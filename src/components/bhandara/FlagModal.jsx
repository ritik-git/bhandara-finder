import { useState } from 'react';
import toast from 'react-hot-toast';
import { useLang } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { flagBhandara, FLAG_REASONS } from '../../services/bhandaraService';

export default function FlagModal({ bhandaraId, onClose }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { t, lang } = useLang();
  const { currentUser } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason) {
      toast.error(lang === 'hi' ? 'कारण चुनें' : 'Please select a reason');
      return;
    }
    setLoading(true);
    try {
      await flagBhandara(bhandaraId, currentUser.uid, reason, description);
      toast.success(t('flagSubmitted'));
      onClose();
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">🚩</span>
          <h3>{t('flagTitle')}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('flagReason')}</label>
            <div className="flag-reasons">
              {FLAG_REASONS.map(fr => (
                <label key={fr.value} className={`flag-reason-option ${reason === fr.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="reason"
                    value={fr.value}
                    checked={reason === fr.value}
                    onChange={() => setReason(fr.value)}
                  />
                  {lang === 'hi' ? fr.labelHi : fr.label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('flagDescription')}</label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder={lang === 'hi' ? 'अधिक जानकारी...' : 'More details...'}
            />
          </div>

          <button
            type="submit"
            className="btn btn-danger btn-full"
            disabled={loading || !reason}
          >
            {loading ? <span className="spinner-sm" /> : `🚩 ${t('submitFlag')}`}
          </button>
        </form>
      </div>
    </div>
  );
}
