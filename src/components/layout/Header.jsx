import { useNavigate, useLocation } from 'react-router-dom';
import { useLang } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../notifications/NotificationBell';

export default function Header() {
  const { t, lang, toggleLang } = useLang();
  const { isAdminUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const hideHeader = ['/', '/login', '/verify-otp', '/complete-profile', '/banned', '/auth-error'].includes(location.pathname);
  if (hideHeader) return null;

  return (
    <header className="app-header">
      <div className="header-left">
        <span className="header-logo" onClick={() => navigate('/home')}>🙏</span>
        <span className="header-title" onClick={() => navigate('/home')}>{t('appName')}</span>
      </div>

      {/* Desktop inline nav — hidden on mobile via CSS */}
      <nav className="header-desktop-nav">
        <button
          className={`desktop-nav-item ${location.pathname === '/home' ? 'desktop-nav-active' : ''}`}
          onClick={() => navigate('/home')}
        >
          🗺️ {lang === 'hi' ? 'मानचित्र' : 'Map'}
        </button>
        <button
          className={`desktop-nav-item ${location.pathname === '/report' ? 'desktop-nav-active' : ''}`}
          onClick={() => navigate('/report')}
        >
          ➕ {lang === 'hi' ? 'रिपोर्ट' : 'Report'}
        </button>
        <button
          className={`desktop-nav-item ${location.pathname === '/explore' ? 'desktop-nav-active' : ''}`}
          onClick={() => navigate('/explore')}
        >
          🧭 {t('explore')}
        </button>
        <button
          className={`desktop-nav-item ${location.pathname === '/profile' ? 'desktop-nav-active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          👤 {t('profile')}
        </button>
      </nav>

      <div className="header-right">
        {isAdminUser && (
          <button
            className="admin-badge"
            onClick={() => navigate('/admin')}
            title="Admin Panel"
          >
            ⚙️
          </button>
        )}
        <NotificationBell />
        <button className="lang-toggle-btn header-lang" onClick={toggleLang}>
          {lang === 'en' ? 'हिं' : 'EN'}
        </button>
      </div>
    </header>
  );
}
