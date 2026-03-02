import { TRUST_LEVELS } from '../../services/userService';
import { useLang } from '../../contexts/LanguageContext';

export default function TrustBadge({ level = 'new', size = 'md' }) {
  const { lang } = useLang();
  const info = TRUST_LEVELS[level] || TRUST_LEVELS.new;

  const icons = { new: '🌱', contributor: '⭐', trusted: '💎', verified: '🏆' };

  return (
    <span
      className={`trust-badge trust-badge-${size} trust-badge-${level}`}
      style={{ borderColor: info.color, color: info.color }}
    >
      {icons[level]} {lang === 'hi' ? info.labelHi : info.label}
    </span>
  );
}
