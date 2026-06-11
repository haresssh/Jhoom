import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button, 
  IconButton, 
  Alert 
} from '@mui/material';
import styles from './PreJoinLobby.module.css';

interface PreJoinLobbyProps {
  roomName: string;
  description?: string;
  defaultMicEnabled: boolean;
  defaultCameraEnabled: boolean;
  onJoin: (
    displayName: string,
    micEnabled: boolean,
    cameraEnabled: boolean,
    audioDeviceId: string,
    videoDeviceId: string
  ) => void;
  isHost: boolean;
  initialName?: string;
  loading?: boolean;
}

export default function PreJoinLobby({
  roomName,
  description,
  defaultMicEnabled,
  defaultCameraEnabled,
  onJoin,
  isHost,
  initialName = '',
  loading = false,
}: PreJoinLobbyProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [isMicOn, setIsMicOn] = useState(defaultMicEnabled);
  const [isCameraOn, setIsCameraOn] = useState(defaultCameraEnabled);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Synchronize initialName when it updates
  useEffect(() => {
    if (initialName) {
      setDisplayName(initialName);
    }
  }, [initialName]);

  // Request permissions & setup devices
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function setupPreview() {
      try {
        // Stop any existing stream tracks first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');

        setVideoDevices(videoInputs);
        setAudioDevices(audioInputs);

        // Auto-select first device if none selected
        let videoId = selectedVideoDevice;
        if (videoInputs.length > 0 && !videoId) {
          videoId = videoInputs[0].deviceId;
          setSelectedVideoDevice(videoId);
        }

        let audioId = selectedAudioDevice;
        if (audioInputs.length > 0 && !audioId) {
          audioId = audioInputs[0].deviceId;
          setSelectedAudioDevice(audioId);
        }

        // Only acquire tracks if toggled on
        if (isCameraOn || isMicOn) {
          const constraints: MediaStreamConstraints = {
            video: isCameraOn
              ? { deviceId: videoId ? videoId : undefined }
              : false,
            audio: isMicOn
              ? { deviceId: audioId ? audioId : undefined }
              : false,
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          activeStream = stream;
          streamRef.current = stream;
          setLocalStream(stream);
        } else {
          streamRef.current = null;
          setLocalStream(null);
        }
      } catch (err) {
        console.error('Failed to get media devices for preview:', err);
        streamRef.current = null;
        setLocalStream(null);
      }
    }

    setupPreview();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isMicOn, isCameraOn, selectedVideoDevice, selectedAudioDevice]);

  // Handle setting stream to video element when it mounts
  useEffect(() => {
    if (videoRef.current && localStream && isCameraOn) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOn]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost && !displayName.trim()) return;

    // Clean up local tracks before transitioning to LiveKit
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    onJoin(
      isHost ? initialName : displayName.trim(),
      isMicOn,
      isCameraOn,
      selectedAudioDevice,
      selectedVideoDevice
    );
  };

  return (
    <div className={styles.lobbyContainer}>
      <div className={`${styles.lobbyCard} glass-panel animate-fade`}>
        {/* Left: Video Preview Box */}
        <div className={styles.previewSection}>
          <div className={styles.videoWrapper}>
            {isCameraOn && localStream?.getVideoTracks().length ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.previewVideo}
              />
            ) : (
              <div className={styles.cameraOffPlaceholder}>
                <VideoOff size={48} />
                <span className={styles.placeholderText}>Camera is off</span>
              </div>
            )}
          </div>

          <div className={styles.previewControls}>
            <IconButton
              onClick={() => setIsMicOn(!isMicOn)}
              color={isMicOn ? "primary" : "error"}
              style={{
                backgroundColor: isMicOn ? 'rgba(4, 96, 255, 0.1)' : 'rgba(255, 53, 53, 0.1)',
                width: '48px',
                height: '48px'
              }}
              title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
              disabled={loading}
            >
              {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </IconButton>

            <IconButton
              onClick={() => setIsCameraOn(!isCameraOn)}
              color={isCameraOn ? "primary" : "error"}
              style={{
                backgroundColor: isCameraOn ? 'rgba(4, 96, 255, 0.1)' : 'rgba(255, 53, 53, 0.1)',
                width: '48px',
                height: '48px'
              }}
              title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              disabled={loading}
            >
              {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
            </IconButton>
          </div>
        </div>

        {/* Right: Joining Form & Settings */}
        <div className={styles.formSection}>
          <div>
            <h1 className={styles.title}>{roomName}</h1>
            {description && <p className={styles.subtitle}>{description}</p>}
          </div>

          {/* Join policies notices */}
          {(!defaultMicEnabled || !defaultCameraEnabled) && (
            <Alert severity="warning" style={{ borderRadius: '8px' }}>
              Mic/Camera are disabled by default in this room.
            </Alert>
          )}

          <form onSubmit={handleSubmit} className={styles.formSection} style={{ gap: '16px' }}>
            {!isHost && (
              <TextField
                label="Your Display Name"
                variant="outlined"
                placeholder="e.g. Alice Smith"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={loading}
                fullWidth
              />
            )}

            {isHost && (
              <TextField
                label="Joining as Host"
                variant="outlined"
                value={displayName || 'Host'}
                disabled
                fullWidth
              />
            )}

            {/* Hardware Selectors */}
            <div className={styles.deviceSettings}>
              <span className={styles.settingsTitle}>Device Settings</span>

              <FormControl fullWidth variant="outlined" style={{ marginTop: '8px' }}>
                <InputLabel id="mic-select-label">Microphone</InputLabel>
                <Select
                  labelId="mic-select-label"
                  value={selectedAudioDevice}
                  onChange={(e) => setSelectedAudioDevice(e.target.value)}
                  label="Microphone"
                  disabled={loading}
                >
                  {audioDevices.map((device) => (
                    <MenuItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone (${device.deviceId.substring(0, 5)})`}
                    </MenuItem>
                  ))}
                  {audioDevices.length === 0 && (
                    <MenuItem value="">No microphone detected</MenuItem>
                  )}
                </Select>
              </FormControl>

              <FormControl fullWidth variant="outlined" style={{ marginTop: '8px' }}>
                <InputLabel id="camera-select-label">Camera</InputLabel>
                <Select
                  labelId="camera-select-label"
                  value={selectedVideoDevice}
                  onChange={(e) => setSelectedVideoDevice(e.target.value)}
                  label="Camera"
                  disabled={loading}
                >
                  {videoDevices.map((device) => (
                    <MenuItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera (${device.deviceId.substring(0, 5)})`}
                    </MenuItem>
                  ))}
                  {videoDevices.length === 0 && (
                    <MenuItem value="">No camera detected</MenuItem>
                  )}
                </Select>
              </FormControl>
            </div>

            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
              size="large"
              fullWidth
              style={{ height: '48px', marginTop: '16px' }}
            >
              {isHost ? 'Start Meeting' : 'Join Call'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
