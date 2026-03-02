import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import {
  submitBhandara, checkDuplicate, checkRateLimit,
  checkSameLocationRecent, confirmBhandara, FOOD_TYPES
} from '../../services/bhandaraService';
import { compressImage, generateLocalDatetime, isIndia } from '../../utils/helpers';
import PlacesAutocomplete from '../shared/PlacesAutocomplete';
import DuplicateModal from './DuplicateModal';

// Shared with MapView — same key, same libraries, SDK loads only once
const LIBRARIES = ['places'];

const PICKER_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',
  clickableIcons: false,
};

const PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.25 18 30 18 30S36 31.25 36 18C36 8.06 27.94 0 18 0z"
          fill="#FF9933" stroke="white" stroke-width="1.5"/>
    <circle cx="18" cy="17" r="11" fill="white" opacity="0.92"/>
    <text x="18" y="22" text-anchor="middle" font-size="15" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">📍</text>
  </svg>
`)}`;

const MAX_PHOTOS = 5;

export default function ReportForm() {
  const { currentUser, userProfile } = useAuth();
  const { t, lang } = useLang();
  const { location } = useGeolocation();
  const navigate = useNavigate();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const [form, setForm] = useState({
    title: '',
    address: '',
    locality: '',
    startTime: generateLocalDatetime(),
    endTime: '',
    foodType: [],
    organizerName: '',
    description: '',
    isRecurring: false,
    recurringPattern: 'weekly',
  });
  const [pinLocation, setPinLocation] = useState(
    location ? { lat: location.lat, lon: location.lon } : { lat: 28.6139, lon: 77.2090 }
  );
  const [photos, setPhotos] = useState([]); // {file, preview}[]
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [pickerMapRef, setPickerMapRef] = useState(null);
  const fileInputRef = useRef();

  function setField(key, value) {
    setForm(p => ({ ...p, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  }

  function toggleFoodType(ft) {
    setForm(p => ({
      ...p,
      foodType: p.foodType.includes(ft)
        ? p.foodType.filter(x => x !== ft)
        : [...p.foodType, ft]
    }));
  }

  async function handlePhotoAdd(e) {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > MAX_PHOTOS) {
      toast.error(`Max ${MAX_PHOTOS} photos allowed`);
      return;
    }
    for (const file of files) {
      setLoadingMsg(t('compressingPhoto'));
      const compressed = file.size > 5 * 1024 * 1024 ? await compressImage(file) : file;
      const preview = URL.createObjectURL(compressed);
      setPhotos(p => [...p, { file: compressed, preview }]);
    }
    setLoadingMsg('');
    if (errors.photos) setErrors(p => ({ ...p, photos: '' }));
  }

  function removePhoto(index) {
    setPhotos(p => {
      URL.revokeObjectURL(p[index].preview);
      return p.filter((_, i) => i !== index);
    });
  }

  function validate() {
    const newErrors = {};
    const newWarnings = [];
    if (!form.title.trim()) newErrors.title = t('titleRequired');
    if (!form.address.trim()) newErrors.address = t('addressRequired');
    if (!form.startTime) newErrors.startTime = t('startTimeRequired');
    if (photos.length === 0) newErrors.photos = t('photoRequired');

    if (form.startTime && form.endTime) {
      if (new Date(form.endTime) <= new Date(form.startTime)) {
        newErrors.endTime = t('endBeforeStart');
      }
    }

    if (form.startTime) {
      const start = new Date(form.startTime);
      const now = new Date();
      if (start < new Date(now - 60 * 60 * 1000)) {
        newWarnings.push('pastTime');
      }
      if (start > new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        newWarnings.push('futureDate');
      }
    }

    if (!isIndia(pinLocation.lat, pinLocation.lon)) {
      newWarnings.push('unusualLocation');
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Rate limit check
      const recentCount = await checkRateLimit(currentUser.uid);
      if (recentCount >= 3) {
        const waitMins = 60 - Math.floor((Date.now() % 3600000) / 60000);
        toast.error(`${t('rateLimit')} ${waitMins} ${t('minutes')}`);
        setLoading(false);
        return;
      }

      // Same location check
      const sameLocation = await checkSameLocationRecent(currentUser.uid, pinLocation.lat, pinLocation.lon);
      if (sameLocation) {
        toast.error(lang === 'hi' ? 'आपने 24 घंटे में इस स्थान पर पहले ही रिपोर्ट की है' : 'You already reported a Bhandara at this location recently');
        setLoading(false);
        return;
      }

      // Deduplication check
      const dups = await checkDuplicate(pinLocation.lat, pinLocation.lon, form.startTime);
      if (dups.length > 0) {
        setDuplicates(dups);
        setShowDuplicate(true);
        setLoading(false);
        return;
      }

      await doSubmit();
    } catch (err) {
      console.error(err);
      toast.error(t('error'));
      setLoading(false);
    }
  }

  async function doSubmit() {
    setLoading(true);
    setLoadingMsg(t('uploadingPhotos'));
    try {
      const formData = {
        ...form,
        reporterName: userProfile?.name || 'Anonymous',
        latitude: pinLocation.lat,
        longitude: pinLocation.lon,
        city: userProfile?.city || '',
      };
      const id = await submitBhandara(currentUser.uid, formData, photos.map(p => p.file));
      toast.success(t('reportSubmitted'));
      navigate(`/bhandara/${id}`);
    } catch (err) {
      console.error(err);
      toast.error(t('error'));
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }

  async function handleDuplicateConfirm(bhandaraId) {
    setShowDuplicate(false);
    setLoading(true);
    try {
      await confirmBhandara(bhandaraId, currentUser.uid);
      toast.success(t('confirmedExisting'));
      navigate(`/bhandara/${bhandaraId}`);
    } catch (err) {
      toast.error(err.message || t('error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicateDifferent() {
    setShowDuplicate(false);
    await doSubmit();
  }

  return (
    <div className="report-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>{t('reportTitle')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="report-form">
        {/* Title */}
        <div className="form-group">
          <label className="form-label">
            {t('bhandaraTitle')} <span className="required">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.title ? 'input-error' : ''}`}
            placeholder={t('bhandaraTitlePlaceholder')}
            value={form.title}
            onChange={e => setField('title', e.target.value)}
            maxLength={100}
          />
          {errors.title && <p className="form-error">{errors.title}</p>}
          <p className="char-hint">{form.title.length}/100</p>
        </div>

        {/* Address — Google Places autocomplete */}
        <div className="form-group">
          <label className="form-label">
            {t('address')} <span className="required">*</span>
          </label>
          {isLoaded ? (
            <PlacesAutocomplete
              value={form.address}
              onChange={(val) => setField('address', val)}
              onSelect={(place) => {
                setField('address', place.description);
                // If place has coordinates, move the map pin there
                if (place.lat && place.lng) {
                  setPinLocation({ lat: place.lat, lon: place.lng });
                  if (pickerMapRef) {
                    pickerMapRef.panTo({ lat: place.lat, lng: place.lng });
                    pickerMapRef.setZoom(17);
                  }
                }
              }}
              placeholder={t('addressPlaceholder')}
              types={['geocode', 'establishment']}
              countryRestriction="in"
              error={errors.address}
            />
          ) : (
            <>
              <input
                type="text"
                className={`form-input ${errors.address ? 'input-error' : ''}`}
                placeholder={t('addressPlaceholder')}
                value={form.address}
                onChange={e => setField('address', e.target.value)}
              />
              {errors.address && <p className="form-error">{errors.address}</p>}
            </>
          )}
          <input
            type="text"
            className="form-input"
            placeholder={lang === 'hi' ? 'इलाका / मोहल्ला (वैकल्पिक)' : 'Locality / Area (optional)'}
            value={form.locality}
            onChange={e => setField('locality', e.target.value)}
            style={{ marginTop: '8px' }}
          />
        </div>

        {/* Map pin */}
        <div className="form-group">
          <label className="form-label">
            📍 {lang === 'hi' ? 'मानचित्र पर स्थान सेट करें' : 'Set exact location on map'}
          </label>
          <p className="form-hint">
            {lang === 'hi' ? 'मानचित्र पर टैप करें या पिन खींचें' : 'Tap on map to place pin, or drag to adjust'}
          </p>
          <div className="map-picker">
            {isLoaded ? (
              <GoogleMap
                mapContainerClassName="picker-map"
                center={{ lat: pinLocation.lat, lng: pinLocation.lon }}
                zoom={15}
                options={PICKER_OPTIONS}
                onLoad={map => setPickerMapRef(map)}
                onClick={e => setPinLocation({ lat: e.latLng.lat(), lon: e.latLng.lng() })}
              >
                <Marker
                  position={{ lat: pinLocation.lat, lng: pinLocation.lon }}
                  draggable
                  onDragEnd={e => setPinLocation({ lat: e.latLng.lat(), lon: e.latLng.lng() })}
                  icon={{
                    url: PIN_SVG,
                    scaledSize: new window.google.maps.Size(36, 48),
                    anchor:     new window.google.maps.Point(18, 48),
                  }}
                />
              </GoogleMap>
            ) : (
              <div className="picker-map map-loading">
                <div className="spinner-lg" />
              </div>
            )}
          </div>
          {warnings.includes('unusualLocation') && (
            <p className="form-warning">⚠️ {lang === 'hi' ? 'यह स्थान असामान्य लग रहा है। कृपया सत्यापित करें।' : 'This location seems unusual. Please verify.'}</p>
          )}
          <p className="coord-hint">📌 {pinLocation.lat.toFixed(5)}, {pinLocation.lon.toFixed(5)}</p>
        </div>

        {/* Times */}
        <div className="form-row">
          <div className="form-group form-group-half">
            <label className="form-label">
              {t('startTime')} <span className="required">*</span>
            </label>
            <input
              type="datetime-local"
              className={`form-input ${errors.startTime ? 'input-error' : ''}`}
              value={form.startTime}
              onChange={e => setField('startTime', e.target.value)}
            />
            {errors.startTime && <p className="form-error">{errors.startTime}</p>}
            {warnings.includes('pastTime') && (
              <p className="form-warning">⚠️ {t('pastTimeWarning')}</p>
            )}
            {warnings.includes('futureDate') && (
              <p className="form-warning">⚠️ {t('futureDateWarning')}</p>
            )}
          </div>
          <div className="form-group form-group-half">
            <label className="form-label">{t('endTime')}</label>
            <input
              type="datetime-local"
              className={`form-input ${errors.endTime ? 'input-error' : ''}`}
              value={form.endTime}
              onChange={e => setField('endTime', e.target.value)}
            />
            {errors.endTime && <p className="form-error">{errors.endTime}</p>}
          </div>
        </div>

        {/* Food Types */}
        <div className="form-group">
          <label className="form-label">{t('foodTypes')}</label>
          <div className="food-type-grid">
            {FOOD_TYPES.map(ft => (
              <button
                key={ft.value}
                type="button"
                className={`food-type-btn ${form.foodType.includes(ft.value) ? 'food-type-selected' : ''}`}
                onClick={() => toggleFoodType(ft.value)}
              >
                <span>{ft.emoji}</span>
                <span>{lang === 'hi' ? ft.labelHi : ft.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Organizer */}
        <div className="form-group">
          <label className="form-label">{t('organizerName')}</label>
          <input
            type="text"
            className="form-input"
            placeholder={lang === 'hi' ? 'आयोजक का नाम या संस्था' : 'Organizer or organization name'}
            value={form.organizerName}
            onChange={e => setField('organizerName', e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">{t('description')}</label>
          <textarea
            className="form-textarea"
            placeholder={lang === 'hi' ? 'भंडारे के बारे में कुछ और बताएँ...' : 'Additional details about the Bhandara...'}
            value={form.description}
            onChange={e => setField('description', e.target.value)}
            rows={3}
            maxLength={300}
          />
          <p className="char-hint">{form.description.length}/300</p>
        </div>

        {/* Recurring */}
        <div className="form-group">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={e => setField('isRecurring', e.target.checked)}
              className="toggle-input"
            />
            <span className="toggle-track" />
            <span>{t('isRecurring')}</span>
          </label>
          {form.isRecurring && (
            <select
              className="form-select"
              value={form.recurringPattern}
              onChange={e => setField('recurringPattern', e.target.value)}
              style={{ marginTop: '8px' }}
            >
              <option value="weekly">{t('weekly')}</option>
              <option value="monthly">{t('monthly')}</option>
              <option value="annual">{t('annual')}</option>
            </select>
          )}
        </div>

        {/* Photos */}
        <div className="form-group">
          <label className="form-label">
            {t('photos')} <span className="required">*</span>
          </label>
          <div className="photo-grid">
            {photos.map((p, i) => (
              <div key={i} className="photo-thumb">
                <img src={p.preview} alt={`photo ${i + 1}`} />
                <button type="button" className="photo-remove" onClick={() => removePhoto(i)}>✕</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                className="photo-add-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <span>📷</span>
                <span>{t('addPhoto')}</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handlePhotoAdd}
            style={{ display: 'none' }}
          />
          {errors.photos && <p className="form-error">{errors.photos}</p>}
        </div>

        {loadingMsg && (
          <div className="loading-msg">
            <span className="spinner-sm" /> {loadingMsg}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full btn-submit"
          disabled={loading}
        >
          {loading ? (
            <span className="btn-loading">
              <span className="spinner-sm" /> {t('submitting')}
            </span>
          ) : `🙏 ${t('submitReport')}`}
        </button>
      </form>

      {showDuplicate && (
        <DuplicateModal
          duplicates={duplicates}
          onConfirm={handleDuplicateConfirm}
          onDifferent={handleDuplicateDifferent}
          onClose={() => setShowDuplicate(false)}
        />
      )}
    </div>
  );
}
