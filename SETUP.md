# Bhandara Finder — Setup Guide

## Prerequisites
- Node.js 18+
- A Firebase account (free tier works for basic features)
- A Vercel account (for deployment, free tier)

---

## Step 1: Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add Project** → name it "bhandara-finder"
3. Enable **Google Analytics** (optional)

### Enable Authentication
- Sidebar → **Authentication** → **Get started**
- **Sign-in method** tab → Enable **Phone**
- Add your domain to **Authorized domains** (localhost is there by default; add your Vercel URL after deploying)

### Enable Firestore
- Sidebar → **Firestore Database** → **Create database**
- Start in **production mode** (we'll deploy rules separately)
- Choose a region close to India (e.g., `asia-south1`)

### Enable Storage
- Sidebar → **Storage** → **Get started**
- Start in **production mode**

### Enable Cloud Messaging (for push notifications)
- Sidebar → **Project Settings** → **Cloud Messaging** tab
- Note the **Server key** and **Sender ID**
- Under **Web Push certificates**, click **Generate key pair** — this is your VAPID key

### Get Firebase Config
- Sidebar → **Project Settings** → **General** tab → scroll down to "Your apps"
- Click **Add app** → **Web** (</> icon)
- Register app, copy the `firebaseConfig` object values

---

## Step 2: Create .env File

```bash
cp .env.example .env
```

Fill in the values from your Firebase config:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXX
VITE_FIREBASE_VAPID_KEY=your-vapid-key-from-cloud-messaging
```

---

## Step 3: Update firebase-messaging-sw.js

Edit `public/firebase-messaging-sw.js` and replace the placeholder config values with your actual Firebase config values (same values as in .env but without the VITE_ prefix).

---

## Step 4: Install Dependencies

```bash
npm install
```

---

## Step 5: Deploy Firebase Rules & Indexes

Install Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase use --add  # Select your project
```

Deploy rules:
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

---

## Step 6: Set Up Admin Account

After logging into the app with your phone number for the first time:

1. Go to Firestore Console → Create document:
   - Collection: `admin`
   - Document ID: `config`
   - Field: `adminUIDs` (array)
   - Add your UID (find it in Firestore under `users` collection)

---

## Step 7: Deploy Cloud Functions (Optional, requires Blaze plan)

The automated lifecycle management (expiring bhandaras, duplicate detection) requires Firebase Cloud Functions.

Upgrade to **Blaze (pay-as-you-go)** plan in Firebase Console.

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

**Without functions:** The app still works, but bhandara statuses won't auto-update. You can manually update them in Firestore.

---

## Step 8: Run Locally

```bash
npm run dev
```

Visit `http://localhost:5173`

**Note:** Phone Auth requires a real phone number. For testing, Firebase provides test phone numbers:
- Firebase Console → Authentication → **Phone** → **Phone numbers for testing**
- Add: `+91 9999999999` with OTP `123456`

---

## Step 9: Deploy to Vercel

```bash
npm install -g vercel
npm run build
vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments.

**Environment Variables in Vercel:** Add all VITE_ variables from your .env file in Vercel project settings → Environment Variables.

**Important:** Add your Vercel domain to Firebase Authentication → Authorized domains.

---

## App Features Checklist

### Authentication
- [x] Phone OTP login with +91 prefix
- [x] Invisible reCAPTCHA
- [x] Profile completion on first login
- [x] Persistent sessions
- [x] 3-attempt OTP lock (5 min)
- [x] 30-second resend timer
- [x] Banned user screen with unban request

### Map & Discovery
- [x] Full-screen Leaflet map (OpenStreetMap)
- [x] GPS location with fallback to city
- [x] Colored pins (Green/Orange/Red)
- [x] Filter by Today/Tomorrow/This Week
- [x] Verified-only filter
- [x] Bottom sheet with nearby list
- [x] Distance sorting

### Reporting
- [x] Map pin drag for exact location
- [x] Photo upload with auto-compression (>5MB)
- [x] Duplicate detection (100m radius)
- [x] Rate limiting (3/hour)
- [x] Same-location 24h block
- [x] Time warnings
- [x] Recurring bhandara support

### Verification & Karma
- [x] Confirm as real (+3 karma each)
- [x] Check-in (GPS, within 300m)
- [x] Confidence score calculation
- [x] Trust levels (New/Contributor/Trusted/Verified)
- [x] Flag as fake with reasons
- [x] Dynamic flag thresholds based on confirmations

### Admin Panel
- [x] Dashboard stats
- [x] Under-review queue with restore/fake decision
- [x] Unban request queue with approve/reject
- [x] Banned users list

### PWA
- [x] Installable on Android & iOS
- [x] Service worker with offline caching
- [x] OSM tile caching (7 days)
- [x] Push notifications via FCM

---

## Karma Points Reference

| Action | Points |
|--------|--------|
| Report submitted | +2 |
| Report verified (3+ confirmations) | +10 |
| Someone checks in at your report | +1 (max +20) |
| Confirming a report | +3 |
| Report flagged as fake (confirmed) | -15 |
| First warning | -20 |
| Correct flag on fake report | +5 |
| Wrong flag (malicious) | -10 |
| Duplicate merge bonus | +5 |

---

## Trust Levels

| Level | Points | Privileges |
|-------|--------|-----------|
| 🌱 New | 0–29 | Basic reporting |
| ⭐ Contributor | 30–99 | +5 confidence bonus |
| 💎 Trusted | 100–299 | +15 confidence bonus |
| 🏆 Verified | 300+ | +25 confidence bonus |
