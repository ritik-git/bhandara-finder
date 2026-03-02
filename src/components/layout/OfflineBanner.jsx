import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useLang } from '../../contexts/LanguageContext';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useLang();

  if (isOnline) return null;

  return (
    <div className="offline-banner">
      📡 {t('offline')}
    </div>
  );
}
