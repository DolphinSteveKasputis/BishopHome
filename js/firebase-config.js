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

console.log("Firebase initialized successfully. Project:", firebaseConfig.projectId);
