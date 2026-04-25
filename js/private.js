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
    try {
        var bucket = firebase.app().options.storageBucket || 'YOUR-BUCKET-NAME';
        var cmd = document.getElementById('help-cors-command');
        if (cmd) cmd.textContent = cmd.textContent.replace(/YOUR-BUCKET-NAME/g, bucket);
        var step = document.getElementById('help-cors-step-paste');
        if (step && bucket !== 'YOUR-BUCKET-NAME') {
            step.innerHTML = 'Click inside the Cloud Shell terminal, paste the command below (your bucket name is already filled in), then press <strong>Enter</strong>:';
        }
    } catch (e) {}
}

function privateCopyCode(btn) {
    var pre = btn.parentElement.querySelector('pre');
    navigator.clipboard.writeText(pre.textContent).then(function() {
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
    });
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

// ============================================================
// Phase 3: Private Bookmarks
// ============================================================

// Flat array of all bookmark nodes, decrypted in-memory after unlock.
// Each entry: {id, type, name, url, notes, parentId, order, depth}
var _bmNodes     = [];
var _bmRootId    = null;    // Firestore ID of the root node
var _bmCollapsed = {};      // {nodeId: true} — collapsed folder state (session only)

// Drag-and-drop state
var _bmDragId   = null;
var _bmDragOver = null;
var _bmDropPos  = null;     // 'before' | 'inside' | 'after'

// CRUD modal state
var _bmModalMode     = null; // 'add-folder' | 'add-bookmark' | 'edit'
var _bmModalParentId = null;
var _bmModalEditId   = null;

// ---- Page entry point ----

async function loadPrivateBookmarksPage() {
    if (!privateIsUnlocked()) { window.location.hash = '#private'; return; }
    var el = document.getElementById('private-bm-tree');
    if (el) el.innerHTML = '<p class="loading-state">Loading\u2026</p>';
    try {
        _bmNodes = await _bmLoadAll();
        var root = _bmNodes.find(function(n) { return n.type === 'root'; });
        if (!root) {
            var ref = await userCol('privateBookmarks').add({
                type: 'root', name: 'Bookmarks', parentId: null, order: 0, depth: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            root = { id: ref.id, type: 'root', name: 'Bookmarks', url: '', notes: '', parentId: null, order: 0, depth: 0 };
            _bmNodes.push(root);
        }
        _bmRootId = root.id;
        _bmRenderTree();
    } catch (e) {
        console.error('Bookmarks load failed:', e);
        if (el) el.innerHTML = '<p class="empty-state">Failed to load bookmarks.</p>';
    }
}

// ---- Data loading ----

async function _bmLoadAll() {
    var snap  = await userCol('privateBookmarks').get();
    var nodes = [];
    for (var i = 0; i < snap.docs.length; i++) {
        var doc = snap.docs[i];
        var d   = doc.data();
        var node = { id: doc.id, type: d.type, parentId: d.parentId || null, order: d.order || 0, depth: d.depth || 0 };
        if (d.type === 'root') {
            node.name = d.name || 'Bookmarks'; node.url = ''; node.notes = '';
        } else if (d.encryptedData) {
            var raw = await _privateDecryptStringWithKey(d.encryptedData, _privateCryptoKey);
            if (raw) {
                try {
                    var obj = JSON.parse(raw);
                    node.name = obj.name || ''; node.url = obj.url || ''; node.notes = obj.notes || '';
                } catch (e2) { node.name = '(error)'; node.url = ''; node.notes = ''; }
            } else { node.name = '(decrypt error)'; node.url = ''; node.notes = ''; }
        } else { node.name = ''; node.url = ''; node.notes = ''; }
        nodes.push(node);
    }
    return nodes;
}

async function _bmEncryptNode(name, url, notes) {
    var plain = JSON.stringify({ name: name || '', url: url || '', notes: notes || '' });
    return _privateEncryptStringWithKey(plain, _privateCryptoKey);
}

// ---- Rendering ----

function _bmRenderTree() {
    var el = document.getElementById('private-bm-tree');
    if (!el) return;
    var children = _bmGetChildren(_bmRootId);
    if (children.length === 0) {
        el.innerHTML = '<p class="empty-state">No bookmarks yet. Add a folder or bookmark above.</p>';
        return;
    }
    el.innerHTML = children.map(_bmNodeHtml).join('');
}

function _bmNodeHtml(node) {
    var isFolder  = node.type === 'folder';
    var children  = isFolder ? _bmGetChildren(node.id) : [];
    var collapsed = !!_bmCollapsed[node.id];
    var icon      = isFolder ? '&#128193;' : '&#128278;';

    var nameHtml = isFolder
        ? '<span class="bm-name">' + _bmEsc(node.name) + '</span>'
        : '<a class="bm-name bm-link" href="' + _bmEsc(node.url || '#') + '" target="_blank" rel="noopener">' + _bmEsc(node.name) + '</a>';

    var toggleBtn = isFolder
        ? '<button class="bm-toggle" onclick="_bmToggleFolder(\'' + node.id + '\')" title="' + (collapsed ? 'Expand' : 'Collapse') + '">' + (collapsed ? '&#9654;' : '&#9660;') + '</button>'
        : '<span class="bm-toggle-spacer"></span>';

    var acts = '';
    if (isFolder) {
        acts += '<button class="btn btn-small btn-secondary bm-act" onclick="event.stopPropagation();privateOpenAddBookmarkModal(\'' + node.id + '\')">+ Bookmark</button>';
        acts += '<button class="btn btn-small btn-secondary bm-act" onclick="event.stopPropagation();privateOpenAddFolderModal(\'' + node.id + '\')">+ Folder</button>';
    }
    acts += '<button class="btn btn-small btn-secondary bm-act" onclick="event.stopPropagation();privateOpenEditBmModal(\'' + node.id + '\')">Edit</button>';
    acts += '<button class="btn btn-small btn-danger bm-act" onclick="event.stopPropagation();privateDeleteNode(\'' + node.id + '\',\'' + node.type + '\')">Delete</button>';

    var childHtml = isFolder ? children.map(_bmNodeHtml).join('') : '';

    return (
        '<div class="bm-node" data-bm-id="' + node.id + '" data-bm-type="' + node.type + '">' +
            '<div class="bm-node-row"' +
                ' draggable="true"' +
                ' ondragstart="_bmOnDragStart(event,\'' + node.id + '\')"' +
                ' ondragover="_bmOnDragOver(event,\'' + node.id + '\',' + isFolder + ')"' +
                ' ondragleave="_bmOnDragLeave(event,\'' + node.id + '\')"' +
                ' ondragend="_bmOnDragEnd(event)"' +
                ' ondrop="_bmOnDrop(event,\'' + node.id + '\',' + isFolder + ')">' +
                '<span class="bm-drag-handle" title="Drag to reorder">&#9776;</span>' +
                toggleBtn +
                '<span class="bm-icon">' + icon + '</span>' +
                nameHtml +
                '<div class="bm-actions">' + acts + '</div>' +
            '</div>' +
            (isFolder ? '<div class="bm-children' + (collapsed ? ' hidden' : '') + '" id="bm-ch-' + node.id + '">' + childHtml + '</div>' : '') +
        '</div>'
    );
}

function _bmGetChildren(parentId) {
    return _bmNodes
        .filter(function(n) { return n.parentId === parentId; })
        .sort(function(a, b) { return a.order - b.order; });
}

function _bmGetDescendants(id) {
    var result = [];
    _bmGetChildren(id).forEach(function(child) {
        result.push(child);
        _bmGetDescendants(child.id).forEach(function(d) { result.push(d); });
    });
    return result;
}

function _bmEsc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _bmToggleFolder(id) {
    _bmCollapsed[id] = !_bmCollapsed[id];
    var btn = document.querySelector('.bm-node[data-bm-id="' + id + '"] > .bm-node-row .bm-toggle');
    var ch  = document.getElementById('bm-ch-' + id);
    if (btn) { btn.innerHTML = _bmCollapsed[id] ? '&#9654;' : '&#9660;'; btn.title = _bmCollapsed[id] ? 'Expand' : 'Collapse'; }
    if (ch)  ch.classList.toggle('hidden', !!_bmCollapsed[id]);
}

// Toolbar shortcuts — add at root level
function privateAddFolderAtRoot()   { if (_bmRootId) privateOpenAddFolderModal(_bmRootId); }
function privateAddBookmarkAtRoot() { if (_bmRootId) privateOpenAddBookmarkModal(_bmRootId); }

// ---- CRUD modals ----

function _bmResetModal(title, showUrl) {
    document.getElementById('bm-modal-title').textContent = title;
    document.getElementById('bm-url-group').classList.toggle('hidden', !showUrl);
    document.getElementById('bm-modal-name').value  = '';
    document.getElementById('bm-modal-url').value   = '';
    document.getElementById('bm-modal-notes').value = '';
    var err = document.getElementById('bm-modal-error');
    err.textContent = ''; err.classList.add('hidden');
    var btn = document.getElementById('bm-modal-save-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
}

function privateOpenAddFolderModal(parentId) {
    _bmModalMode = 'add-folder'; _bmModalParentId = parentId; _bmModalEditId = null;
    _bmResetModal('Add Folder', false);
    openModal('modal-bm-edit');
    setTimeout(function() { document.getElementById('bm-modal-name').focus(); }, 100);
}

function privateOpenAddBookmarkModal(parentId) {
    _bmModalMode = 'add-bookmark'; _bmModalParentId = parentId; _bmModalEditId = null;
    _bmResetModal('Add Bookmark', true);
    openModal('modal-bm-edit');
    setTimeout(function() { document.getElementById('bm-modal-name').focus(); }, 100);
}

function privateOpenEditBmModal(nodeId) {
    var node = _bmNodes.find(function(n) { return n.id === nodeId; });
    if (!node) return;
    _bmModalMode = 'edit'; _bmModalParentId = node.parentId; _bmModalEditId = nodeId;
    _bmResetModal(node.type === 'folder' ? 'Edit Folder' : 'Edit Bookmark', node.type === 'bookmark');
    document.getElementById('bm-modal-name').value  = node.name  || '';
    document.getElementById('bm-modal-url').value   = node.url   || '';
    document.getElementById('bm-modal-notes').value = node.notes || '';
    openModal('modal-bm-edit');
    setTimeout(function() { document.getElementById('bm-modal-name').focus(); }, 100);
}

async function privateSubmitBmModal() {
    var name  = (document.getElementById('bm-modal-name').value  || '').trim();
    var url   = (document.getElementById('bm-modal-url').value   || '').trim();
    var notes = (document.getElementById('bm-modal-notes').value || '').trim();
    var errEl = document.getElementById('bm-modal-error');
    var btn   = document.getElementById('bm-modal-save-btn');

    if (!name) { errEl.textContent = 'Name is required.'; errEl.classList.remove('hidden'); return; }

    var editNode   = _bmModalEditId ? _bmNodes.find(function(n) { return n.id === _bmModalEditId; }) : null;
    var isBookmark = _bmModalMode === 'add-bookmark' || (editNode && editNode.type === 'bookmark');
    if (isBookmark && !url) { errEl.textContent = 'URL is required.'; errEl.classList.remove('hidden'); return; }
    if (isBookmark && url && !url.match(/^https?:\/\//)) url = 'https://' + url;

    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    try {
        if (_bmModalMode === 'edit') {
            var enc = await _bmEncryptNode(name, url, notes);
            await userCol('privateBookmarks').doc(_bmModalEditId).update({ encryptedData: enc });
        } else {
            var parentNode = _bmNodes.find(function(n) { return n.id === _bmModalParentId; });
            var newDepth   = (parentNode ? parentNode.depth : 0) + 1;
            if (newDepth > 5) {
                errEl.textContent = 'Maximum depth of 5 levels reached.';
                errEl.classList.remove('hidden');
                if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
                return;
            }
            var enc2 = await _bmEncryptNode(name, url, notes);
            await userCol('privateBookmarks').add({
                type: _bmModalMode === 'add-folder' ? 'folder' : 'bookmark',
                encryptedData: enc2,
                parentId: _bmModalParentId,
                order: _bmGetChildren(_bmModalParentId).length,
                depth: newDepth,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        closeModal('modal-bm-edit');
        await loadPrivateBookmarksPage();
    } catch (e3) {
        console.error('BM save failed:', e3);
        errEl.textContent = 'Save failed. Please try again.';
        errEl.classList.remove('hidden');
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
}

async function privateDeleteNode(nodeId, type) {
    var node = _bmNodes.find(function(n) { return n.id === nodeId; });
    var msg  = type === 'folder'
        ? 'Delete folder "' + (node ? node.name : '') + '" and ALL its contents?'
        : 'Delete bookmark "' + (node ? node.name : '') + '"?';
    if (!confirm(msg)) return;
    var ids   = [nodeId].concat(_bmGetDescendants(nodeId).map(function(d) { return d.id; }));
    var batch = firebase.firestore().batch();
    ids.forEach(function(id) { batch.delete(userCol('privateBookmarks').doc(id)); });
    await batch.commit();
    await loadPrivateBookmarksPage();
}

// ---- Drag and Drop ----

function _bmOnDragStart(e, id) {
    _bmDragId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setTimeout(function() {
        var row = document.querySelector('.bm-node[data-bm-id="' + id + '"] > .bm-node-row');
        if (row) row.classList.add('bm-dragging');
    }, 0);
}

function _bmOnDragEnd(e) {
    document.querySelectorAll('.bm-dragging,.bm-drop-before,.bm-drop-after,.bm-drop-inside').forEach(function(el) {
        el.classList.remove('bm-dragging', 'bm-drop-before', 'bm-drop-after', 'bm-drop-inside');
    });
    _bmDragOver = null;
}

function _bmOnDragOver(e, id, isFolder) {
    if (id === _bmDragId || _bmIsDescendant(id, _bmDragId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    var row  = e.currentTarget;
    var rect = row.getBoundingClientRect();
    var yPct = (e.clientY - rect.top) / rect.height;
    if (_bmDragOver && _bmDragOver !== id) _bmClearHighlight(_bmDragOver);
    _bmDragOver = id;
    row.classList.remove('bm-drop-before', 'bm-drop-after', 'bm-drop-inside');
    if (yPct < 0.28) {
        _bmDropPos = 'before'; row.classList.add('bm-drop-before');
    } else if (isFolder && yPct <= 0.72) {
        _bmDropPos = 'inside'; row.classList.add('bm-drop-inside');
    } else {
        _bmDropPos = 'after';  row.classList.add('bm-drop-after');
    }
}

function _bmOnDragLeave(e, id) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    _bmClearHighlight(id);
}

function _bmClearHighlight(id) {
    var row = document.querySelector('.bm-node[data-bm-id="' + id + '"] > .bm-node-row');
    if (row) row.classList.remove('bm-drop-before', 'bm-drop-after', 'bm-drop-inside');
}

async function _bmOnDrop(e, targetId, isFolder) {
    e.preventDefault();
    var sourceId = _bmDragId;
    var dropPos  = _bmDropPos;
    _bmDragId = null;
    if (!sourceId || sourceId === targetId || !dropPos) return;
    if (_bmIsDescendant(targetId, sourceId)) return;

    var source = _bmNodes.find(function(n) { return n.id === sourceId; });
    var target = _bmNodes.find(function(n) { return n.id === targetId; });
    if (!source || !target) return;

    var newParentId = (dropPos === 'inside') ? targetId : target.parentId;
    var newParent   = _bmNodes.find(function(n) { return n.id === newParentId; });
    var newDepth    = (newParent ? newParent.depth : 0) + 1;
    var depthDelta  = newDepth - source.depth;

    if (newDepth + _bmMaxSubtreeDepth(sourceId) > 5) {
        alert('Cannot move here \u2014 exceeds the 5-level depth limit.');
        return;
    }

    // Build ordered sibling list for the new parent, inserting source at the right position
    var newSibs = _bmGetChildren(newParentId).filter(function(n) { return n.id !== sourceId; });
    var insertAt = newSibs.length;
    if (dropPos === 'before') {
        var ti = newSibs.findIndex(function(n) { return n.id === targetId; });
        insertAt = ti >= 0 ? ti : 0;
    } else if (dropPos === 'after') {
        var ti2 = newSibs.findIndex(function(n) { return n.id === targetId; });
        insertAt = ti2 >= 0 ? ti2 + 1 : newSibs.length;
    }
    newSibs.splice(insertAt, 0, { id: sourceId });

    // Collect all Firestore updates; one entry per doc to avoid double-write
    var upd = {};
    upd[sourceId] = { parentId: newParentId, depth: newDepth, order: insertAt };
    newSibs.forEach(function(s, i) { if (!upd[s.id]) upd[s.id] = {}; upd[s.id].order = i; });
    if (depthDelta !== 0) {
        _bmGetDescendants(sourceId).forEach(function(d) {
            if (!upd[d.id]) upd[d.id] = {};
            upd[d.id].depth = d.depth + depthDelta;
        });
    }
    if (source.parentId !== newParentId) {
        _bmGetChildren(source.parentId)
            .filter(function(n) { return n.id !== sourceId; })
            .forEach(function(s, i) { if (!upd[s.id]) upd[s.id] = {}; upd[s.id].order = i; });
    }

    var batch = firebase.firestore().batch();
    Object.keys(upd).forEach(function(id) {
        batch.update(userCol('privateBookmarks').doc(id), upd[id]);
    });
    await batch.commit();
    await loadPrivateBookmarksPage();
}

function _bmIsDescendant(candidateId, ancestorId) {
    if (!candidateId || !ancestorId) return false;
    var node = _bmNodes.find(function(n) { return n.id === candidateId; });
    while (node && node.parentId) {
        if (node.parentId === ancestorId) return true;
        node = _bmNodes.find(function(n2) { return n2.id === node.parentId; });
    }
    return false;
}

function _bmMaxSubtreeDepth(id) {
    var ch = _bmGetChildren(id);
    if (!ch.length) return 0;
    return 1 + Math.max.apply(null, ch.map(function(c) { return _bmMaxSubtreeDepth(c.id); }));
}

// ============================================================
// Phase 4: Private Documents
// ============================================================

// In-memory document list (decrypted titles, unencrypted metadata).
var _docList = []; // [{id, title, originalFileName, storageRef, fileSizeBytes, updatedAt, createdAt}]

// Modal state
var _docModalMode       = null; // 'add' | 'reupload'
var _docReuploadId      = null; // doc ID being replaced
var _docReuploadTitle   = null; // kept as-is on reupload

// ---- Binary crypto helpers ----

// Encrypt an ArrayBuffer using the in-memory key.
// Returns Uint8Array: [IV(12 bytes) | ciphertext]
async function _privateEncryptBuffer(buffer) {
    var iv        = crypto.getRandomValues(new Uint8Array(12));
    var cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, _privateCryptoKey, buffer);
    var result    = new Uint8Array(12 + cipherBuf.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(cipherBuf), 12);
    return result;
}

// Decrypt a Uint8Array/ArrayBuffer produced by _privateEncryptBuffer.
// Returns ArrayBuffer of the original plaintext.
async function _privateDecryptBuffer(combined) {
    var arr  = combined instanceof Uint8Array ? combined : new Uint8Array(combined);
    var iv   = arr.slice(0, 12);
    var data = arr.slice(12);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, _privateCryptoKey, data);
}

// Download raw bytes from Firebase Storage via XHR (avoids fetch CORS quirks).
function _docFetchBytes(storagePath) {
    return firebase.storage().ref(storagePath).getDownloadURL().then(function(url) {
        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.responseType = 'arraybuffer';
            xhr.onload  = function() { xhr.status === 200 ? resolve(xhr.response) : reject(new Error('HTTP ' + xhr.status)); };
            xhr.onerror = function() { reject(new Error('Network error')); };
            xhr.open('GET', url);
            xhr.send();
        });
    });
}

// Trigger a browser download of a decrypted ArrayBuffer as a .docx file.
function _docTriggerDownload(buffer, filename) {
    var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = filename || 'document.docx';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
}

function _docFormatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function _docFormatDate(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _docSetStatus(msg) {
    var el = document.getElementById('doc-upload-status');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
}

// ---- Page entry ----

async function loadPrivateDocumentsPage() {
    if (!privateIsUnlocked()) { window.location.hash = '#private'; return; }
    var el = document.getElementById('private-doc-list');
    if (el) el.innerHTML = '<p class="loading-state">Loading\u2026</p>';
    try {
        _docList = await _docLoadAll();
        _docRenderList();
    } catch (e) {
        console.error('Docs load failed:', e);
        if (el) el.innerHTML = '<p class="empty-state">Failed to load documents.</p>';
    }
}

// ---- Data loading ----

async function _docLoadAll() {
    var snap = await userCol('privateDocuments').orderBy('updatedAt', 'desc').get();
    var docs = [];
    for (var i = 0; i < snap.docs.length; i++) {
        var doc = snap.docs[i];
        var d   = doc.data();
        var title = d.encryptedTitle
            ? (await _privateDecryptStringWithKey(d.encryptedTitle, _privateCryptoKey) || '(decrypt error)')
            : '(untitled)';
        var originalFileName = d.encryptedOriginalFileName
            ? (await _privateDecryptStringWithKey(d.encryptedOriginalFileName, _privateCryptoKey) || 'document.docx')
            : 'document.docx';
        docs.push({
            id: doc.id,
            title: title,
            originalFileName: originalFileName,
            storageRef: d.storageRef,
            fileSizeBytes: d.fileSizeBytes || 0,
            updatedAt: d.updatedAt,
            createdAt: d.createdAt
        });
    }
    return docs;
}

// ---- Rendering ----

function _docRenderList() {
    var el = document.getElementById('private-doc-list');
    if (!el) return;
    if (_docList.length === 0) {
        el.innerHTML = '<p class="empty-state">No documents yet. Click \u201c+ Add Document\u201d to upload one.</p>';
        return;
    }
    el.innerHTML = _docList.map(function(doc) {
        return (
            '<div class="doc-row">' +
                '<div class="doc-info">' +
                    '<span class="doc-title">' + _bmEsc(doc.title) + '</span>' +
                    '<span class="doc-meta">' + _docFormatDate(doc.updatedAt) + ' &bull; ' + _docFormatSize(doc.fileSizeBytes) + '</span>' +
                '</div>' +
                '<div class="doc-actions">' +
                    '<button class="btn btn-small btn-secondary" onclick="privateOpenDoc(\'' + doc.id + '\')">Open</button>' +
                    '<button class="btn btn-small btn-secondary" onclick="privateReuploadDocModal(\'' + doc.id + '\')">Re-upload</button>' +
                    '<button class="btn btn-small btn-danger"    onclick="privateDeleteDoc(\'' + doc.id + '\')">Delete</button>' +
                '</div>' +
            '</div>'
        );
    }).join('');
}

// ---- Add document modal ----

function privateOpenAddDocModal() {
    _docModalMode = 'add'; _docReuploadId = null; _docReuploadTitle = null;
    document.getElementById('doc-modal-heading').textContent = 'Add Document';
    document.getElementById('doc-title-group').classList.remove('hidden');
    document.getElementById('doc-reupload-label').classList.add('hidden');
    document.getElementById('doc-modal-title-input').value = '';
    document.getElementById('doc-modal-file').value = '';
    document.getElementById('doc-file-size').textContent = '';
    document.getElementById('doc-file-size').classList.add('hidden');
    document.getElementById('doc-modal-error').textContent = '';
    document.getElementById('doc-modal-error').classList.add('hidden');
    _docSetStatus('');
    var btn = document.getElementById('doc-modal-save-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Upload'; }
    var cancel = document.getElementById('doc-modal-cancel-btn');
    if (cancel) cancel.disabled = false;
    openModal('modal-doc-edit');
    setTimeout(function() { document.getElementById('doc-modal-title-input').focus(); }, 100);
}

function privateReuploadDocModal(docId) {
    var doc = _docList.find(function(d) { return d.id === docId; });
    if (!doc) return;
    _docModalMode = 'reupload'; _docReuploadId = docId; _docReuploadTitle = doc.title;
    document.getElementById('doc-modal-heading').textContent = 'Re-upload Document';
    document.getElementById('doc-title-group').classList.add('hidden');
    var lbl = document.getElementById('doc-reupload-label');
    lbl.textContent = 'Replacing: ' + doc.title;
    lbl.classList.remove('hidden');
    document.getElementById('doc-modal-file').value = '';
    document.getElementById('doc-file-size').textContent = '';
    document.getElementById('doc-file-size').classList.add('hidden');
    document.getElementById('doc-modal-error').textContent = '';
    document.getElementById('doc-modal-error').classList.add('hidden');
    _docSetStatus('');
    var btn = document.getElementById('doc-modal-save-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Upload'; }
    var cancel = document.getElementById('doc-modal-cancel-btn');
    if (cancel) cancel.disabled = false;
    openModal('modal-doc-edit');
    setTimeout(function() { document.getElementById('doc-modal-file').focus(); }, 100);
}

// Show selected file size in the modal
function _docOnFileChange(input) {
    var sizeEl = document.getElementById('doc-file-size');
    if (input.files && input.files[0]) {
        sizeEl.textContent = _docFormatSize(input.files[0].size);
        sizeEl.classList.remove('hidden');
    } else {
        sizeEl.textContent = '';
        sizeEl.classList.add('hidden');
    }
}

async function privateSubmitDocModal() {
    var errEl  = document.getElementById('doc-modal-error');
    var btn    = document.getElementById('doc-modal-save-btn');
    var cancel = document.getElementById('doc-modal-cancel-btn');
    var file   = document.getElementById('doc-modal-file').files[0];
    var title  = _docModalMode === 'add'
        ? (document.getElementById('doc-modal-title-input').value || '').trim()
        : _docReuploadTitle;

    errEl.textContent = ''; errEl.classList.add('hidden');

    if (_docModalMode === 'add' && !title) {
        errEl.textContent = 'Title is required.'; errEl.classList.remove('hidden'); return;
    }
    if (!file) {
        errEl.textContent = 'Please select a .docx file.'; errEl.classList.remove('hidden'); return;
    }

    if (btn)    { btn.disabled = true; btn.textContent = 'Working\u2026'; }
    if (cancel) cancel.disabled = true;
    window.privateUploadInProgress = true;

    try {
        _docSetStatus('Reading file\u2026');
        var buffer = await file.arrayBuffer();

        _docSetStatus('Encrypting\u2026');
        var encrypted = await _privateEncryptBuffer(buffer);

        var user = firebase.auth().currentUser;
        if (!user) throw new Error('Not authenticated');

        if (_docModalMode === 'add') {
            // Create Firestore doc ref first to get the ID for the Storage path
            var newRef = userCol('privateDocuments').doc();
            var storagePath = 'users/' + user.uid + '/privateDocuments/' + newRef.id;
            var storageRef  = firebase.storage().ref(storagePath);

            _docSetStatus('Uploading\u2026 0%');
            var uploadTask = storageRef.put(encrypted.buffer, { contentType: 'application/octet-stream' });
            uploadTask.on('state_changed', function(snap) {
                var pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
                _docSetStatus('Uploading\u2026 ' + pct + '%');
            });
            await uploadTask;

            _docSetStatus('Saving\u2026');
            var encTitle    = await _privateEncryptStringWithKey(title, _privateCryptoKey);
            var encFileName = await _privateEncryptStringWithKey(file.name, _privateCryptoKey);
            await newRef.set({
                encryptedTitle: encTitle,
                encryptedOriginalFileName: encFileName,
                storageRef: storagePath,
                fileSizeBytes: file.size,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Re-upload: overwrite Storage, update Firestore
            var existing = _docList.find(function(d) { return d.id === _docReuploadId; });
            if (!existing) throw new Error('Doc not found');
            var rStorageRef = firebase.storage().ref(existing.storageRef);

            _docSetStatus('Uploading\u2026 0%');
            var rTask = rStorageRef.put(encrypted.buffer, { contentType: 'application/octet-stream' });
            rTask.on('state_changed', function(snap) {
                var pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
                _docSetStatus('Uploading\u2026 ' + pct + '%');
            });
            await rTask;

            _docSetStatus('Saving\u2026');
            var encFN2 = await _privateEncryptStringWithKey(file.name, _privateCryptoKey);
            await userCol('privateDocuments').doc(_docReuploadId).update({
                encryptedOriginalFileName: encFN2,
                fileSizeBytes: file.size,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        _docSetStatus('Done!');
        window.privateUploadInProgress = false;
        setTimeout(function() {
            closeModal('modal-doc-edit');
            loadPrivateDocumentsPage();
        }, 600);
    } catch (e) {
        console.error('Doc upload failed:', e);
        window.privateUploadInProgress = false;
        errEl.textContent = 'Upload failed: ' + e.message;
        errEl.classList.remove('hidden');
        _docSetStatus('');
        if (btn)    { btn.disabled = false; btn.textContent = 'Upload'; }
        if (cancel) cancel.disabled = false;
    }
}

// ---- Open (download + decrypt) ----

async function privateOpenDoc(docId) {
    var doc = _docList.find(function(d) { return d.id === docId; });
    if (!doc) return;
    var btn = event && event.target ? event.target : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Opening\u2026'; }
    try {
        var encBytes = await _docFetchBytes(doc.storageRef);
        var plain    = await _privateDecryptBuffer(encBytes);
        _docTriggerDownload(plain, doc.originalFileName);
    } catch (e) {
        console.error('Doc open failed:', e);
        alert('Failed to open document: ' + e.message);
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Open'; }
}

// ---- Delete ----

async function privateDeleteDoc(docId) {
    var doc = _docList.find(function(d) { return d.id === docId; });
    if (!doc) return;
    if (!confirm('Delete "' + doc.title + '"? This cannot be undone.')) return;
    try {
        await firebase.storage().ref(doc.storageRef).delete();
        await userCol('privateDocuments').doc(docId).delete();
        await loadPrivateDocumentsPage();
    } catch (e) {
        console.error('Doc delete failed:', e);
        alert('Delete failed: ' + e.message);
    }
}

// ============================================================
// Phase 5: Private Photos
// ============================================================

// In-memory state
var _photoAlbums          = []; // [{id, name, order}]
var _photoCurrentKey      = null; // Firestore albumId | null (uncategorized)
var _photoCurrentPhotos   = []; // [{id, caption, originalFileName, storageRef, albumId, createdAt}]
var _photoBlobUrls        = {}; // {photoId: blobUrl} — revoked on gallery reload
var _photoViewerIdx       = -1; // current index into _photoCurrentPhotos
var _photoAlbumModalMode  = null; // 'add' | 'rename'
var _photoAlbumRenameId   = null;

// ---- Image compression ----

function _photoCompress(file) {
    return new Promise(function(resolve, reject) {
        var img = new Image();
        var objUrl = URL.createObjectURL(file);
        img.onload = function() {
            var MAX = 1400;
            var w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
                else        { w = Math.round(w * MAX / h); h = MAX; }
            }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(objUrl);
            canvas.toBlob(function(blob) { resolve(blob); }, 'image/jpeg', 0.82);
        };
        img.onerror = reject;
        img.src = objUrl;
    });
}

// Revoke all cached thumbnail blob URLs (call before loading a new gallery).
function _photoRevokeBlobs() {
    Object.values(_photoBlobUrls).forEach(function(u) { URL.revokeObjectURL(u); });
    _photoBlobUrls = {};
}

// ---- Album list page ----

async function loadPrivatePhotosPage() {
    if (!privateIsUnlocked()) { window.location.hash = '#private'; return; }
    var el = document.getElementById('private-album-list');
    if (el) el.innerHTML = '<p class="loading-state">Loading\u2026</p>';
    _photoRevokeBlobs();
    try {
        _photoAlbums = await _photoLoadAlbums();
        // Count photos per album and uncategorized
        var countSnap = await userCol('privatePhotos').get();
        var counts = {}; var uncatCount = 0;
        countSnap.docs.forEach(function(d) {
            var aid = d.data().albumId;
            if (aid) counts[aid] = (counts[aid] || 0) + 1;
            else uncatCount++;
        });
        _photoRenderAlbumList(counts, uncatCount);
    } catch (e) {
        console.error('Photo albums load failed:', e);
        if (el) el.innerHTML = '<p class="empty-state">Failed to load albums.</p>';
    }
}

async function _photoLoadAlbums() {
    var snap = await userCol('privatePhotoAlbums').orderBy('order').get();
    var albums = [];
    for (var i = 0; i < snap.docs.length; i++) {
        var doc = snap.docs[i]; var d = doc.data();
        var name = d.encryptedName
            ? (await _privateDecryptStringWithKey(d.encryptedName, _privateCryptoKey) || '(album)')
            : '(album)';
        albums.push({ id: doc.id, name: name, order: d.order || i });
    }
    return albums;
}

function _photoRenderAlbumList(counts, uncatCount) {
    var el = document.getElementById('private-album-list');
    if (!el) return;
    var html = '';
    // Uncategorized virtual album (first, only if photos exist)
    if (uncatCount > 0) {
        html += _photoAlbumCardHtml(null, 'Uncategorized', uncatCount, true);
    }
    _photoAlbums.forEach(function(album) {
        html += _photoAlbumCardHtml(album.id, album.name, counts[album.id] || 0, false);
    });
    if (!html) {
        el.innerHTML = '<p class="empty-state">No albums yet. Click \u201c+ Add Album\u201d to create one.</p>';
        return;
    }
    el.innerHTML = html;
}

function _photoAlbumCardHtml(albumId, name, count, isVirtual) {
    var key = albumId || 'uncategorized';
    return (
        '<div class="photo-album-card" onclick="window.location.hash=\'#private/photos/album/' + key + '\'">' +
            '<div class="photo-album-icon">&#128247;</div>' +
            '<div class="photo-album-name">' + _bmEsc(name) + '</div>' +
            '<div class="photo-album-count">' + count + ' photo' + (count === 1 ? '' : 's') + '</div>' +
        '</div>'
    );
}

// ---- Album CRUD ----

function privateOpenAddAlbumModal() {
    _photoAlbumModalMode = 'add'; _photoAlbumRenameId = null;
    document.getElementById('album-modal-title').textContent = 'Add Album';
    document.getElementById('album-modal-name').value = '';
    var err = document.getElementById('album-modal-error');
    err.textContent = ''; err.classList.add('hidden');
    var btn = document.getElementById('album-modal-save-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    openModal('modal-photo-album-edit');
    setTimeout(function() { document.getElementById('album-modal-name').focus(); }, 100);
}

function privateRenameAlbumModal(albumId) {
    var album = _photoAlbums.find(function(a) { return a.id === albumId; });
    if (!album) return;
    _photoAlbumModalMode = 'rename'; _photoAlbumRenameId = albumId;
    document.getElementById('album-modal-title').textContent = 'Rename Album';
    document.getElementById('album-modal-name').value = album.name;
    var err = document.getElementById('album-modal-error');
    err.textContent = ''; err.classList.add('hidden');
    var btn = document.getElementById('album-modal-save-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    openModal('modal-photo-album-edit');
    setTimeout(function() { document.getElementById('album-modal-name').focus(); }, 100);
}

async function privateSubmitAlbumModal() {
    var name  = (document.getElementById('album-modal-name').value || '').trim();
    var errEl = document.getElementById('album-modal-error');
    var btn   = document.getElementById('album-modal-save-btn');
    if (!name) { errEl.textContent = 'Name is required.'; errEl.classList.remove('hidden'); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    try {
        var encName = await _privateEncryptStringWithKey(name, _privateCryptoKey);
        if (_photoAlbumModalMode === 'add') {
            await userCol('privatePhotoAlbums').add({
                encryptedName: encName,
                order: _photoAlbums.length,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await userCol('privatePhotoAlbums').doc(_photoAlbumRenameId).update({ encryptedName: encName });
        }
        closeModal('modal-photo-album-edit');
        await loadPrivatePhotosPage();
    } catch (e) {
        console.error('Album save failed:', e);
        errEl.textContent = 'Save failed. Try again.'; errEl.classList.remove('hidden');
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
}

async function privateDeleteAlbum(albumId) {
    var album = _photoAlbums.find(function(a) { return a.id === albumId; });
    if (!confirm('Delete album "' + (album ? album.name : '') + '" and ALL its photos? This cannot be undone.')) return;
    try {
        // Delete all photos in this album from Storage + Firestore
        var snap = await userCol('privatePhotos').where('albumId', '==', albumId).get();
        var batch = firebase.firestore().batch();
        var storageDeletes = [];
        snap.docs.forEach(function(doc) {
            var sr = doc.data().storageRef;
            if (sr) storageDeletes.push(firebase.storage().ref(sr).delete().catch(function(){}));
            batch.delete(userCol('privatePhotos').doc(doc.id));
        });
        await Promise.all(storageDeletes);
        await batch.commit();
        await userCol('privatePhotoAlbums').doc(albumId).delete();
        await loadPrivatePhotosPage();
    } catch (e) {
        console.error('Album delete failed:', e);
        alert('Delete failed: ' + e.message);
    }
}

// ---- Gallery page ----

async function loadPrivatePhotosGallery(albumKey) {
    if (!privateIsUnlocked()) { window.location.hash = '#private'; return; }
    _photoCurrentKey = albumKey; // null = uncategorized, otherwise Firestore albumId
    _photoRevokeBlobs();

    // Set heading and show/hide named-album actions
    var heading = document.getElementById('gallery-album-name');
    var namedActions = document.getElementById('gallery-named-actions');
    if (albumKey === null) {
        if (heading) heading.textContent = 'Uncategorized';
        if (namedActions) namedActions.style.display = 'none';
    } else {
        var al = _photoAlbums.find(function(a) { return a.id === albumKey; });
        if (heading) heading.textContent = al ? al.name : 'Album';
        if (namedActions) namedActions.style.display = '';
    }

    var el = document.getElementById('private-gallery');
    if (el) el.innerHTML = '<p class="loading-state">Loading\u2026</p>';
    var warn = document.getElementById('gallery-cors-warning');
    if (warn) warn.classList.add('hidden');

    try {
        var snap;
        if (albumKey === null) {
            snap = await userCol('privatePhotos').where('albumId', '==', null).get();
        } else {
            snap = await userCol('privatePhotos').where('albumId', '==', albumKey).get();
        }
        _photoCurrentPhotos = [];
        for (var i = 0; i < snap.docs.length; i++) {
            var doc = snap.docs[i]; var d = doc.data();
            var caption = d.encryptedCaption
                ? (await _privateDecryptStringWithKey(d.encryptedCaption, _privateCryptoKey) || '')
                : '';
            var origName = d.encryptedOriginalFileName
                ? (await _privateDecryptStringWithKey(d.encryptedOriginalFileName, _privateCryptoKey) || 'photo.jpg')
                : 'photo.jpg';
            _photoCurrentPhotos.push({ id: doc.id, caption: caption, originalFileName: origName, storageRef: d.storageRef, albumId: d.albumId, createdAt: d.createdAt });
        }
        // Sort newest-first client-side (avoids composite Firestore index requirement)
        _photoCurrentPhotos.sort(function(a, b) {
            var ta = a.createdAt ? a.createdAt.toMillis() : 0;
            var tb = b.createdAt ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        _photoRenderGallery();
    } catch (e) {
        console.error('Gallery load failed:', e);
        if (el) el.innerHTML = '<p class="empty-state">Failed to load photos.</p>';
    }
}

function _photoRenderGallery() {
    var el = document.getElementById('private-gallery');
    if (!el) return;
    if (_photoCurrentPhotos.length === 0) {
        el.innerHTML = '<p class="empty-state">No photos yet. Tap \u201c+ Add Photo\u201d to upload.</p>';
        return;
    }
    el.innerHTML = _photoCurrentPhotos.map(function(photo, idx) {
        return (
            '<div class="photo-thumb" data-photo-id="' + photo.id + '" data-idx="' + idx + '" onclick="privateOpenPhotoViewer(' + idx + ')">' +
                '<div class="photo-thumb-placeholder">&#128247;</div>' +
            '</div>'
        );
    }).join('');
    // Decrypt thumbnails progressively
    _photoCurrentPhotos.forEach(function(photo, idx) { _photoDecryptThumb(photo, idx); });
}

async function _photoDecryptThumb(photo, idx) {
    try {
        var enc  = await _docFetchBytes(photo.storageRef);
        var plain = await _privateDecryptBuffer(enc);
        var url  = URL.createObjectURL(new Blob([plain], { type: 'image/jpeg' }));
        _photoBlobUrls[photo.id] = url;
        var el = document.querySelector('.photo-thumb[data-idx="' + idx + '"]');
        if (el) el.innerHTML = '<img src="' + url + '" class="photo-thumb-img" alt="' + _bmEsc(photo.caption) + '">';
    } catch (e) {
        console.error('Thumb decrypt failed:', e);
        if (e.message === 'Network error') _photoShowCorsWarning();
    }
}

function _photoShowCorsWarning() {
    var el = document.getElementById('gallery-cors-warning');
    if (el) el.classList.remove('hidden');
}

// ---- Photo upload ----

function _photoOnFileSelected(input) {
    if (!input.files || !input.files.length) return;
    var files = Array.from(input.files);
    input.value = ''; // reset so same file can be re-selected
    _photoUploadFiles(files);
}

async function _photoUploadFiles(files) {
    var statusEl = document.getElementById('gallery-upload-status');
    var user = firebase.auth().currentUser;
    if (!user) return;
    window.privateUploadInProgress = true;
    if (statusEl) { statusEl.textContent = 'Preparing\u2026'; statusEl.classList.remove('hidden'); }
    try {
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (statusEl) statusEl.textContent = 'Compressing ' + (i + 1) + '/' + files.length + '\u2026';
            var compressed = await _photoCompress(file);
            var buffer     = await compressed.arrayBuffer();

            if (statusEl) statusEl.textContent = 'Encrypting ' + (i + 1) + '/' + files.length + '\u2026';
            var encrypted = await _privateEncryptBuffer(buffer);

            var newDocRef   = userCol('privatePhotos').doc();
            var storagePath = 'users/' + user.uid + '/privatePhotos/' + newDocRef.id;
            var storageRef  = firebase.storage().ref(storagePath);

            if (statusEl) statusEl.textContent = 'Uploading ' + (i + 1) + '/' + files.length + '\u2026 0%';
            var task = storageRef.put(encrypted.buffer, { contentType: 'application/octet-stream' });
            task.on('state_changed', function(snap) {
                var pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
                if (statusEl) statusEl.textContent = 'Uploading ' + (i + 1) + '/' + files.length + '\u2026 ' + pct + '%';
            });
            await task;

            var encCaption  = await _privateEncryptStringWithKey('', _privateCryptoKey);
            var encFileName = await _privateEncryptStringWithKey(file.name, _privateCryptoKey);
            await newDocRef.set({
                albumId: _photoCurrentKey,
                encryptedCaption: encCaption,
                encryptedOriginalFileName: encFileName,
                storageRef: storagePath,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        if (statusEl) { statusEl.textContent = 'Done!'; }
        window.privateUploadInProgress = false;
        setTimeout(function() {
            if (statusEl) { statusEl.textContent = ''; statusEl.classList.add('hidden'); }
            loadPrivatePhotosGallery(_photoCurrentKey);
        }, 700);
    } catch (e) {
        console.error('Photo upload failed:', e);
        window.privateUploadInProgress = false;
        if (statusEl) { statusEl.textContent = 'Upload failed: ' + e.message; }
    }
}

// ---- Photo viewer ----

async function privateOpenPhotoViewer(idx) {
    _photoViewerIdx = idx;
    var photo = _photoCurrentPhotos[idx];
    if (!photo) return;

    document.getElementById('pv-img').src = '';
    document.getElementById('pv-caption').value = photo.caption || '';
    document.getElementById('pv-caption-save').classList.add('hidden');
    _photoUpdateViewerNav();
    openModal('modal-photo-viewer');

    // Reuse cached blob or decrypt fresh
    var url = _photoBlobUrls[photo.id];
    if (!url) {
        try {
            var enc   = await _docFetchBytes(photo.storageRef);
            var plain = await _privateDecryptBuffer(enc);
            url = URL.createObjectURL(new Blob([plain], { type: 'image/jpeg' }));
            _photoBlobUrls[photo.id] = url;
        } catch (e) {
            console.error('Viewer decrypt failed:', e);
            document.getElementById('pv-img').alt = 'Error: ' + e.message;
            document.getElementById('pv-img').style.display = 'none';
            var wrap = document.getElementById('pv-img').parentElement;
            if (wrap) wrap.innerHTML += '<p style="color:#dc2626;padding:16px;text-align:center;">Failed to decrypt: ' + e.message + '</p>';
            return;
        }
    }
    document.getElementById('pv-img').src = url;
}

function _photoUpdateViewerNav() {
    var older = document.getElementById('pv-older-btn');
    var newer = document.getElementById('pv-newer-btn');
    if (older) older.disabled = _photoViewerIdx >= _photoCurrentPhotos.length - 1;
    if (newer) newer.disabled = _photoViewerIdx <= 0;
}

function privateOlderPhoto() { if (_photoViewerIdx < _photoCurrentPhotos.length - 1) privateOpenPhotoViewer(_photoViewerIdx + 1); }
function privateNewerPhoto() { if (_photoViewerIdx > 0) privateOpenPhotoViewer(_photoViewerIdx - 1); }

function _pvOnCaptionInput() {
    document.getElementById('pv-caption-save').classList.remove('hidden');
}

async function privateSaveCaption() {
    var photo   = _photoCurrentPhotos[_photoViewerIdx];
    if (!photo) return;
    var caption = (document.getElementById('pv-caption').value || '').trim();
    var btn     = document.getElementById('pv-caption-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    try {
        var enc = await _privateEncryptStringWithKey(caption, _privateCryptoKey);
        await userCol('privatePhotos').doc(photo.id).update({ encryptedCaption: enc });
        _photoCurrentPhotos[_photoViewerIdx].caption = caption;
        if (btn) { btn.classList.add('hidden'); btn.disabled = false; btn.textContent = 'Save'; }
    } catch (e) {
        console.error('Caption save failed:', e);
        if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
}

// ---- Move photo ----

function privateOpenMoveModal() {
    var listEl = document.getElementById('photo-move-list');
    if (!listEl) return;
    var html = '';
    // Uncategorized option (only if not currently in uncategorized)
    if (_photoCurrentKey !== null) {
        html += '<button class="btn btn-secondary photo-move-opt" onclick="privateMovePhoto(null)">Uncategorized</button>';
    }
    _photoAlbums.forEach(function(album) {
        if (album.id !== _photoCurrentKey) {
            html += '<button class="btn btn-secondary photo-move-opt" onclick="privateMovePhoto(\'' + album.id + '\')">' + _bmEsc(album.name) + '</button>';
        }
    });
    listEl.innerHTML = html || '<p class="empty-state" style="margin:0">No other albums available.</p>';
    openModal('modal-photo-move');
}

async function privateMovePhoto(newAlbumKey) {
    var photo = _photoCurrentPhotos[_photoViewerIdx];
    if (!photo) return;
    closeModal('modal-photo-move');
    try {
        await userCol('privatePhotos').doc(photo.id).update({ albumId: newAlbumKey });
        // Remove from current gallery
        _photoCurrentPhotos.splice(_photoViewerIdx, 1);
        if (_photoBlobUrls[photo.id]) { URL.revokeObjectURL(_photoBlobUrls[photo.id]); delete _photoBlobUrls[photo.id]; }
        closeModal('modal-photo-viewer');
        _photoRenderGallery();
    } catch (e) {
        console.error('Move failed:', e);
        alert('Move failed: ' + e.message);
    }
}

// ---- Delete photo ----

async function privateDeletePhotoFromViewer() {
    var photo = _photoCurrentPhotos[_photoViewerIdx];
    if (!photo) return;
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    try {
        await firebase.storage().ref(photo.storageRef).delete();
        await userCol('privatePhotos').doc(photo.id).delete();
        if (_photoBlobUrls[photo.id]) { URL.revokeObjectURL(_photoBlobUrls[photo.id]); delete _photoBlobUrls[photo.id]; }
        _photoCurrentPhotos.splice(_photoViewerIdx, 1);
        closeModal('modal-photo-viewer');
        // Adjust index and re-render
        if (_photoCurrentPhotos.length === 0) {
            _photoRenderGallery();
        } else {
            _photoViewerIdx = Math.min(_photoViewerIdx, _photoCurrentPhotos.length - 1);
            _photoRenderGallery();
        }
    } catch (e) {
        console.error('Photo delete failed:', e);
        alert('Delete failed: ' + e.message);
    }
}

// ============================================================
// Phase 6 — Private Backup Export
// ============================================================

function privateSanitizeFilename(str) {
    if (!str) return 'file';
    return str.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';
}

// Decrypt a binary blob using an explicit CryptoKey (not the global _privateCryptoKey).
async function _backupDecryptBuffer(combined, key) {
    var arr  = combined instanceof Uint8Array ? combined : new Uint8Array(combined);
    var iv   = arr.slice(0, 12);
    var data = arr.slice(12);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
}

// Render one bookmark node as Netscape Bookmark HTML (recursive).
function _backupBmHtml(nodeId, nodeMap, childMap, indent) {
    indent = indent || '';
    var node = nodeMap[nodeId];
    if (!node) return '';
    if (node.type === 'bookmark') {
        return indent + '<DT><A HREF="' + (node.url || '').replace(/"/g, '&quot;') + '">' +
               (node.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</A>\n';
    }
    // Folder
    var kids = (childMap[nodeId] || []).slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
    var html = indent + '<DT><H3>' + (node.title || 'Folder').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</H3>\n';
    html += indent + '<DL><p>\n';
    for (var k of kids) html += _backupBmHtml(k.id, nodeMap, childMap, indent + '    ');
    html += indent + '</DL><p>\n';
    return html;
}

// Open the backup passphrase modal.
function privateOpenBackupModal() {
    var el     = document.getElementById('private-backup-passphrase');
    var err    = document.getElementById('private-backup-err');
    var status = document.getElementById('private-backup-status');
    var btn    = document.getElementById('private-backup-btn');
    if (el)     { el.value = ''; el.disabled = false; }
    if (err)    { err.textContent = ''; }
    if (status) { status.textContent = ''; status.classList.add('hidden'); }
    if (btn)    { btn.disabled = false; btn.textContent = 'Export'; }
    openModal('modal-private-backup');
    if (el) setTimeout(function() { el.focus(); }, 100);
}

// Main export function — called when user clicks Export in the modal.
async function privateExportBackup() {
    var passEl   = document.getElementById('private-backup-passphrase');
    var errEl    = document.getElementById('private-backup-err');
    var statusEl = document.getElementById('private-backup-status');
    var btn      = document.getElementById('private-backup-btn');

    var passphrase = (passEl ? passEl.value : '').trim();
    if (!passphrase) {
        if (errEl) errEl.textContent = 'Enter your passphrase.';
        return;
    }

    if (btn)     { btn.disabled = true; btn.textContent = 'Working\u2026'; }
    if (errEl)   errEl.textContent = '';
    if (statusEl) { statusEl.textContent = 'Verifying passphrase\u2026'; statusEl.classList.remove('hidden'); }

    function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

    try {
        // 1. Derive key and verify sentinel
        var key = await _privateDerive(passphrase);
        if (!key) throw new Error('Key derivation failed.');

        var vaultDoc = await userCol('privateVault').doc('auth').get();
        if (!vaultDoc.exists || !vaultDoc.data().encryptedSentinel) throw new Error('Vault not activated.');

        var sentinel = await _privateDecryptStringWithKey(vaultDoc.data().encryptedSentinel, key);
        if (sentinel !== 'PRIVATE_VAULT_OK') {
            if (errEl)  errEl.textContent = 'Wrong passphrase \u2014 try again.';
            if (passEl) { passEl.value = ''; passEl.disabled = false; passEl.focus(); }
            if (btn)    { btn.disabled = false; btn.textContent = 'Export'; }
            if (statusEl) statusEl.classList.add('hidden');
            return;
        }

        // 2. Set up zip writer (AES-256, password = passphrase)
        var zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'), {
            password: passphrase,
            encryptionStrength: 3
        });

        // 3. Bookmarks
        setStatus('Decrypting bookmarks\u2026');
        var bmSnap    = await userCol('privateBookmarks').get();
        var bmNodeMap  = {};
        var bmChildMap = {};
        var bmRootId   = null;

        for (var bd of bmSnap.docs) {
            var braw = bd.data();
            try {
                var bdec = JSON.parse(await _privateDecryptStringWithKey(braw.encryptedData, key));
                var bn   = Object.assign({ id: bd.id, parentId: braw.parentId, type: braw.type, order: braw.order || 0 }, bdec);
                bmNodeMap[bd.id] = bn;
                if (!braw.parentId) {
                    bmRootId = bd.id;
                } else {
                    if (!bmChildMap[braw.parentId]) bmChildMap[braw.parentId] = [];
                    bmChildMap[braw.parentId].push(bn);
                }
            } catch (e) { console.warn('Bookmark decrypt skipped:', bd.id, e); }
        }

        // bookmarks.html (Netscape Bookmark File Format)
        var bmHtmlBody = '';
        if (bmRootId) {
            var rootKids = (bmChildMap[bmRootId] || []).slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
            for (var rk of rootKids) bmHtmlBody += _backupBmHtml(rk.id, bmNodeMap, bmChildMap, '    ');
        }
        var bmHtml = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Private Bookmarks</TITLE>\n<H1>Private Bookmarks</H1>\n<DL><p>\n' + bmHtmlBody + '</DL><p>\n';
        await zipWriter.add('bookmarks.html', new zip.TextReader(bmHtml));

        // bookmarks.json (full flat list)
        await zipWriter.add('bookmarks.json', new zip.TextReader(JSON.stringify(Object.values(bmNodeMap), null, 2)));

        // 4. Documents
        setStatus('Downloading documents\u2026');
        var docSnap   = await userCol('privateDocuments').get();
        var docCount  = docSnap.docs.length;
        var docIdx    = 0;
        var usedDocNames = {};

        for (var dd of docSnap.docs) {
            docIdx++;
            var draw   = dd.data();
            var dTitle = '';
            var dOrigFn = 'document.docx';
            try { dTitle  = await _privateDecryptStringWithKey(draw.encryptedTitle, key); } catch (e) {}
            try { dOrigFn = await _privateDecryptStringWithKey(draw.encryptedOriginalFileName, key); } catch (e) {}

            setStatus('Decrypting document ' + docIdx + ' of ' + docCount + ': ' + (dTitle || dOrigFn));
            try {
                var dBytes = await _docFetchBytes(draw.storageRef);
                var dPlain = await _backupDecryptBuffer(dBytes, key);
                var dBase  = privateSanitizeFilename(dOrigFn || dTitle || 'document');
                if (!/\.docx$/i.test(dBase)) dBase += '.docx';
                var dKey   = dBase.toLowerCase();
                if (usedDocNames[dKey]) { usedDocNames[dKey]++; dBase = dBase.replace(/\.docx$/i, '') + '-' + usedDocNames[dKey] + '.docx'; }
                else usedDocNames[dKey] = 1;
                await zipWriter.add('documents/' + dBase, new zip.Uint8ArrayReader(new Uint8Array(dPlain)));
            } catch (e) { console.warn('Document backup failed:', dd.id, e); }
        }

        // 5. Photos
        setStatus('Loading photo albums\u2026');
        var albumSnap  = await userCol('privatePhotoAlbums').get();
        var albumNames = {};
        albumNames['null'] = 'Uncategorized';
        for (var ad of albumSnap.docs) {
            try { albumNames[ad.id] = await _privateDecryptStringWithKey(ad.data().encryptedName, key); } catch (e) { albumNames[ad.id] = 'Album'; }
        }

        var photoSnap  = await userCol('privatePhotos').orderBy('createdAt', 'desc').get();
        var photoCount = photoSnap.docs.length;
        var photoIdx   = 0;
        var usedPhotoNames = {};

        for (var pd of photoSnap.docs) {
            photoIdx++;
            var praw    = pd.data();
            var pCaption = '';
            var pOrigFn  = '';
            try { pCaption = await _privateDecryptStringWithKey(praw.encryptedCaption, key); } catch (e) {}
            try { pOrigFn  = await _privateDecryptStringWithKey(praw.encryptedOriginalFileName, key); } catch (e) {}

            var albumId   = praw.albumId || null;
            var albumName = privateSanitizeFilename(albumNames[albumId] || albumNames['null']);
            var createdStr = '';
            try { createdStr = new Date(praw.createdAt.toDate()).toISOString().slice(0, 10); } catch (e) { createdStr = new Date().toISOString().slice(0, 10); }
            var nameBase  = privateSanitizeFilename(pCaption || pOrigFn || ('photo-' + createdStr + '-' + photoIdx));
            var photoPath = 'photos/' + albumName + '/' + nameBase + '.jpg';
            var nameKey   = photoPath.toLowerCase();
            if (usedPhotoNames[nameKey]) {
                usedPhotoNames[nameKey]++;
                photoPath = 'photos/' + albumName + '/' + nameBase + '-' + usedPhotoNames[nameKey] + '.jpg';
            } else {
                usedPhotoNames[nameKey] = 1;
            }

            setStatus('Decrypting photo ' + photoIdx + ' of ' + photoCount + '\u2026');
            try {
                var pBytes = await _docFetchBytes(praw.storageRef);
                var pPlain = await _backupDecryptBuffer(pBytes, key);
                await zipWriter.add(photoPath, new zip.Uint8ArrayReader(new Uint8Array(pPlain)));
            } catch (e) { console.warn('Photo backup failed:', pd.id, e); }
        }

        // 6. metadata.json
        var meta = {
            exportDate: new Date().toISOString(),
            bookmarks:  Object.keys(bmNodeMap).length,
            documents:  docCount,
            photos:     photoCount,
            app:        'Bishop Private Vault'
        };
        await zipWriter.add('metadata.json', new zip.TextReader(JSON.stringify(meta, null, 2)));

        // 7. Build zip and download
        setStatus('Building zip\u2026');
        var zipBlob = await zipWriter.close();
        var today   = new Date().toISOString().slice(0, 10);
        _docTriggerDownload(zipBlob, 'private-backup-' + today + '.zip');

        setStatus('\u2713 Export complete \u2014 check your Downloads folder.');
        if (btn)    { btn.disabled = false; btn.textContent = 'Export'; }
        if (passEl) passEl.value = '';

    } catch (e) {
        console.error('Private backup failed:', e);
        if (errEl) errEl.textContent = 'Export failed: ' + (e.message || 'unknown error');
        if (btn)   { btn.disabled = false; btn.textContent = 'Export'; }
        if (passEl) passEl.disabled = false;
    }
}
