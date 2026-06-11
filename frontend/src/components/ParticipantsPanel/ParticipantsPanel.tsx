import { X, Mic, MicOff, Trash2, Shield } from 'lucide-react';
import { IconButton } from '@mui/material';
import type { Participant } from 'livekit-client';
import styles from './ParticipantsPanel.module.css';

interface ParticipantsPanelProps {
  participants: Participant[];
  localParticipant: Participant;
  isHost: boolean;
  onMuteParticipant: (identity: string) => void;
  onKickParticipant: (identity: string) => void;
  onClose: () => void;
}

export default function ParticipantsPanel({
  participants,
  localParticipant,
  isHost,
  onMuteParticipant,
  onKickParticipant,
  onClose
}: ParticipantsPanelProps) {

  const getParticipantRole = (p: Participant): 'host' | 'guest' => {
    try {
      if (p.metadata) {
        const meta = JSON.parse(p.metadata);
        if (meta.role) return meta.role;
      }
    } catch (err) {
      // Ignore parsing error
    }
    return p.identity.toLowerCase().includes('host') ? 'host' : 'guest';
  };

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <Shield size={18} style={{ color: 'var(--primary)' }} />
          <span>Participants ({participants.length})</span>
        </div>
        <IconButton size="small" onClick={onClose} title="Close Panel">
          <X size={18} />
        </IconButton>
      </div>

      {/* List */}
      <div className={styles.listContainer}>
        {participants.map((p) => {
          const role = getParticipantRole(p);
          const isMe = p.identity === localParticipant.identity;
          const name = p.name || p.identity;

          return (
            <div key={p.identity} className={styles.participantItem}>
              <div className={styles.info}>
                <div className={styles.nameContainer}>
                  <span className={styles.name} title={name}>{name}</span>
                  {role === 'host' && (
                    <span className={`${styles.badge} ${styles.badgeHost}`}>Host</span>
                  )}
                  {role === 'guest' && (
                    <span className={`${styles.badge} ${styles.badgeGuest}`}>Guest</span>
                  )}
                  {isMe && (
                    <span className={`${styles.badge} ${styles.badgeYou}`}>You</span>
                  )}
                </div>
                <div className={styles.statusText}>
                  {p.isMicrophoneEnabled ? 'Mic: On' : 'Mic: Off'} | {p.isCameraEnabled ? 'Video: On' : 'Video: Off'}
                </div>
              </div>

              <div className={styles.actions}>
                {/* Status Icons */}
                {p.isMicrophoneEnabled ? (
                  <Mic size={16} style={{ color: 'var(--secondary)', opacity: 0.6, marginRight: '4px' }} />
                ) : (
                  <MicOff size={16} style={{ color: 'var(--error)', opacity: 0.6, marginRight: '4px' }} />
                )}

                {/* Host Controls */}
                {isHost && !isMe && role !== 'host' && (
                  <>
                    {p.isMicrophoneEnabled && (
                      <IconButton
                        size="small"
                        color="error"
                        title="Mute Participant"
                        onClick={() => onMuteParticipant(p.identity)}
                        className={styles.actionButton}
                        style={{ padding: '4px', marginLeft: '2px' }}
                      >
                        <MicOff size={15} />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="error"
                      title="Remove Participant"
                      onClick={() => onKickParticipant(p.identity)}
                      className={styles.actionButton}
                      style={{ padding: '4px', marginLeft: '2px' }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
