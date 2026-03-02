import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { getUserProfile } from '../../services/userService';

const MAX_ATTEMPTS = 3;
const LOCK_DURATION = 5 * 60 * 1000; // 5 minutes
const RESEND_DELAY = 30; // seconds
const OTP_EXPIRY = 60; // seconds

export default function OTPVerification() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_DELAY);
  const [canResend, setCanResend] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const inputRefs = useRef([]);
  const { verifyOTP, sendOTP, currentUser, userProfile } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const navigate = useNavigate();
  const phone = sessionStorage.getItem('bf_phone');
  const sentAt = parseInt(sessionStorage.getItem('bf_otp_sent_at') || '0');

  // Check if OTP session is valid
  useEffect(() => {
    if (!phone) { navigate('/login'); return; }
    const elapsed = Date.now() - sentAt;
    if (elapsed > OTP_EXPIRY * 1000) {
      // OTP expired, reset to phone entry
    }
  }, []);

  // Resend countdown
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(t => {
          if (t <= 1) { setCanResend(true); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Lock countdown
  useEffect(() => {
    let interval;
    if (locked && lockTimer > 0) {
      interval = setInterval(() => {
        setLockTimer(t => {
          if (t <= 1) { setLocked(false); setAttempts(0); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [locked, lockTimer]);

  function handleOtpChange(index, value) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d !== '')) {
      handleVerify(newOtp.join(''));
    }
    if (error) setError('');
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(otpValue) {
    const code = otpValue || otp.join('');
    if (code.length !== 6) return;
    if (locked) return;
    setLoading(true);
    setError('');
    try {
      const user = await verifyOTP(code);
      const profile = await getUserProfile(user.uid);
      sessionStorage.removeItem('bf_phone');
      sessionStorage.removeItem('bf_otp_sent_at');
      if (!profile) {
        navigate('/complete-profile');
      } else if (profile.accountStatus === 'banned' || profile.accountStatus === 'pending_unban') {
        navigate('/banned');
      } else {
        navigate('/');
      }
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();

      if (newAttempts >= MAX_ATTEMPTS) {
        setLocked(true);
        setLockTimer(LOCK_DURATION / 1000);
        setError(t('tooManyAttempts'));
      } else {
        if (err.code === 'auth/code-expired') {
          setError(t('otpExpired'));
        } else {
          setError(`${t('invalidOTP')} (${MAX_ATTEMPTS - newAttempts} ${lang === 'hi' ? 'प्रयास बचे' : 'attempts left'})`);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!canResend || !phone) return;
    try {
      setLoading(true);
      await sendOTP(phone);
      sessionStorage.setItem('bf_otp_sent_at', Date.now().toString());
      setCanResend(false);
      setResendTimer(RESEND_DELAY);
      setAttempts(0);
      setLocked(false);
      setOtp(['', '', '', '', '', '']);
      setError('');
      toast.success(lang === 'hi' ? 'OTP फिर से भेजा गया' : 'OTP resent!');
    } catch (err) {
      toast.error(t('error'));
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

      <button className="back-btn" onClick={() => navigate('/login')}>
        ← {t('back')}
      </button>

      <div className="auth-card">
        <div className="auth-logo">🔐</div>
        <h2 className="auth-title">{t('enterOTP')}</h2>
        <p className="auth-subtitle">
          {t('otpSent')} <strong>+91 {phone}</strong>
        </p>

        <div className="otp-inputs">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleOtpChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`otp-input ${error ? 'input-error' : ''} ${locked ? 'input-locked' : ''}`}
              disabled={loading || locked}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}

        {locked && (
          <p className="lock-timer">
            🔒 {lang === 'hi' ? `${Math.floor(lockTimer / 60)}:${String(lockTimer % 60).padStart(2, '0')} में अनलॉक होगा` : `Unlocks in ${Math.floor(lockTimer / 60)}:${String(lockTimer % 60).padStart(2, '0')}`}
          </p>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={() => handleVerify()}
          disabled={loading || otp.join('').length !== 6 || locked}
        >
          {loading ? <span className="spinner-sm" /> : t('verify')}
        </button>

        <div className="resend-section">
          {canResend ? (
            <button className="btn-text" onClick={handleResend} disabled={loading}>
              🔄 {t('resendOTP')}
            </button>
          ) : (
            <p className="resend-timer">
              {resendTimer > 0 ? (
                <>{t('resendIn')} <strong>{resendTimer}s</strong></>
              ) : (
                <button className="btn-text" onClick={handleResend}>{t('resendOTP')}</button>
              )}
            </p>
          )}
          {resendTimer <= 0 && !canResend && (
            <p className="trouble-text">{t('havingTrouble')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
