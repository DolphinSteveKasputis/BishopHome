// ============================================================
// firebasesetup.js — Firebase setup wizard + first-run banner
// Handles: first-run detection, config entry, validation, save/reset
// ============================================================

// After login, show the first-run banner if the user hasn't configured
// their own Firebase and hasn't dismissed the prompt before.
firebase.auth().onAuthStateChanged(function(user) {
    if (!user) return;
    if (usingCustomFirebase) return;                          // already on their own Firebase
    if (localStorage.getItem('bishopSetupDismissed')) return; // dismissed before

    var banner = document.getElementById('firstRunBanner');
    if (banner) banner.classList.remove('hidden');
});

/** Dismiss the first-run banner without setting up Firebase. */
function fsbDismiss() {
    localStorage.setItem('bishopSetupDismissed', '1');
    var banner = document.getElementById('firstRunBanner');
    if (banner) banner.classList.add('hidden');
}

// Tracks whether the page was opened from the login screen (pre-auth)
var _fsbFromLogin = false;

/** Called from the login screen "Set Up My Own Account" button. */
function fsbShowFromLogin() {
    _fsbFromLogin = true;
    document.getElementById('loginScreen').style.display = 'none';
    var pg = document.getElementById('page-firebase-setup');
    if (pg) pg.classList.remove('hidden');
    renderFirebaseSetupPage();
}

// ── Setup Page ──

function renderFirebaseSetupPage() {
    var pg = document.getElementById('page-firebase-setup');
    if (!pg) return;

    var hasCustom = usingCustomFirebase;
    var currentProjectId = hasCustom
        ? (activeFirebaseConfig.projectId || 'Unknown')
        : 'Shared (default)';

    var existingConfig = '';
    if (hasCustom) {
        try { existingConfig = JSON.stringify(JSON.parse(localStorage.getItem('bishopFirebaseConfig')), null, 2); }
        catch(e) {}
    }

    pg.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small back-btn" onclick="_fsbGoBack()">&#8592; Back</button>' +
            '<h2>Data Storage</h2>' +
            '<div></div>' +
        '</div>' +

        // Current status card
        '<div class="settings-card">' +
            '<h3 class="settings-section-title">Current Status</h3>' +
            '<p class="settings-section-desc">' +
                (hasCustom
                    ? '✅ You are using your own Firebase project: <strong>' + _fsbEsc(currentProjectId) + '</strong>'
                    : '⚠️ You are currently using the shared default database. Set up your own for private, dedicated storage.') +
            '</p>' +
            (hasCustom
                ? '<button class="btn btn-danger btn-small" style="margin-top:12px" onclick="_fsbReset()">🗑 Remove My Config &amp; Reset</button>'
                : '') +
        '</div>' +

        // Why section
        '<div class="settings-card">' +
            '<h3 class="settings-section-title">Why Set Up Your Own?</h3>' +
            '<ul class="fsb-why-list">' +
                '<li>Your data is completely private — only you can access it</li>' +
                '<li>Your own storage quota — no sharing limits with others</li>' +
                '<li>Free Firebase plan covers normal personal use easily</li>' +
                '<li>Takes about 10 minutes to set up</li>' +
            '</ul>' +
        '</div>' +

        // Step by step
        '<div class="settings-card">' +
            '<h3 class="settings-section-title">Step-by-Step Setup</h3>' +
            '<p class="settings-section-desc">Follow these steps, then paste your config at the bottom.</p>' +
            '<ol class="fsb-steps">' +
                '<li>' +
                    '<strong>Go to Firebase Console</strong><br>' +
                    'Open <span class="fsb-url">console.firebase.google.com</span> in your browser. ' +
                    'Sign in with a Google account (Gmail works fine).' +
                '</li>' +
                '<li>' +
                    '<strong>Create a new project</strong><br>' +
                    'Click <em>"Create a project"</em>. Give it any name (e.g., "My Bishop App"). ' +
                    'On the next screen, <strong>turn off Google Analytics</strong> (not needed). Click <em>"Create project"</em>.' +
                '</li>' +
                '<li>' +
                    '<strong>Enable Firestore (your database)</strong><br>' +
                    'In the left sidebar click <em>Build → Firestore Database</em>. Click <em>"Create database"</em>. ' +
                    'Choose <em>"Start in production mode"</em>. Click Next. ' +
                    'Pick the location closest to you (e.g., us-east1 for East US). Click <em>"Enable"</em>.' +
                '</li>' +
                '<li>' +
                    '<strong>Set Firestore security rules</strong><br>' +
                    'Once Firestore is created, click the <em>"Rules"</em> tab. Replace all the text with:<br>' +
                    '<code class="fsb-code">rules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}</code><br>' +
                    'Click <em>"Publish"</em>.' +
                '</li>' +
                '<li>' +
                    '<strong>Enable Email Login</strong><br>' +
                    'In the left sidebar click <em>Build → Authentication</em>. Click <em>"Get started"</em>. ' +
                    'Click <em>"Email/Password"</em>. Toggle it <strong>On</strong>. Click <em>"Save"</em>.' +
                '</li>' +
                '<li>' +
                    '<strong>Get your config</strong><br>' +
                    'Click the <em>gear icon ⚙️</em> at the top left → <em>"Project settings"</em>. ' +
                    'Scroll down to <em>"Your apps"</em>. Click the <em>&lt;/&gt;</em> (web) icon. ' +
                    'Give the app any name. Click <em>"Register app"</em>. ' +
                    'You\'ll see a block of code starting with <code>const firebaseConfig = {</code>. ' +
                    '<strong>Copy everything between the { curly braces }</strong> (just the object contents, or the whole thing — both work).' +
                '</li>' +
            '</ol>' +
        '</div>' +

        // Lock down
        '<div class="settings-card">' +
            '<h3 class="settings-section-title">Lock Down Your Account</h3>' +
            '<p class="settings-section-desc">After creating your account, disable new sign-ups so no one else can register on your Firebase project. Your existing account and password reset will still work.</p>' +
            '<ol class="fsb-steps">' +
                '<li>Go to <span class="fsb-url">console.firebase.google.com</span> and select your project</li>' +
                '<li>In the left sidebar click <em>Build → Authentication</em></li>' +
                '<li>Click the <strong>Settings</strong> tab (not the Users tab)</li>' +
                '<li>Under <strong>"User actions"</strong>, uncheck <strong>"Enable create (sign-up)"</strong></li>' +
                '<li>Click <strong>Save</strong></li>' +
            '</ol>' +
        '</div>' +

        // Paste config
        '<div class="settings-card">' +
            '<h3 class="settings-section-title">Paste Your Config Here</h3>' +
            '<p class="settings-section-desc">Paste the <code>firebaseConfig</code> block you copied from the Firebase console.</p>' +
            '<textarea id="fsbConfigInput" class="form-control fsb-config-textarea" ' +
                'placeholder=\'Paste your Firebase config here...\n\nExample:\n{\n  "apiKey": "AIza...",\n  "authDomain": "your-project.firebaseapp.com",\n  "projectId": "your-project",\n  "storageBucket": "your-project.firebasestorage.app",\n  "messagingSenderId": "123456789",\n  "appId": "1:123...:web:abc..."\n}\'>' +
                (hasCustom ? existingConfig : '') +
            '</textarea>' +
            '<p id="fsbError" class="fsb-error hidden"></p>' +
            '<div class="modal-buttons" style="margin-top:12px;">' +
                '<button class="btn btn-secondary" onclick="fsbDismiss(); _fsbGoBack()">Skip for Now</button>' +
                '<button class="btn btn-primary" onclick="_fsbValidateAndSave()">✅ Validate &amp; Save</button>' +
            '</div>' +
        '</div>';
}

/** Validate the pasted config, save to localStorage, and reload. */
function _fsbValidateAndSave() {
    var raw = (document.getElementById('fsbConfigInput').value || '').trim();
    if (!raw) { _fsbShowError('Please paste your Firebase config first.'); return; }

    // Extract the JSON object — handles both raw JSON and the full `const firebaseConfig = {...}` block
    var match = raw.match(/\{[\s\S]*\}/);
    if (!match) { _fsbShowError('Could not find a config object. Make sure you copied the firebaseConfig block from Firebase.'); return; }

    var parsed;
    try { parsed = JSON.parse(match[0]); }
    catch(e) { _fsbShowError('The config doesn\'t look like valid JSON. Try copying it again from the Firebase console.'); return; }

    var required = ['apiKey', 'authDomain', 'projectId', 'appId'];
    var missing = required.filter(function(k) { return !parsed[k]; });
    if (missing.length > 0) {
        _fsbShowError('Missing required fields: ' + missing.join(', ') + '. Make sure you copied the full config.');
        return;
    }

    localStorage.setItem('bishopFirebaseConfig', JSON.stringify(parsed));
    localStorage.setItem('bishopSetupDismissed', '1');

    alert('Config saved! Reloading now — create a new account (or sign in if you already did on this project).');
    window.location.reload();
}

/** Clear the stored config and reload (returns to default/shared Firebase). */
function _fsbReset() {
    if (!confirm('This removes your Firebase config and reloads. You will need to sign in again. Continue?')) return;
    localStorage.removeItem('bishopFirebaseConfig');
    localStorage.removeItem('bishopSetupDismissed');
    window.location.reload();
}

function _fsbShowError(msg) {
    var el = document.getElementById('fsbError');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function _fsbEsc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** Navigate back — to login screen if opened pre-auth, or to settings if opened post-auth. */
function _fsbGoBack() {
    var pg = document.getElementById('page-firebase-setup');
    if (pg) pg.classList.add('hidden');
    if (_fsbFromLogin) {
        _fsbFromLogin = false;
        document.getElementById('loginScreen').style.display = '';
    } else {
        window.location.hash = '#settings';
    }
}
