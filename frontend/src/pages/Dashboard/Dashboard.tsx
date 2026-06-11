import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Video, ExternalLink, Trash2, Calendar,
  ClipboardCheck, Clock, Radio, History, Users, Share2
} from 'lucide-react';
import {
  TextField, FormControl, InputLabel, Select, MenuItem,
  Switch, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions
} from '@mui/material';
import { API_BASE_URL } from '../../config';
import styles from './Dashboard.module.css';

interface Room {
  id: string;
  name: string;
  createdAt: string;
  endedAt?: string;
  isActive: boolean;
  description?: string;
  maxParticipants?: number;
}

export default function Dashboard() {
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [isMutedOnJoin, setIsMutedOnJoin] = useState(false);
  const [isCameraOffOnJoin, setIsCameraOffOnJoin] = useState(false);
  const [isApprovalRequired, setIsApprovalRequired] = useState(false);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'ended'>('active');
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [roomToEndId, setRoomToEndId] = useState<string | null>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');

  const activeRooms = allRooms.filter(r => r.isActive);
  const endedRooms = allRooms.filter(r => !r.isActive);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchAllRooms();
  }, [token]);

  const fetchAllRooms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setAllRooms(data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
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
        body: JSON.stringify({
          roomName: roomName.trim(),
          description: description.trim(),
          maxParticipants,
          isMutedOnJoin,
          isCameraOffOnJoin,
          isApprovalRequired
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Don't store token - let PreJoinLobby handle the full join flow
        // so the host can configure A/V settings before entering
        navigate(`/room/${data.roomId}`);
      }
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setLoading(false);
    }
  };

  const promptEndRoom = (roomId: string) => {
    setRoomToEndId(roomId);
    setConfirmEndOpen(true);
  };

  const handleEndRoomConfirm = async () => {
    if (!roomToEndId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms/${roomToEndId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchAllRooms(); // Refresh the full list
      }
    } catch (error) {
      console.error('Error ending room:', error);
    } finally {
      setConfirmEndOpen(false);
      setRoomToEndId(null);
    }
  };

  const handleShareLink = (roomId: string) => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    copyToClipboard(inviteLink, roomId);
  };

  const copyToClipboard = (link: string, roomId: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatDuration = (startStr: string, endStr?: string) => {
    if (!endStr) return null;
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const diffMs = end - start;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return '< 1 min';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  };

  const displayedRooms = activeTab === 'active' ? activeRooms : endedRooms;

  return (
    <div className={styles.container}>
      {/* Top Navbar */}
      <header className={`${styles.header} animate-fade`}>
        <div className={styles.logo}>Jhoom</div>
        <div className={styles.userInfo}>
          <span className={styles.username}>Hi, {username}</span>
          <Button
            variant="text"
            color="inherit"
            size="small"
            startIcon={<LogOut size={16} />}
            onClick={handleLogout}
            style={{
              textTransform: 'none',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              borderRadius: '8px',
              padding: '4px 10px'
            }}
          >
            Log Out
          </Button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className={styles.grid}>
        {/* Left Side: Create Room Panel */}
        <section className="animate-fade">
          <h3 className={styles.sectionTitle}>New Meeting</h3>
          <div className={`${styles.card} glass-panel`}>
            <form onSubmit={handleCreateRoom} className={styles.form}>
              <div className={styles.formCols}>
                <div className={styles.formLeft}>
                  <TextField
                    label="Meeting Topic"
                    variant="outlined"
                    placeholder="e.g. Daily Sync"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                    disabled={loading}
                    fullWidth
                  />

                  <TextField
                    label="Description / Agenda (Optional)"
                    variant="outlined"
                    placeholder="What is this meeting about?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                    multiline
                    rows={2}
                    fullWidth
                  />

                  <FormControl fullWidth variant="outlined">
                    <InputLabel id="max-participants-label">Max Participants</InputLabel>
                    <Select
                      labelId="max-participants-label"
                      id="maxParticipants"
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(Number(e.target.value))}
                      label="Max Participants"
                      disabled={loading}
                    >
                      <MenuItem value={10}>10 participants</MenuItem>
                      <MenuItem value={20}>20 participants (Default)</MenuItem>
                      <MenuItem value={50}>50 participants</MenuItem>
                      <MenuItem value={100}>100 participants</MenuItem>
                    </Select>
                  </FormControl>
                </div>

                <div className={styles.formRight}>
                  <div className={styles.optionsDivider}>Guest Rules</div>

                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleLabel}>
                      <span className={styles.toggleTitle}>Mute on join</span>
                      <span className={styles.toggleDesc}>Participants' mic will be muted when they enter</span>
                    </div>
                    <Switch
                      checked={isMutedOnJoin}
                      onChange={(e) => setIsMutedOnJoin(e.target.checked)}
                      disabled={loading}
                      color="primary"
                    />
                  </div>

                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleLabel}>
                      <span className={styles.toggleTitle}>Camera off on join</span>
                      <span className={styles.toggleDesc}>Participants' video will be turned off when they enter</span>
                    </div>
                    <Switch
                      checked={isCameraOffOnJoin}
                      onChange={(e) => setIsCameraOffOnJoin(e.target.checked)}
                      disabled={loading}
                      color="primary"
                    />
                  </div>

                  <div className={styles.toggleGroup}>
                    <div className={styles.toggleLabel}>
                      <span className={styles.toggleTitle}>Require host approval</span>
                      <span className={styles.toggleDesc}>Guests must be admitted by the host to join</span>
                    </div>
                    <Switch
                      checked={isApprovalRequired}
                      onChange={(e) => setIsApprovalRequired(e.target.checked)}
                      disabled={loading}
                      color="primary"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading}
                startIcon={<Video size={18} />}
                size="large"
                fullWidth
                style={{ height: '48px', marginTop: '8px', borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
              >
                {loading ? 'Starting...' : 'Start Instant Meeting'}
              </Button>
            </form>
          </div>
        </section>

        {/* Right Side: Meetings List with Tabs */}
        <section className={`${styles.tabsSection} animate-fade`} style={{ animationDelay: '0.1s' }}>
          <div className={styles.tabBar}>
            <button
              className={`${styles.tab} ${activeTab === 'active' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('active')}
            >
              <Radio size={14} />
              Active
              {activeRooms.length > 0 && (
                <span className={styles.tabBadge}>{activeRooms.length}</span>
              )}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'ended' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('ended')}
            >
              <History size={14} />
              Past Meetings
              {endedRooms.length > 0 && (
                <span className={`${styles.tabBadge} ${styles.tabBadgeMuted}`}>{endedRooms.length}</span>
              )}
            </button>
          </div>

          <div className={styles.roomList}>
            {displayedRooms.length === 0 ? (
              <div className={styles.emptyState}>
                {activeTab === 'active' ? (
                  <>
                    <Calendar size={36} className={styles.emptyIcon} />
                    <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No active meetings</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '280px' }}>
                      Create a new meeting on the left to get started. Active meetings will appear here.
                    </p>
                  </>
                ) : (
                  <>
                    <History size={36} className={styles.emptyIcon} />
                    <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No past meetings</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '280px' }}>
                      Ended meetings will show up here with their duration and details.
                    </p>
                  </>
                )}
              </div>
            ) : (
              displayedRooms.map(room => (
                <div
                  key={room.id}
                  className={`${styles.roomCard} ${!room.isActive ? styles.roomCardEnded : ''}`}
                >
                  {/* Top Row: Name + Status */}
                  <div className={styles.roomTopRow}>
                    <div className={styles.roomInfo}>
                      <div className={styles.roomNameRow}>
                        <span className={styles.roomName}>{room.name}</span>
                        <span className={`${styles.statusBadge} ${room.isActive ? styles.statusLive : styles.statusEnded}`}>
                          {room.isActive ? '● Live' : 'Ended'}
                        </span>
                      </div>
                      <div className={styles.roomId}>{room.id}</div>
                      <div className={styles.roomMeta}>
                        <Clock size={12} />
                        {formatDate(room.createdAt)}
                        {!room.isActive && room.endedAt && (
                          <span className={styles.durationPill}>
                            Duration: {formatDuration(room.createdAt, room.endedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons (labeled) */}
                  <div className={styles.roomActions}>
                    {room.isActive ? (
                      <>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<ExternalLink size={14} />}
                          onClick={() => navigate(`/room/${room.id}`)}
                          style={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '13px' }}
                        >
                          Join Meeting
                        </Button>
                        <Button
                          variant="outlined"
                          color="primary"
                          size="small"
                          startIcon={copiedId === room.id ? <ClipboardCheck size={14} /> : <Share2 size={14} />}
                          onClick={() => handleShareLink(room.id)}
                          style={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '13px' }}
                        >
                          {copiedId === room.id ? 'Copied!' : 'Share Link'}
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<Trash2 size={14} />}
                          onClick={() => promptEndRoom(room.id)}
                          style={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '13px' }}
                        >
                          End Meeting
                        </Button>
                      </>
                    ) : (
                      <>
                        <Chip
                          icon={<Clock size={12} />}
                          label={`Ended ${room.endedAt ? formatDate(room.endedAt) : ''}`}
                          size="small"
                          variant="outlined"
                          style={{ fontSize: '12px' }}
                        />
                        {room.maxParticipants && (
                          <Chip
                            icon={<Users size={12} />}
                            label={`Up to ${room.maxParticipants}`}
                            size="small"
                            variant="outlined"
                            style={{ fontSize: '12px' }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* End Meeting Confirmation Modal */}
      <Dialog
        open={confirmEndOpen}
        onClose={() => setConfirmEndOpen(false)}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '16px',
            padding: '8px',
            maxWidth: '400px',
            background: '#ffffff'
          }
        }}
      >
        <DialogTitle style={{ fontWeight: 700, color: 'var(--text-primary)' }}>End Meeting?</DialogTitle>
        <DialogContent>
          <DialogContentText style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to end this meeting for everyone? This will immediately disconnect all active participants.
          </DialogContentText>
        </DialogContent>
        <DialogActions style={{ padding: '16px 24px' }}>
          <Button 
            onClick={() => setConfirmEndOpen(false)} 
            variant="outlined" 
            color="primary"
            style={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleEndRoomConfirm} 
            variant="contained" 
            color="error"
            style={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600 }}
            autoFocus
          >
            End Meeting
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
