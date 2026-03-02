import { useNavigate, useLocation } from 'react-router-dom';
import { useLang } from '../../contexts/LanguageContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLang();

  const hideNav = ['/', '/login', '/verify-otp', '/complete-profile', '/banned', '/auth-error'].includes(location.pathname);
  if (hideNav) return null;

  const tabs = [
    { path: '/home',          icon: '🗺️', label: t('home') || 'Home' },
    { path: '/report',        icon: '➕', label: t('reportBhandara') || 'Report', isPrimary: true },
    { path: '/profile',       icon: '👤', label: t('profile') },
    { path: '/explore',       icon: '🧭', label: t('explore') || 'Explore' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            className={`nav-item ${isActive ? 'nav-item-active' : ''} ${tab.isPrimary ? 'nav-item-primary' : ''}`}
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
