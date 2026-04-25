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
