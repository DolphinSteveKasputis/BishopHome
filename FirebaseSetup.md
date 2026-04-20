# Setting Up Your Own Firebase for Bishop

This guide walks you through setting up your own free Firebase project so your Bishop data is completely private and on your own account. It takes about 10 minutes.

---

## What is Firebase?

Firebase is a free service from Google that stores your app's data securely in the cloud. It's the same technology that powers the default Bishop database, but when you set up your own, only you have access to it.

**Cost:** Free. Google's free plan (called "Spark") is more than enough for normal personal use.

---

## Step 1 — Sign in to Firebase Console

Go to **console.firebase.google.com** in your browser.

Sign in with your Google account. If you use Gmail, that's the same login.

---

## Step 2 — Create a New Project

1. Click **"Create a project"** (or "Add project")
2. Type a project name — anything works, like **"My Bishop App"**
3. Click **Continue**
4. On the Google Analytics screen, **turn it off** — you don't need it
5. Click **"Create project"**
6. Wait a moment, then click **"Continue"**

---

## Step 3 — Enable Firestore (Your Database)

Firestore is the database that stores all your Bishop data.

1. In the left sidebar, click **Build** → **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → click **Next**
4. Pick a location — choose the one closest to you:
   - East US → `us-east1`
   - Central US → `us-central1`
   - West US → `us-west1`
   - Europe → `europe-west1`
5. Click **"Enable"** and wait for it to finish

---

## Step 4 — Set Security Rules

This step makes sure only you (when logged in) can read or write your data.

1. Once Firestore is ready, click the **"Rules"** tab at the top
2. Delete everything in the text box
3. Paste in this exact text:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Click **"Publish"**

---

## Step 5 — Enable Email Login

This lets you create a username and password for Bishop.

1. In the left sidebar, click **Build** → **Authentication**
2. Click **"Get started"**
3. Under "Sign-in providers", click **"Email/Password"**
4. Toggle the first switch to **On**
5. Click **"Save"**

---

## Step 6 — Get Your Config

This is the connection info Bishop needs to talk to your database.

1. Click the **gear icon ⚙️** at the very top left of the page
2. Click **"Project settings"**
3. Scroll down until you see **"Your apps"**
4. Click the **`</>`** (web) icon
5. Give it any name (like "Bishop Web")
6. Click **"Register app"**
7. You'll see a block of code that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

8. **Copy the entire block** — from the opening `{` to the closing `}`

---

## Step 7 — Paste It Into Bishop

1. Open Bishop in your browser
2. Go to **Settings → Data Storage** (or tap the blue banner if it appeared)
3. Paste your config into the text box
4. Click **"Validate & Save"**
5. The app will reload
6. **Create a new account** — use your email and a password you choose

That's it. Your data is now 100% private and stored in your own Firebase project.

---

## Frequently Asked Questions

**What if I forget my password?**
On the login screen, tap "Forgot Password" and enter your email — Firebase will send a reset link.

**Will I lose my data if I clear my browser?**
Your data lives in Firebase (the cloud), not your browser. Clearing browser data won't affect it. However, if you clear your browser's local storage, the app may not know which Firebase project to connect to — you'd need to paste your config again. Your data is still safe in Firebase.

**What's the storage limit on the free plan?**
1 GB of Firestore storage and 1 GB of network transfer per month. For a personal life tracker with photos stored as compressed images, this is plenty. If you ever get close, Firebase will notify you before charging anything — and you can upgrade to pay-as-you-go (typically under $1/month for personal use).

**Can I share my Firebase with a family member?**
Yes — you'd both use the same config, and each person gets their own data because Bishop separates it by user account. Just have them go through Step 7 with your config, then create their own account.

**I messed something up — how do I start over?**
In Bishop, go to **Settings → Data Storage** and click **"Remove My Config & Reset"**. This clears your stored config so you can paste a new one. Your data in Firebase is not deleted.
