import { useLang } from '../../contexts/LanguageContext';

export default function FilterBar({ filter, onFilterChange, verifiedOnly, onVerifiedToggle }) {
  const { t } = useLang();

  const filters = [
    { value: 'today', label: t('today') },
    { value: 'tomorrow', label: t('tomorrow') },
    { value: 'week', label: t('thisWeek') },
  ];

  return (
    <div className="filter-bar">
      <div className="filter-chips">
        {filters.map(f => (
          <button
            key={f.value}
            className={`filter-chip ${filter === f.value ? 'filter-chip-active' : ''}`}
            onClick={() => onFilterChange(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        className={`verified-toggle ${verifiedOnly ? 'verified-toggle-active' : ''}`}
        onClick={onVerifiedToggle}
      >
        ✓ {t('verifiedOnly')}
      </button>
    </div>
  );
}
