import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';

// Detect in-app browsers (WebViews) where Google OAuth is blocked
function detectInAppBrowser() {
  const ua = navigator.userAgent || '';
  if (/Instagram/i.test(ua))  return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/WhatsApp/i.test(ua))   return 'WhatsApp';
  if (/Twitter/i.test(ua))    return 'Twitter / X';
  if (/Snapchat/i.test(ua))   return 'Snapchat';
  if (/TikTok|musical_ly/i.test(ua)) return 'TikTok';
  if (/Line\//i.test(ua))     return 'Line';
  if (/GSA\//i.test(ua))      return 'Google Search App';
  // Generic Android WebView (Version/ without Chrome/)
  if (/Android/.test(ua) && /Version\/\d/.test(ua) && !/Chrome\/\d/.test(ua)) return 'In-App Browser';
  return null;
}

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const { t, lang, toggleLang } = useLang();

  const inAppBrowser = detectInAppBrowser();
  const appUrl = 'https://bhandara-f9f81.web.app';

  // ── Show WebView warning ─────────────────────────────────────────────────────
  if (inAppBrowser) {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const chromeIntentUrl = `intent://${appUrl.replace('https://', '')}#Intent;scheme=https;package=com.android.chrome;end`;

    async function copyLink() {
      try {
        await navigator.clipboard.writeText(appUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        // fallback — select text
        const el = document.createElement('input');
        el.value = appUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    }

    return (
      <div className="landing-page">
        <div className="landing-bg" />
        <button className="lang-toggle-btn" onClick={toggleLang} aria-label="Toggle language">
          {lang === 'en' ? 'हिं' : 'EN'}
        </button>
        <div className="landing-content">
          <div className="landing-logo">
            <div className="logo-icon">🙏</div>
            <h1 className="logo-title">{t('appName')}</h1>
          </div>

          <div className="webview-warning">
            <div className="webview-warning-icon">🌐</div>
            <h2 className="webview-warning-title">
              {lang === 'hi' ? 'Chrome / Safari में खोलें' : 'Open in Chrome or Safari'}
            </h2>
            <p className="webview-warning-desc">
              {lang === 'hi'
                ? `Google Sign-In ${inAppBrowser} के अंदर काम नहीं करता। कृपया इस लिंक को Chrome या Safari में खोलें।`
                : `Google Sign-In doesn't work inside ${inAppBrowser}. Please open this link in Chrome or Safari.`}
            </p>

            <div className="webview-steps">
              {lang === 'hi' ? (
                <>
                  <p>📋 <strong>तरीका:</strong></p>
                  <p>1. नीचे "लिंक कॉपी करें" दबाएँ</p>
                  <p>2. Chrome या Safari खोलें</p>
                  <p>3. एड्रेस बार में लिंक पेस्ट करें</p>
                </>
              ) : (
                <>
                  <p>📋 <strong>How to open:</strong></p>
                  <p>1. Tap "Copy Link" below</p>
                  <p>2. Open Chrome or Safari</p>
                  <p>3. Paste the link in the address bar</p>
                </>
              )}
            </div>

            <div className="webview-url-box">{appUrl}</div>

            <button className="webview-copy-btn" onClick={copyLink}>
              {copied
                ? (lang === 'hi' ? '✅ कॉपी हो गया!' : '✅ Copied!')
                : (lang === 'hi' ? '📋 लिंक कॉपी करें' : '📋 Copy Link')}
            </button>

            {isAndroid && (
              <a className="webview-chrome-btn" href={chromeIntentUrl}>
                {lang === 'hi' ? '🔵 Chrome में खोलें' : '🔵 Open in Chrome'}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  async function handleGoogleSignIn() {
    console.log('[LandingPage] Google Sign-In button clicked.');
    setLoading(true);
    try {
      console.log('[LandingPage] Calling signInWithGoogle()...');
      // signInWithPopup: opens Google account picker in a popup.
      // On success, onAuthStateChanged fires → PublicOnlyRoute sends user to
      // /complete-profile (new user) or /home (returning user with profile).
      await signInWithGoogle();

      console.log('[LandingPage] signInWithGoogle() resolved — popup closed, auth state updating...');
    } catch (err) {
      console.error('[LandingPage] ❌ signInWithGoogle() threw an error:', err.code, err.message, err);
      setLoading(false);
      navigate('/auth-error', {
        replace: true,
        state: { error: { code: err?.code, message: err?.message } },
      });
    }
    // Don't setLoading(false) on success — page is navigating away
  }

  return (
    <div className="landing-page">
      <div className="landing-bg" />

      <button className="lang-toggle-btn" onClick={toggleLang} aria-label="Toggle language">
        {lang === 'en' ? 'हिं' : 'EN'}
      </button>

      <div className="landing-content">
        <div className="landing-logo">
          <div className="logo-icon">🙏</div>
          <h1 className="logo-title">{t('appName')}</h1>
          <p className="logo-tagline">{t('tagline')}</p>
        </div>

        <div className="landing-features">
          <div className="feature-item">
            <span className="feature-icon">📍</span>
            <span>{lang === 'hi' ? 'पास के भंडारे खोजें' : 'Find nearby Bhandaras'}</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📸</span>
            <span>{lang === 'hi' ? 'फ़ोटो के साथ रिपोर्ट करें' : 'Report with photos'}</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⭐</span>
            <span>{lang === 'hi' ? 'कर्म अंक अर्जित करें' : 'Earn karma points'}</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🔔</span>
            <span>{lang === 'hi' ? 'नजदीकी सूचनाएँ पाएँ' : 'Get local notifications'}</span>
          </div>
        </div>

        <button
          className="google-signin-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <span className="btn-loading">
              <span className="spinner-sm spinner-dark" />
              {lang === 'hi' ? 'Google पर जा रहे हैं...' : 'Redirecting to Google...'}
            </span>
          ) : (
            <>
              <GoogleIcon />
              {lang === 'hi' ? 'Google से जारी रखें' : 'Continue with Google'}
            </>
          )}
        </button>

        <p className="landing-disclaimer">
          {lang === 'hi'
            ? 'लॉगिन करके आप हमारी सेवा शर्तों से सहमत हैं'
            : 'By continuing you agree to our Terms of Service'}
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-3-11.4-7.4l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.2 5.2C41 35.1 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
    </svg>
  );
}
