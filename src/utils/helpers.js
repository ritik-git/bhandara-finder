import { Timestamp } from 'firebase/firestore';

// ── Time helpers ──────────────────────────────────────────────────────────────

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate(); // Firestore Timestamp
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return null;
}

export function formatRelativeTime(value, lang = 'en') {
  const date = toDate(value);
  if (!date) return '—';
  const now = Date.now();
  const diff = now - date.getTime(); // positive = past
  const absDiff = Math.abs(diff);
  const isFuture = diff < 0;

  const mins = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  if (absDiff < 30000) return lang === 'hi' ? 'अभी-अभी' : 'Just now';

  if (isFuture) {
    // "starts in X"
    if (mins < 60) return lang === 'hi' ? `${mins} मिनट में` : `in ${mins} min`;
    if (hours < 24) return lang === 'hi' ? `${hours} घंटे में` : `in ${hours}h`;
    return lang === 'hi' ? `${days} दिन में` : `in ${days}d`;
  } else {
    if (mins < 60) return lang === 'hi' ? `${mins} मिनट पहले` : `${mins}m ago`;
    if (hours < 24) return lang === 'hi' ? `${hours} घंटे पहले` : `${hours}h ago`;
    return lang === 'hi' ? `${days} दिन पहले` : `${days}d ago`;
  }
}

export function formatTimeLeft(endValue, lang = 'en') {
  const end = toDate(endValue);
  if (!end) return '';
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return lang === 'hi' ? 'समाप्त' : 'Ended';
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 60) return lang === 'hi' ? `${mins} मिनट बचे` : `${mins}m left`;
  return lang === 'hi' ? `${hours}h बचे` : `${hours}h left`;
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

export function formatTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function isExpiring(endValue) {
  const end = toDate(endValue);
  if (!end) return false;
  const diff = end.getTime() - Date.now();
  return diff > 0 && diff <= 30 * 60 * 1000;
}

export function isExpired(endValue) {
  const end = toDate(endValue);
  if (!end) return false;
  return end.getTime() < Date.now();
}

export function localDatetimeToISO(localString) {
  // Convert local datetime-local input value to ISO
  if (!localString) return null;
  return new Date(localString).toISOString();
}

// ── Distance helpers ──────────────────────────────────────────────────────────

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters, lang = 'en') {
  if (meters === null || meters === undefined) return '—';
  if (meters < 1000) return lang === 'hi' ? `${Math.round(meters)}मी` : `${Math.round(meters)}m`;
  return lang === 'hi' ? `${(meters / 1000).toFixed(1)}किमी` : `${(meters / 1000).toFixed(1)}km`;
}

// ── Image helpers ─────────────────────────────────────────────────────────────

export async function compressImage(file, maxSizeMB = 1) {
  const { default: imageCompression } = await import('browser-image-compression');
  const options = {
    maxSizeMB,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    onProgress: () => {},
  };
  try {
    return await imageCompression(file, options);
  } catch {
    return file;
  }
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export function generateLocalDatetime() {
  const now = new Date();
  now.setSeconds(0, 0);
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function shareUrl(title, url) {
  if (navigator.share) {
    navigator.share({ title, url });
  } else {
    navigator.clipboard.writeText(url);
  }
}

export function isIndia(lat, lon) {
  return lat >= 8 && lat <= 37 && lon >= 68 && lon <= 97;
}

export function getStatusColor(status) {
  const map = {
    reported: '#888',
    active: '#138808',
    expiring: '#FF9933',
    expired: '#999',
    under_review: '#e53935',
    fake: '#b71c1c',
    archived: '#ccc',
  };
  return map[status] || '#888';
}

export function getPinColor(status) {
  if (status === 'active') return '#138808';
  if (status === 'expiring') return '#FF9933';
  if (status === 'under_review') return '#e53935';
  if (status === 'reported') return '#2196F3';
  return '#888';
}
