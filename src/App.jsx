import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useLang } from './contexts/LanguageContext';

// Layout
import Header from './components/layout/Header';
import BottomNav from './components/layout/BottomNav';
import OfflineBanner from './components/layout/OfflineBanner';

// Auth
import LandingPage from './components/auth/LandingPage';
import CompleteProfile from './components/auth/CompleteProfile';
import BannedScreen from './components/auth/BannedScreen';
import AuthErrorScreen from './components/auth/AuthErrorScreen';

// Main
import MapView from './components/map/MapView';
import ReportForm from './components/bhandara/ReportForm';
import BhandaraDetail from './components/bhandara/BhandaraDetail';
import ProfilePage from './components/profile/ProfilePage';
import NotificationList from './components/notifications/NotificationList';
import ExplorePage from './components/explore/ExplorePage';
import AdminPanel from './components/admin/AdminPanel';

function ProtectedRoute({ children }) {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] loading:', loading, '| currentUser:', currentUser?.email ?? 'null', '| userProfile:', userProfile ? `${userProfile.name} / ${userProfile.city}` : 'null');

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner-lg" />
      </div>
    );
  }

  if (!currentUser) {
    console.log('[ProtectedRoute] → No user, redirecting to /');
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (userProfile?.accountStatus === 'banned' || userProfile?.accountStatus === 'pending_unban') {
    console.log('[ProtectedRoute] → User banned, redirecting to /banned');
    return <Navigate to="/banned" replace />;
  }

  if (!userProfile) {
    console.log('[ProtectedRoute] → No profile, redirecting to /complete-profile');
    return <Navigate to="/complete-profile" replace />;
  }

  console.log('[ProtectedRoute] → Access granted, rendering children.');
  return children;
}

function PublicOnlyRoute({ children }) {
  const { currentUser, userProfile, loading } = useAuth();

  console.log('[PublicOnlyRoute] loading:', loading, '| currentUser:', currentUser?.email ?? 'null', '| userProfile:', userProfile ? `${userProfile.name} / ${userProfile.city}` : 'null');

  if (loading) return <div className="loading-page"><div className="spinner-lg" /></div>;
  if (currentUser && userProfile) {
    console.log('[PublicOnlyRoute] → User already signed in with profile, redirecting to /home');
    return <Navigate to="/home" replace />;
  }
  if (currentUser && !userProfile) {
    // Signed in but no Firestore profile yet (first time user, or Firestore error).
    // Redirect to /complete-profile so they can set up their account.
    console.log('[PublicOnlyRoute] → User signed in but no profile — redirecting to /complete-profile');
    return <Navigate to="/complete-profile" replace />;
  }
  return children;
}

export default function App() {
  const { loading, redirectError, clearRedirectError } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  // When Google redirect returns with an error, navigate to auth error screen
  useEffect(() => {
    if (redirectError && location.pathname !== '/auth-error') {
      clearRedirectError();
      navigate('/auth-error', { replace: true, state: { error: redirectError } });
    }
  }, [redirectError, location.pathname, navigate, clearRedirectError]);

  if (loading) {
    return (
      <div className="loading-page splash">
        <div className="splash-logo">🙏</div>
        <div className="splash-title">Bhandara Finder</div>
        <div className="splash-subtitle">भंडारा फाइंडर</div>
        <div className="spinner-lg" style={{ marginTop: '2rem' }} />
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <OfflineBanner />
      <Header />

      <main className="app-main">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>} />
          <Route path="/auth-error" element={<AuthErrorScreen />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/banned" element={<BannedScreen />} />

          {/* Protected routes */}
          <Route path="/home" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><ReportForm /></ProtectedRoute>} />
          <Route path="/bhandara/:id" element={<ProtectedRoute><BhandaraDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/explore" element={<ProtectedRoute><ExplorePage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationList /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}
