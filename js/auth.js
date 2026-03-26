// ============================================================
// Auth.js — Firebase Authentication
// Guards the entire app behind a login screen.
// Uses Firebase Auth email/password sign-in.
// ============================================================

/**
 * Show the login screen and hide the app.
 */
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appWrapper').classList.add('hidden');
}

/**
 * Hide the login screen and reveal the app.
 */
function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appWrapper').classList.remove('hidden');
}

// ---------- Auth State Listener ----------
// Firebase fires this immediately on page load with the current user
// (or null). This means returning users on a remembered device go
// straight to the app without seeing the login screen.
//
// IMPORTANT: Firebase also fires this on silent token refreshes (roughly
// every hour). We use a flag so initApp() only runs once — on the initial
// sign-in — not on every token refresh. Without this guard, the app would
// navigate back to the home page whenever the token refreshed in the background.

var _appInitialized = false;

auth.onAuthStateChanged(function(user) {
    if (user) {
        // Signed in — show the app
        showApp();
        // Only call initApp() on the first auth event, not on token refreshes
        if (!_appInitialized) {
            _appInitialized = true;
            initApp();
        }
    } else {
        // Signed out — reset flag and show login screen
        _appInitialized = false;
        showLoginScreen();
    }
});

// ---------- Login Form ----------

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    var email    = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    var errorEl  = document.getElementById('loginError');
    var submitBtn = document.getElementById('loginSubmitBtn');

    // Clear previous error and disable button while signing in
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged above handles the transition to the app
    } catch (error) {
        // Show a generic error — don't reveal whether email or password was wrong
        errorEl.textContent = 'Invalid email or password. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
    }
});

// ---------- Sign Out ----------
// Wire up both the desktop and mobile sign-out buttons.

function handleSignOut() {
    auth.signOut().then(function() {
        // Clear the hash so when they log back in they start at home
        window.location.hash = '';
    });
}

document.getElementById('signOutBtn').addEventListener('click', handleSignOut);
document.getElementById('signOutBtnMobile').addEventListener('click', handleSignOut);
