import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';

export default function PhoneLogin() {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { sendOTP } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const navigate = useNavigate();

  function validatePhone(num) {
    return /^[6-9]\d{9}$/.test(num.replace(/\s/g, ''));
  }

  async function handleSendOTP(e) {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s|-/g, '');
    if (!validatePhone(cleanPhone)) {
      setError(t('invalidPhone'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendOTP(cleanPhone);
      sessionStorage.setItem('bf_phone', cleanPhone);
      sessionStorage.setItem('bf_otp_sent_at', Date.now().toString());
      navigate('/verify-otp');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/too-many-requests') {
        setError(t('tooManyAttempts'));
      } else {
        setError(t('error'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div id="recaptcha-container" />

      <button className="lang-toggle-btn" onClick={toggleLang}>
        {lang === 'en' ? 'हिं' : 'EN'}
      </button>

      <button className="back-btn" onClick={() => navigate('/')}>
        ← {t('back')}
      </button>

      <div className="auth-card">
        <div className="auth-logo">📱</div>
        <h2 className="auth-title">{t('enterPhone')}</h2>
        <p className="auth-subtitle">
          {lang === 'hi'
            ? 'हम आपको एक OTP भेजेंगे'
            : "We'll send you an OTP to verify"}
        </p>

        <form onSubmit={handleSendOTP} className="auth-form">
          <div className="phone-input-wrapper">
            <span className="phone-prefix">+91</span>
            <input
              type="tel"
              className={`phone-input ${error ? 'input-error' : ''}`}
              placeholder={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setPhone(val);
                if (error) setError('');
              }}
              maxLength={10}
              autoFocus
              inputMode="numeric"
              autoComplete="tel-national"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || phone.length < 10}
          >
            {loading ? (
              <span className="btn-loading">
                <span className="spinner-sm" /> {lang === 'hi' ? 'भेज रहे हैं...' : 'Sending...'}
              </span>
            ) : t('sendOTP')}
          </button>
        </form>

        <p className="auth-note">
          {lang === 'hi'
            ? 'आपका नंबर किसी के साथ शेयर नहीं किया जाएगा'
            : 'Your number will never be shared with anyone'}
        </p>
      </div>
    </div>
  );
}
