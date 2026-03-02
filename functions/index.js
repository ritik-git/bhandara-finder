const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ── Helper: haversine distance (meters) ───────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
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

function calcConfidenceScore(confirmCount, checkInCount, trustLevel) {
  let score = 0;
  score += Math.min(confirmCount * 15, 45);
  score += Math.min(checkInCount * 10, 30);
  const bonusMap = { new: 0, contributor: 5, trusted: 15, verified: 25 };
  score += bonusMap[trustLevel] || 0;
  return Math.min(score, 100);
}

// ── 1. Bhandara lifecycle manager (runs every 15 min) ─────────────────────────
exports.manageBhandaraLifecycle = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    const active = await db.collection('bhandaras')
      .where('status', 'in', ['reported', 'active', 'expiring'])
      .get();

    for (const doc of active.docs) {
      const b = doc.data();
      const expiresAt = b.expiresAt?.toDate();
      if (!expiresAt) continue;

      const nowMs = now.toDate().getTime();
      const expiresMs = expiresAt.getTime();

      if (nowMs > expiresMs) {
        batch.update(doc.ref, { status: 'expired', updatedAt: now });
      } else if (expiresMs - nowMs <= 30 * 60 * 1000 && b.status !== 'expiring') {
        batch.update(doc.ref, { status: 'expiring', updatedAt: now });
      }
    }

    // Archive expired bhandaras older than 24h
    const expired = await db.collection('bhandaras')
      .where('status', '==', 'expired')
      .get();

    for (const doc of expired.docs) {
      const b = doc.data();
      const expiresAt = b.expiresAt?.toDate();
      if (expiresAt && now.toDate().getTime() > expiresAt.getTime() + 24 * 60 * 60 * 1000) {
        batch.update(doc.ref, { status: 'archived', updatedAt: now });
      }
    }

    await batch.commit();
    console.log('Lifecycle management complete');
  });

// ── 2. Duplicate detection (runs every 5 min) ─────────────────────────────────
exports.detectDuplicates = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const active = await db.collection('bhandaras')
      .where('status', 'in', ['reported', 'active', 'expiring'])
      .where('isMerged', '==', false)
      .get();

    const bhandaras = active.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    for (let i = 0; i < bhandaras.length; i++) {
      for (let j = i + 1; j < bhandaras.length; j++) {
        const b1 = bhandaras[i];
        const b2 = bhandaras[j];

        // Check proximity (100m)
        const dist = haversineDistance(b1.latitude, b1.longitude, b2.latitude, b2.longitude);
        if (dist > 100) continue;

        // Check time overlap
        const b1Start = b1.startTime?.toDate();
        const b2Start = b2.startTime?.toDate();
        const b1End = b1.expiresAt?.toDate();
        const b2End = b2.expiresAt?.toDate();

        const hasOverlap = b1Start && b2Start && b1End && b2End &&
          b1Start < b2End && b2Start < b1End;

        if (!hasOverlap) continue;

        // Determine older one (canonical)
        const b1Created = b1.createdAt?.toDate()?.getTime() || 0;
        const b2Created = b2.createdAt?.toDate()?.getTime() || 0;
        const canonical = b1Created <= b2Created ? b1 : b2;
        const duplicate = b1Created <= b2Created ? b2 : b1;

        // Merge
        const batch = db.batch();
        batch.update(duplicate.ref, {
          isMerged: true,
          mergedWith: canonical.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Merge photos from duplicate into canonical
        const mergedPhotos = [
          ...(canonical.photos || []),
          ...(duplicate.photos || []),
        ].slice(0, 10);

        batch.update(canonical.ref, {
          photos: mergedPhotos,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Award points to both reporters
        if (duplicate.reportedBy) {
          const dupeUserRef = db.doc(`users/${duplicate.reportedBy}`);
          batch.update(dupeUserRef, {
            karmaPoints: admin.firestore.FieldValue.increment(5),
          });
        }
        if (canonical.reportedBy) {
          const canonUserRef = db.doc(`users/${canonical.reportedBy}`);
          batch.update(canonUserRef, {
            karmaPoints: admin.firestore.FieldValue.increment(5),
          });
        }

        await batch.commit();
        console.log(`Merged ${duplicate.id} into ${canonical.id}`);
      }
    }
  });

// ── 3. Send reminder notifications for bookmarked bhandaras ──────────────────
exports.sendBookmarkReminders = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const in30min = new Date(now.toDate().getTime() + 30 * 60 * 1000);
    const in35min = new Date(now.toDate().getTime() + 35 * 60 * 1000);

    // Find bhandaras starting in ~30 minutes
    const upcoming = await db.collection('bhandaras')
      .where('status', 'in', ['reported', 'active'])
      .where('startTime', '>=', admin.firestore.Timestamp.fromDate(in30min))
      .where('startTime', '<=', admin.firestore.Timestamp.fromDate(in35min))
      .get();

    for (const doc of upcoming.docs) {
      const b = doc.data();
      // Find users who bookmarked this (stored in localStorage on client, so we skip server-side for now)
      // In a full implementation, bookmarks would be stored in Firestore
    }
  });

// ── 4. Auto-create recurring bhandara instances ──────────────────────────────
exports.createRecurringInstances = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const recurring = await db.collection('bhandaras')
      .where('isRecurring', '==', true)
      .where('status', 'in', ['active', 'expired', 'archived'])
      .get();

    for (const doc of recurring.docs) {
      const b = doc.data();
      const lastStart = b.startTime?.toDate();
      if (!lastStart) continue;

      let nextStart = null;

      if (b.recurringPattern === 'weekly') {
        nextStart = new Date(lastStart);
        nextStart.setDate(nextStart.getDate() + 7);
      } else if (b.recurringPattern === 'monthly') {
        nextStart = new Date(lastStart);
        nextStart.setMonth(nextStart.getMonth() + 1);
      } else if (b.recurringPattern === 'annual') {
        nextStart = new Date(lastStart);
        nextStart.setFullYear(nextStart.getFullYear() + 1);
      }

      if (!nextStart) continue;

      // Check if it's within the next 24 hours
      const hoursDiff = (nextStart.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 24 && hoursDiff > 0) {
        // Create new instance
        const duration = (b.endTime?.toDate()?.getTime() || lastStart.getTime() + 3 * 60 * 60 * 1000) - lastStart.getTime();
        const nextEnd = new Date(nextStart.getTime() + duration);

        await db.collection('bhandaras').add({
          reportedBy: b.reportedBy,
          reporterName: b.reporterName,
          title: b.title,
          description: b.description,
          address: b.address,
          locality: b.locality,
          city: b.city,
          latitude: b.latitude,
          longitude: b.longitude,
          startTime: admin.firestore.Timestamp.fromDate(nextStart),
          endTime: admin.firestore.Timestamp.fromDate(nextEnd),
          foodType: b.foodType,
          photos: b.photos,
          status: 'reported',
          confidenceScore: 10, // starts with some score since it's recurring
          confirmations: [],
          confirmationCount: 0,
          checkIns: [],
          checkInCount: 0,
          flags: [],
          flagCount: 0,
          isRecurring: true,
          recurringPattern: b.recurringPattern,
          organizerName: b.organizerName,
          isOrganizerVerified: b.isOrganizerVerified,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromDate(nextEnd),
          lastConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          isMerged: false,
          parentBhandaraId: doc.id,
        });

        console.log(`Created recurring instance for ${b.title}`);
      }
    }
  });

// ── 5. Update trust level on karma change ─────────────────────────────────────
exports.updateTrustLevel = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;
    const after = change.after.data();
    const before = change.before.exists ? change.before.data() : {};

    if (after.karmaPoints === before.karmaPoints) return;

    const karma = after.karmaPoints || 0;
    let trustLevel = 'new';
    if (karma >= 300) trustLevel = 'verified';
    else if (karma >= 100) trustLevel = 'trusted';
    else if (karma >= 30) trustLevel = 'contributor';

    if (trustLevel !== after.trustLevel) {
      await change.after.ref.update({ trustLevel });
    }
  });
