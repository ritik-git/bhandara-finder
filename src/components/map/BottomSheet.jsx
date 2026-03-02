import { useState, useRef } from 'react';
import { useLang } from '../../contexts/LanguageContext';
import BhandaraCard from './BhandaraCard';

export default function BottomSheet({ bhandaras, userLocation }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLang();
  const sheetRef = useRef(null);

  return (
    <div className={`bottom-sheet ${expanded ? 'expanded' : ''}`} ref={sheetRef}>
      <div
        className="sheet-handle"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="handle-bar" />
        <span className="sheet-title">
          {bhandaras.length > 0
            ? `${t('nearbyBhandaras')} (${bhandaras.length})`
            : t('nearbyBhandaras')}
        </span>
        <span className="sheet-toggle-icon">{expanded ? '▼' : '▲'}</span>
      </div>

      <div className="sheet-content">
        {bhandaras.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍽️</div>
            <p className="empty-title">{t('noNearbyBhandaras')}</p>
            <p className="empty-subtitle">{t('beFirst')}</p>
          </div>
        ) : (
          <div className="bhandara-list">
            {bhandaras.map(b => (
              <BhandaraCard key={b.id} bhandara={b} userLocation={userLocation} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
