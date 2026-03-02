import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import {
  getUnderReviewBhandaras, resolveBhandara, getAdminStats
} from '../../services/bhandaraService';
import {
  getUsersByStatus, updateUserProfile, addNotification
} from '../../services/userService';
import { formatRelativeTime, formatDateTime, toDate } from '../../utils/helpers';

export default function AdminPanel() {
  const { currentUser, isAdminUser } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [reviewBhandaras, setReviewBhandaras] = useState([]);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [unbanUsers, setUnbanUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingUid, setRejectingUid] = useState('');

  useEffect(() => {
    if (!isAdminUser) { navigate('/home'); return; }
    loadData();
  }, [isAdminUser]);

  async function loadData() {
    setLoading(true);
    try {
      const [st, reviews, banned, unban] = await Promise.all([
        getAdminStats(),
        getUnderReviewBhandaras(),
        getUsersByStatus('banned'),
        getUsersByStatus('pending_unban'),
      ]);
      setStats(st);
      setReviewBhandaras(reviews);
      setBannedUsers(banned);
      setUnbanUsers(unban);
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(bhandaraId, decision) {
    setActionLoading(bhandaraId + decision);
    try {
      await resolveBhandara(bhandaraId, decision, currentUser.uid);
      setReviewBhandaras(prev => prev.filter(b => b.id !== bhandaraId));
      toast.success(decision === 'restore'
        ? (lang === 'hi' ? 'भंडारा बहाल किया' : 'Bhandara restored')
        : (lang === 'hi' ? 'नकली पुष्टि की' : 'Confirmed as fake'));
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleApproveUnban(uid) {
    setActionLoading('unban_' + uid);
    try {
      await updateUserProfile(uid, {
        accountStatus: 'active',
        karmaPoints: 0,
        warningCount: 0,
        previouslyBanned: true,
        bannedAt: null,
        banReason: null,
        unbanRequestText: null,
        unbanRequestedAt: null,
      });
      await addNotification(uid, {
        type: 'unban_approved',
        title: 'Account Restored ✅',
        titleHi: 'खाता बहाल किया ✅',
        message: 'Your account has been restored. Please follow community guidelines.',
        messageHi: 'आपका खाता बहाल किया गया है। कृपया सामुदायिक दिशानिर्देशों का पालन करें।',
      });
      setUnbanUsers(prev => prev.filter(u => u.id !== uid));
      setBannedUsers(prev => prev.filter(u => u.id !== uid));
      toast.success(lang === 'hi' ? 'अनबैन स्वीकृत' : 'Unban approved');
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleRejectUnban(uid) {
    if (!rejectReason.trim()) {
      toast.error(lang === 'hi' ? 'अस्वीकृति का कारण दर्ज करें' : 'Enter rejection reason');
      return;
    }
    setActionLoading('reject_' + uid);
    try {
      await updateUserProfile(uid, {
        accountStatus: 'banned',
        unbanRequestText: null,
        unbanRequestedAt: null,
      });
      await addNotification(uid, {
        type: 'unban_rejected',
        title: 'Unban Request Rejected',
        titleHi: 'अनबैन अनुरोध अस्वीकृत',
        message: `Your unban request was rejected: ${rejectReason}`,
        messageHi: `आपका अनबैन अनुरोध अस्वीकृत किया गया: ${rejectReason}`,
      });
      setUnbanUsers(prev => prev.filter(u => u.id !== uid));
      setRejectingUid('');
      setRejectReason('');
      toast.success(lang === 'hi' ? 'अनबैन अस्वीकृत' : 'Unban rejected');
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setActionLoading('');
    }
  }

  if (!isAdminUser) return null;

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner-lg" />
        <p>{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/home')}>←</button>
        <h2>⚙️ {t('adminPanel')}</h2>
      </div>

      {/* Tab nav */}
      <div className="admin-tabs">
        {[
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'review', label: `🚩 ${t('underReview')} (${reviewBhandaras.length})` },
          { key: 'unban', label: `📋 ${t('unbanRequests')} (${unbanUsers.length})` },
          { key: 'banned', label: `🚫 ${t('bannedUsers')} (${bannedUsers.length})` },
        ].map(tab_item => (
          <button
            key={tab_item.key}
            className={`admin-tab ${tab === tab_item.key ? 'admin-tab-active' : ''}`}
            onClick={() => setTab(tab_item.key)}
          >
            {tab_item.label}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {/* Dashboard */}
        {tab === 'dashboard' && stats && (
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <span className="dash-num">{stats.total}</span>
              <span className="dash-label">{t('totalBhandaras')}</span>
            </div>
            <div className="dashboard-card active-card">
              <span className="dash-num">{stats.activeNow}</span>
              <span className="dash-label">{t('activeNowStat')}</span>
            </div>
            <div className="dashboard-card">
              <span className="dash-num">{stats.reportedToday}</span>
              <span className="dash-label">{t('reportedToday')}</span>
            </div>
            <div className="dashboard-card review-card">
              <span className="dash-num">{reviewBhandaras.length}</span>
              <span className="dash-label">{t('underReview')}</span>
            </div>
            <div className="dashboard-card ban-card">
              <span className="dash-num">{bannedUsers.length}</span>
              <span className="dash-label">{t('bannedUsers')}</span>
            </div>
            <div className="dashboard-card unban-card">
              <span className="dash-num">{unbanUsers.length}</span>
              <span className="dash-label">{t('unbanRequests')}</span>
            </div>
          </div>
        )}

        {/* Under Review */}
        {tab === 'review' && (
          <div className="review-list">
            {reviewBhandaras.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>{lang === 'hi' ? 'कोई समीक्षा लंबित नहीं' : 'No pending reviews'}</p>
              </div>
            ) : (
              reviewBhandaras.map(b => (
                <div key={b.id} className="review-card">
                  {b.photos?.[0] && (
                    <img src={b.photos[0]} alt="" className="review-thumb" />
                  )}
                  <div className="review-info">
                    <h4>{b.title}</h4>
                    <p className="review-address">{b.address}</p>
                    <p className="review-meta">
                      🚩 {b.flagCount} flags · ✓ {b.confirmationCount} confirmations · 👣 {b.checkInCount} check-ins
                    </p>
                    <p className="review-reporter">Reporter: {b.reporterName}</p>
                    <p className="review-time">{formatDateTime(b.createdAt)}</p>

                    {/* Flags */}
                    {b.flags?.length > 0 && (
                      <div className="flags-list">
                        <p className="flags-title">Flag reasons:</p>
                        {b.flags.slice(0, 3).map((f, i) => (
                          <span key={i} className="flag-chip">{f.reason}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="review-actions">
                    <button
                      className="btn btn-success"
                      onClick={() => handleResolve(b.id, 'restore')}
                      disabled={actionLoading === b.id + 'restore'}
                    >
                      {actionLoading === b.id + 'restore' ? <span className="spinner-sm" /> : '✓'} {t('restore')}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleResolve(b.id, 'fake')}
                      disabled={actionLoading === b.id + 'fake'}
                    >
                      {actionLoading === b.id + 'fake' ? <span className="spinner-sm" /> : '✕'} {t('confirmFake')}
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => window.open(`/bhandara/${b.id}`, '_blank')}
                    >
                      👁️ View
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Unban Requests */}
        {tab === 'unban' && (
          <div className="unban-list">
            {unbanUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>{lang === 'hi' ? 'कोई अनबैन अनुरोध नहीं' : 'No unban requests'}</p>
              </div>
            ) : (
              unbanUsers.map(u => (
                <div key={u.id} className="unban-card">
                  <div className="user-info">
                    <p className="user-name">{u.name}</p>
                    <p className="user-phone">+91 {u.phoneNumber}</p>
                    <p className="user-meta">
                      ⚠️ {u.warningCount} warnings · 🚩 {u.flaggedReports} flagged reports
                    </p>
                    {u.banReason && <p className="ban-reason-admin">Ban reason: {u.banReason}</p>}
                  </div>
                  <div className="unban-request-text">
                    <strong>{lang === 'hi' ? 'उपयोगकर्ता का अनुरोध:' : "User's request:"}</strong>
                    <p>{u.unbanRequestText}</p>
                    <p className="request-time">{formatRelativeTime(u.unbanRequestedAt, lang)}</p>
                  </div>

                  {rejectingUid === u.id ? (
                    <div className="reject-form">
                      <textarea
                        className="form-textarea"
                        placeholder="Rejection reason..."
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        rows={3}
                      />
                      <div className="reject-btns">
                        <button
                          className="btn btn-danger"
                          onClick={() => handleRejectUnban(u.id)}
                          disabled={actionLoading === 'reject_' + u.id}
                        >
                          Confirm Reject
                        </button>
                        <button className="btn btn-outline" onClick={() => { setRejectingUid(''); setRejectReason(''); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="unban-actions">
                      <button
                        className="btn btn-success"
                        onClick={() => handleApproveUnban(u.id)}
                        disabled={actionLoading === 'unban_' + u.id}
                      >
                        {actionLoading === 'unban_' + u.id ? <span className="spinner-sm" /> : '✓'} {t('approve')}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => setRejectingUid(u.id)}
                      >
                        ✕ {t('reject')}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Banned Users */}
        {tab === 'banned' && (
          <div className="banned-list">
            {bannedUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <p>{lang === 'hi' ? 'कोई प्रतिबंधित उपयोगकर्ता नहीं' : 'No banned users'}</p>
              </div>
            ) : (
              bannedUsers.map(u => (
                <div key={u.id} className="banned-user-card">
                  <div className="user-info">
                    <p className="user-name">{u.name} {u.permanentBan ? '🔴 Permanent' : ''}</p>
                    <p className="user-phone">+91 {u.phoneNumber} · {u.city}</p>
                    <p className="user-meta">
                      Warned {u.warningCount}x · {u.flaggedReports} fake reports · {u.totalReports} total
                    </p>
                    {u.banReason && <p className="ban-reason-admin">{u.banReason}</p>}
                    {u.bannedAt && <p className="ban-time">Banned {formatRelativeTime(u.bannedAt, lang)}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <button className="refresh-btn" onClick={loadData}>🔄 Refresh</button>
    </div>
  );
}
