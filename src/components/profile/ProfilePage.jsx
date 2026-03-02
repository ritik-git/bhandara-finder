import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { updateUserProfile } from '../../services/userService';
import { getTrustLevel, TRUST_LEVELS } from '../../services/userService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatRelativeTime, formatDateTime, compressImage } from '../../utils/helpers';
import TrustBadge from './TrustBadge';
import BhandaraCard from '../map/BhandaraCard';
import PlacesAutocomplete from '../shared/PlacesAutocomplete';

const LIBRARIES = ['places'];

export default function ProfilePage() {
  const { currentUser, userProfile, logout, refreshProfile, setUserProfile } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCityInput, setEditCityInput] = useState('');
  const [myBhandaras, setMyBhandaras] = useState([]);
  const [loadingBhandaras, setLoadingBhandaras] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  useEffect(() => {
    if (userProfile) {
      setEditName(userProfile.name || '');
      setEditCity(userProfile.city || '');
      setEditCityInput(userProfile.city || '');
      loadMyBhandaras();
    }
  }, [userProfile]);

  async function loadMyBhandaras() {
    if (!currentUser) return;
    setLoadingBhandaras(true);
    try {
      const q = query(
        collection(db, 'bhandaras'),
        where('reportedBy', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      setMyBhandaras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBhandaras(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressed = file.size > 2 * 1024 * 1024 ? await compressImage(file, 0.5) : file;
      const storageRef = ref(storage, `profiles/${currentUser.uid}`);
      const contentType = compressed.type?.startsWith('image/') ? compressed.type : 'image/jpeg';
      await uploadBytes(storageRef, compressed, { contentType });
      const url = await getDownloadURL(storageRef);
      await updateUserProfile(currentUser.uid, { profilePhoto: url });
      await refreshProfile();
      toast.success(lang === 'hi' ? 'फ़ोटो अपडेट की' : 'Photo updated!');
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setUploadingPhoto(false);
    }
  }

  function startEditing() {
    setEditName(userProfile.name || '');
    setEditCity(userProfile.city || '');
    setEditCityInput(userProfile.city || '');
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    if (!editCity.trim()) {
      toast.error(lang === 'hi' ? 'शहर चुनें' : 'Please select a city');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(currentUser.uid, {
        name: editName.trim(),
        city: editCity.trim(),
      });
      await refreshProfile();
      setEditing(false);
      toast.success(lang === 'hi' ? 'प्रोफ़ाइल अपडेट की' : 'Profile updated!');
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  if (!userProfile) {
    return (
      <div className="loading-page">
        <div className="spinner-lg" />
      </div>
    );
  }

  const trustInfo = TRUST_LEVELS[userProfile.trustLevel] || TRUST_LEVELS.new;
  const nextLevel = userProfile.trustLevel === 'new' ? TRUST_LEVELS.contributor
    : userProfile.trustLevel === 'contributor' ? TRUST_LEVELS.trusted
    : userProfile.trustLevel === 'trusted' ? TRUST_LEVELS.verified
    : null;

  const progressToNext = nextLevel
    ? Math.min(100, ((userProfile.karmaPoints - trustInfo.min) / (nextLevel.min - trustInfo.min)) * 100)
    : 100;

  return (
    <div className="profile-page">
      <div className="profile-header-bar">
        <h2>{t('profile')}</h2>
        <div className="header-actions">
          <button className="lang-toggle-btn" onClick={toggleLang}>
            {lang === 'en' ? 'हिं' : 'EN'}
          </button>
          <button className="icon-btn" onClick={handleLogout} title={t('logout')}>🚪</button>
        </div>
      </div>

      {/* Avatar */}
      <div className="profile-avatar-section">
        <div className="avatar-wrapper" onClick={() => photoRef.current?.click()}>
          {userProfile.profilePhoto ? (
            <img src={userProfile.profilePhoto} alt="Profile" className="avatar-img" />
          ) : (
            <div className="avatar-placeholder">
              {userProfile.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          {uploadingPhoto ? (
            <div className="avatar-loading"><span className="spinner-sm" /></div>
          ) : (
            <div className="avatar-edit-overlay">📷</div>
          )}
        </div>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          style={{ display: 'none' }}
        />

        <div className="profile-name-section">
          {editing ? (
            <div className="edit-profile-form">
              {/* Editable name */}
              <div className="edit-row">
                <label className="edit-label">{lang === 'hi' ? 'नाम' : 'Name'}</label>
                <input
                  className="form-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={50}
                  placeholder={lang === 'hi' ? 'आपका नाम' : 'Your name'}
                />
              </div>

              {/* Editable city — Google Places autocomplete */}
              <div className="edit-row">
                <label className="edit-label">📍 {lang === 'hi' ? 'शहर' : 'City'}</label>
                {isLoaded ? (
                  <PlacesAutocomplete
                    value={editCityInput}
                    onChange={(val) => {
                      setEditCityInput(val);
                      setEditCity('');
                    }}
                    onSelect={(place) => {
                      setEditCity(place.mainText);
                      setEditCityInput(place.mainText);
                    }}
                    placeholder={lang === 'hi' ? 'शहर खोजें...' : 'Search city...'}
                    types={['(cities)']}
                    countryRestriction="in"
                  />
                ) : (
                  <input
                    className="form-input"
                    value={editCityInput}
                    onChange={e => { setEditCityInput(e.target.value); setEditCity(e.target.value); }}
                    placeholder={lang === 'hi' ? 'शहर लिखें' : 'Type city...'}
                  />
                )}
              </div>

              {/* Save / Cancel */}
              <div className="edit-actions">
                <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? <span className="spinner-sm" /> : (lang === 'hi' ? 'सहेजें' : 'Save')}
                </button>
                <button className="btn btn-outline" onClick={() => setEditing(false)}>
                  {lang === 'hi' ? 'रद्द' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div className="name-display">
              <h3 className="profile-name">{userProfile.name}</h3>
              <button className="edit-btn" onClick={startEditing}>✏️</button>
            </div>
          )}
          {!editing && (
            <>
              <p className="profile-city">📍 {userProfile.city}</p>
              <TrustBadge level={userProfile.trustLevel} size="lg" />
            </>
          )}
        </div>
      </div>

      {/* Karma Card */}
      <div className="karma-card">
        <div className="karma-header">
          <span className="karma-label">{t('karmaPoints')}</span>
          <span className="karma-value">{userProfile.karmaPoints || 0}</span>
        </div>
        {nextLevel && (
          <>
            <div className="karma-progress-track">
              <div className="karma-progress-fill" style={{ width: `${progressToNext}%` }} />
            </div>
            <p className="karma-next-level">
              {lang === 'hi'
                ? `${nextLevel.min - (userProfile.karmaPoints || 0)} अंक और चाहिए "${nextLevel.labelHi}" बनने के लिए`
                : `${nextLevel.min - (userProfile.karmaPoints || 0)} more points to become "${nextLevel.label}"`}
            </p>
          </>
        )}
        {!nextLevel && (
          <p className="karma-max">{lang === 'hi' ? 'आप सर्वोच्च स्तर पर हैं! 🏆' : 'You\'ve reached the highest level! 🏆'}</p>
        )}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-num">{userProfile.totalReports || 0}</span>
          <span className="stat-lbl">{t('totalReports')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{userProfile.verifiedReports || 0}</span>
          <span className="stat-lbl">{t('verifiedReports')}</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{userProfile.warningCount || 0}</span>
          <span className="stat-lbl">Warnings</span>
        </div>
      </div>

      {/* Warning indicator */}
      {userProfile.warningCount > 0 && (
        <div className={`warning-banner warning-${userProfile.warningCount >= 2 ? 'final' : 'first'}`}>
          ⚠️ {userProfile.warningCount === 1
            ? (lang === 'hi' ? 'आपको पहली चेतावनी मिली है' : 'You have received 1 warning')
            : (lang === 'hi' ? 'अंतिम चेतावनी — अगला उल्लंघन बैन करेगा' : 'Final warning — next violation results in ban')}
        </div>
      )}

      {/* My Bhandaras */}
      <div className="my-bhandaras-section">
        <h3 className="section-title">{t('myBhandaras')}</h3>
        {loadingBhandaras ? (
          <div className="loading-center"><span className="spinner-sm" /></div>
        ) : myBhandaras.length === 0 ? (
          <div className="empty-state-sm">
            <p>{lang === 'hi' ? 'अभी तक कोई भंडारा रिपोर्ट नहीं किया' : 'No Bhandaras reported yet'}</p>
            <button className="btn btn-primary" onClick={() => navigate('/report')}>
              + {t('reportBhandara')}
            </button>
          </div>
        ) : (
          <div className="bhandara-list">
            {myBhandaras.map(b => (
              <BhandaraCard key={b.id} bhandara={b} userLocation={null} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
