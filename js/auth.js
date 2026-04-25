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
            _checkNewAccountWelcome();
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

// ---------- Forgot Password ----------

document.getElementById('forgotPasswordLink').addEventListener('click', function(e) {
    e.preventDefault();

    var email   = document.getElementById('loginEmail').value.trim();
    var errorEl = document.getElementById('loginError');
    var msgEl   = document.getElementById('forgotPasswordMsg');

    // Clear any previous messages
    errorEl.textContent  = '';
    msgEl.style.display  = 'none';
    msgEl.textContent    = '';

    if (!email) {
        errorEl.textContent = 'Enter your email address above, then click Forgot password.';
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(function() {
            // Show confirmation regardless of whether the email exists (security best practice)
            msgEl.textContent   = 'If that email is registered, a reset link has been sent. Check your inbox.';
            msgEl.style.display = '';
        })
        .catch(function(err) {
            console.error('Password reset error:', err);
            errorEl.textContent = 'Could not send reset email. Please try again.';
        });
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

// ---------- Create Account (shown when user has their own Firebase config) ----------

// Reveal the create-account section on load if the user has saved their own Firebase config
(function() {
    if (typeof usingCustomFirebase !== 'undefined' && usingCustomFirebase) {
        var el = document.getElementById('createAccountSection');
        if (el) el.classList.remove('hidden');
    }
})();

async function handleCreateAccount() {
    var email     = (document.getElementById('caEmail').value || '').trim();
    var password  = document.getElementById('caPassword').value;
    var confirm   = document.getElementById('caConfirm').value;
    var errorEl   = document.getElementById('caError');
    var submitBtn = document.getElementById('caSubmitBtn');

    errorEl.textContent = '';

    if (!email || !password || !confirm) {
        errorEl.textContent = 'Please fill in all fields.';
        return;
    }
    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        return;
    }
    if (password !== confirm) {
        errorEl.textContent = 'Passwords do not match.';
        return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Creating…';

    try {
        await auth.createUserWithEmailAndPassword(email, password);
        // Flag so the app shows lock-down instructions after loading
        localStorage.setItem('bishopNewAccountCreated', '1');
        // onAuthStateChanged fires automatically and transitions to the app
    } catch (err) {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Create Account';
        if (err.code === 'auth/email-already-in-use') {
            errorEl.textContent = 'An account with that email already exists. Try signing in instead.';
        } else if (err.code === 'auth/invalid-email') {
            errorEl.textContent = 'Please enter a valid email address.';
        } else if (err.code === 'auth/weak-password') {
            errorEl.textContent = 'Password must be at least 6 characters.';
        } else {
            errorEl.textContent = 'Could not create account. Please try again.';
            console.error('Create account error:', err);
        }
    }
}

// Called after app initializes — shows lock-down instructions once if account was just created
function _checkNewAccountWelcome() {
    if (!localStorage.getItem('bishopNewAccountCreated')) return;
    localStorage.removeItem('bishopNewAccountCreated');
    // Small delay so the app finishes routing before the modal opens
    setTimeout(function() { openModal('modal-new-account-welcome'); }, 400);
}

// ---------- Change Password Page ----------

/**
 * Called by app.js when navigating to #changepassword.
 * Clears the form so it's fresh each visit.
 */
function loadChangePasswordPage() {
    document.getElementById('cpCurrentPassword').value = '';
    document.getElementById('cpNewPassword').value     = '';
    document.getElementById('cpConfirmPassword').value = '';
    document.getElementById('cpError').textContent     = '';
    document.getElementById('cpSuccess').classList.add('hidden');
    document.getElementById('cpSaveBtn').disabled      = false;
    document.getElementById('cpSaveBtn').textContent   = 'Update Password';
}

document.getElementById('cpSaveBtn').addEventListener('click', async function() {
    var currentPw = document.getElementById('cpCurrentPassword').value;
    var newPw     = document.getElementById('cpNewPassword').value;
    var confirmPw = document.getElementById('cpConfirmPassword').value;
    var errorEl   = document.getElementById('cpError');
    var successEl = document.getElementById('cpSuccess');
    var saveBtn   = document.getElementById('cpSaveBtn');

    // Clear previous messages
    errorEl.textContent = '';
    successEl.classList.add('hidden');

    // Basic validation
    if (!currentPw || !newPw || !confirmPw) {
        errorEl.textContent = 'Please fill in all three fields.';
        return;
    }
    if (newPw.length < 6) {
        errorEl.textContent = 'New password must be at least 6 characters.';
        return;
    }
    if (newPw !== confirmPw) {
        errorEl.textContent = 'New password and confirmation do not match.';
        return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Updating…';

    try {
        var user = auth.currentUser;

        // Firebase requires re-authentication before changing password
        var credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPw);
        await user.reauthenticateWithCredential(credential);

        // Re-auth passed — now update the password
        await user.updatePassword(newPw);

        // Success
        successEl.classList.remove('hidden');
        document.getElementById('cpCurrentPassword').value = '';
        document.getElementById('cpNewPassword').value     = '';
        document.getElementById('cpConfirmPassword').value = '';
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Update Password';

    } catch (err) {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Update Password';

        // Give a clear message for the most common errors
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            errorEl.textContent = 'Current password is incorrect.';
        } else if (err.code === 'auth/weak-password') {
            errorEl.textContent = 'New password is too weak. Use at least 6 characters.';
        } else if (err.code === 'auth/requires-recent-login') {
            errorEl.textContent = 'Session expired. Please sign out and sign back in, then try again.';
        } else {
            errorEl.textContent = 'Could not update password. Please try again.';
            console.error('Change password error:', err);
        }
    }
});
