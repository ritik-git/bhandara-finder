import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import {
  getBhandara, confirmBhandara, checkInBhandara, flagBhandara,
  FOOD_TYPES, BHANDARA_STATUS
} from '../../services/bhandaraService';
import { addNotification } from '../../services/userService';
import {
  formatDateTime, formatTimeLeft, formatRelativeTime,
  haversineDistance, formatDistance, toDate, getStatusColor
} from '../../utils/helpers';
import PhotoGallery from './PhotoGallery';
import ConfidenceBar from './ConfidenceBar';
import FlagModal from './FlagModal';

export default function BhandaraDetail() {
  const { id } = useParams();
  const [bhandara, setBhandara] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showFlag, setShowFlag] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const { currentUser, userProfile } = useAuth();
  const { t, lang } = useLang();
  const { location } = useGeolocation();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const data = await getBhandara(id);
        setBhandara(data);
        const bookmarks = JSON.parse(localStorage.getItem('bf_bookmarks') || '[]');
        setBookmarked(bookmarks.includes(id));
      } catch (err) {
        toast.error(t('error'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const distance = bhandara && location
    ? haversineDistance(location.lat, location.lon, bhandara.latitude, bhandara.longitude)
    : null;

  const hasConfirmed = bhandara?.confirmations?.includes(currentUser?.uid);
  const hasCheckedIn = bhandara?.checkIns?.includes(currentUser?.uid);
  const isOwnReport = bhandara?.reportedBy === currentUser?.uid;
  const canCheckIn = distance !== null && distance <= 300;
  const isActive = bhandara && ['active', 'expiring', 'reported'].includes(bhandara.status);
  const now = new Date();
  const startDate = toDate(bhandara?.startTime);
  const endDate = toDate(bhandara?.expiresAt || bhandara?.endTime);
  const withinTimeWindow = startDate && endDate && now >= startDate && now <= endDate;

  async function handleConfirm() {
    if (isOwnReport) { toast.error(t('ownReport')); return; }
    if (hasConfirmed) { toast.error(t('alreadyConfirmed')); return; }
    setActionLoading('confirm');
    try {
      await confirmBhandara(id, currentUser.uid);
      const updated = await getBhandara(id);
      setBhandara(updated);
      toast.success(t('confirmedSuccess'));
    } catch (err) {
      toast.error(err.message || t('error'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleCheckIn() {
    if (!location) { toast.error('Enable location to check in'); return; }
    if (!canCheckIn) { toast.error(t('notNearby')); return; }
    if (hasCheckedIn) return;
    setActionLoading('checkin');
    try {
      await checkInBhandara(id, currentUser.uid, location.lat, location.lon);
      const updated = await getBhandara(id);
      setBhandara(updated);
      toast.success(t('checkInSuccess'));
    } catch (err) {
      toast.error(err.message || t('error'));
    } finally {
      setActionLoading('');
    }
  }

  function handleBookmark() {
    const bookmarks = JSON.parse(localStorage.getItem('bf_bookmarks') || '[]');
    if (bookmarked) {
      localStorage.setItem('bf_bookmarks', JSON.stringify(bookmarks.filter(b => b !== id)));
      setBookmarked(false);
    } else {
      localStorage.setItem('bf_bookmarks', JSON.stringify([...bookmarks, id]));
      setBookmarked(true);
      toast.success(t('bookmarked'));
    }
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: bhandara.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success(t('copied'));
    }
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner-lg" />
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (!bhandara) {
    return (
      <div className="loading-page">
        <p>Bhandara not found</p>
        <button className="btn btn-primary" onClick={() => navigate('/home')}>Go Home</button>
      </div>
    );
  }

  const statusColor = getStatusColor(bhandara.status);

  const foodLabels = (bhandara.foodType || []).map(ft => {
    const found = FOOD_TYPES.find(f => f.value === ft);
    return found ? { emoji: found.emoji, label: lang === 'hi' ? found.labelHi : found.label } : { emoji: '🍽️', label: ft };
  });

  return (
    <div className="detail-page">
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <div className="detail-actions-top">
          <button className="icon-btn" onClick={handleShare}>📤</button>
          <button
            className={`icon-btn ${bookmarked ? 'bookmarked' : ''}`}
            onClick={handleBookmark}
          >
            {bookmarked ? '🔖' : '📌'}
          </button>
        </div>
      </div>

      <PhotoGallery photos={bhandara.photos || []} />

      <div className="detail-content">
        {/* Status badge */}
        <div className="status-row">
          <span className="status-badge" style={{ backgroundColor: statusColor }}>
            {bhandara.status === 'active' ? '🟢 Active' :
             bhandara.status === 'expiring' ? '🟠 Expiring' :
             bhandara.status === 'reported' ? '🔵 Reported' :
             bhandara.status === 'under_review' ? '🔴 Under Review' :
             bhandara.status === 'fake' ? '❌ Fake' : bhandara.status}
          </span>
          {bhandara.isRecurring && (
            <span className="recurring-badge-lg">♻️ {t('recurring')}</span>
          )}
        </div>

        {/* Title */}
        <h1 className="detail-title">{bhandara.title}</h1>

        {/* Organizer */}
        {bhandara.organizerName && (
          <div className="organizer-row">
            <span>{bhandara.isOrganizerVerified ? '✅' : '👤'} {bhandara.organizerName}</span>
            {bhandara.isOrganizerVerified && (
              <span className="verified-org-text">{t('verifiedOrganizer')}</span>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="detail-meta">
          <div className="meta-item">
            <span className="meta-icon">📍</span>
            <div>
              <p className="meta-main">{bhandara.address}</p>
              {bhandara.locality && <p className="meta-sub">{bhandara.locality}, {bhandara.city}</p>}
              {distance !== null && (
                <p className="meta-distance">{formatDistance(distance, lang)} {t('away')}</p>
              )}
            </div>
          </div>
          <div className="meta-item">
            <span className="meta-icon">🕐</span>
            <div>
              <p className="meta-main">{formatDateTime(bhandara.startTime)}</p>
              {bhandara.endTime && <p className="meta-sub">→ {formatDateTime(bhandara.endTime)}</p>}
              <p className="meta-time-left" style={{ color: bhandara.status === 'expiring' ? '#FF6B35' : '#138808' }}>
                {formatTimeLeft(bhandara.expiresAt || bhandara.endTime, lang)}
              </p>
            </div>
          </div>
        </div>

        {/* Food types */}
        <div className="food-types-row">
          {foodLabels.map((f, i) => (
            <span key={i} className="food-badge-lg">{f.emoji} {f.label}</span>
          ))}
        </div>

        {/* Confidence score */}
        <ConfidenceBar score={bhandara.confidenceScore || 0} />

        {/* Stats */}
        <div className="detail-stats">
          <div className="stat-box">
            <span className="stat-number">{bhandara.confirmationCount || 0}</span>
            <span className="stat-label">{t('confirmations')}</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">{bhandara.checkInCount || 0}</span>
            <span className="stat-label">{t('checkIns')}</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">{bhandara.flagCount || 0}</span>
            <span className="stat-label">Flags</span>
          </div>
        </div>

        {/* Description */}
        {bhandara.description && (
          <div className="detail-description">
            <p>{bhandara.description}</p>
          </div>
        )}

        {/* Reporter */}
        <div className="contributors-section">
          <h3 className="section-title">{t('contributors')}</h3>
          <div className="contributor-item">
            <span className="contributor-role">{t('reporter')}:</span>
            <span className="contributor-name">{bhandara.reporterName}</span>
            <span className="contributor-time">{formatRelativeTime(bhandara.createdAt, lang)}</span>
          </div>
        </div>

        {/* Action buttons */}
        {isActive && bhandara.status !== 'fake' && (
          <div className="action-buttons">
            {!isOwnReport && !hasConfirmed && (
              <button
                className="btn btn-action btn-confirm"
                onClick={handleConfirm}
                disabled={actionLoading === 'confirm'}
              >
                {actionLoading === 'confirm' ? <span className="spinner-sm" /> : '✓'} {t('confirmReal')}
              </button>
            )}
            {hasConfirmed && (
              <div className="btn btn-action btn-confirmed-done">
                ✓ {lang === 'hi' ? 'पुष्टि की गई' : 'Confirmed'}
              </div>
            )}

            <button
              className={`btn btn-action ${bookmarked ? 'btn-bookmarked' : 'btn-bookmark'}`}
              onClick={handleBookmark}
            >
              {bookmarked ? '🔖' : '📌'} {t('attending')}
            </button>

            {withinTimeWindow && (
              hasCheckedIn ? (
                <div className="btn btn-action btn-checked-in">{t('checkedIn')}</div>
              ) : (
                <button
                  className={`btn btn-action ${canCheckIn ? 'btn-checkin' : 'btn-checkin-disabled'}`}
                  onClick={handleCheckIn}
                  disabled={actionLoading === 'checkin' || !canCheckIn}
                  title={!canCheckIn ? t('notNearby') : ''}
                >
                  {actionLoading === 'checkin' ? <span className="spinner-sm" /> : '📍'} {t('checkIn')}
                  {!canCheckIn && location && (
                    <span className="checkin-hint"> ({formatDistance(distance, lang)})</span>
                  )}
                </button>
              )
            )}

            <button
              className="btn btn-action btn-flag"
              onClick={() => setShowFlag(true)}
            >
              🚩 {t('reportFake')}
            </button>
          </div>
        )}
      </div>

      {showFlag && (
        <FlagModal
          bhandaraId={id}
          onClose={() => setShowFlag(false)}
        />
      )}
    </div>
  );
}
