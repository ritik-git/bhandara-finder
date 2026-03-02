import { useLang } from '../../contexts/LanguageContext';
import { formatTimeLeft } from '../../utils/helpers';

export default function DuplicateModal({ duplicates, onConfirm, onDifferent, onClose }) {
  const { t, lang } = useLang();
  const dup = duplicates[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon">⚠️</span>
          <h3>{t('duplicateFound')}</h3>
        </div>

        <div className="duplicate-info">
          <div className="dup-bhandara">
            {dup?.photos?.[0] && <img src={dup.photos[0]} alt="" className="dup-thumb" />}
            <div>
              <strong>{dup?.title}</strong>
              <p style={{ fontSize: '0.85rem', color: '#666', margin: '4px 0' }}>{dup?.address}</p>
              <p style={{ fontSize: '0.85rem', color: '#138808' }}>
                {formatTimeLeft(dup?.expiresAt, lang)}
              </p>
            </div>
          </div>
        </div>

        <p className="modal-question">{t('isSameBhandara')}</p>

        <div className="modal-actions">
          <button
            className="btn btn-primary btn-full"
            onClick={() => onConfirm(dup.id)}
          >
            ✓ {t('yes')} — {lang === 'hi' ? 'पुष्टि करें (+3 कर्म)' : 'Confirm it (+3 karma)'}
          </button>
          <button
            className="btn btn-outline btn-full"
            onClick={onDifferent}
            style={{ marginTop: '8px' }}
          >
            {t('no')}
          </button>
          <button className="btn-text" onClick={onClose} style={{ marginTop: '8px' }}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
