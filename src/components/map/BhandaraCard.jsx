import { useNavigate } from 'react-router-dom';
import { useLang } from '../../contexts/LanguageContext';
import { formatDistance, formatTimeLeft, toDate, getPinColor } from '../../utils/helpers';
import { haversineDistance } from '../../utils/helpers';
import { FOOD_TYPES } from '../../services/bhandaraService';

export default function BhandaraCard({ bhandara: b, userLocation }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();

  const distance = userLocation
    ? haversineDistance(userLocation.lat, userLocation.lon, b.latitude, b.longitude)
    : null;

  const statusColor = getPinColor(b.status);

  const foodLabels = (b.foodType || []).map(ft => {
    const found = FOOD_TYPES.find(f => f.value === ft);
    return found ? `${found.emoji} ${lang === 'hi' ? found.labelHi : found.label}` : ft;
  });

  const timeLeft = formatTimeLeft(b.expiresAt || b.endTime, lang);
  const startDate = toDate(b.startTime);
  const hasStarted = startDate && startDate <= new Date();

  return (
    <div
      className="bhandara-card"
      onClick={() => navigate(`/bhandara/${b.id}`)}
      style={{ borderLeftColor: statusColor }}
    >
      <div className="card-header">
        <div className="card-title-row">
          <h3 className="card-title">{b.title}</h3>
          {b.isRecurring && <span className="recurring-badge">♻️</span>}
          {b.isOrganizerVerified && <span className="verified-org-badge">✓</span>}
        </div>
        <div className="card-meta">
          {distance !== null && (
            <span className="card-distance">📍 {formatDistance(distance, lang)}</span>
          )}
          <span className="card-time" style={{ color: b.status === 'expiring' ? '#FF6B35' : '#138808' }}>
            🕐 {hasStarted ? timeLeft : `${t('startsIn')} ${formatTimeLeft(b.startTime, lang)}`}
          </span>
        </div>
      </div>

      <div className="card-food-types">
        {foodLabels.map((label, i) => (
          <span key={i} className="food-badge">{label}</span>
        ))}
      </div>

      <div className="card-stats">
        <span className="stat-item">
          ✓ {b.confirmationCount || 0} {t('confirmations')}
        </span>
        <span className="stat-item">
          👣 {b.checkInCount || 0} {t('checkIns')}
        </span>
        <div className="confidence-mini">
          <div
            className="confidence-fill"
            style={{ width: `${b.confidenceScore || 0}%` }}
          />
        </div>
        <span className="confidence-label">{b.confidenceScore || 0}%</span>
      </div>

      {b.photos?.[0] && (
        <div className="card-thumb">
          <img src={b.photos[0]} alt={b.title} loading="lazy" />
        </div>
      )}
    </div>
  );
}
