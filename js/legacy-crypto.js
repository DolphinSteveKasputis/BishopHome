// ============================================================
// legacy-crypto.js — My Legacy encryption utilities
//
// Encrypts sensitive financial fields (passwords, account
// numbers, SSNs, PINs) before saving to Firestore.
//
// How it works:
//   - User sets a Legacy Passphrase the first time they open
//     the Financial or Social section.
//   - The passphrase is used to derive an AES-GCM key via
//     PBKDF2 + a random salt stored in Firestore (non-sensitive).
//   - The passphrase and derived key are NEVER stored anywhere.
//   - The key lives in memory for the browser session only.
//   - Encrypted fields are stored in Firestore with an "Enc"
//     suffix (e.g., passwordEnc) as Base64-encoded strings.
// ============================================================

var _legacyCryptoKey = null;  // CryptoKey in memory; null = locked

// ---------- Public API ----------

/** Returns true if the section is unlocked this session. */
function legacyIsUnlocked() {
    return _legacyCryptoKey !== null;
}

/** Clears the in-memory key (called when navigating away from Legacy). */
function legacyLock() {
    _legacyCryptoKey = null;
}

/**
 * Derives an AES-GCM key from the given passphrase and the stored salt.
 * If no salt exists yet (first-time setup), creates and saves one.
 * Returns true on success, false if Firestore fails.
 */
async function legacyCryptoDeriveKey(passphrase) {
    try {
        var salt = await _legacyGetOrCreateSalt();
        var enc = new TextEncoder();
        var keyMaterial = await crypto.subtle.importKey(
            'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
        );
        _legacyCryptoKey = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
        return true;
    } catch (e) {
        console.error('Legacy key derivation failed:', e);
        return false;
    }
}

/**
 * Returns true if a passphrase has already been set up for this user
 * (i.e., a PBKDF2 salt exists in Firestore). Used to switch the modal
 * between "Create passphrase" and "Enter passphrase" modes.
 */
async function legacyCryptoIsSetUp() {
    try {
        var doc = await userCol('legacyMeta').doc('crypto').get();
        return doc.exists && !!doc.data().pbkdf2Salt;
    } catch (e) {
        return false;
    }
}

/**
 * Encrypts a plaintext string using AES-GCM.
 * Returns a Base64 string (IV prepended to ciphertext).
 * Throws if the section is not unlocked.
 */
async function legacyEncrypt(plaintext) {
    if (!_legacyCryptoKey) throw new Error('Legacy section is locked');
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var enc = new TextEncoder();
    var cipherBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        _legacyCryptoKey,
        enc.encode(plaintext)
    );
    var combined = new Uint8Array(iv.length + cipherBuf.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuf), iv.length);
    return btoa(String.fromCharCode.apply(null, combined));
}

/**
 * Decrypts a Base64-encoded AES-GCM ciphertext.
 * Returns the plaintext string, or null if decryption fails
 * (wrong passphrase, corrupted data, or section locked).
 */
async function legacyDecrypt(b64) {
    if (!_legacyCryptoKey || !b64) return null;
    try {
        var bytes = Uint8Array.from(atob(b64), function(c) { return c.charCodeAt(0); });
        var iv = bytes.slice(0, 12);
        var data = bytes.slice(12);
        var plainBuf = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            _legacyCryptoKey,
            data
        );
        return new TextDecoder().decode(plainBuf);
    } catch (e) {
        return null;
    }
}

// ---------- Internal Helpers ----------

async function _legacyGetOrCreateSalt() {
    var doc = await userCol('legacyMeta').doc('crypto').get();
    if (doc.exists && doc.data().pbkdf2Salt) {
        return _hexToBytes(doc.data().pbkdf2Salt);
    }
    // First-time: generate a random 16-byte salt and persist it
    var salt = crypto.getRandomValues(new Uint8Array(16));
    await userCol('legacyMeta').doc('crypto').set(
        { pbkdf2Salt: _bytesToHex(salt) },
        { merge: true }
    );
    return salt;
}

function _bytesToHex(bytes) {
    return Array.from(bytes).map(function(b) {
        return b.toString(16).padStart(2, '0');
    }).join('');
}

function _hexToBytes(hex) {
    var arr = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
        arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return arr;
}
