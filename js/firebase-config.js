// ============================================================
// Firebase Configuration
// Initializes Firebase and exposes the Firestore database
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyAcgyLNK1yzbZEm9hf6FJi-T1U5O1Kwi7k",
    authDomain: "bishop-62d43.firebaseapp.com",
    projectId: "bishop-62d43",
    storageBucket: "bishop-62d43.firebasestorage.app",
    messagingSenderId: "1067248723493",
    appId: "1:1067248723493:web:b8c0bc4bae883407ce81cc"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get a reference to Firestore — this is what we'll use everywhere to read/write data
const db = firebase.firestore();

// Get a reference to Firebase Auth — used by auth.js for login/logout
const auth = firebase.auth();

// ============================================================
// userCol() — Per-user Firestore collection helper
//
// Instead of db.collection('things')  →  shared by everyone
// Use    userCol('things')            →  /users/{uid}/things
//
// Reads whoever is currently signed in via Firebase Auth,
// so it works automatically for any user — no hardcoding.
//
// Used by all JS modules after the multi-user refactor (MU-5+).
// ============================================================
function userCol(collectionName) {
    var user = firebase.auth().currentUser;
    if (!user) {
        console.error('userCol() called with no signed-in user');
        // Return a dead-end reference that won't throw but also won't
        // read or write real data — prevents silent cross-user leaks
        return db.collection('__nouser__').doc('__nouser__').collection(collectionName);
    }
    return db.collection('users').doc(user.uid).collection(collectionName);
}

console.log("Firebase initialized successfully. Project:", firebaseConfig.projectId);
