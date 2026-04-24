// ============================================================
// legacy.js — My Legacy section
//
// Handles the My Legacy landing page and all 12 sub-sections.
// Financial and Social sub-sections require the Legacy
// Passphrase before displaying encrypted fields.
// ============================================================

// Sections that require the passphrase gate
var LEGACY_GATED_SECTIONS = ['accounts', 'social'];

// Pending callback to invoke after passphrase is entered
var _legacyPassphraseCallback = null;

// Section metadata: key → { icon, label, route, gated }
var LEGACY_SECTIONS = [
    { key: 'burial',    icon: '⚱️',  label: 'Burial & Remains',      route: '#legacy/burial'    },
    { key: 'service',   icon: '🕊️',  label: 'Service Wishes',         route: '#legacy/service'   },
    { key: 'obituary',  icon: '📜',  label: 'My Obituary',            route: '#legacy/obituary'  },
    { key: 'social',    icon: '📱',  label: 'Social Media',           route: '#legacy/social',   gated: true },
    { key: 'accounts',  icon: '💰',  label: 'Financial Accounts',     route: '#legacy/accounts', gated: true },
    { key: 'documents', icon: '📁',  label: 'Documents',              route: '#legacy/documents' },
    { key: 'medical',   icon: '🏥',  label: 'Medical Wishes',         route: '#legacy/medical'   },
    { key: 'household', icon: '🏠',  label: 'Household Instructions', route: '#legacy/household' },
    { key: 'pets',      icon: '🐾',  label: 'Pets',                   route: '#legacy/pets'      },
    { key: 'notify',    icon: '📞',  label: 'People to Notify',       route: '#legacy/notify'    },
    { key: 'letters',   icon: '✉️',  label: 'Letters',                route: '#legacy/letters'   },
    { key: 'message',   icon: '💬',  label: 'Final Message',          route: '#legacy/message'   }
];

// ============================================================
// Landing Page
// ============================================================

function loadLegacyPage() {
    var page = document.getElementById('page-legacy');
    if (!page) return;

    page.innerHTML =
        '<div class="page-header"><h2>🕊️ My Legacy</h2></div>' +
        '<p class="legacy-intro">Private information for your loved ones. Keep your Legacy Passphrase stored safely alongside your app login.</p>' +
        '<div class="landing-grid landing-grid--3col" id="legacyTileGrid"></div>';

    var grid = document.getElementById('legacyTileGrid');
    LEGACY_SECTIONS.forEach(function(s) {
        var tile = document.createElement('a');
        tile.href = s.route;
        tile.className = 'landing-tile landing-tile--legacy-' + s.key;
        tile.innerHTML =
            '<span class="landing-tile-icon">' + s.icon + '</span>' +
            '<span class="landing-tile-label">' + s.label + '</span>' +
            (s.gated ? '<span class="landing-tile-soon">🔒 Encrypted</span>' : '');
        grid.appendChild(tile);
    });
}

// ============================================================
// Sub-section Loaders
// ============================================================

function loadLegacyBurialPage() {
    _legacyLoadStub('page-legacy-burial', 'Burial & Remains', 'burial');
}
function loadLegacyServicePage() {
    _legacyLoadStub('page-legacy-service', 'Service Wishes', 'service');
}
function loadLegacyObituaryPage() {
    _legacyLoadStub('page-legacy-obituary', 'My Obituary', 'obituary');
}
function loadLegacyDocumentsPage() {
    _legacyLoadStub('page-legacy-documents', 'Documents', 'documents');
}
function loadLegacyMedicalPage() {
    _legacyLoadStub('page-legacy-medical', 'Medical Wishes', 'medical');
}
function loadLegacyHouseholdPage() {
    _legacyLoadStub('page-legacy-household', 'Household Instructions', 'household');
}
function loadLegacyPetsPage() {
    _legacyLoadStub('page-legacy-pets', 'Pets', 'pets');
}
function loadLegacyNotifyPage() {
    _legacyLoadStub('page-legacy-notify', 'People to Notify', 'notify');
}
function loadLegacyLettersPage() {
    _legacyLoadStub('page-legacy-letters', 'Letters', 'letters');
}
function loadLegacyLetterDetailPage(id) {
    _legacyLoadStub('page-legacy-letter', 'Letter', 'letters');
}
function loadLegacyMessagePage() {
    _legacyLoadStub('page-legacy-message', 'Final Message', 'message');
}

/** Gated — requires passphrase. */
function loadLegacyAccountsPage() {
    _legacyRequireUnlock(function() {
        _legacyLoadStub('page-legacy-accounts', 'Financial Accounts', 'accounts');
    });
}

/** Gated — requires passphrase. */
function loadLegacySocialPage() {
    _legacyRequireUnlock(function() {
        _legacyLoadStub('page-legacy-social', 'Social Media', 'social');
    });
}

// ============================================================
// Passphrase Gate
// ============================================================

/**
 * If the section is already unlocked, run callback immediately.
 * Otherwise show the passphrase modal, then run callback on success.
 */
function _legacyRequireUnlock(callback) {
    if (legacyIsUnlocked()) {
        callback();
        return;
    }
    _legacyPassphraseCallback = callback;
    _legacyOpenPassphraseModal();
}

async function _legacyOpenPassphraseModal() {
    var isSetUp = await legacyCryptoIsSetUp();
    var title    = document.getElementById('legacyPassphraseTitle');
    var desc     = document.getElementById('legacyPassphraseDesc');
    var confirm  = document.getElementById('legacyPassphraseConfirmGroup');
    var warning  = document.getElementById('legacyPassphraseWarning');
    var input    = document.getElementById('legacyPassphraseInput');
    var errEl    = document.getElementById('legacyPassphraseError');
    var btnLabel = document.getElementById('legacyPassphraseBtnLabel');

    if (input)  input.value = '';
    if (errEl)  { errEl.textContent = ''; errEl.classList.add('hidden'); }
    var confirmInput = document.getElementById('legacyPassphraseConfirm');
    if (confirmInput) confirmInput.value = '';

    if (isSetUp) {
        if (title)   title.textContent = 'Unlock Financial Info';
        if (desc)    desc.textContent  = 'Enter your Legacy Passphrase to view encrypted financial information.';
        if (confirm) confirm.classList.add('hidden');
        if (warning) warning.classList.add('hidden');
        if (btnLabel) btnLabel.textContent = 'Unlock';
    } else {
        if (title)   title.textContent = 'Create Legacy Passphrase';
        if (desc)    desc.textContent  = 'This passphrase encrypts your financial passwords and account numbers. It is never stored — write it down and keep it with your app login instructions.';
        if (confirm) confirm.classList.remove('hidden');
        if (warning) warning.classList.remove('hidden');
        if (btnLabel) btnLabel.textContent = 'Create & Unlock';
    }

    openModal('modal-legacy-passphrase');
    if (input) setTimeout(function() { input.focus(); }, 100);
}

async function legacySubmitPassphrase() {
    var input    = document.getElementById('legacyPassphraseInput');
    var confirm  = document.getElementById('legacyPassphraseConfirm');
    var errEl    = document.getElementById('legacyPassphraseError');
    var isSetUp  = await legacyCryptoIsSetUp();

    var passphrase = input ? input.value.trim() : '';
    if (!passphrase) {
        _legacyPassphraseError('Please enter a passphrase.');
        return;
    }

    if (!isSetUp) {
        // First-time: validate confirmation
        var confirmVal = confirm ? confirm.value.trim() : '';
        if (passphrase !== confirmVal) {
            _legacyPassphraseError('Passphrases do not match.');
            return;
        }
        if (passphrase.length < 6) {
            _legacyPassphraseError('Passphrase must be at least 6 characters.');
            return;
        }
    }

    var ok = await legacyCryptoDeriveKey(passphrase);
    if (!ok) {
        _legacyPassphraseError('Something went wrong. Please try again.');
        return;
    }

    closeModal('modal-legacy-passphrase');
    if (_legacyPassphraseCallback) {
        var cb = _legacyPassphraseCallback;
        _legacyPassphraseCallback = null;
        cb();
    }
}

function legacyCancelPassphrase() {
    _legacyPassphraseCallback = null;
    closeModal('modal-legacy-passphrase');
    // Navigate back to legacy landing if user cancels
    window.location.hash = '#legacy';
}

function _legacyPassphraseError(msg) {
    var errEl = document.getElementById('legacyPassphraseError');
    if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
    }
}

// Allow Enter key to submit the passphrase modal
document.addEventListener('keydown', function(e) {
    var modal = document.getElementById('modal-legacy-passphrase');
    if (modal && !modal.classList.contains('hidden') && e.key === 'Enter') {
        e.preventDefault();
        legacySubmitPassphrase();
    }
});

// ============================================================
// Internal Helpers
// ============================================================

function _legacyLoadStub(pageId, title, sectionKey) {
    var page = document.getElementById(pageId);
    if (!page) return;

    // Find icon for this section
    var meta = LEGACY_SECTIONS.find(function(s) { return s.key === sectionKey; });
    var icon = meta ? meta.icon : '📋';

    page.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small" onclick="location.hash=\'#legacy\'">&#8592; My Legacy</button>' +
            '<h2>' + icon + ' ' + title + '</h2>' +
        '</div>' +
        '<div class="legacy-stub">' +
            '<p class="legacy-stub-icon">🔧</p>' +
            '<p class="legacy-stub-text">This section is coming soon.</p>' +
            '<p class="legacy-stub-hint">Content for <strong>' + title + '</strong> will be built here.</p>' +
        '</div>';

    // Set breadcrumb
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) {
        crumb.innerHTML =
            '<a href="#life">Life</a>' +
            '<span class="separator">&rsaquo;</span>' +
            '<a href="#legacy">My Legacy</a>' +
            '<span class="separator">&rsaquo;</span>' +
            '<span>' + title + '</span>';
    }
}
