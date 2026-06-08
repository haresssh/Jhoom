import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Video, Copy, ExternalLink, Trash2, Calendar, ClipboardCheck } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import styles from './Dashboard.module.css';

interface Room {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
}

export default function Dashboard() {
  const [roomName, setRoomName] = useState('');
  const [activeRooms, setActiveRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchActiveRooms();
  }, [token]);

  const fetchActiveRooms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setActiveRooms(data);
      }
    } catch (error) {
      console.error('Error fetching active rooms:', error);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomName: roomName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        // Save host token and details for this room in session storage
        sessionStorage.setItem(`room_token_${data.roomId}`, data.token);
        sessionStorage.setItem(`room_role_${data.roomId}`, 'host');
        // Redirect directly to the meeting room
        navigate(`/room/${data.roomId}`);
      }
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to end this meeting for everyone?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setActiveRooms(prev => prev.filter(r => r.id !== roomId));
      }
    } catch (error) {
      console.error('Error ending room:', error);
    }
  };

  const handleCopyLink = (roomId: string) => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      {/* Top Navbar */}
      <header className={`${styles.header} glass-panel animate-fade`}>
        <div className={styles.logo}>VideoCollab</div>
        <div className={styles.userInfo}>
          <span className={styles.username}>Hi, {username}</span>
          <button className={styles.actionBtn} onClick={handleLogout} title="Log Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className={styles.grid}>
        {/* Left Side: Create Room Panel */}
        <section className="animate-fade">
          <h3 className={styles.sectionTitle}>New Meeting</h3>
          <div className={`${styles.card} glass-panel`}>
            <form onSubmit={handleCreateRoom} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="roomName">Meeting Topic</label>
                <input
                  id="roomName"
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Daily Sync"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={loading}>
                <Video size={18} />
                {loading ? 'Starting...' : 'Start Instant Meeting'}
              </button>
            </form>
          </div>
        </section>

        {/* Right Side: Active Meetings List */}
        <section className="animate-fade" style={{ animationDelay: '0.1s' }}>
          <h3 className={styles.sectionTitle}>Active Meetings</h3>
          <div className={styles.roomList}>
            {activeRooms.length === 0 ? (
              <div className={styles.emptyState}>
                <Calendar size={36} className={styles.emptyIcon} />
                <p>No active meetings found.</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Meetings you start will appear here for sharing.</p>
              </div>
            ) : (
              activeRooms.map(room => (
                <div key={room.id} className={`${styles.roomCard} glass-panel`}>
                  <div className={styles.roomInfo}>
                    <div className={styles.roomName}>{room.name}</div>
                    <div className={styles.roomId}>{room.id}</div>
                    <div className={styles.roomMeta}>
                      Created: {new Date(room.createdAt).toLocaleString(undefined, {
                        hour: 'numeric',
                        minute: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>

                  <div className={styles.roomActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleCopyLink(room.id)}
                      title="Copy Meeting Link"
                      style={{ color: copiedId === room.id ? 'var(--secondary)' : 'inherit' }}
                    >
                      {copiedId === room.id ? <ClipboardCheck size={18} /> : <Copy size={18} />}
                    </button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => navigate(`/room/${room.id}`)}
                      title="Join Meeting"
                      style={{ color: 'var(--primary)' }}
                    >
                      <ExternalLink size={18} />
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => handleEndRoom(room.id)}
                      title="End Meeting"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
