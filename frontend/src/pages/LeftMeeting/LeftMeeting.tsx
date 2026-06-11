import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, Home, VideoOff } from 'lucide-react';
import { Button, CircularProgress } from '@mui/material';
import { API_BASE_URL } from '../../config';
import styles from './LeftMeeting.module.css';

export default function LeftMeeting() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEndedByReason = searchParams.get('reason') === 'ended';
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');

  const showActive = isActive && !isEndedByReason;

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const fetchMetadata = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/metadata`);
        if (response.ok) {
          const data = await response.json();
          setIsActive(true);
          setRoomName(data.roomName || 'Active Meeting');
          setRoomDescription(data.description || '');
        } else {
          // If 404, the room is not active/has ended
          setIsActive(false);
          setRoomName('Meeting');
        }
      } catch (err) {
        console.error('Failed to fetch room metadata:', err);
        setIsActive(false);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [roomId]);

  const handleRejoin = () => {
    if (roomId) {
      navigate(`/room/${roomId}`);
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <CircularProgress size={40} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.card} glass-panel animate-fade`}>
        <div className={styles.header}>
          <div className={`${styles.iconWrapper} ${showActive ? styles.iconWrapperSuccess : styles.iconWrapperEnded}`}>
            {showActive ? <RefreshCw size={32} /> : <VideoOff size={32} />}
          </div>
          <h2 className={styles.title}>
            {showActive ? 'You left the meeting' : 'Meeting Ended'}
          </h2>
          <p className={styles.subtitle}>
            {showActive ? (
              <>
                You left Jhoom meeting <span className={styles.roomName}>{roomName}</span>. 
                {roomDescription && <span style={{ display: 'block', fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>{roomDescription}</span>}
                <span style={{ display: 'block', marginTop: '12px' }}>You can rejoin this meeting if it is still in progress.</span>
              </>
            ) : (
              <>
                The host has ended this meeting session for all participants.
              </>
            )}
          </p>
        </div>

        <div className={styles.actions}>
          {showActive && (
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<RefreshCw size={18} />}
              onClick={handleRejoin}
              className={styles.btn}
            >
              Rejoin Meeting
            </Button>
          )}
          
          <Button
            variant={showActive ? "outlined" : "contained"}
            color="primary"
            size="large"
            startIcon={<Home size={18} />}
            onClick={handleGoHome}
            className={styles.btn}
          >
            Return to Home Screen
          </Button>
        </div>
      </div>
    </div>
  );
}
