import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import PlacesAutocomplete from '../shared/PlacesAutocomplete';

const LIBRARIES = ['places'];

/**
 * Reverse-geocode lat/lng → city name using Google Geocoding API.
 * Returns the city (locality) name or null if not found.
 */
async function reverseGeocodeCity(lat, lng) {
  if (!window.google?.maps?.Geocoder) return null;
  try {
    const geocoder = new window.google.maps.Geocoder();
    const resp = await geocoder.geocode({ location: { lat, lng } });
    if (!resp.results?.length) return null;

    // Walk through address components looking for the city
    for (const result of resp.results) {
      for (const comp of result.address_components) {
        if (comp.types.includes('locality')) {
          return comp.long_name; // e.g. "Pune"
        }
      }
    }
    // Fallback: try administrative_area_level_2 (district)
    for (const result of resp.results) {
      for (const comp of result.address_components) {
        if (comp.types.includes('administrative_area_level_2')) {
          return comp.long_name;
        }
      }
    }
  } catch (err) {
    console.warn('[CompleteProfile] Reverse geocode failed:', err);
  }
  return null;
}

export default function CompleteProfile() {
  const { currentUser, completeProfile } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { location, loading: geoLoading, permissionDenied } = useGeolocation();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  // Pre-fill name from Google account
  const googleName = currentUser?.displayName || '';
  const [name, setName]             = useState(googleName);
  const [city, setCity]             = useState('');    // confirmed city name
  const [cityInput, setCityInput]   = useState('');    // input display text
  const [detectingCity, setDetectingCity] = useState(false);
  const [cityDetected, setCityDetected]  = useState(false);
  const [errors, setErrors]         = useState({});
  const [loading, setLoading]       = useState(false);

  // ── Auto-detect city from GPS when both location and Google Maps API are ready ──
  useEffect(() => {
    if (!isLoaded || !location || cityDetected || city) return;

    async function detect() {
      setDetectingCity(true);
      const detected = await reverseGeocodeCity(location.lat, location.lon);
      if (detected) {
        setCity(detected);
        setCityInput(detected);
        setCityDetected(true);
        if (errors.city) setErrors(p => ({ ...p, city: '' }));
      }
      setDetectingCity(false);
    }

    detect();
  }, [isLoaded, location, cityDetected, city]);

  function validate() {
    const newErrors = {};
    if (!name.trim() || name.trim().length < 2) newErrors.name = t('nameRequired');
    if (!city) newErrors.city = t('cityRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate() || !currentUser) return;
    setLoading(true);
    try {
      await completeProfile(currentUser.uid, name.trim(), city);
      toast.success(lang === 'hi' ? 'प्रोफ़ाइल बनाई गई! स्वागत है 🙏' : 'Profile created! Welcome 🙏');
      navigate('/home');
    } catch (err) {
      console.error(err);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }

  const showCityLoading = geoLoading || detectingCity;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Google avatar if available */}
        {currentUser?.photoURL && (
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <img
              src={currentUser.photoURL}
              alt="Google profile"
              style={{ width: 72, height: 72, borderRadius: '50%', border: '3px solid #FF9933', margin: '0 auto' }}
            />
          </div>
        )}

        <div className="auth-logo" style={{ marginBottom: 4 }}>👤</div>
        <h2 className="auth-title">{t('completeProfile')}</h2>
        <p className="auth-subtitle">
          {lang === 'hi'
            ? 'बस एक बार — हम आपका शहर खोज रहे हैं!'
            : 'Just one more step — we\'re detecting your city!'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Name — pre-filled from Google */}
          <div className="form-group">
            <label className="form-label">{t('yourName')}</label>
            <input
              type="text"
              className={`form-input ${errors.name ? 'input-error' : ''}`}
              placeholder={lang === 'hi' ? 'जैसे राम कुमार' : 'e.g. Ram Kumar'}
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: '' })); }}
              autoComplete="name"
              maxLength={50}
            />
            {errors.name && <p className="form-error">{errors.name}</p>}
          </div>

          {/* City — auto-detected from GPS, editable via Places search */}
          <div className="form-group">
            <label className="form-label">
              {t('yourCity')}
              {showCityLoading && (
                <span className="city-detect-status">
                  <span className="spinner-sm" style={{ marginLeft: 8 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                    {lang === 'hi' ? 'खोज रहा है...' : 'Detecting...'}
                  </span>
                </span>
              )}
            </label>

            {/* Show auto-detected city with change option */}
            {city && !showCityLoading && (
              <div className="detected-city-row">
                <div className="detected-city-badge">
                  <span className="detected-icon">📍</span>
                  <span className="detected-name">{city}</span>
                  {cityDetected && (
                    <span className="detected-auto-tag">
                      {lang === 'hi' ? 'GPS से' : 'auto-detected'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="change-city-btn"
                  onClick={() => {
                    setCity('');
                    setCityInput('');
                    setCityDetected(false);
                  }}
                >
                  {lang === 'hi' ? 'बदलें' : 'Change'}
                </button>
              </div>
            )}

            {/* Show search input when no city or user wants to change */}
            {!city && !showCityLoading && (
              <>
                {permissionDenied && (
                  <p className="form-hint" style={{ color: 'var(--warning)', marginBottom: 8 }}>
                    ⚠️ {lang === 'hi'
                      ? 'लोकेशन अनुमति नहीं दी। कृपया अपना शहर खोजें।'
                      : 'Location permission denied. Please search your city.'}
                  </p>
                )}
                {isLoaded ? (
                  <PlacesAutocomplete
                    value={cityInput}
                    onChange={(val) => {
                      setCityInput(val);
                      setCity('');
                      if (errors.city) setErrors(p => ({ ...p, city: '' }));
                    }}
                    onSelect={(place) => {
                      setCity(place.mainText);
                      setCityInput(place.mainText);
                    }}
                    placeholder={lang === 'hi' ? 'अपना शहर खोजें...' : 'Search your city...'}
                    types={['(cities)']}
                    countryRestriction="in"
                    error={errors.city}
                  />
                ) : (
                  <input
                    type="text"
                    className={`form-input ${errors.city ? 'input-error' : ''}`}
                    placeholder={lang === 'hi' ? 'अपना शहर लिखें' : 'Type your city...'}
                    value={cityInput}
                    onChange={e => {
                      setCityInput(e.target.value);
                      setCity(e.target.value);
                      if (errors.city) setErrors(p => ({ ...p, city: '' }));
                    }}
                  />
                )}
              </>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || showCityLoading}
            style={{ marginTop: '1.5rem' }}
          >
            {loading ? <span className="spinner-sm" /> : `🙏 ${t('saveProfile')}`}
          </button>
        </form>
      </div>
    </div>
  );
}
