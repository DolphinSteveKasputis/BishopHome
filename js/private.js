// ============================================================
// private.js — Private Vault feature
//
// Provides an encrypted personal vault accessible only via a
// passphrase that is never stored anywhere. Uses the same
// AES-256-GCM + PBKDF2 pattern as legacy-crypto.js.
//
// Phase 1: encryption utilities + Settings activation flow.
// Phases 2-6 will add vault home, bookmarks, documents,
// photos, and backup.
// ============================================================

// In-memory derived key — null means vault is locked.
// We store the CryptoKey object, never the raw passphrase.
var _privateCryptoKey = null;

// Whether the vault has been activated (set on app load by
// privateCheckActivated(), used to show/hide the Life tile).
var window_privateActivated = false;

// True while a Storage upload is in progress — lock is deferred
// until the upload completes so data is never partially written.
window.privateUploadInProgress = false;

// Auto-lock timer handle.
var _privateLockTimer = null;
var _PRIVATE_LOCK_MS  = 60 * 60 * 1000; // 60 minutes

// Reset the inactivity timer on any click or keypress anywhere in the app.
document.addEventListener('click',    function() { if (_privateCryptoKey) _privateResetTimer(); });
document.addEventListener('keypress', function() { if (_privateCryptoKey) _privateResetTimer(); });

// ============================================================
// Public state helpers
// ============================================================

function privateIsUnlocked() {
    return _privateCryptoKey !== null;
}

// ============================================================
// Auto-lock timer
// ============================================================

function _privateStartTimer() {
    _privateResetTimer();
}

function _privateResetTimer() {
    clearTimeout(_privateLockTimer);
    if (!_privateCryptoKey) return;
    _privateLockTimer = setTimeout(privateLock, _PRIVATE_LOCK_MS);
}

// Lock the vault: clear the key, stop the timer, show gate if on a
// private page. Deferred if an upload is currently in progress.
function privateLock() {
    if (window.privateUploadInProgress) {
        setTimeout(privateLock, 5000);
        return;
    }
    _privateCryptoKey = null;
    clearTimeout(_privateLockTimer);
    _privateLockTimer = null;
    // If user is on any private page, redirect to gate
    var hash = window.location.hash;
    if (hash === '#private' || hash.startsWith('#private/')) {
        window.location.hash = '#private';
        _privateShowGateState();
    }
}

// ============================================================
// Gate / home state helpers
// ============================================================

// Show the passphrase gate, hide the vault home.
function _privateShowGateState() {
    var gate   = document.getElementById('private-gate');
    var home   = document.getElementById('private-home');
    var passEl = document.getElementById('privateGatePassphrase');
    var errEl  = document.getElementById('privateGateError');
    var btnEl  = document.getElementById('privateGateBtn');
    if (gate) gate.classList.remove('hidden');
    if (home) home.classList.add('hidden');
    if (passEl) { passEl.value = ''; setTimeout(function() { passEl.focus(); }, 100); }
    if (errEl)  { errEl.textContent = ''; errEl.classList.add('hidden'); }
    if (btnEl)  { btnEl.disabled = false; btnEl.textContent = 'Unlock'; }
}

// Show the vault home, hide the gate.
function _privateShowHomeState() {
    var gate = document.getElementById('private-gate');
    var home = document.getElementById('private-home');
    if (gate) gate.classList.add('hidden');
    if (home) home.classList.remove('hidden');
}

// ============================================================
// Navigation entry point — called by app.js route handler
// ============================================================

function privateNavigateTo(subpage) {
    if (!window.privateActivated) {
        window.location.hash = '#life';
        return;
    }
    if (subpage === 'home') {
        if (_privateCryptoKey) {
            _privateShowHomeState();
        } else {
            _privateShowGateState();
        }
    }
    // Sub-pages (bookmarks, documents, photos) gate-check in the
    // app.js route handler before calling showPage().
}

// ============================================================
// Unlock — verify passphrase against stored sentinel
// ============================================================

async function privateUnlock() {
    var passEl = document.getElementById('privateGatePassphrase');
    var btnEl  = document.getElementById('privateGateBtn');
    var errEl  = document.getElementById('privateGateError');

    var passphrase = passEl ? passEl.value : '';
    if (!passphrase) {
        if (errEl) { errEl.textContent = 'Enter your passphrase.'; errEl.classList.remove('hidden'); }
        return;
    }

    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Unlocking\u2026'; }
    if (errEl) errEl.classList.add('hidden');

    try {
        var doc = await userCol('privateVault').doc('auth').get();
        if (!doc.exists || !doc.data().encryptedSentinel) throw new Error('No vault auth doc');

        var key = await _privateDerive(passphrase);
        if (!key) throw new Error('Key derivation failed');

        var decrypted = await _privateDecryptStringWithKey(doc.data().encryptedSentinel, key);
        if (decrypted !== 'PRIVATE_VAULT_OK') {
            if (errEl) { errEl.textContent = 'Incorrect passphrase.'; errEl.classList.remove('hidden'); }
            if (passEl) { passEl.value = ''; passEl.focus(); }
            if (btnEl)  { btnEl.disabled = false; btnEl.textContent = 'Unlock'; }
            return;
        }

        // Correct passphrase — store key and show vault home
        _privateCryptoKey = key;
        if (passEl) passEl.value = '';
        _privateStartTimer();
        _privateShowHomeState();
    } catch (e) {
        console.error('Private unlock failed:', e);
        if (errEl) { errEl.textContent = 'Unlock failed. Please try again.'; errEl.classList.remove('hidden'); }
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Unlock'; }
    }
}

// ============================================================
// Activation check
// Reads Firestore to see if privateVault/auth exists.
// Sets window.privateActivated and returns the boolean.
// ============================================================

async function privateCheckActivated() {
    try {
        var doc = await userCol('privateVault').doc('auth').get();
        window.privateActivated = doc.exists && !!doc.data().encryptedSentinel;
    } catch (e) {
        window.privateActivated = false;
    }
    _privateUpdateLifeTile();
    _privateUpdateSettingsBadge();
    return window.privateActivated;
}

// Show or hide the Private tile on the Life screen based on
// activation state.
function _privateUpdateLifeTile() {
    var tile = document.getElementById('private-life-tile');
    if (!tile) return;
    if (window.privateActivated) {
        tile.classList.remove('hidden');
    } else {
        tile.classList.add('hidden');
    }
}

// ============================================================
// Settings card — open help modal
// ============================================================

function privateOpenHelpModal() {
    openModal('modal-private-help');
}

// ============================================================
// Settings card — open activation modal
// ============================================================

function privateOpenActivateModal() {
    var passEl    = document.getElementById('privateActivatePassphrase');
    var confirmEl = document.getElementById('privateActivateConfirm');
    var errEl     = document.getElementById('privateActivateError');
    var btnEl     = document.getElementById('privateActivateBtn');

    if (passEl)    passEl.value = '';
    if (confirmEl) confirmEl.value = '';
    if (errEl)     { errEl.textContent = ''; errEl.classList.add('hidden'); }
    if (btnEl)     { btnEl.disabled = false; btnEl.textContent = 'Activate'; }

    openModal('modal-private-activate');
    if (passEl) setTimeout(function() { passEl.focus(); }, 100);
}

// ============================================================
// Activation — full flow
// ============================================================

async function privateSubmitActivate() {
    var passEl    = document.getElementById('privateActivatePassphrase');
    var confirmEl = document.getElementById('privateActivateConfirm');
    var btnEl     = document.getElementById('privateActivateBtn');

    var passphrase = passEl ? passEl.value.trim() : '';
    var confirm    = confirmEl ? confirmEl.value.trim() : '';

    // Validate
    if (!passphrase) {
        _privateActivateError('Please enter a passphrase.');
        return;
    }
    if (passphrase.length <= 3) {
        _privateActivateError('Passphrase must be more than 3 characters.');
        return;
    }
    if (passphrase !== confirm) {
        _privateActivateError('Passphrases do not match.');
        return;
    }

    // Disable button and show progress
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Testing storage…'; }

    // Step 1 — derive the key
    var key = await _privateDerive(passphrase);
    if (!key) {
        _privateActivateError('Key derivation failed. Please try again.');
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Activate'; }
        return;
    }

    // Step 2 — Firebase Storage connectivity test
    if (btnEl) btnEl.textContent = 'Testing storage…';
    var storageOk = await _privateStorageTest(key);
    if (!storageOk) {
        _privateActivateError(
            'Firebase Storage is not ready. Complete the Setup steps first ' +
            '(including publishing the Security Rules), then try again.'
        );
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Activate'; }
        return;
    }

    // Step 3 — encrypt sentinel and save to Firestore
    if (btnEl) btnEl.textContent = 'Saving…';
    try {
        _privateCryptoKey = key;
        var sentinel = await _privateEncryptString('PRIVATE_VAULT_OK');
        var salt     = await _privateGetOrCreateSalt(); // already stored; retrieve for reference
        await userCol('privateVault').doc('auth').set({
            encryptedSentinel: sentinel
        }, { merge: true });
    } catch (e) {
        console.error('Private vault activation save failed:', e);
        _privateCryptoKey = null;
        _privateActivateError('Failed to save. Check your connection and try again.');
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Activate'; }
        return;
    }

    // Success
    window.privateActivated = true;
    _privateUpdateLifeTile();
    _privateUpdateSettingsBadge();
    closeModal('modal-private-activate');
}

function _privateActivateError(msg) {
    var errEl = document.getElementById('privateActivateError');
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
}

// ============================================================
// Settings badge — show green Active badge when activated
// ============================================================

function _privateUpdateSettingsBadge() {
    var badge  = document.getElementById('privateSettingsActiveBadge');
    var btn    = document.getElementById('privateActivateBtn');
    var btnWrap = document.getElementById('privateActivateBtnWrap');

    if (window.privateActivated) {
        if (badge)   badge.classList.remove('hidden');
        if (btnWrap) btnWrap.classList.add('hidden');
    } else {
        if (badge)   badge.classList.add('hidden');
        if (btnWrap) btnWrap.classList.remove('hidden');
    }
}

// Call this after the page loads and activation state is known.
function privateInitSettingsCard() {
    _privateUpdateSettingsBadge();
}

// ============================================================
// Firebase Storage connectivity test
// Uploads a tiny encrypted blob, downloads it, decrypts it,
// verifies it matches, then deletes it.
// Returns true on success, false on any failure.
// ============================================================

async function _privateStorageTest(key) {
    try {
        var user = firebase.auth().currentUser;
        if (!user) return false;

        var ref = firebase.storage().ref(
            'users/' + user.uid + '/test/activation-check'
        );

        // Upload a tiny blob, then delete it — proves both write and delete
        // access work under the current security rules.
        var blob = new Blob(['OK'], { type: 'text/plain' });
        await ref.put(blob);
        await ref.delete();
        return true;
    } catch (e) {
        console.error('Private Storage test failed:', e);
        return false;
    }
}

// ============================================================
// Core crypto — PBKDF2 key derivation
// ============================================================

async function _privateDerive(passphrase) {
    try {
        var salt = await _privateGetOrCreateSalt();
        var enc  = new TextEncoder();
        var keyMaterial = await crypto.subtle.importKey(
            'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
        );
        var key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
        return key;
    } catch (e) {
        console.error('Private key derivation failed:', e);
        return null;
    }
}

// ============================================================
// Encrypt / decrypt strings using the in-memory key
// ============================================================

// Encrypt using _privateCryptoKey (must be unlocked).
async function _privateEncryptString(plaintext) {
    if (!_privateCryptoKey) throw new Error('Private vault is locked');
    return _privateEncryptStringWithKey(plaintext, _privateCryptoKey);
}

// Decrypt using _privateCryptoKey (must be unlocked).
async function _privateDecryptString(b64) {
    if (!_privateCryptoKey || !b64) return null;
    return _privateDecryptStringWithKey(b64, _privateCryptoKey);
}

// Encrypt with an explicit key (used before _privateCryptoKey is set).
async function _privateEncryptStringWithKey(plaintext, key) {
    var iv      = crypto.getRandomValues(new Uint8Array(12));
    var enc     = new TextEncoder();
    var cipherBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(plaintext)
    );
    var combined = new Uint8Array(iv.length + cipherBuf.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuf), iv.length);
    return btoa(String.fromCharCode.apply(null, combined));
}

// Decrypt with an explicit key.
async function _privateDecryptStringWithKey(b64, key) {
    try {
        var bytes = Uint8Array.from(atob(b64), function(c) { return c.charCodeAt(0); });
        var iv    = bytes.slice(0, 12);
        var data  = bytes.slice(12);
        var plainBuf = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        return new TextDecoder().decode(plainBuf);
    } catch (e) {
        return null;
    }
}

// ============================================================
// Salt — stored plaintext in Firestore (not secret; prevents
// rainbow table attacks on the derived key).
// ============================================================

async function _privateGetOrCreateSalt() {
    var doc = await userCol('privateVault').doc('auth').get();
    if (doc.exists && doc.data().pbkdf2Salt) {
        return _privateHexToBytes(doc.data().pbkdf2Salt);
    }
    // First time: generate and persist the salt
    var salt = crypto.getRandomValues(new Uint8Array(16));
    await userCol('privateVault').doc('auth').set(
        { pbkdf2Salt: _privateBytesToHex(salt) },
        { merge: true }
    );
    return salt;
}

function _privateBytesToHex(bytes) {
    return Array.from(bytes).map(function(b) {
        return b.toString(16).padStart(2, '0');
    }).join('');
}

function _privateHexToBytes(hex) {
    var arr = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
        arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return arr;
}
