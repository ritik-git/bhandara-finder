import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import toast from 'react-hot-toast';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLang } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToBhandaras } from '../../services/bhandaraService';
import { haversineDistance, formatTimeLeft, toDate, getPinColor } from '../../utils/helpers';
import FilterBar from './FilterBar';
import BottomSheet from './BottomSheet';

// ── Shared Google Maps config ─────────────────────────────────────────────────
const LIBRARIES = ['places'];

// Map display options — clean, minimal like Uber/Google Maps
const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: false,
  gestureHandling: 'greedy',
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
};

// ── Custom SVG pin builder ────────────────────────────────────────────────────
function makePinSvg(color, emoji = '🙏', size = 36) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.33)}" viewBox="0 0 36 48">
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/>
      </filter>
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.25 18 30 18 30S36 31.25 36 18C36 8.06 27.94 0 18 0z"
            fill="${color}" filter="url(#shadow)"/>
      <circle cx="18" cy="17" r="11" fill="white" opacity="0.93"/>
      <text x="18" y="22" text-anchor="middle" font-size="13" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">${emoji}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// User location blue dot (same style as Google Maps)
const USER_DOT_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.2"/>
    <circle cx="12" cy="12" r="6" fill="#4285F4" stroke="white" stroke-width="2"/>
  </svg>`;

// ── Main Component ────────────────────────────────────────────────────────────
export default function MapView() {
  const [bhandaras, setBhandaras] = useState([]);
  const [filter, setFilter] = useState('today');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selected, setSelected] = useState(null);   // currently tapped bhandara
  const [mapRef, setMapRef] = useState(null);
  const [mapType, setMapType] = useState('roadmap'); // roadmap | satellite

  const { location, permissionDenied, refresh: refreshLocation } = useGeolocation();
  const { t, lang } = useLang();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  // Subscribe to live Firestore bhandaras
  useEffect(() => {
    const unsub = subscribeToBhandaras(
      (data) => setBhandaras(data),
      ['reported', 'active', 'expiring'],
      (err) => {
        if (err?.code === 'failed-precondition' && err?.message?.includes('index')) {
          toast.error('Firestore index required. Open Explore tab for setup link.');
        } else {
          toast.error('Could not load Bhandaras');
        }
      }
    );
    return unsub;
  }, []);

  const now = new Date();

  const mapCenter = useMemo(() =>
    location
      ? { lat: location.lat, lng: location.lon }
      : { lat: 28.6139, lng: 77.2090 },   // Delhi fallback
    [location?.lat, location?.lon]
  );

  // ── Filter logic (unchanged from original) ────────────────────────────────
  const filteredBhandaras = useMemo(() => {
    return bhandaras.filter(b => {
      const start = toDate(b.startTime);
      const end   = toDate(b.expiresAt || b.endTime);

      if (verifiedOnly && b.confirmationCount < 3) return false;
      if (!['reported', 'active', 'expiring', 'under_review'].includes(b.status)) return false;

      if (filter === 'today') {
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59);
        return start && start <= todayEnd && (!end || end >= now);
      }
      if (filter === 'tomorrow') {
        const tmrStart = new Date(now); tmrStart.setDate(tmrStart.getDate() + 1); tmrStart.setHours(0, 0, 0);
        const tmrEnd   = new Date(tmrStart); tmrEnd.setHours(23, 59, 59);
        return start && start >= tmrStart && start <= tmrEnd;
      }
      if (filter === 'week') {
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
        return start && start <= weekEnd && (!end || end >= now);
      }
      return true;
    });
  }, [bhandaras, filter, verifiedOnly]);

  const nearbyBhandaras = useMemo(() => {
    if (!location) return filteredBhandaras;
    return [...filteredBhandaras]
      .map(b => ({
        ...b,
        _distance: haversineDistance(location.lat, location.lon, b.latitude, b.longitude),
      }))
      .sort((a, b) => a._distance - b._distance);
  }, [filteredBhandaras, location]);

  // ── Map handlers ─────────────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    setMapRef(map);
  }, []);

  const panToUser = useCallback(() => {
    refreshLocation();
    if (mapRef && location) {
      mapRef.panTo({ lat: location.lat, lng: location.lon });
      mapRef.setZoom(15);
    }
  }, [mapRef, location, refreshLocation]);

  const toggleMapType = useCallback(() => {
    const next = mapType === 'roadmap' ? 'satellite' : 'roadmap';
    setMapType(next);
    mapRef?.setMapTypeId(next);
  }, [mapRef, mapType]);

  // ── Error / loading states ────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="map-page">
        <div className="map-api-error">
          <p>⚠️ {lang === 'hi' ? 'मानचित्र लोड नहीं हुआ।' : 'Map failed to load.'}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Check <code>VITE_GOOGLE_MAPS_API_KEY</code> in your <code>.env</code> file.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="map-page">
      {permissionDenied && (
        <div className="location-banner">📍 {t('enableLocation')}</div>
      )}

      <FilterBar
        filter={filter}
        onFilterChange={setFilter}
        verifiedOnly={verifiedOnly}
        onVerifiedToggle={() => setVerifiedOnly(v => !v)}
      />

      <div className="map-container">
        {isLoaded ? (
          <GoogleMap
            mapContainerClassName="leaflet-map"
            center={mapCenter}
            zoom={13}
            options={MAP_OPTIONS}
            onLoad={onMapLoad}
            onClick={() => setSelected(null)}
          >
            {/* ── User location blue dot ─────────────────────────────────── */}
            {location && (
              <Marker
                position={{ lat: location.lat, lng: location.lon }}
                icon={{
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(USER_DOT_SVG)}`,
                  scaledSize: new window.google.maps.Size(24, 24),
                  anchor:     new window.google.maps.Point(12, 12),
                }}
                zIndex={1000}
                title="You are here"
              />
            )}

            {/* ── Bhandara pins ──────────────────────────────────────────── */}
            {filteredBhandaras.map(b => (
              <Marker
                key={b.id}
                position={{ lat: b.latitude, lng: b.longitude }}
                icon={{
                  url: makePinSvg(getPinColor(b.status), b.isRecurring ? '♻️' : '🙏'),
                  scaledSize: new window.google.maps.Size(36, 48),
                  anchor:     new window.google.maps.Point(18, 48),
                }}
                onClick={() => setSelected(b)}
                zIndex={selected?.id === b.id ? 999 : 1}
                animation={selected?.id === b.id ? window.google.maps.Animation.BOUNCE : null}
              />
            ))}

            {/* ── InfoWindow popup ───────────────────────────────────────── */}
            {selected && (
              <InfoWindow
                position={{ lat: selected.latitude, lng: selected.longitude }}
                onCloseClick={() => setSelected(null)}
                options={{ pixelOffset: new window.google.maps.Size(0, -52) }}
              >
                <div
                  className="gmap-popup"
                  onClick={() => navigate(`/bhandara/${selected.id}`)}
                >
                  <p className="gmap-popup-title">{selected.title}</p>
                  {selected.address && (
                    <p className="gmap-popup-address">{selected.address}</p>
                  )}
                  <p className="gmap-popup-time">
                    ⏱ {formatTimeLeft(selected.expiresAt, lang)}
                  </p>
                  <p className="gmap-popup-cta">
                    {lang === 'hi' ? 'विवरण देखें →' : 'View details →'}
                  </p>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        ) : (
          <div className="map-loading">
            <div className="spinner-lg" />
            <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {lang === 'hi' ? 'मानचित्र लोड हो रहा है...' : 'Loading map...'}
            </p>
          </div>
        )}

        {/* ── Map controls ───────────────────────────────────────────────── */}
        <button
          className="map-control-btn location-btn"
          onClick={panToUser}
          title={t('myLocation')}
        >
          🎯
        </button>

        <button
          className="map-control-btn map-type-btn"
          onClick={toggleMapType}
          title={mapType === 'roadmap' ? 'Switch to Satellite' : 'Switch to Map'}
        >
          {mapType === 'roadmap' ? '🛰' : '🗺'}
        </button>

        {/* ── FAB report button ───────────────────────────────────────────── */}
        <button
          className="fab-report"
          onClick={() => navigate('/report')}
          title={t('reportBhandara')}
        >
          <span className="fab-icon">+</span>
          <span className="fab-label">{t('reportBhandara')}</span>
        </button>
      </div>

      <BottomSheet bhandaras={nearbyBhandaras} userLocation={location} />
    </div>
  );
}
