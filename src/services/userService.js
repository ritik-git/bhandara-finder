import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, addDoc, query, where, getDocs, orderBy, limit,
  onSnapshot, increment
} from 'firebase/firestore';
import { db } from '../firebase';

export const TRUST_LEVELS = {
  new: { label: 'New', labelHi: 'नया', min: 0, max: 29, color: '#888' },
  contributor: { label: 'Contributor', labelHi: 'योगदानकर्ता', min: 30, max: 99, color: '#4CAF50' },
  trusted: { label: 'Trusted', labelHi: 'विश्वसनीय', min: 100, max: 299, color: '#2196F3' },
  verified: { label: 'Verified Reporter', labelHi: 'सत्यापित रिपोर्टर', min: 300, max: Infinity, color: '#FF9933' },
};

export function getTrustLevel(karmaPoints) {
  if (karmaPoints >= 300) return 'verified';
  if (karmaPoints >= 100) return 'trusted';
  if (karmaPoints >= 30) return 'contributor';
  return 'new';
}

export async function getUserProfile(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createUserProfile(uid, data) {
  const ref = doc(db, 'users', uid);
  const profile = {
    phoneNumber: data.phoneNumber,
    name: data.name,
    city: data.city,
    profilePhoto: null,
    karmaPoints: 0,
    trustLevel: 'new',
    totalReports: 0,
    verifiedReports: 0,
    flaggedReports: 0,
    accountStatus: 'active',
    warningCount: 0,
    notificationsEnabled: false,
    savedLocality: '',
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return { id: uid, ...profile };
}

export async function updateUserProfile(uid, data) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { ...data, lastActive: serverTimestamp() });
}

export async function updateKarmaPoints(uid, delta) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const current = snap.data().karmaPoints || 0;
  const newPoints = Math.max(0, current + delta);
  const trustLevel = getTrustLevel(newPoints);

  await updateDoc(ref, {
    karmaPoints: newPoints,
    trustLevel,
    lastActive: serverTimestamp(),
  });
  return newPoints;
}

export async function getUserNotifications(uid, limitCount = 30) {
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeToNotifications(uid, callback) {
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(notifications);
  });
}

export async function addNotification(uid, notification) {
  const ref = collection(db, 'users', uid, 'notifications');
  await addDoc(ref, {
    ...notification,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationRead(uid, notifId) {
  const ref = doc(db, 'users', uid, 'notifications', notifId);
  await updateDoc(ref, { read: true });
}

export async function markAllNotificationsRead(uid) {
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  const updates = snap.docs.map(d => updateDoc(d.ref, { read: true }));
  await Promise.all(updates);
}

export async function submitUnbanRequest(uid, text) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, {
    unbanRequestText: text,
    unbanRequestedAt: serverTimestamp(),
    accountStatus: 'pending_unban',
  });
}

export async function getUsersByStatus(status) {
  const q = query(
    collection(db, 'users'),
    where('accountStatus', '==', status)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAdminUIDs() {
  const ref = doc(db, 'admin', 'config');
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().adminUIDs || []) : [];
}

export async function isAdmin(uid) {
  const admins = await getAdminUIDs();
  return admins.includes(uid);
}
