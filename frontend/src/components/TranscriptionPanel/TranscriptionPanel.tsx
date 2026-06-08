import React, { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { Mic, X, MessageSquare, AlertCircle } from 'lucide-react';
import styles from './TranscriptionPanel.module.css';

interface TranscriptionPanelProps {
  room: Room;
  roomId: string;
  onClose: () => void;
}

interface TranscriptMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: Date;
  speakerTag: number;
}

interface ActiveTranscript {
  text: string;
  speakerTag: number;
}

export default function TranscriptionPanel({ room, roomId, onClose }: TranscriptionPanelProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [activeTranscripts, setActiveTranscripts] = useState<Record<String, ActiveTranscript>>({});
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [micPermissionError, setMicPermissionError] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript container to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, activeTranscripts]);

  useEffect(() => {
    // 1. Listen for incoming LiveKit Data Channel messages from OTHER participants
    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const decoded = new TextDecoder().decode(payload);
        const data = JSON.parse(decoded);

        if (data.type === 'transcript') {
          const sender = data.senderName || participant?.identity || 'Anonymous';
          
          if (data.isFinal) {
            // Remove from active interim transcripts and add to final message list
            setActiveTranscripts(prev => {
              const updated = { ...prev };
              delete updated[sender];
              return updated;
            });

            setMessages(prev => [
              ...prev,
              {
                id: `${sender}-${Date.now()}`,
                senderName: sender,
                text: data.text,
                timestamp: new Date(),
                speakerTag: data.speakerTag ?? 0
              }
            ]);
          } else {
            // Update active interim transcript
            setActiveTranscripts(prev => ({
              ...prev,
              [sender]: {
                text: data.text,
                speakerTag: data.speakerTag ?? 0
              }
            }));
          }
        }
      } catch (err) {
        console.error('Error parsing received data channel message:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    
    // Start local transcription capturing
    startLocalTranscription();

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      stopLocalTranscription();
    };
  }, [room, roomId]);

  const startLocalTranscription = async () => {
    setConnectionStatus('connecting');
    setMicPermissionError(false);

    try {
      // 1. Request microphone access from browser
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setMicPermissionError(true);
      setConnectionStatus('error');
      return;
    }

    try {
      // 2. Fetch short-lived ephemeral Deepgram token from backend
      const response = await fetch(`http://localhost:8080/api/transcription/token?roomId=${roomId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Deepgram token');
      }
      const data = await response.json();
      const ephemeralToken = data.token;

      // 3. Select supported audio MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (!MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = ''; // Let browser decide fallback
      }

      // 4. Open WebSocket connection to Deepgram
      // Pass token inside sub-protocols parameters to satisfy browser security rules
      const wsUrl = 'wss://api.deepgram.com/v1/listen?encoding=webm-opus&sample_rate=16000&diarize=true&interim_results=true&endpointing=300';
      const ws = new WebSocket(wsUrl, ['token', ephemeralToken]);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        
        // 5. Initialize and start MediaRecorder once WebSocket is open
        const mediaRecorder = mimeType 
          ? new MediaRecorder(audioStreamRef.current!, { mimeType })
          : new MediaRecorder(audioStreamRef.current!);
          
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        // Pipe audio chunks to Deepgram every 250 milliseconds
        mediaRecorder.start(250);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const transcript = parsed.channel?.alternatives?.[0]?.transcript;
          if (!transcript || !transcript.trim()) return;

          const isFinal = parsed.is_final;
          
          // Extract Deepgram diarization speaker tag from words list
          const words = parsed.channel?.alternatives?.[0]?.words;
          const speakerTag = words && words.length > 0 ? (words[0].speaker ?? 0) : 0;
          const localName = room.localParticipant.name || room.localParticipant.identity;

          // Render local transcription directly to UI to save latency
          if (isFinal) {
            setActiveTranscripts(prev => {
              const updated = { ...prev };
              delete updated[localName];
              return updated;
            });

            setMessages(prev => [
              ...prev,
              {
                id: `local-${Date.now()}`,
                senderName: localName,
                text: transcript,
                timestamp: new Date(),
                speakerTag
              }
            ]);
          } else {
            setActiveTranscripts(prev => ({
              ...prev,
              [localName]: { text: transcript, speakerTag }
            }));
          }

          // 6. Broadcast transcription JSON via LiveKit Data Channel to other participants
          const payload = JSON.stringify({
            type: 'transcript',
            text: transcript,
            isFinal,
            speakerTag,
            senderName: localName
          });
          
          room.localParticipant.publishData(
            new TextEncoder().encode(payload),
            { reliable: true }
          );
        } catch (err) {
          console.error('Error handling Deepgram WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('Deepgram WebSocket error:', err);
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        logger.info('Deepgram WebSocket connection closed');
        if (connectionStatus !== 'error') {
          setConnectionStatus('disconnected');
        }
      };
    } catch (err) {
      console.error('Failed to initialize Deepgram WebSocket:', err);
      setConnectionStatus('error');
    }
  };

  const stopLocalTranscription = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    mediaRecorderRef.current = null;
    socketRef.current = null;
    audioStreamRef.current = null;
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Transcription Active';
      case 'connecting': return 'Connecting AI...';
      case 'error': return 'AI Offline';
      default: return 'Disconnected';
    }
  };

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <MessageSquare size={18} className="text-primary" />
          <span>Live Transcript</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} title="Close Panel">
          <X size={18} />
        </button>
      </div>

      {/* Main scrolling transcripts area */}
      <div ref={containerRef} className={styles.transcriptContainer}>
        {micPermissionError && (
          <div className={styles.warningBanner}>
            <AlertCircle size={18} style={{ marginBottom: '4px' }} />
            <div><strong>Microphone Access Required</strong></div>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              Microphone permission was denied. Live transcription has been disabled. Please enable mic access in your browser settings and try again.
            </div>
          </div>
        )}

        {/* Display Final Messages */}
        {messages.map((msg) => (
          <div key={msg.id} className={styles.message}>
            <div className={styles.meta}>
              <span className={styles.speaker}>
                {msg.senderName} (Speaker {msg.speakerTag})
              </span>
              <span className={styles.time}>
                {msg.timestamp.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            </div>
            <div className={styles.text}>{msg.text}</div>
          </div>
        ))}

        {/* Display active interim (real-time updating) transcripts */}
        {Object.entries(activeTranscripts).map(([sender, active]) => (
          <div key={`interim-${sender}`} className={styles.message}>
            <div className={styles.meta}>
              <span className={styles.speaker} style={{ color: 'var(--text-secondary)' }}>
                {sender} (Speaker {active.speakerTag})
              </span>
            </div>
            <div className={`${styles.text} ${styles.interim}`}>{active.text}</div>
          </div>
        ))}

        {messages.length === 0 && Object.keys(activeTranscripts).length === 0 && !micPermissionError && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            <Mic size={24} style={{ marginRight: '8px', opacity: 0.5 }} />
            <span>Speak to see transcription...</span>
          </div>
        )}
      </div>

      {/* Footer Connection Status Bar */}
      <div className={styles.statusIndicator}>
        <div className={`${styles.statusDot} ${
          connectionStatus === 'connected' ? styles.statusConnected :
          connectionStatus === 'connecting' ? styles.statusConnecting :
          connectionStatus === 'error' ? styles.statusError : ''
        }`} />
        <span>{getStatusText()}</span>
      </div>
    </div>
  );
}

// Log utility fallback
const logger = {
  info: (msg: string) => console.log(`[Transcription] ${msg}`)
};
