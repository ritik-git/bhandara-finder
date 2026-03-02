import { useLang } from '../../contexts/LanguageContext';

export default function ConfidenceBar({ score = 0 }) {
  const { t } = useLang();

  const color = score >= 70 ? '#138808' : score >= 40 ? '#FF9933' : '#e53935';

  return (
    <div className="confidence-bar-wrapper">
      <div className="confidence-bar-header">
        <span className="confidence-label-text">{t('confidence')}</span>
        <span className="confidence-score" style={{ color }}>{score}%</span>
      </div>
      <div className="confidence-track">
        <div
          className="confidence-fill-bar"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <p className="confidence-hint">
        {score >= 70 ? '✅ Highly reliable' : score >= 40 ? '⚠️ Moderate confidence' : '❓ Needs verification'}
      </p>
    </div>
  );
}
