import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../../services/userService';
import { formatRelativeTime } from '../../utils/helpers';
import { getToken } from 'firebase/messaging';
import { messaging, VAPID_KEY } from '../../firebase';
import { updateUserProfile } from '../../services/userService';

const NOTIF_ICONS = {
  report_verified: '✅',
  report_under_review: '⚠️',
  warning_issued: '⚠️',
  final_warning: '🚨',
  account_banned: '🚫',
  unban_approved: '✅',
  unban_rejected: '❌',
  new_confirmation: '👍',
  new_checkin: '📍',
  default: '🔔',
};

export default function NotificationList() {
  const { currentUser, userProfile } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingPush, setRequestingPush] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToNotifications(currentUser.uid, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  async function handleMarkRead(notif) {
    if (!notif.read) {
      await markNotificationRead(currentUser.uid, notif.id);
    }
    if (notif.bhandaraId) {
      navigate(`/bhandara/${notif.bhandaraId}`);
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(currentUser.uid);
    toast.success(lang === 'hi' ? 'सभी पढ़ा हुआ चिह्नित किया' : 'All marked as read');
  }

  async function handleEnablePush() {
    if (!messaging) {
      toast.error('Push notifications not supported in this browser');
      return;
    }
    setRequestingPush(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        await updateUserProfile(currentUser.uid, {
          notificationsEnabled: true,
          fcmToken: token,
        });
        toast.success(lang === 'hi' ? 'सूचनाएँ सक्षम की गईं!' : 'Notifications enabled!');
      } else {
        toast.error(lang === 'hi' ? 'सूचना अनुमति अस्वीकृत' : 'Notification permission denied');
      }
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setRequestingPush(false);
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="notif-page">
      <div className="page-header">
        <h2>{t('notifications')}</h2>
        {unreadCount > 0 && (
          <button className="btn-text" onClick={handleMarkAllRead}>
            {t('markAllRead')}
          </button>
        )}
      </div>

      {/* Push notification prompt */}
      {!userProfile?.notificationsEnabled && (
        <div className="push-prompt">
          <p>🔔 {t('notifPermission')}</p>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleEnablePush}
            disabled={requestingPush}
          >
            {requestingPush ? <span className="spinner-sm" /> : t('enableNotifications')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-center">
          <div className="spinner-lg" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔕</div>
          <p>{t('noNotifications')}</p>
        </div>
      ) : (
        <div className="notif-list">
          {notifications.map(notif => {
            const icon = NOTIF_ICONS[notif.type] || NOTIF_ICONS.default;
            const title = lang === 'hi' ? (notif.titleHi || notif.title) : notif.title;
            const message = lang === 'hi' ? (notif.messageHi || notif.message) : notif.message;

            return (
              <div
                key={notif.id}
                className={`notif-item ${!notif.read ? 'notif-unread' : ''}`}
                onClick={() => handleMarkRead(notif)}
              >
                <div className="notif-icon">{icon}</div>
                <div className="notif-content">
                  <p className="notif-title">{title}</p>
                  <p className="notif-message">{message}</p>
                  <p className="notif-time">{formatRelativeTime(notif.createdAt, lang)}</p>
                </div>
                {!notif.read && <div className="notif-dot" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
