import { useEffect, useState, useRef, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { Mic, X, MessageSquare, AlertCircle, Download } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { IconButton, Button } from '@mui/material';
import styles from './TranscriptionPanel.module.css';

interface TranscriptionPanelProps {
  room: Room;
  roomId: string;
  onClose: () => void;
  messages: TranscriptMessage[];
  setMessages: React.Dispatch<React.SetStateAction<TranscriptMessage[]>>;
  isTranscriptionStopped: boolean;
  isHost: boolean;
  onToggleTranscriptionGlobal: (val: boolean) => void;
}

export interface TranscriptMessage {
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

export default function TranscriptionPanel({ 
  room, roomId, onClose, messages, setMessages,
  isTranscriptionStopped, isHost, onToggleTranscriptionGlobal 
}: TranscriptionPanelProps) {
  const [activeTranscripts, setActiveTranscripts] = useState<Record<string, ActiveTranscript>>({});
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [micPermissionError, setMicPermissionError] = useState(false);

  const handleDownloadTranscript = () => {
    if (messages.length === 0) return;
    const textContent = messages.map(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `[${time}] ${msg.senderName}: ${msg.text}`;
    }).join('\n');
    
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Transcript_${roomId || 'meeting'}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const keepAliveIntervalRef = useRef<any>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const activeSessionIdRef = useRef<string | null>(null);

  // Auto-scroll transcript container to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, activeTranscripts]);

  // Deduplicated message adder — prevents adding the same transcript twice
  const addMessage = useCallback((msg: TranscriptMessage) => {
    if (processedIdsRef.current.has(msg.id)) return;
    processedIdsRef.current.add(msg.id);
    setMessages(prev => [...prev, msg]);
  }, [setMessages]);

  useEffect(() => {
    const localIdentity = room.localParticipant.identity;

    // 1. Listen for incoming LiveKit Data Channel messages from OTHER participants only
    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const decoded = new TextDecoder().decode(payload);
        const data = JSON.parse(decoded);

        if (data.type === 'transcript') {
          const senderIdentity: string = data.senderIdentity || participant?.identity || '';
          
          // Skip messages sent by ourselves — we already rendered them locally
          if (senderIdentity === localIdentity) return;

          const sender: string = data.senderName || senderIdentity || 'Anonymous';
          
          if (data.isFinal) {
            setActiveTranscripts(prev => {
              const updated = { ...prev };
              delete updated[sender];
              return updated;
            });

            // Use the sender's generated id for perfect deduplication
            const msgId = data.id || `remote-${sender}-${data.text}-${Date.now()}`;
            addMessage({
              id: msgId,
              senderName: sender,
              text: data.text,
              timestamp: new Date(),
              speakerTag: data.speakerTag ?? 0
            });
          } else {
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
    
    // Start local transcription capturing ONLY if not stopped globally
    if (!isTranscriptionStopped) {
      startLocalTranscription();
    } else {
      stopLocalTranscription();
    }

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      stopLocalTranscription();
    };
  }, [room, roomId, addMessage, isTranscriptionStopped]);

  const startLocalTranscription = async () => {
    const sessionId = Math.random().toString();
    activeSessionIdRef.current = sessionId;

    setConnectionStatus('connecting');
    setMicPermissionError(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activeSessionIdRef.current !== sessionId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      audioStreamRef.current = stream;
    } catch (err) {
      if (activeSessionIdRef.current !== sessionId) return;
      console.error('Microphone permission denied:', err);
      setMicPermissionError(true);
      setConnectionStatus('error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/transcription/token?roomId=${roomId}`);
      if (activeSessionIdRef.current !== sessionId) return;
      if (!response.ok) {
        throw new Error('Failed to fetch Deepgram token');
      }
      const data = await response.json();
      const ephemeralToken = data.token;

      if (activeSessionIdRef.current !== sessionId) return;

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (!MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = '';
      }

      const wsUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&endpointing=300';
      const ws = new WebSocket(wsUrl, ['token', ephemeralToken]);
      
      if (activeSessionIdRef.current !== sessionId) {
        ws.close();
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        if (activeSessionIdRef.current !== sessionId) {
          ws.close();
          return;
        }
        setConnectionStatus('connected');
        
        keepAliveIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, 10000);
        
        const mediaRecorder = mimeType 
          ? new MediaRecorder(audioStreamRef.current!, { mimeType })
          : new MediaRecorder(audioStreamRef.current!);
          
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          const isMuted = !room.localParticipant.isMicrophoneEnabled;
          if (event.data && event.data.size > 0 && ws.readyState === WebSocket.OPEN && !isMuted) {
            ws.send(event.data);
          }
        };

        mediaRecorder.start(250);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const transcript = parsed.channel?.alternatives?.[0]?.transcript;
          if (!transcript || !transcript.trim()) return;

          const isFinal = parsed.is_final;
          const words = parsed.channel?.alternatives?.[0]?.words;
          const speakerTag = words && words.length > 0 ? (words[0].speaker ?? 0) : 0;
          const localName: string = room.localParticipant.name || room.localParticipant.identity;
          const localIdentity: string = room.localParticipant.identity;

          let finalMsgId = '';

          if (isFinal) {
            setActiveTranscripts(prev => {
              const updated = { ...prev };
              delete updated[localName];
              return updated;
            });

            // Generate unique message ID for deduplication across all participants
            finalMsgId = `tr-${localName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            addMessage({
              id: finalMsgId,
              senderName: localName,
              text: transcript,
              timestamp: new Date(),
              speakerTag
            });
          } else {
            setActiveTranscripts(prev => ({
              ...prev,
              [localName]: { text: transcript, speakerTag }
            }));
          }

          // Broadcast transcription via LiveKit Data Channel to other participants
          const payload = JSON.stringify({
            type: 'transcript',
            id: finalMsgId || undefined,
            text: transcript,
            isFinal,
            speakerTag,
            senderName: localName,
            senderIdentity: localIdentity
          });
          
          room.localParticipant.publishData(
            new TextEncoder().encode(payload),
            { reliable: isFinal }
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
        console.log('[Transcription] Deepgram WebSocket connection closed');
        setConnectionStatus((prev) => prev !== 'error' ? 'disconnected' : prev);
      };
    } catch (err) {
      console.error('Failed to initialize Deepgram WebSocket:', err);
      setConnectionStatus('error');
    }
  };

  const stopLocalTranscription = () => {
    activeSessionIdRef.current = null;
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
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
    if (isTranscriptionStopped) return 'Transcription Paused';
    switch (connectionStatus) {
      case 'connected': return 'Transcription Active';
      case 'connecting': return 'Connecting Transcription...';
      case 'error': return 'Transcription Offline';
      default: return 'Transcription Offline';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {messages.length > 0 && (
            <IconButton size="small" onClick={handleDownloadTranscript} title="Download Transcript">
              <Download size={18} />
            </IconButton>
          )}
          <IconButton size="small" onClick={onClose} title="Close Panel">
            <X size={18} />
          </IconButton>
        </div>
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
                {msg.senderName}
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
                {sender}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className={`${styles.statusDot} ${
            isTranscriptionStopped ? '' :
            connectionStatus === 'connected' ? styles.statusConnected :
            connectionStatus === 'connecting' ? styles.statusConnecting :
            connectionStatus === 'error' ? styles.statusError : ''
          }`} />
          <span>{getStatusText()}</span>
        </div>
        
        {isHost && (
          <Button
            size="small"
            color={isTranscriptionStopped ? "primary" : "error"}
            variant="outlined"
            onClick={() => onToggleTranscriptionGlobal(isTranscriptionStopped)}
            style={{ 
              textTransform: 'none', 
              borderRadius: '8px', 
              fontSize: '11px', 
              padding: '2px 8px',
              fontWeight: 600,
              height: '24px'
            }}
          >
            {isTranscriptionStopped ? "Enable Transcription" : "Disable Transcription"}
          </Button>
        )}
      </div>
    </div>
  );
}
