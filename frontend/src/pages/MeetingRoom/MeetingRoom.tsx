import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  GridLayout, 
  ParticipantTile,
  useLocalParticipant,
  useTracks,
  useRoomContext,
  useConnectionState,
  useParticipants
} from '@livekit/components-react';
import { Track, ConnectionState, RoomEvent } from 'livekit-client';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, 
  ClipboardCheck, MessageSquare, ShieldAlert, Share2, Users
} from 'lucide-react';
import TranscriptionPanel from '../../components/TranscriptionPanel/TranscriptionPanel';
import type { TranscriptMessage } from '../../components/TranscriptionPanel/TranscriptionPanel';
import ParticipantsPanel from '../../components/ParticipantsPanel/ParticipantsPanel';
import PreJoinLobby from './PreJoinLobby';
import { API_BASE_URL } from '../../config';
import { 
  CircularProgress, Card, Button, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions 
} from '@mui/material';
import styles from './MeetingRoom.module.css';

interface RoomDetails {
  roomId: string;
  roomName: string;
  token: string;
  livekitUrl: string;
  role: 'host' | 'guest';
  description?: string;
  maxParticipants?: number;
  isMutedOnJoin?: boolean;
  isCameraOffOnJoin?: boolean;
  isApprovalRequired?: boolean;
}

export default function MeetingRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [roomMetadata, setRoomMetadata] = useState<any | null>(null);
  const [showLobby, setShowLobby] = useState(true);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [joinRequestId, setJoinRequestId] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [showTranscription, setShowTranscription] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // User media selections from Lobby
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [audioDeviceId, setAudioDeviceId] = useState('');
  const [videoDeviceId, setVideoDeviceId] = useState('');

  const hostToken = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const isHost = !!hostToken;

  // Always show the PreJoinLobby first — fetch room metadata
  useEffect(() => {
    if (!roomId) return;
    fetchRoomMetadata();
  }, [roomId]);

  // Poll status when guest is waiting for host approval
  useEffect(() => {
    if (!isWaitingForApproval || !joinRequestId || !roomId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/requests/${joinRequestId}/status`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'APPROVED') {
            clearInterval(interval);
            setIsWaitingForApproval(false);
            setRoomDetails({
              roomId: data.roomId,
              roomName: roomMetadata?.roomName || '',
              token: data.token,
              livekitUrl: roomMetadata?.livekitUrl || '',
              role: 'guest',
              description: roomMetadata?.description,
              maxParticipants: roomMetadata?.maxParticipants,
              isMutedOnJoin: roomMetadata?.isMutedOnJoin,
              isCameraOffOnJoin: roomMetadata?.isCameraOffOnJoin,
              isApprovalRequired: roomMetadata?.isApprovalRequired
            });
            setShowLobby(false);
          } else if (data.status === 'DENIED') {
            clearInterval(interval);
            setIsWaitingForApproval(false);
            setError("The host has denied your request to join the meeting.");
          }
        }
      } catch (err) {
        console.error("Error polling request status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isWaitingForApproval, joinRequestId, roomId, roomMetadata]);

  const fetchRoomMetadata = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/metadata`);
      if (response.ok) {
        const data = await response.json();
        setRoomMetadata(data);
        setMicEnabled(!data.isMutedOnJoin);
        setCameraEnabled(!data.isCameraOffOnJoin);
      } else {
        navigate(`/left-meeting/${roomId}`);
      }
    } catch (err: any) {
      navigate(`/left-meeting/${roomId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLobbyJoin = async (
    name: string,
    mic: boolean,
    camera: boolean,
    audioDevice: string,
    videoDevice: string
  ) => {
    setMicEnabled(mic);
    setCameraEnabled(camera);
    setAudioDeviceId(audioDevice);
    setVideoDeviceId(videoDevice);

    setLoading(true);
    setError('');

    try {
      // 1. Host Join
      if (isHost) {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hostToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setRoomDetails(data);
          setShowLobby(false);
        } else {
          throw new Error("Failed to join as host.");
        }
        return;
      }

      // 2. Guest with Approval Required
      if (roomMetadata?.isApprovalRequired || roomMetadata?.approvalRequired) {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: name }),
        });

        if (response.ok) {
          const data = await response.json();
          setJoinRequestId(data.requestId);
          setIsWaitingForApproval(true);
        } else {
          const errData = await response.json();
          throw new Error(errData.message || "Failed to submit entry request.");
        }
      } else {
        // 3. Guest with direct entry
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: name }),
        });

        if (response.ok) {
          const data = await response.json();
          setRoomDetails(data);
          setShowLobby(false);
        } else {
          const errData = await response.json();
          throw new Error(errData.message || "Failed to join meeting.");
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join meeting.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareLink = () => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    copyToClipboard(inviteLink);
  };

  const copyToClipboard = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div className={styles.dialogOverlay}>
        <div className={`${styles.dialog} glass-panel`} style={{ textAlign: 'center', gap: '16px' }}>
          <ShieldAlert size={48} style={{ color: 'var(--error)', margin: '0 auto' }} />
          <h2 className={styles.dialogTitle}>Connection Failed</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => navigate('/')}
            style={{ borderRadius: '20px', textTransform: 'none', marginTop: '16px' }}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Show Waiting Lobby for Approval
  if (isWaitingForApproval) {
    return (
      <div className={styles.dialogOverlay}>
        <div className="glass-panel animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px', maxWidth: '400px', textAlign: 'center' }}>
          <CircularProgress color="primary" />
          <h2 className={styles.dialogTitle}>Waiting for Host</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Please wait, the host will let you join shortly.
          </p>
          <Button variant="outlined" color="primary" onClick={() => {
            setIsWaitingForApproval(false);
            setJoinRequestId(null);
          }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Render Pre-Join green room lobby
  if (showLobby && roomMetadata) {
    return (
      <PreJoinLobby
        roomName={roomMetadata.roomName}
        description={roomMetadata.description}
        defaultMicEnabled={!roomMetadata.isMutedOnJoin}
        defaultCameraEnabled={!roomMetadata.isCameraOffOnJoin}
        onJoin={handleLobbyJoin}
        isHost={isHost}
        initialName={isHost ? (username || '') : ''}
        loading={loading}
      />
    );
  }

  if (!roomDetails) {
    return (
      <div className={styles.dialogOverlay}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <CircularProgress color="primary" />
          <div style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>Initializing video room...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <LiveKitRoom
        token={roomDetails.token}
        serverUrl={roomDetails.livekitUrl}
        connect={true}
        audio={false}
        video={false}
        options={{
          videoCaptureDefaults: {
            deviceId: videoDeviceId || undefined
          },
          audioCaptureDefaults: {
            deviceId: audioDeviceId || undefined
          }
        }}
        data-lk-theme="default"
        style={{ display: 'flex', width: '100%', height: '100%' }}
      >
        <RoomContent 
          roomDetails={roomDetails} 
          showTranscription={showTranscription}
          setShowTranscription={setShowTranscription}
          onShareLink={handleShareLink}
          copied={copied}
          initialMicEnabled={micEnabled}
          initialCameraEnabled={cameraEnabled}
        />
      </LiveKitRoom>
    </div>
  );
}

interface RoomContentProps {
  roomDetails: RoomDetails;
  showTranscription: boolean;
  setShowTranscription: (val: boolean) => void;
  onShareLink: () => void;
  copied: boolean;
  initialMicEnabled: boolean;
  initialCameraEnabled: boolean;
}

// Inner component to consume LiveKit context hooks
function RoomContent({ 
  roomDetails, showTranscription, setShowTranscription, 
  onShareLink, copied, initialMicEnabled, initialCameraEnabled 
}: RoomContentProps) {
  const navigate = useNavigate();
  const hostToken = localStorage.getItem('token');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [mediaInitialized, setMediaInitialized] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isTranscriptionStopped, setIsTranscriptionStopped] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: ''
  });

  // LiveKit hooks
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false }
  ]);
  const participants = useParticipants();

  // Enable mic/camera AFTER the room is fully connected
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected || mediaInitialized) return;
    
    const enableMedia = async () => {
      try {
        if (initialMicEnabled) {
          await localParticipant.setMicrophoneEnabled(true);
        }
        if (initialCameraEnabled) {
          await localParticipant.setCameraEnabled(true);
        }
      } catch (err) {
        console.warn("Failed to enable initial media:", err);
      } finally {
        setMediaInitialized(true);
      }
    };

    // Small delay to ensure engine is fully ready
    const timer = setTimeout(enableMedia, 300);
    return () => clearTimeout(timer);
  }, [connectionState, mediaInitialized, initialMicEnabled, initialCameraEnabled, localParticipant]);

  // Listen for Room Disconnected event (e.g. host ended the meeting)
  useEffect(() => {
    const handleDisconnected = (reason?: any) => {
      console.log("Room disconnected. Reason:", reason);
      sessionStorage.removeItem(`room_token_${roomDetails.roomId}`);
      sessionStorage.removeItem(`room_role_${roomDetails.roomId}`);
      navigate(`/left-meeting/${roomDetails.roomId}`);
    };

    room.on(RoomEvent.Disconnected, handleDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room, roomDetails.roomId, navigate]);

  const showAlert = useCallback((title: string, message: string) => {
    setAlertDialog({ open: true, title, message });
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (!localParticipant || connectionState !== ConnectionState.Connected) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err: any) {
      console.error("Failed to toggle microphone:", err);
      showAlert("Microphone Access Error", err.message || err.toString());
    }
  }, [localParticipant, connectionState, isMicrophoneEnabled, showAlert]);

  const toggleCamera = useCallback(async () => {
    if (!localParticipant || connectionState !== ConnectionState.Connected) return;
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err: any) {
      console.error("Failed to toggle camera:", err);
      showAlert("Camera Access Error", err.message || err.toString());
    }
  }, [localParticipant, connectionState, isCameraEnabled, showAlert]);

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant || connectionState !== ConnectionState.Connected) return;
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (err: any) {
      console.error("Failed to toggle screen share:", err);
      showAlert("Screen Share Error", err.message || err.toString());
    }
  }, [localParticipant, connectionState, isScreenShareEnabled, showAlert]);

  // Host pending requests polling loop
  useEffect(() => {
    if (roomDetails.role !== 'host') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomDetails.roomId}/requests/pending`, {
          headers: { Authorization: `Bearer ${hostToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          setPendingRequests(data);
        }
      } catch (err) {
        console.error("Failed to fetch pending requests:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [roomDetails.roomId, roomDetails.role, hostToken]);

  // Listen for host commands (mute, kick, transcription control)
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;

    const handleDataReceived = (payload: Uint8Array, _participant?: any) => {
      try {
        const decoded = new TextDecoder().decode(payload);
        const data = JSON.parse(decoded);

        if (data.type === 'remote-mute') {
          if (data.targetIdentity === localParticipant.identity) {
            console.log("Muted by host request");
            localParticipant.setMicrophoneEnabled(false).catch(err => {
              console.error("Failed to apply remote mute:", err);
            });
            showAlert("Muted by Host", "The host has muted your microphone.");
          }
        } else if (data.type === 'remote-kick') {
          if (data.targetIdentity === localParticipant.identity) {
            console.log("Kicked by host request");
            room.disconnect();
            sessionStorage.removeItem(`room_token_${roomDetails.roomId}`);
            sessionStorage.removeItem(`room_role_${roomDetails.roomId}`);
            navigate('/', { state: { alertMessage: 'You have been removed from the meeting by the host.' } });
          }
        } else if (data.type === 'room-ended') {
          console.log("Meeting ended by host");
          room.disconnect();
          sessionStorage.removeItem(`room_token_${roomDetails.roomId}`);
          sessionStorage.removeItem(`room_role_${roomDetails.roomId}`);
          navigate(`/left-meeting/${roomDetails.roomId}?reason=ended`);
        } else if (data.type === 'transcription-control') {
          console.log("Transcription control update:", data.stopped);
          setIsTranscriptionStopped(data.stopped);
          if (data.stopped) {
            showAlert("Transcription Paused", "The host has paused live transcription generation for this meeting.");
          } else {
            showAlert("Transcription Resumed", "The host has resumed live transcription generation for this meeting.");
          }
        }
      } catch (err) {
        console.error("Error handling incoming host control command:", err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, connectionState, localParticipant, roomDetails.roomId, navigate, showAlert]);

  const handleMuteParticipant = useCallback((targetIdentity: string) => {
    console.log("Requesting to mute participant:", targetIdentity);
    const payload = JSON.stringify({
      type: 'remote-mute',
      targetIdentity
    });
    try {
      room.localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true }
      );
    } catch (err) {
      console.error("Failed to publish remote-mute command:", err);
    }
  }, [room]);

  const handleKickParticipant = useCallback((targetIdentity: string) => {
    console.log("Requesting to kick participant:", targetIdentity);
    const payload = JSON.stringify({
      type: 'remote-kick',
      targetIdentity
    });
    try {
      room.localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true }
      );
    } catch (err) {
      console.error("Failed to publish remote-kick command:", err);
    }
  }, [room]);

  const handleToggleTranscriptionGlobal = useCallback((currentlyStopped: boolean) => {
    const nextStopped = !currentlyStopped;
    setIsTranscriptionStopped(nextStopped);

    const payload = JSON.stringify({
      type: 'transcription-control',
      stopped: nextStopped
    });
    try {
      room.localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true }
      );
    } catch (err) {
      console.error("Failed to publish transcription-control command:", err);
    }
  }, [room]);

  const handleApprove = async (requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hostToken}` }
      });
      if (response.ok) {
        setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
      }
    } catch (err) {
      console.error("Failed to approve request:", err);
    }
  };

  const handleDeny = async (requestId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms/requests/${requestId}/deny`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hostToken}` }
      });
      if (response.ok) {
        setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
      }
    } catch (err) {
      console.error("Failed to deny request:", err);
    }
  };

  const handleLeaveConfirm = () => {
    sessionStorage.removeItem(`room_token_${roomDetails.roomId}`);
    sessionStorage.removeItem(`room_role_${roomDetails.roomId}`);
    setConfirmLeaveOpen(false);
    navigate(`/left-meeting/${roomDetails.roomId}`);
  };

  const handleEndConfirm = async () => {
    if (roomDetails.role === 'host') {
      // Broadcast room-ended message to all participants via LiveKit data channel
      const payload = JSON.stringify({ type: 'room-ended' });
      try {
        await room.localParticipant.publishData(
          new TextEncoder().encode(payload),
          { reliable: true }
        );
      } catch (err) {
        console.error('Failed to broadcast room-ended message:', err);
      }

      if (hostToken) {
        try {
          await fetch(`${API_BASE_URL}/api/rooms/${roomDetails.roomId}/end`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${hostToken}` },
          });
        } catch (err) {
          console.error('Failed to end room:', err);
        }
      }
    }
    room.disconnect();
    sessionStorage.removeItem(`room_token_${roomDetails.roomId}`);
    sessionStorage.removeItem(`room_role_${roomDetails.roomId}`);
    setConfirmLeaveOpen(false);
    navigate(`/left-meeting/${roomDetails.roomId}?reason=ended`);
  };

  const isConnecting = connectionState !== ConnectionState.Connected;

  return (
    <>
      {/* Left Column: Meeting workspace */}
      <div className={styles.workspace}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.roomInfoContainer}>
            <div className={styles.roomInfo}>
              <span className={styles.roomName}>{roomDetails.roomName}</span>
              <span className={styles.badge}>
                {roomDetails.role === 'host' ? 'Host' : 'Guest'}
              </span>
              {isConnecting && (
                <span className={styles.badge} style={{ background: 'rgba(255, 170, 0, 0.1)', color: '#e67e00', borderColor: 'rgba(255, 170, 0, 0.3)' }}>
                  Connecting...
                </span>
              )}
            </div>
            {roomDetails.description && (
              <span className={styles.roomDescription} title={roomDetails.description}>
                {roomDetails.description}
              </span>
            )}
          </div>
          <div className={styles.headerActions}>
            {roomDetails.role === 'host' && (
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={copied ? <ClipboardCheck size={16} /> : <Share2 size={16} />}
                onClick={onShareLink}
                style={{ borderRadius: '20px', textTransform: 'none' }}
              >
                {copied ? 'Copied!' : 'Share Link'}
              </Button>
            )}
          </div>
        </div>

        {/* Video Grid */}
        <div className={styles.gridContainer}>
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        </div>

        {/* Floating bottom controls bar */}
        <div className={`${styles.controlsBar} glass-panel`}>
          <Tooltip title={isMicrophoneEnabled ? 'Mute Mic' : 'Unmute Mic'}>
            <span>
              <IconButton 
                onClick={toggleMicrophone}
                disabled={isConnecting}
                color={isMicrophoneEnabled ? "primary" : "default"}
                style={{
                  backgroundColor: isMicrophoneEnabled ? 'rgba(4, 96, 255, 0.1)' : 'rgba(31, 52, 86, 0.05)',
                  width: '44px',
                  height: '44px',
                  opacity: isConnecting ? 0.5 : 1
                }}
              >
                {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title={isCameraEnabled ? 'Stop Video' : 'Start Video'}>
            <span>
              <IconButton 
                onClick={toggleCamera}
                disabled={isConnecting}
                color={isCameraEnabled ? "primary" : "default"}
                style={{
                  backgroundColor: isCameraEnabled ? 'rgba(4, 96, 255, 0.1)' : 'rgba(31, 52, 86, 0.05)',
                  width: '44px',
                  height: '44px',
                  opacity: isConnecting ? 0.5 : 1
                }}
              >
                {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={isScreenShareEnabled ? 'Stop Sharing' : 'Share Screen'}>
            <span>
              <IconButton 
                onClick={toggleScreenShare}
                disabled={isConnecting}
                color={isScreenShareEnabled ? "primary" : "default"}
                style={{
                  backgroundColor: isScreenShareEnabled ? 'rgba(4, 96, 255, 0.1)' : 'rgba(31, 52, 86, 0.05)',
                  width: '44px',
                  height: '44px',
                  opacity: isConnecting ? 0.5 : 1
                }}
              >
                <Monitor size={20} />
              </IconButton>
            </span>
          </Tooltip>

          <div className={styles.divider} />

          <Tooltip title={showParticipants ? 'Hide Participants' : 'Show Participants'}>
            <span>
              <IconButton 
                onClick={() => setShowParticipants(!showParticipants)}
                disabled={isConnecting}
                color={showParticipants ? "primary" : "default"}
                style={{
                  backgroundColor: showParticipants ? 'rgba(4, 96, 255, 0.1)' : 'rgba(31, 52, 86, 0.05)',
                  width: '44px',
                  height: '44px',
                  opacity: isConnecting ? 0.5 : 1
                }}
              >
                <Users size={20} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Toggle Live Transcript">
            <IconButton 
              onClick={() => setShowTranscription(!showTranscription)}
              color={showTranscription ? "primary" : "default"}
              style={{
                backgroundColor: showTranscription ? 'rgba(4, 96, 255, 0.1)' : 'rgba(31, 52, 86, 0.05)',
                width: '44px',
                height: '44px'
              }}
            >
              <MessageSquare size={20} />
            </IconButton>
          </Tooltip>

          <Tooltip title={roomDetails.role === 'host' ? 'End Meeting' : 'Leave Meeting'}>
            <IconButton 
              onClick={() => setConfirmLeaveOpen(true)}
              color="error"
              style={{
                backgroundColor: 'rgba(255, 53, 53, 0.1)',
                width: '44px',
                height: '44px'
              }}
            >
              <PhoneOff size={20} />
            </IconButton>
          </Tooltip>
        </div>

        {/* LiveKit audio renderer component to play incoming audio */}
        <RoomAudioRenderer />
      </div>

      {/* Right Column: Sliding sidebar hosting panels vertically (upside down) */}
      {(showTranscription || showParticipants) && (
        <div className={styles.sidebar}>
          {showParticipants && (
            <div style={{ flex: showTranscription ? '0 0 45%' : '1 1 100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <ParticipantsPanel
                participants={participants}
                localParticipant={room.localParticipant}
                isHost={roomDetails.role === 'host'}
                onMuteParticipant={handleMuteParticipant}
                onKickParticipant={handleKickParticipant}
                onClose={() => setShowParticipants(false)}
              />
            </div>
          )}
          {showParticipants && showTranscription && (
            <div style={{ height: '1px', backgroundColor: 'rgba(31, 52, 86, 0.08)' }} />
          )}
          {showTranscription && (
            <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <TranscriptionPanel 
                room={room} 
                roomId={roomDetails.roomId}
                onClose={() => setShowTranscription(false)}
                messages={messages}
                setMessages={setMessages}
                isTranscriptionStopped={isTranscriptionStopped}
                isHost={roomDetails.role === 'host'}
                onToggleTranscriptionGlobal={handleToggleTranscriptionGlobal}
              />
            </div>
          )}
        </div>
      )}

      {/* Pending requests overlay for host */}
      {pendingRequests.length > 0 && (
        <div className={styles.requestsOverlay}>
          {pendingRequests.map(req => (
            <Card key={req.requestId} className={`${styles.requestCard} glass-panel animate-slide-right`} style={{ background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(4, 96, 255, 0.2)' }}>
              <div className={styles.requestInfo}>
                <span className={styles.requestName}>{req.displayName}</span>
                <span className={styles.requestText}>wants to join this meeting</span>
              </div>
              <div className={styles.requestActions}>
                <Button variant="contained" color="primary" size="small" style={{ height: '32px' }} onClick={() => handleApprove(req.requestId)}>
                  Admit
                </Button>
                <Button variant="outlined" color="primary" size="small" style={{ height: '32px' }} onClick={() => handleDeny(req.requestId)}>
                  Deny
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Leave / End Meeting Confirmation Modal */}
      <Dialog
        open={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '16px',
            padding: '8px',
            maxWidth: '400px',
            background: '#ffffff'
          }
        }}
      >
        <DialogTitle style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {roomDetails.role === 'host' ? 'End or Leave Meeting?' : 'Leave Meeting?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: 'var(--text-secondary)' }}>
            {roomDetails.role === 'host'
              ? 'As the host, do you want to end this meeting for everyone, or simply leave the room yourself?'
              : 'Are you sure you want to leave this meeting call?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions style={{ padding: '16px 24px', gap: '8px' }}>
          <Button 
            onClick={() => setConfirmLeaveOpen(false)} 
            variant="outlined" 
            color="primary"
            style={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          
          <Button 
            onClick={handleLeaveConfirm} 
            variant="contained" 
            color="primary"
            style={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600 }}
          >
            {roomDetails.role === 'host' ? 'Just Leave' : 'Leave'}
          </Button>

          {roomDetails.role === 'host' && (
            <Button 
              onClick={handleEndConfirm} 
              variant="contained" 
              color="error"
              style={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600 }}
            >
              End for All
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Permission / General Error Alert Dialog */}
      <Dialog
        open={alertDialog.open}
        onClose={() => setAlertDialog(prev => ({ ...prev, open: false }))}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '16px',
            padding: '8px',
            maxWidth: '400px',
            background: '#ffffff'
          }
        }}
      >
        <DialogTitle style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{alertDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: 'var(--text-secondary)' }}>
            {alertDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions style={{ padding: '16px 24px' }}>
          <Button 
            onClick={() => setAlertDialog(prev => ({ ...prev, open: false }))} 
            variant="contained" 
            color="primary"
            style={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600 }}
            autoFocus
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
