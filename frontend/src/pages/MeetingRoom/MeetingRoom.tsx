import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  GridLayout, 
  ParticipantTile,
  useLocalParticipant,
  useTracks
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, 
  Copy, ClipboardCheck, MessageSquare, ShieldAlert
} from 'lucide-react';
import TranscriptionPanel from '../../components/TranscriptionPanel/TranscriptionPanel';
import styles from './MeetingRoom.module.css';

interface RoomDetails {
  roomId: string;
  roomName: string;
  token: string;
  livekitUrl: string;
  role: 'host' | 'guest';
}

export default function MeetingRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTranscription, setShowTranscription] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    checkRoomAccess();
  }, [roomId]);

  const checkRoomAccess = async () => {
    const cachedToken = sessionStorage.getItem(`room_token_${roomId}`);
    const cachedRole = sessionStorage.getItem(`room_role_${roomId}`) as 'host' | 'guest';
    const hostToken = localStorage.getItem('token');

    // Case 1: Host has already initialized the room and has cached token
    if (cachedToken && cachedRole) {
      fetchRoomDetailsWithToken(cachedToken, cachedRole);
      return;
    }

    // Case 2: User has a Host JWT token in local storage, attempt to join automatically
    if (hostToken) {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:8080/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hostToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setRoomDetails(data);
          sessionStorage.setItem(`room_token_${roomId}`, data.token);
          sessionStorage.setItem(`room_role_${roomId}`, data.role);
          return;
        }
      } catch (err) {
        console.error('Failed to auto-join as host:', err);
      } finally {
        setLoading(false);
      }
    }

    // Case 3: No cached token and not auto-joined as host -> must be a Guest, prompt for name
    setShowNamePrompt(true);
  };

  const fetchRoomDetailsWithToken = async (token: string, role: 'host' | 'guest') => {
    try {
      // Just check if room is still active
      const response = await fetch(`http://localhost:8080/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Ping' }), // Dummy ping
      });

      if (!response.ok) {
        throw new Error('Room is no longer active.');
      }
      
      const data = await response.json();
      setRoomDetails({
        roomId: data.roomId,
        roomName: data.roomName,
        token: token,
        livekitUrl: data.livekitUrl,
        role: role
      });
    } catch (err: any) {
      setError(err.message || 'Meeting has ended or is unavailable.');
      sessionStorage.clear();
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:8080/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to join room.');
      }

      setRoomDetails(data);
      sessionStorage.setItem(`room_token_${roomId}`, data.token);
      sessionStorage.setItem(`room_role_${roomId}`, data.role);
      setShowNamePrompt(false);
    } catch (err: any) {
      setError(err.message || 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteLink);
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
          <button className="btn-primary" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show name prompt dialog for guest access
  if (showNamePrompt) {
    return (
      <div className={styles.dialogOverlay}>
        <div className={`${styles.dialog} glass-panel animate-fade`}>
          <h2 className={styles.dialogTitle}>Join Meeting</h2>
          <form onSubmit={handleGuestSubmit} className={styles.dialogForm}>
            <div className={styles.dialogForm} style={{ gap: '8px' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Your Name</label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. Alice Smith"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Joining...' : 'Join Call'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/')} disabled={loading}>
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!roomDetails) {
    return (
      <div className={styles.dialogOverlay}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>Initializing video room...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <LiveKitRoom
        token={roomDetails.token}
        serverUrl={roomDetails.livekitUrl}
        connect={true}
        audio={true}
        video={true}
        data-lk-theme="default"
        style={{ display: 'flex', width: '100%', height: '100%' }}
      >
        <RoomContent 
          roomDetails={roomDetails} 
          showTranscription={showTranscription}
          setShowTranscription={setShowTranscription}
          onCopyLink={handleCopyLink}
          copied={copied}
        />
      </LiveKitRoom>
    </div>
  );
}

interface RoomContentProps {
  roomDetails: RoomDetails;
  showTranscription: boolean;
  setShowTranscription: (val: boolean) => void;
  onCopyLink: () => void;
  copied: boolean;
}

// Inner component to consume LiveKit context hooks
function RoomContent({ roomDetails, showTranscription, setShowTranscription, onCopyLink, copied }: RoomContentProps) {
  const navigate = useNavigate();
  const hostToken = localStorage.getItem('token');

  // LiveKit hooks
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false }
  ]);

  const handleDisconnect = async () => {
    if (roomDetails.role === 'host' && hostToken) {
      if (confirm('Do you want to end this meeting for all participants?')) {
        try {
          await fetch(`http://localhost:8080/api/rooms/${roomDetails.roomId}/end`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${hostToken}` },
          });
        } catch (err) {
          console.error('Failed to end room:', err);
        }
      }
    }
    
    // Clear session storage and disconnect
    sessionStorage.removeItem(`room_token_${roomDetails.roomId}`);
    sessionStorage.removeItem(`room_role_${roomDetails.roomId}`);
    navigate('/');
  };

  return (
    <>
      {/* Left Column: Meeting workspace */}
      <div className={styles.workspace}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.roomInfo}>
            <span className={styles.roomName}>{roomDetails.roomName}</span>
            <span className={styles.badge}>
              {roomDetails.role === 'host' ? 'Host' : 'Guest'}
            </span>
          </div>
          <div className={styles.headerActions}>
            <button 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '14px' }}
              onClick={onCopyLink}
            >
              {copied ? <ClipboardCheck size={16} className="text-secondary" /> : <Copy size={16} />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
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
          <button 
            className={`${styles.controlBtn} ${isMicrophoneEnabled ? styles.controlBtnActive : ''}`}
            onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            title={isMicrophoneEnabled ? 'Mute Mic' : 'Unmute Mic'}
          >
            {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          
          <button 
            className={`${styles.controlBtn} ${isCameraEnabled ? styles.controlBtnActive : ''}`}
            onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
            title={isCameraEnabled ? 'Stop Video' : 'Start Video'}
          >
            {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button 
            className={`${styles.controlBtn} ${isScreenShareEnabled ? styles.controlBtnActive : ''}`}
            onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
            title={isScreenShareEnabled ? 'Stop Sharing' : 'Share Screen'}
          >
            <Monitor size={20} />
          </button>

          <div className={styles.divider} />

          <button 
            className={`${styles.controlBtn} ${showTranscription ? styles.controlBtnActive : ''}`}
            onClick={() => setShowTranscription(!showTranscription)}
            title="Toggle Live Transcript"
          >
            <MessageSquare size={20} />
          </button>

          <button 
            className={`${styles.controlBtn} ${styles.controlBtnDanger}`}
            onClick={handleDisconnect}
            title={roomDetails.role === 'host' ? 'End Meeting' : 'Leave Meeting'}
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {/* LiveKit audio renderer component to play incoming audio */}
        <RoomAudioRenderer />
      </div>

      {/* Right Column: Sliding transcription sidebar */}
      {showTranscription && (
        <TranscriptionPanel 
          room={localParticipant.room} 
          roomId={roomDetails.roomId}
          onClose={() => setShowTranscription(false)}
        />
      )}
    </>
  );
}
