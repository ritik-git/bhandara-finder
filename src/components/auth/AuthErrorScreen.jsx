import { useNavigate, useLocation } from 'react-router-dom';
import { useLang } from '../../contexts/LanguageContext';

export default function AuthErrorScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLang();

  const error = location.state?.error;
  const code = error?.code || 'unknown';
  const message = error?.message || '';

  // User-friendly messages for common Firebase auth errors
  const getFriendlyMessage = () => {
    if (lang === 'hi') {
      switch (code) {
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
          return 'आपने लॉगिन रद्द कर दिया।';
        case 'auth/operation-not-allowed':
          return 'Google लॉगिन अभी सक्षम नहीं है।';
        case 'auth/unauthorized-domain':
          return 'यह वेबसाइट अभी सेट अप नहीं है।';
        case 'auth/network-request-failed':
          return 'इंटरनेट कनेक्शन जांचें।';
        case 'auth/too-many-requests':
          return 'बहुत सारे प्रयास। कृपया बाद में प्रयास करें।';
        default:
          return 'लॉगिन विफल। पुनः प्रयास करें।';
      }
    }
    switch (code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled.';
      case 'auth/operation-not-allowed':
        return 'Google sign-in is not enabled for this app.';
      case 'auth/unauthorized-domain':
        return 'This website is not authorized for sign-in.';
      case 'auth/network-request-failed':
        return 'Please check your internet connection.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      default:
        return 'Sign-in failed. Please try again.';
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-error-icon">⚠️</div>
        <h2 className="auth-title">
          {lang === 'hi' ? 'लॉगिन विफल' : 'Sign-In Failed'}
        </h2>
        <p className="auth-subtitle auth-error-message">{getFriendlyMessage()}</p>

        {(code || message) && (
          <details className="auth-error-details">
            <summary>{lang === 'hi' ? 'तकनीकी विवरण' : 'Technical details'}</summary>
            <pre>{code || '—'}\n{message || '—'}</pre>
          </details>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={() => navigate('/', { replace: true })}
          style={{ marginTop: '1rem' }}
        >
          {lang === 'hi' ? 'वापस जाएं और पुनः प्रयास करें' : 'Go back and try again'}
        </button>
      </div>
    </div>
  );
}
