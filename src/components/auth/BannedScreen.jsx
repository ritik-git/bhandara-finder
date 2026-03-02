import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { submitUnbanRequest } from '../../services/userService';

export default function BannedScreen() {
  const { userProfile, logout, currentUser } = useAuth();
  const { t, lang } = useLang();
  const [unbanText, setUnbanText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isPermanent = userProfile?.permanentBan;
  const isPending = userProfile?.accountStatus === 'pending_unban';

  async function handleSubmitUnban(e) {
    e.preventDefault();
    if (unbanText.trim().length < 50) {
      toast.error(lang === 'hi' ? 'कम से कम 50 अक्षर लिखें' : 'Please write at least 50 characters');
      return;
    }
    setLoading(true);
    try {
      await submitUnbanRequest(currentUser.uid, unbanText.trim());
      setSubmitted(true);
      toast.success(t('unbanSubmitted'));
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card banned-card">
        <div className="banned-icon">🚫</div>
        <h2 className="auth-title">{t('accountSuspended')}</h2>

        {isPermanent ? (
          <p className="banned-reason">{t('permanentBan')}</p>
        ) : isPending || submitted ? (
          <div className="pending-unban">
            <div className="pending-icon">⏳</div>
            <p>{t('pendingUnban')}</p>
          </div>
        ) : (
          <>
            {userProfile?.banReason && (
              <div className="ban-reason-box">
                <strong>{t('banReason')}:</strong>
                <p>{userProfile.banReason}</p>
              </div>
            )}
            <form onSubmit={handleSubmitUnban} className="unban-form">
              <label className="form-label">{t('submitUnban')}</label>
              <textarea
                className="form-textarea"
                placeholder={t('unbanText')}
                value={unbanText}
                onChange={e => setUnbanText(e.target.value)}
                rows={5}
                maxLength={500}
              />
              <p className="char-count">{unbanText.length}/500</p>
              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading || unbanText.length < 50}
              >
                {loading ? <span className="spinner-sm" /> : t('submitUnban')}
              </button>
            </form>
          </>
        )}

        <button className="btn btn-outline btn-full" onClick={logout} style={{ marginTop: '1rem' }}>
          {t('logout')}
        </button>
      </div>
    </div>
  );
}
