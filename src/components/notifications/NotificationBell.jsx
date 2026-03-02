import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToNotifications } from '../../services/userService';

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToNotifications(currentUser.uid, (notifs) => {
      setUnreadCount(notifs.filter(n => !n.read).length);
    });
    return unsub;
  }, [currentUser]);

  return (
    <button
      className="notif-bell-btn"
      onClick={() => navigate('/notifications')}
      aria-label="Notifications"
    >
      🔔
      {unreadCount > 0 && (
        <span className="notif-badge">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
