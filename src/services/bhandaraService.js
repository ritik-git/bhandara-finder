import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc,
  query, where, orderBy, limit, startAfter, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove, increment, GeoPoint,
  Timestamp, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { updateKarmaPoints, addNotification, getTrustLevel, getUserProfile } from './userService';

export const BHANDARA_STATUS = {
  reported: 'reported',
  active: 'active',
  expiring: 'expiring',
  expired: 'expired',
  archived: 'archived',
  under_review: 'under_review',
  fake: 'fake',
};

export const FOOD_TYPES = [
  { value: 'prasad', label: 'Prasad', labelHi: 'प्रसाद', emoji: '🙏' },
  { value: 'full_meal', label: 'Full Meal', labelHi: 'पूरा भोजन', emoji: '🍱' },
  { value: 'snacks', label: 'Snacks', labelHi: 'नाश्ता', emoji: '🥪' },
  { value: 'langar', label: 'Langar', labelHi: 'लंगर', emoji: '🫕' },
];

export const FLAG_REASONS = [
  { value: 'doesnt_exist', label: "Doesn't Exist", labelHi: 'मौजूद नहीं है' },
  { value: 'wrong_location', label: 'Wrong Location', labelHi: 'गलत स्थान' },
  { value: 'already_over', label: 'Already Over', labelHi: 'पहले ही खत्म हो गया' },
  { value: 'spam_duplicate', label: 'Spam / Duplicate', labelHi: 'स्पैम / डुप्लीकेट' },
  { value: 'inappropriate', label: 'Inappropriate Content', labelHi: 'अनुचित सामग्री' },
];

function calcDistance(lat1, lon1, lat2, lon2) {
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

export function calcConfidenceScore(bhandara, reporterTrustLevel) {
  let score = 0;
  const confirmCount = bhandara.confirmationCount || 0;
  const checkInCount = bhandara.checkInCount || 0;
  score += Math.min(confirmCount * 15, 45);
  score += Math.min(checkInCount * 10, 30);
  const bonusMap = { new: 0, contributor: 5, trusted: 15, verified: 25 };
  score += bonusMap[reporterTrustLevel] || 0;
  return Math.min(score, 100);
}

export async function uploadPhoto(file, bhandaraId, index) {
  const storageRef = ref(storage, `bhandaras/${bhandaraId}/photo_${index}_${Date.now()}`);
  const contentType = file.type?.startsWith('image/') ? file.type : 'image/jpeg';
  const snap = await uploadBytes(storageRef, file, { contentType });
  return getDownloadURL(snap.ref);
}

export async function checkDuplicate(latitude, longitude, startTime) {
  const allActive = await getDocs(
    query(
      collection(db, 'bhandaras'),
      where('status', 'in', ['reported', 'active', 'expiring']),
    )
  );
  const nearby = [];
  allActive.docs.forEach(d => {
    const b = d.data();
    const dist = calcDistance(latitude, longitude, b.latitude, b.longitude);
    if (dist <= 100) {
      nearby.push({ id: d.id, ...b, distance: dist });
    }
  });
  return nearby;
}

export async function submitBhandara(reporterUid, formData, photoFiles) {
  const batch = writeBatch(db);
  const bhandaraRef = doc(collection(db, 'bhandaras'));

  const endTime = formData.endTime
    ? Timestamp.fromDate(new Date(formData.endTime))
    : Timestamp.fromDate(new Date(new Date(formData.startTime).getTime() + 3 * 60 * 60 * 1000));

  const newBhandara = {
    reportedBy: reporterUid,
    reporterName: formData.reporterName,
    title: formData.title,
    description: formData.description || '',
    address: formData.address,
    locality: formData.locality || '',
    city: formData.city,
    latitude: formData.latitude,
    longitude: formData.longitude,
    startTime: Timestamp.fromDate(new Date(formData.startTime)),
    endTime,
    foodType: formData.foodType || [],
    photos: [],
    status: BHANDARA_STATUS.reported,
    confidenceScore: 0,
    confirmations: [],
    confirmationCount: 0,
    checkIns: [],
    checkInCount: 0,
    flags: [],
    flagCount: 0,
    isRecurring: formData.isRecurring || false,
    recurringPattern: formData.recurringPattern || null,
    organizerName: formData.organizerName || '',
    isOrganizerVerified: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt: endTime,
    lastConfirmedAt: serverTimestamp(),
    isMerged: false,
    mergedWith: null,
  };

  batch.set(bhandaraRef, newBhandara);

  const userRef = doc(db, 'users', reporterUid);
  batch.update(userRef, {
    totalReports: increment(1),
    karmaPoints: increment(2),
  });

  await batch.commit();

  const photoUrls = [];
  for (let i = 0; i < photoFiles.length; i++) {
    const url = await uploadPhoto(photoFiles[i], bhandaraRef.id, i);
    photoUrls.push(url);
  }

  const userSnap = await getDoc(doc(db, 'users', reporterUid));
  const trustLevel = userSnap.exists() ? userSnap.data().trustLevel : 'new';
  const score = calcConfidenceScore({ confirmationCount: 0, checkInCount: 0 }, trustLevel);

  await updateDoc(bhandaraRef, {
    photos: photoUrls,
    confidenceScore: score,
  });

  return bhandaraRef.id;
}

export function subscribeToBhandaras(callback, filterStatus = ['reported', 'active', 'expiring'], onError) {
  const q = query(
    collection(db, 'bhandaras'),
    where('status', 'in', filterStatus),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      const bhandaras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(bhandaras);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function getBhandara(id) {
  const ref = doc(db, 'bhandaras', id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function confirmBhandara(bhandaraId, userUid) {
  const bRef = doc(db, 'bhandaras', bhandaraId);
  const snap = await getDoc(bRef);
  if (!snap.exists()) throw new Error('Bhandara not found');

  const bhandara = snap.data();

  if (bhandara.reportedBy === userUid) throw new Error('Cannot confirm your own report');
  if (bhandara.confirmations?.includes(userUid)) throw new Error('Already confirmed');

  const newCount = (bhandara.confirmationCount || 0) + 1;
  let newStatus = bhandara.status;
  if (newCount >= 2 && bhandara.status === BHANDARA_STATUS.reported) {
    newStatus = BHANDARA_STATUS.active;
  }

  const userSnap = await getDoc(doc(db, 'users', bhandara.reportedBy));
  const trustLevel = userSnap.exists() ? userSnap.data().trustLevel : 'new';
  const score = calcConfidenceScore(
    { confirmationCount: newCount, checkInCount: bhandara.checkInCount || 0 },
    trustLevel
  );

  await updateDoc(bRef, {
    confirmations: arrayUnion(userUid),
    confirmationCount: increment(1),
    status: newStatus,
    confidenceScore: score,
    lastConfirmedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateKarmaPoints(userUid, 3);
  await updateKarmaPoints(bhandara.reportedBy, 3);

  if (newCount === 3) {
    await updateDoc(doc(db, 'users', bhandara.reportedBy), {
      verifiedReports: increment(1),
      karmaPoints: increment(10),
    });
    await addNotification(bhandara.reportedBy, {
      type: 'report_verified',
      title: 'Report Verified! ✓',
      titleHi: 'रिपोर्ट सत्यापित! ✓',
      message: `Your Bhandara "${bhandara.title}" got 3+ confirmations!`,
      messageHi: `आपका भंडारा "${bhandara.title}" सत्यापित हो गया!`,
      bhandaraId,
    });
  }
}

export async function checkInBhandara(bhandaraId, userUid, userLat, userLon) {
  const bRef = doc(db, 'bhandaras', bhandaraId);
  const snap = await getDoc(bRef);
  if (!snap.exists()) throw new Error('Bhandara not found');

  const bhandara = snap.data();
  const dist = calcDistance(userLat, userLon, bhandara.latitude, bhandara.longitude);
  if (dist > 300) throw new Error('You must be within 300 meters to check in');
  if (bhandara.checkIns?.includes(userUid)) throw new Error('Already checked in');

  const newCheckInCount = (bhandara.checkInCount || 0) + 1;
  const userSnap = await getDoc(doc(db, 'users', bhandara.reportedBy));
  const trustLevel = userSnap.exists() ? userSnap.data().trustLevel : 'new';
  const score = calcConfidenceScore(
    { confirmationCount: bhandara.confirmationCount || 0, checkInCount: newCheckInCount },
    trustLevel
  );

  await updateDoc(bRef, {
    checkIns: arrayUnion(userUid),
    checkInCount: increment(1),
    confidenceScore: score,
    updatedAt: serverTimestamp(),
  });

  const currentCheckIns = newCheckInCount;
  if (currentCheckIns <= 20) {
    await updateKarmaPoints(bhandara.reportedBy, 1);
  }
}

export async function flagBhandara(bhandaraId, userUid, reason, description) {
  const bRef = doc(db, 'bhandaras', bhandaraId);
  const snap = await getDoc(bRef);
  if (!snap.exists()) throw new Error('Bhandara not found');

  const bhandara = snap.data();
  const confirmCount = bhandara.confirmationCount || 0;
  const currentFlags = (bhandara.flagCount || 0) + 1;

  let threshold = 3;
  if (confirmCount >= 20) threshold = 15;
  else if (confirmCount >= 5) threshold = 7;

  await updateDoc(bRef, {
    flags: arrayUnion({ uid: userUid, reason, description: description || '', timestamp: new Date().toISOString() }),
    flagCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  if (currentFlags >= threshold) {
    await updateDoc(bRef, { status: BHANDARA_STATUS.under_review });
    await addNotification(bhandara.reportedBy, {
      type: 'report_under_review',
      title: 'Bhandara Under Review',
      titleHi: 'भंडारा समीक्षाधीन',
      message: `Your Bhandara "${bhandara.title}" is temporarily hidden for review.`,
      messageHi: `आपका भंडारा "${bhandara.title}" समीक्षा के लिए अस्थायी रूप से छिपाया गया है।`,
      bhandaraId,
    });
  }
}

export async function resolveBhandara(bhandaraId, decision, adminUid) {
  const bRef = doc(db, 'bhandaras', bhandaraId);
  const snap = await getDoc(bRef);
  if (!snap.exists()) throw new Error('Bhandara not found');
  const bhandara = snap.data();

  if (decision === 'restore') {
    await updateDoc(bRef, {
      status: BHANDARA_STATUS.active,
      flags: [],
      flagCount: 0,
      updatedAt: serverTimestamp(),
    });
  } else if (decision === 'fake') {
    await updateDoc(bRef, {
      status: BHANDARA_STATUS.fake,
      updatedAt: serverTimestamp(),
    });

    const reporterRef = doc(db, 'users', bhandara.reportedBy);
    const reporterSnap = await getDoc(reporterRef);
    if (reporterSnap.exists()) {
      const reporter = reporterSnap.data();
      const currentWarnings = reporter.warningCount || 0;
      const currentKarma = reporter.karmaPoints || 0;

      let updateData = {
        karmaPoints: Math.max(0, currentKarma - 15),
        flaggedReports: increment(1),
      };

      if (currentWarnings === 0) {
        updateData.warningCount = 1;
        updateData.karmaPoints = Math.max(0, currentKarma - 35);
        await addNotification(bhandara.reportedBy, {
          type: 'warning_issued',
          title: 'Warning Issued ⚠️',
          titleHi: 'चेतावनी जारी ⚠️',
          message: 'Your report was confirmed as fake. First warning issued.',
          messageHi: 'आपकी रिपोर्ट नकली पाई गई। पहली चेतावनी जारी की गई।',
          bhandaraId,
        });
      } else if (currentWarnings === 1) {
        updateData.warningCount = 2;
        await addNotification(bhandara.reportedBy, {
          type: 'final_warning',
          title: 'Final Warning ⚠️⚠️',
          titleHi: 'अंतिम चेतावनी ⚠️⚠️',
          message: 'This is your final warning. Next violation will result in a ban.',
          messageHi: 'यह आपकी अंतिम चेतावनी है। अगला उल्लंघन बैन में होगा।',
          bhandaraId,
        });
      } else if (currentWarnings >= 2) {
        updateData.accountStatus = 'banned';
        updateData.bannedAt = serverTimestamp();
        updateData.banReason = 'Multiple fake reports submitted';
        const prevBanned = reporter.previouslyBanned;
        if (prevBanned) {
          updateData.accountStatus = 'banned';
          updateData.permanentBan = true;
        }
        await addNotification(bhandara.reportedBy, {
          type: 'account_banned',
          title: 'Account Suspended',
          titleHi: 'खाता निलंबित',
          message: 'Your account has been suspended due to multiple fake reports.',
          messageHi: 'कई नकली रिपोर्टों के कारण आपका खाता निलंबित कर दिया गया है।',
        });
      }

      await updateDoc(reporterRef, updateData);
    }
  }
}

export async function getAdminStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = Timestamp.fromDate(today);

  const [totalSnap, activeSnap, todaySnap] = await Promise.all([
    getDocs(collection(db, 'bhandaras')),
    getDocs(query(collection(db, 'bhandaras'), where('status', 'in', ['active', 'expiring']))),
    getDocs(query(collection(db, 'bhandaras'), where('createdAt', '>=', todayTs))),
  ]);

  return {
    total: totalSnap.size,
    activeNow: activeSnap.size,
    reportedToday: todaySnap.size,
  };
}

export async function getUnderReviewBhandaras() {
  const q = query(
    collection(db, 'bhandaras'),
    where('status', '==', BHANDARA_STATUS.under_review),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function checkRateLimit(uid) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const q = query(
    collection(db, 'bhandaras'),
    where('reportedBy', '==', uid),
    where('createdAt', '>=', Timestamp.fromDate(oneHourAgo))
  );
  const snap = await getDocs(q);
  return snap.size;
}

export async function checkSameLocationRecent(uid, lat, lon) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const q = query(
    collection(db, 'bhandaras'),
    where('reportedBy', '==', uid),
    where('createdAt', '>=', Timestamp.fromDate(oneDayAgo))
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const b = d.data();
    const dist = calcDistance(lat, lon, b.latitude, b.longitude);
    if (dist <= 100) return true;
  }
  return false;
}

export function getDistanceFromUser(bhandara, userLat, userLon) {
  if (!userLat || !userLon) return null;
  return calcDistance(userLat, userLon, bhandara.latitude, bhandara.longitude);
}

export function formatDistance(meters) {
  if (meters === null || meters === undefined) return '—';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
