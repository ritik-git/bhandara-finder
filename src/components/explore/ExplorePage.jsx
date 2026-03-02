import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../../contexts/LanguageContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { subscribeToBhandaras, FOOD_TYPES } from '../../services/bhandaraService';
import { haversineDistance, toDate } from '../../utils/helpers';
import BhandaraCard from '../map/BhandaraCard';

const LOAD_TIMEOUT_MS = 10000;

function extractIndexUrl(message) {
  const match = typeof message === 'string' && message.match(/https:\/\/[^\s]+/);
  return match ? match[0] : 'https://console.firebase.google.com';
}

export default function ExplorePage() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { location, permissionDenied, loading: geoLoading, refresh } = useGeolocation();

  const [bhandaras, setBhandaras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [activeTab, setActiveTab] = useState('now');
  const [foodFilter, setFoodFilter] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const timeoutRef = useRef(null);
  const resolvedRef = useRef(false);

  const handleRetry = () => {
    setLoading(true);
    setLoadError(null);
    setLoadTimeout(false);
    setRetryKey((k) => k + 1);
  };

  // Subscribe to bhandaras (same real-time query as MapView)
  useEffect(() => {
    resolvedRef.current = false;
    setLoadError(null);
    setLoadTimeout(false);

    const unsub = subscribeToBhandaras(
      (data) => {
        resolvedRef.current = true;
        setBhandaras(data);
        setLoading(false);
        setLoadError(null);
      },
      ['reported', 'active', 'expiring'],
      (err) => {
        resolvedRef.current = true;
        setLoading(false);
        setLoadError(err);
        setLoadTimeout(false);
      }
    );

    timeoutRef.current = setTimeout(() => {
      if (!resolvedRef.current) setLoadTimeout(true);
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsub();
    };
  }, [retryKey]);

  // Split into "happening now" vs "upcoming"
  const now = new Date();

  const nowList = useMemo(() => {
    return bhandaras.filter((b) => {
      if (b.status === 'active' || b.status === 'expiring') return true;
      if (b.status === 'reported') {
        const start = toDate(b.startTime);
        return start && start <= now;
      }
      return false;
    });
  }, [bhandaras]);

  const upcomingList = useMemo(() => {
    return bhandaras.filter((b) => {
      if (b.status === 'reported') {
        const start = toDate(b.startTime);
        return start && start > now;
      }
      return false;
    });
  }, [bhandaras]);

  const activeList = activeTab === 'now' ? nowList : upcomingList;

  // Apply food type filter
  const filtered = useMemo(() => {
    if (!foodFilter) return activeList;
    return activeList.filter((b) =>
      (b.foodType || []).includes(foodFilter)
    );
  }, [activeList, foodFilter]);

  // Sort by distance (nearest first)
  const sorted = useMemo(() => {
    if (!location) return filtered;
    return [...filtered]
      .map((b) => ({
        ...b,
        _distance: haversineDistance(location.lat, location.lon, b.latitude, b.longitude),
      }))
      .sort((a, b) => a._distance - b._distance);
  }, [filtered, location]);

  return (
    <div className="explore-page">
      {/* Location denied banner */}
      {permissionDenied && (
        <div className="location-banner">
          <span className="location-banner-icon">📍</span>
          <span className="location-banner-text">{t('enableLocationExplore')}</span>
          <button className="location-banner-btn" onClick={refresh}>
            {t('refreshLocation')}
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="explore-header">
        <h2>🧭 {t('explore')}</h2>
        <button className="refresh-btn" onClick={refresh} title={t('refreshLocation')}>
          🔄
        </button>
      </div>

      {/* Segment tabs: Happening Now / Upcoming */}
      <div className="explore-tabs">
        <button
          className={`explore-tab ${activeTab === 'now' ? 'explore-tab-active' : ''}`}
          onClick={() => setActiveTab('now')}
        >
          🔴 {t('happeningNow')}
          <span className="tab-count">{nowList.length}</span>
        </button>
        <button
          className={`explore-tab ${activeTab === 'upcoming' ? 'explore-tab-active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          📅 {t('upcoming')}
          <span className="tab-count">{upcomingList.length}</span>
        </button>
      </div>

      {/* Food type filter chips */}
      <div className="explore-food-filters">
        <button
          className={`filter-chip ${!foodFilter ? 'filter-chip-active' : ''}`}
          onClick={() => setFoodFilter(null)}
        >
          {t('allTypes')}
        </button>
        {FOOD_TYPES.map((ft) => (
          <button
            key={ft.value}
            className={`filter-chip ${foodFilter === ft.value ? 'filter-chip-active' : ''}`}
            onClick={() => setFoodFilter(foodFilter === ft.value ? null : ft.value)}
          >
            {ft.emoji} {lang === 'hi' ? ft.labelHi : ft.label}
          </button>
        ))}
      </div>

      {/* Distance hint */}
      {location && sorted.length > 0 && (
        <p className="explore-distance-hint">
          📍 {t('sortedByDistance')}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="loading-center">
          <div className="spinner-lg" />
          {loadTimeout && (
            <p className="load-timeout-msg">
              {t('loadTimeout')}
            </p>
          )}
        </div>
      ) : loadError ? (
        <div className="empty-state load-error-state">
          <div className="empty-icon">⚠️</div>
          <p className="empty-title">{t('loadError')}</p>
          <p className="empty-subtitle">
            {loadError.code === 'failed-precondition' && loadError.message?.includes('index')
              ? t('createIndexHelp')
              : loadError.message || t('loadErrorGeneric')}
          </p>
          {loadError.code === 'failed-precondition' && loadError.message?.includes('index') && (
            <a
              href={extractIndexUrl(loadError.message)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ marginTop: 12 }}
            >
              🔗 {t('createIndexLink')}
            </a>
          )}
          <button
            className="btn btn-secondary"
            style={{ marginTop: 8 }}
            onClick={handleRetry}
          >
            🔄 {t('retry')}
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{activeTab === 'now' ? '🍽️' : '📅'}</div>
          <p className="empty-title">
            {activeTab === 'now' ? t('noActiveNearby') : t('noUpcomingNearby')}
          </p>
          <p className="empty-subtitle">{t('beFirst')}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => navigate('/report')}
          >
            ➕ {t('reportBhandara')}
          </button>
        </div>
      ) : (
        <div className="explore-list">
          {sorted.map((b) => (
            <BhandaraCard key={b.id} bhandara={b} userLocation={location} />
          ))}
        </div>
      )}
    </div>
  );
}
