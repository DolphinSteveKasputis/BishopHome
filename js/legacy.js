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

async function loadLegacyBurialPage() {
    var page = document.getElementById('page-legacy-burial');
    if (!page) return;

    page.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small" onclick="location.hash=\'#legacy\'">&#8592; My Legacy</button>' +
            '<h2>⚱️ Burial & Remains</h2>' +
        '</div>' +
        '<div class="legacy-section">' +

            // Disposition type
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyBurialType">Disposition Type</label>' +
                '<select id="legacyBurialType" class="form-control">' +
                    '<option value="">-- Select --</option>' +
                    '<option value="cremation">Cremation</option>' +
                    '<option value="burial">Burial</option>' +
                    '<option value="body-donation">Body donation to science</option>' +
                    '<option value="natural-burial">Natural / green burial</option>' +
                    '<option value="other">Other</option>' +
                '</select>' +
            '</div>' +

            // My Wishes
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyBurialWishes">My Wishes</label>' +
                '<p class="legacy-hint">Describe everything in plain English — where to scatter ashes, which cemetery, special requests, anything your family needs to know.</p>' +
                '<textarea id="legacyBurialWishes" class="legacy-textarea" rows="8" placeholder="e.g. Cremate me and scatter half at Lake Superior near Two Harbors. Give the other half to Karen. No expensive urn needed."></textarea>' +
            '</div>' +

            // Reference Links
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label">Reference Links</label>' +
                '<p class="legacy-hint">Links your family should look at — tombstone, cemetery, memorial planner, etc.</p>' +
                '<div id="legacyBurialLinks"></div>' +
                '<button class="btn btn-secondary btn-small" onclick="legacyBurialAddLink()" style="margin-top:8px;">+ Add Link</button>' +
            '</div>' +

            // Pre-arrangement
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label">Pre-arrangement</label>' +
                '<div class="legacy-toggle-row">' +
                    '<label class="legacy-toggle-label">' +
                        '<input type="checkbox" id="legacyBurialPreArranged"> I have a pre-arranged funeral plan' +
                    '</label>' +
                '</div>' +
                '<div id="legacyBurialPreArrangementDetails" class="legacy-subsection hidden">' +
                    '<div class="form-group">' +
                        '<label for="legacyBurialFuneralHome">Funeral Home Name</label>' +
                        '<input type="text" id="legacyBurialFuneralHome" class="form-control" placeholder="e.g. Johnson Funeral Home">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label for="legacyBurialFuneralPhone">Phone Number</label>' +
                        '<input type="tel" id="legacyBurialFuneralPhone" class="form-control" placeholder="e.g. 612-555-1234">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label for="legacyBurialPayment">Payment Status</label>' +
                        '<select id="legacyBurialPayment" class="form-control">' +
                            '<option value="">-- Select --</option>' +
                            '<option value="paid-in-full">Paid in full</option>' +
                            '<option value="deposit-paid">Deposit paid</option>' +
                            '<option value="not-yet-paid">Not yet paid</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label for="legacyBurialDocsLocation">Where are the documents?</label>' +
                        '<input type="text" id="legacyBurialDocsLocation" class="form-control" placeholder="e.g. Filing cabinet in the office, green folder">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label for="legacyBurialPreNotes">Notes</label>' +
                        '<textarea id="legacyBurialPreNotes" class="legacy-textarea" rows="3" placeholder="Any other details about the pre-arrangement..."></textarea>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<p class="legacy-save-status" id="legacyBurialSaveStatus"></p>' +
        '</div>';

    // Set breadcrumb
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) {
        crumb.innerHTML =
            '<a href="#life">Life</a><span class="separator">&rsaquo;</span>' +
            '<a href="#legacy">My Legacy</a><span class="separator">&rsaquo;</span>' +
            '<span>Burial & Remains</span>';
    }

    // Load saved data
    try {
        var doc = await userCol('legacyMeta').doc('burial').get();
        if (doc.exists) {
            var d = doc.data();
            document.getElementById('legacyBurialType').value        = d.dispositionType || '';
            document.getElementById('legacyBurialWishes').value      = d.wishes          || '';
            document.getElementById('legacyBurialFuneralHome').value = d.preArrangementName     || '';
            document.getElementById('legacyBurialFuneralPhone').value= d.preArrangementPhone    || '';
            document.getElementById('legacyBurialPayment').value     = d.preArrangementPayment  || '';
            document.getElementById('legacyBurialDocsLocation').value= d.preArrangementDocsLocation || '';
            document.getElementById('legacyBurialPreNotes').value    = d.preArrangementNotes    || '';

            if (d.preArranged) {
                document.getElementById('legacyBurialPreArranged').checked = true;
                document.getElementById('legacyBurialPreArrangementDetails').classList.remove('hidden');
            }

            _legacyBurialRenderLinks(d.links || []);
        } else {
            _legacyBurialRenderLinks([]);
        }
    } catch (e) {
        console.error('Error loading burial data:', e);
        _legacyBurialRenderLinks([]);
    }

    // Toggle pre-arrangement details
    document.getElementById('legacyBurialPreArranged').addEventListener('change', function() {
        var details = document.getElementById('legacyBurialPreArrangementDetails');
        details.classList.toggle('hidden', !this.checked);
        _legacySaveBurial();
    });

    // Auto-save on blur/change for all fields
    ['legacyBurialType', 'legacyBurialWishes', 'legacyBurialFuneralHome',
     'legacyBurialFuneralPhone', 'legacyBurialPayment', 'legacyBurialDocsLocation',
     'legacyBurialPreNotes'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', _legacySaveBurial);
        if (el && el.tagName === 'TEXTAREA') el.addEventListener('blur', _legacySaveBurial);
    });
}

function _legacyBurialRenderLinks(links) {
    var container = document.getElementById('legacyBurialLinks');
    if (!container) return;
    container.innerHTML = '';
    links.forEach(function(link, i) {
        container.appendChild(_legacyBurialLinkRow(link.label || '', link.url || '', i));
    });
}

function _legacyBurialLinkRow(label, url, index) {
    var row = document.createElement('div');
    row.className = 'legacy-link-row';
    row.dataset.index = index;
    row.innerHTML =
        '<input type="text" class="form-control legacy-link-label" placeholder="Label (e.g. Tombstone I want)" value="' + _esc(label) + '">' +
        '<input type="url" class="form-control legacy-link-url" placeholder="https://" value="' + _esc(url) + '">' +
        '<button class="btn btn-danger btn-small legacy-link-remove" onclick="legacyBurialRemoveLink(' + index + ')">✕</button>';
    row.querySelector('.legacy-link-label').addEventListener('blur', _legacySaveBurial);
    row.querySelector('.legacy-link-url').addEventListener('blur', _legacySaveBurial);
    return row;
}

function legacyBurialAddLink() {
    var container = document.getElementById('legacyBurialLinks');
    if (!container) return;
    var index = container.children.length;
    container.appendChild(_legacyBurialLinkRow('', '', index));
}

function legacyBurialRemoveLink(index) {
    var links = _legacyBurialGetLinks();
    links.splice(index, 1);
    _legacyBurialRenderLinks(links);
    _legacySaveBurial();
}

function _legacyBurialGetLinks() {
    var rows = document.querySelectorAll('.legacy-link-row');
    var links = [];
    rows.forEach(function(row) {
        var label = row.querySelector('.legacy-link-label').value.trim();
        var url   = row.querySelector('.legacy-link-url').value.trim();
        if (label || url) links.push({ label: label, url: url });
    });
    return links;
}

function _legacySaveBurial() {
    var preArranged = document.getElementById('legacyBurialPreArranged').checked;
    var data = {
        dispositionType          : document.getElementById('legacyBurialType').value,
        wishes                   : document.getElementById('legacyBurialWishes').value,
        links                    : _legacyBurialGetLinks(),
        preArranged              : preArranged,
        preArrangementName       : document.getElementById('legacyBurialFuneralHome').value,
        preArrangementPhone      : document.getElementById('legacyBurialFuneralPhone').value,
        preArrangementPayment    : document.getElementById('legacyBurialPayment').value,
        preArrangementDocsLocation: document.getElementById('legacyBurialDocsLocation').value,
        preArrangementNotes      : document.getElementById('legacyBurialPreNotes').value
    };
    var status = document.getElementById('legacyBurialSaveStatus');
    userCol('legacyMeta').doc('burial').set(data, { merge: true })
        .then(function() {
            if (status) { status.textContent = 'Saved.'; setTimeout(function() { if (status) status.textContent = ''; }, 2000); }
        })
        .catch(function(e) {
            console.error('Error saving burial data:', e);
            if (status) status.textContent = 'Error saving.';
        });
}

// Simple HTML escape for values inserted into innerHTML
function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function loadLegacyServicePage() {
    _legacyLoadStub('page-legacy-service', 'Service Wishes', 'service');
}
async function loadLegacyObituaryPage() {
    var page = document.getElementById('page-legacy-obituary');
    if (!page) return;

    // Render the page shell immediately so the user sees something
    page.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small" onclick="location.hash=\'#legacy\'">&#8592; My Legacy</button>' +
            '<h2>📜 My Obituary</h2>' +
        '</div>' +
        '<div class="legacy-section">' +

            // Box 1 — Planning Notes
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyObituaryNotes">My Planning Notes</label>' +
                '<p class="legacy-hint">Brain dump — facts, stories, people, anything you\'d want included. No structure needed.</p>' +
                '<textarea id="legacyObituaryNotes" class="legacy-textarea" rows="7" placeholder="Things I want covered: where I grew up, my career, my family, hobbies, a funny story about..."></textarea>' +
                '<div id="legacyObituaryAiRow" class="legacy-ai-row hidden">' +
                    '<button class="btn btn-secondary btn-small" id="legacyObituaryAiBtn" onclick="legacyObituaryAskAI()">✨ Ask AI to Write</button>' +
                    '<span class="legacy-ai-status" id="legacyObituaryAiStatus"></span>' +
                '</div>' +
            '</div>' +

            // Box 2 — My Draft
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyObituaryDraft">My Draft</label>' +
                '<p class="legacy-hint">Write your own obituary, or let the AI generate one from your planning notes above.</p>' +
                '<textarea id="legacyObituaryDraft" class="legacy-textarea" rows="10" placeholder="Write your obituary here..."></textarea>' +
            '</div>' +

            // Box 3 — Instructions for the Writer
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyObituaryInstructions">Instructions for the Writer</label>' +
                '<p class="legacy-hint">Notes for whoever writes or finalizes the real obituary — tone, length, what to include or skip.</p>' +
                '<textarea id="legacyObituaryInstructions" class="legacy-textarea" rows="5" placeholder="Please keep it under 300 words. Mention my love of fishing. Publish in the Star Tribune..."></textarea>' +
            '</div>' +

            '<p class="legacy-save-status" id="legacyObituarySaveStatus"></p>' +
        '</div>';

    // Set breadcrumb
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) {
        crumb.innerHTML =
            '<a href="#life">Life</a><span class="separator">&rsaquo;</span>' +
            '<a href="#legacy">My Legacy</a><span class="separator">&rsaquo;</span>' +
            '<span>My Obituary</span>';
    }

    // Load saved data
    try {
        var doc = await userCol('legacyMeta').doc('obituary').get();
        if (doc.exists) {
            var d = doc.data();
            document.getElementById('legacyObituaryNotes').value        = d.obituaryNotes        || '';
            document.getElementById('legacyObituaryDraft').value        = d.obituaryDraft        || '';
            document.getElementById('legacyObituaryInstructions').value = d.obituaryInstructions || '';
        }
    } catch (e) {
        console.error('Error loading obituary:', e);
    }

    // Show AI button only if LLM is configured
    _legacyCheckLlm(function(enabled) {
        if (enabled) {
            document.getElementById('legacyObituaryAiRow').classList.remove('hidden');
        }
    });

    // Wire auto-save on blur for all three fields
    ['legacyObituaryNotes', 'legacyObituaryDraft', 'legacyObituaryInstructions'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('blur', _legacySaveObituary);
    });
}

function _legacySaveObituary() {
    var notes   = (document.getElementById('legacyObituaryNotes')        || {}).value || '';
    var draft   = (document.getElementById('legacyObituaryDraft')        || {}).value || '';
    var instrs  = (document.getElementById('legacyObituaryInstructions') || {}).value || '';
    var status  = document.getElementById('legacyObituarySaveStatus');

    userCol('legacyMeta').doc('obituary').set(
        { obituaryNotes: notes, obituaryDraft: draft, obituaryInstructions: instrs },
        { merge: true }
    ).then(function() {
        if (status) { status.textContent = 'Saved.'; setTimeout(function() { if (status) status.textContent = ''; }, 2000); }
    }).catch(function(e) {
        console.error('Error saving obituary:', e);
        if (status) status.textContent = 'Error saving.';
    });
}

async function legacyObituaryAskAI() {
    var notes   = (document.getElementById('legacyObituaryNotes') || {}).value.trim();
    var draftEl = document.getElementById('legacyObituaryDraft');
    var btn     = document.getElementById('legacyObituaryAiBtn');
    var status  = document.getElementById('legacyObituaryAiStatus');

    if (!notes) {
        status.textContent = 'Add some planning notes first.';
        setTimeout(function() { status.textContent = ''; }, 3000);
        return;
    }

    // Confirm before overwriting an existing draft
    if (draftEl.value.trim()) {
        if (!confirm('This will replace your current draft. Continue?')) return;
    }

    btn.disabled = true;
    status.textContent = 'Writing…';

    try {
        var cfgDoc = await userCol('settings').doc('llm').get();
        if (!cfgDoc.exists) throw new Error('No LLM configured');
        var cfg = cfgDoc.data();
        var llm = LLM_PROVIDERS[cfg.provider];
        if (!llm) throw new Error('Unknown provider');

        var prompt =
            'Write a warm, personal obituary based on the following notes written by the person themselves. ' +
            'Use the information naturally. Keep it to 3-4 paragraphs suitable for a newspaper or memorial program. ' +
            'Do not add invented details — only use what is provided.\n\n' + notes;

        var activeModel = cfg.model || llm.model;
        var result = await chatCallOpenAICompat(llm, cfg.apiKey, prompt, activeModel);

        draftEl.value = result;
        _legacySaveObituary();
        status.textContent = 'Done — review and edit as needed.';
        setTimeout(function() { status.textContent = ''; }, 4000);
    } catch (e) {
        console.error('Obituary AI error:', e);
        status.textContent = 'Error: ' + e.message;
    }

    btn.disabled = false;
}

// Checks if LLM is configured and calls cb(true/false)
function _legacyCheckLlm(cb) {
    userCol('settings').doc('llm').get().then(function(doc) {
        cb(doc.exists && !!(doc.data().provider && doc.data().apiKey));
    }).catch(function() { cb(false); });
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

    var result = await legacyCryptoDeriveKey(passphrase);
    if (result === 'wrong') {
        _legacyPassphraseError('Incorrect passphrase. Please try again.');
        return;
    }
    if (result === 'error') {
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
