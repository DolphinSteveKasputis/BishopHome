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
    { key: 'social',    icon: '📱',  label: 'Social Media',           route: '#legacy/social',   gated: true, stub: true },
    { key: 'accounts',  icon: '💰',  label: 'Financial Accounts',     route: '#legacy/accounts', gated: true, stub: true },
    { key: 'documents', icon: '📁',  label: 'Documents',              route: '#legacy/documents', stub: true },
    { key: 'medical',   icon: '🏥',  label: 'Medical Wishes',         route: '#legacy/medical',   stub: true },
    { key: 'household', icon: '🏠',  label: 'Household Instructions', route: '#legacy/household', stub: true },
    { key: 'pets',      icon: '🐾',  label: 'Pets',                   route: '#legacy/pets',      stub: true },
    { key: 'notify',    icon: '📞',  label: 'People to Notify',       route: '#legacy/notify',    stub: true },
    { key: 'letters',   icon: '✉️',  label: 'Letters',                route: '#legacy/letters'   },
    { key: 'message',   icon: '💬',  label: 'Final Message',          route: '#legacy/message',   stub: true }
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

    // Row 1: empty · Read Me First · empty  (alone in the center slot)
    grid.appendChild(document.createElement('div'));
    var rmf = document.createElement('a');
    rmf.href = '#legacy/intro';
    rmf.className = 'landing-tile landing-tile--legacy-intro';
    rmf.innerHTML =
        '<span class="landing-tile-icon">📖</span>' +
        '<span class="landing-tile-label">Read Me First</span>';
    grid.appendChild(rmf);
    grid.appendChild(document.createElement('div'));

    // Remaining rows: all 12 section tiles
    LEGACY_SECTIONS.forEach(function(s) {
        var tile = document.createElement('a');
        tile.href = s.route;
        tile.className = 'landing-tile landing-tile--legacy-' + s.key;
        tile.innerHTML =
            '<span class="landing-tile-icon">' + s.icon + '</span>' +
            '<span class="landing-tile-label">' + s.label + '</span>' +
            (s.gated ? '<span class="landing-tile-soon">🔒 Encrypted</span>' : '') +
            (s.stub  ? '<span class="landing-tile-soon">Coming Soon</span>' : '');
        grid.appendChild(tile);
    });
}

// ============================================================
// Sub-section Loaders
// ============================================================

async function loadLegacyIntroPage() {
    var page = document.getElementById('page-legacy-intro');
    if (!page) return;

    page.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small" onclick="location.hash=\'#legacy\'">&#8592; My Legacy</button>' +
            '<h2>📖 Read Me First</h2>' +
        '</div>' +
        '<div class="legacy-section">' +
            '<div class="legacy-obit-block">' +
                '<p class="legacy-hint">Write whatever you want your loved ones to read before they explore the rest of this section — context, important instructions, or just a note of love.</p>' +
                '<textarea id="legacyIntroBody" class="legacy-textarea" rows="20"' +
                    ' placeholder="Start here..."></textarea>' +
            '</div>' +
            '<p class="legacy-save-status" id="legacyIntroSaveStatus"></p>' +
        '</div>';

    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) {
        crumb.innerHTML =
            '<a href="#life">Life</a><span class="separator">&rsaquo;</span>' +
            '<a href="#legacy">My Legacy</a><span class="separator">&rsaquo;</span>' +
            '<span>Read Me First</span>';
    }

    try {
        var doc = await userCol('legacyMeta').doc('intro').get();
        if (doc.exists) {
            document.getElementById('legacyIntroBody').value = doc.data().body || '';
        }
    } catch (e) {
        console.error('Error loading legacy intro:', e);
    }

    document.getElementById('legacyIntroBody').addEventListener('blur', function() {
        var body   = document.getElementById('legacyIntroBody').value || '';
        var status = document.getElementById('legacyIntroSaveStatus');
        userCol('legacyMeta').doc('intro').set({ body: body }, { merge: true })
            .then(function() {
                if (status) { status.textContent = 'Saved.'; setTimeout(function() { if (status) status.textContent = ''; }, 2000); }
            })
            .catch(function(e) {
                console.error('Error saving legacy intro:', e);
                if (status) status.textContent = 'Error saving.';
            });
    });
}

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
async function loadLegacyServicePage() {
    var page = document.getElementById('page-legacy-service');
    if (!page) return;

    page.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small" onclick="location.hash=\'#legacy\'">&#8592; My Legacy</button>' +
            '<h2>🕊️ Service Wishes</h2>' +
        '</div>' +
        '<div class="legacy-section">' +

            // Service type
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyServiceType">Type of Service</label>' +
                '<select id="legacyServiceType" class="form-control">' +
                    '<option value="">-- Select --</option>' +
                    '<option value="traditional-funeral">Traditional Funeral</option>' +
                    '<option value="memorial-service">Memorial Service</option>' +
                    '<option value="celebration-of-life">Celebration of Life</option>' +
                    '<option value="graveside-only">Graveside Only</option>' +
                    '<option value="no-service">No Service</option>' +
                    '<option value="other">Other</option>' +
                '</select>' +
            '</div>' +

            // Location
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyServiceLocation">Location Preference</label>' +
                '<textarea id="legacyServiceLocation" class="legacy-textarea" rows="3"' +
                    ' placeholder="e.g. St. Michael\'s Church, the backyard, no preference"></textarea>' +
            '</div>' +

            // Officiant
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyServiceOfficiant">Who Should Officiate</label>' +
                '<textarea id="legacyServiceOfficiant" class="legacy-textarea" rows="3"' +
                    ' placeholder="e.g. Pastor Dan, a family member, no preference"></textarea>' +
            '</div>' +

            // Wishes
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyServiceWishes">My Wishes</label>' +
                '<p class="legacy-hint">Anything else — flowers vs. donations, open/closed casket, reception, things you definitely don\'t want, etc.</p>' +
                '<div class="legacy-ai-row" style="margin-bottom:8px;">' +
                    '<button class="btn btn-secondary btn-small" id="legacyServiceWishesVoiceBtn">🎙️ Speak</button>' +
                    '<span class="legacy-ai-status" id="legacyServiceWishesVoiceStatus"></span>' +
                '</div>' +
                '<textarea id="legacyServiceWishes" class="legacy-textarea" rows="16"' +
                    ' placeholder="Write whatever you want your family to know about the service..."></textarea>' +
            '</div>' +

            // Music
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyServiceMusic">Music</label>' +
                '<p class="legacy-hint">List any songs you\'d like played — feel free to include artist and when (entry, during, closing, reception).</p>' +
                '<textarea id="legacyServiceMusic" class="legacy-textarea" rows="5"' +
                    ' placeholder="e.g. Amazing Grace (entry)&#10;In My Life – The Beatles (during)&#10;Don\'t Stop Believin\' – Journey (reception)"></textarea>' +
            '</div>' +

            '<p class="legacy-save-status" id="legacyServiceSaveStatus"></p>' +
        '</div>';

    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) {
        crumb.innerHTML =
            '<a href="#life">Life</a><span class="separator">&rsaquo;</span>' +
            '<a href="#legacy">My Legacy</a><span class="separator">&rsaquo;</span>' +
            '<span>Service Wishes</span>';
    }

    try {
        var doc = await userCol('legacyMeta').doc('service').get();
        if (doc.exists) {
            var d = doc.data();
            document.getElementById('legacyServiceType').value     = d.serviceType || '';
            document.getElementById('legacyServiceLocation').value = d.location    || '';
            document.getElementById('legacyServiceOfficiant').value= d.officiant   || '';
            document.getElementById('legacyServiceMusic').value    = d.music       || '';
            document.getElementById('legacyServiceWishes').value   = d.wishes      || '';
        }
    } catch (e) {
        console.error('Error loading service wishes:', e);
    }

    ['legacyServiceType', 'legacyServiceLocation', 'legacyServiceOfficiant',
     'legacyServiceMusic', 'legacyServiceWishes'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', _legacySaveService);
            el.addEventListener('blur',   _legacySaveService);
        }
    });

    if (typeof initVoiceToText === 'function') {
        initVoiceToText('legacyServiceWishes', 'legacyServiceWishesVoiceBtn');
    } else {
        var vBtn = document.getElementById('legacyServiceWishesVoiceBtn');
        if (vBtn) vBtn.style.display = 'none';
    }
}

function _legacySaveService() {
    var data = {
        serviceType: document.getElementById('legacyServiceType').value,
        location:    document.getElementById('legacyServiceLocation').value,
        officiant:   document.getElementById('legacyServiceOfficiant').value,
        music:       document.getElementById('legacyServiceMusic').value,
        wishes:      document.getElementById('legacyServiceWishes').value
    };
    var status = document.getElementById('legacyServiceSaveStatus');
    userCol('legacyMeta').doc('service').set(data, { merge: true })
        .then(function() {
            if (status) { status.textContent = 'Saved.'; setTimeout(function() { if (status) status.textContent = ''; }, 2000); }
        })
        .catch(function(e) {
            console.error('Error saving service wishes:', e);
            if (status) status.textContent = 'Error saving.';
        });
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
// Stores createdAt of the currently-open letter for use in print
var _legacyLetterCreatedAt = null;

async function loadLegacyLettersPage() {
    var page = document.getElementById('page-legacy-letters');
    if (!page) return;

    page.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small" onclick="location.hash=\'#legacy\'">&#8592; My Legacy</button>' +
            '<h2>✉️ Letters</h2>' +
            '<button class="btn btn-primary btn-small" id="legacyLetterAddBtn" onclick="_legacyLetterAddNew()">+ Add Letter</button>' +
        '</div>' +
        '<div id="legacyLettersList" class="legacy-letters-grid"><p class="empty-state" style="grid-column:1/-1">Loading…</p></div>';

    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) {
        crumb.innerHTML =
            '<a href="#life">Life</a><span class="separator">&rsaquo;</span>' +
            '<a href="#legacy">My Legacy</a><span class="separator">&rsaquo;</span>' +
            '<span>Letters</span>';
    }

    try {
        var snap = await userCol('legacyLetters').orderBy('createdAt', 'desc').get();
        var container = document.getElementById('legacyLettersList');
        if (!container) return;
        container.innerHTML = '';

        if (snap.empty) {
            var emptyMsg = document.createElement('p');
            emptyMsg.className = 'empty-state';
            emptyMsg.style.gridColumn = '1 / -1';
            emptyMsg.innerHTML = 'No letters yet. Tap <strong>Add Letter</strong> to write your first one.';
            container.appendChild(emptyMsg);
            return;
        }
        snap.forEach(function(doc) {
            var d = doc.data();
            var title     = d.title         || 'Untitled';
            var recipient = d.recipientName || '(no recipient)';
            var dateStr   = d.createdAt ? d.createdAt.toDate().toLocaleDateString() : '';
            var card = document.createElement('div');
            card.className = 'legacy-letter-card';
            card.onclick = function() { window.location.hash = '#legacy/letter/' + doc.id; };
            card.innerHTML =
                '<div class="legacy-letter-card-title">' + _esc(title) + '</div>' +
                '<div class="legacy-letter-card-meta">To: ' + _esc(recipient) + (dateStr ? ' &nbsp;&middot;&nbsp; ' + dateStr : '') + '</div>';
            container.appendChild(card);
        });
    } catch (e) {
        console.error('Error loading letters:', e);
        var c = document.getElementById('legacyLettersList');
        if (c) c.innerHTML = '<p class="empty-state">Error loading letters.</p>';
    }
}

async function _legacyLetterAddNew() {
    var btn = document.getElementById('legacyLetterAddBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
    try {
        var ref = await userCol('legacyLetters').add({
            contactId:     null,
            recipientName: '',
            title:         '',
            instructions:  '',
            body:          '',
            createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt:     firebase.firestore.FieldValue.serverTimestamp()
        });
        window.location.hash = '#legacy/letter/' + ref.id;
    } catch (e) {
        console.error('Error creating letter:', e);
        alert('Could not create letter. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = '+ Add Letter'; }
    }
}

async function loadLegacyLetterDetailPage(id) {
    var page = document.getElementById('page-legacy-letter');
    if (!page) return;
    page.dataset.letterId = id;
    _legacyLetterCreatedAt = null;

    page.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small" onclick="location.hash=\'#legacy/letters\'">&#8592; Letters</button>' +
            '<h2>✉️ Letter</h2>' +
            '<button class="btn btn-secondary btn-small" onclick="_legacyLetterPrint()">🖨️ Print</button>' +
        '</div>' +
        '<div class="legacy-section">' +

            // To: contact picker + typed-name fallback
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label">To</label>' +
                '<div id="legacyLetterContactPicker"></div>' +
                '<p class="legacy-hint" style="margin:8px 0 4px;">Not in contacts? Type the name:</p>' +
                '<input type="text" id="legacyLetterTypedName" class="form-control" placeholder="Recipient\'s name…">' +
            '</div>' +

            // Title
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyLetterTitle">Title ' +
                    '<span class="legacy-hint" style="font-weight:normal;font-size:0.85em;">(for your reference — not printed)</span>' +
                '</label>' +
                '<input type="text" id="legacyLetterTitle" class="form-control" placeholder="e.g. To Karen">' +
            '</div>' +

            // Instructions
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyLetterInstructions">Instructions</label>' +
                '<p class="legacy-hint">When or how to deliver this letter — not printed with the letter.</p>' +
                '<textarea id="legacyLetterInstructions" class="legacy-textarea" rows="3"' +
                    ' placeholder="e.g. Open this on your first birthday after I\'m gone."></textarea>' +
            '</div>' +

            // Body + voice
            '<div class="legacy-obit-block">' +
                '<label class="legacy-label" for="legacyLetterBody">Letter</label>' +
                '<div class="legacy-ai-row" style="margin-bottom:8px;">' +
                    '<button class="btn btn-secondary btn-small" id="legacyLetterVoiceBtn">🎙️ Speak</button>' +
                    '<span class="legacy-ai-status" id="legacyLetterVoiceStatus"></span>' +
                '</div>' +
                '<textarea id="legacyLetterBody" class="legacy-textarea" rows="16"' +
                    ' placeholder="Write your letter here…"></textarea>' +
            '</div>' +

            '<p class="legacy-save-status" id="legacyLetterSaveStatus"></p>' +
        '</div>' +
        // Print-only area — populated on print, hidden on screen
        '<div id="legacyLetterPrintArea" class="legacy-print-area"></div>';

    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) {
        crumb.innerHTML =
            '<a href="#life">Life</a><span class="separator">&rsaquo;</span>' +
            '<a href="#legacy">My Legacy</a><span class="separator">&rsaquo;</span>' +
            '<a href="#legacy/letters">Letters</a><span class="separator">&rsaquo;</span>' +
            '<span>Letter</span>';
    }

    // Load saved data
    var d = { contactId: null, recipientName: '', title: '', instructions: '', body: '', createdAt: null };
    try {
        var doc = await userCol('legacyLetters').doc(id).get();
        if (doc.exists) {
            d = Object.assign(d, doc.data());
            _legacyLetterCreatedAt = d.createdAt;
        }
    } catch (e) {
        console.error('Error loading letter:', e);
    }

    document.getElementById('legacyLetterTitle').value        = d.title        || '';
    document.getElementById('legacyLetterInstructions').value = d.instructions || '';
    document.getElementById('legacyLetterBody').value         = d.body         || '';

    // Typed name: used when no contact is linked
    document.getElementById('legacyLetterTypedName').value = d.contactId ? '' : (d.recipientName || '');

    // Build contact picker; onSelect triggers auto-save and clears typed-name field
    buildContactPicker('legacyLetterContactPicker', {
        placeholder:  'Search contacts…',
        initialId:    d.contactId    || '',
        initialName:  d.contactId    ? (d.recipientName || '') : '',
        allowCreate:  false,
        onSelect: function(cid, cname) {
            if (cid) {
                // Contact selected — clear typed name
                document.getElementById('legacyLetterTypedName').value = '';
            }
            _legacySaveLetter(id);
        }
    });

    // Wire voice-to-text
    if (typeof initVoiceToText === 'function') {
        initVoiceToText('legacyLetterBody', 'legacyLetterVoiceBtn');
    } else {
        var vBtn = document.getElementById('legacyLetterVoiceBtn');
        if (vBtn) vBtn.style.display = 'none';
    }

    // Auto-save on blur for all text fields
    ['legacyLetterTitle', 'legacyLetterInstructions', 'legacyLetterBody', 'legacyLetterTypedName'].forEach(function(fid) {
        var el = document.getElementById(fid);
        if (el) el.addEventListener('blur', function() { _legacySaveLetter(id); });
    });
}

function _legacySaveLetter(id) {
    // Determine recipient: prefer contact picker, fall back to typed name
    var hiddenInput  = document.getElementById('legacyLetterContactPicker_id');
    var searchInput  = document.getElementById('legacyLetterContactPicker_search');
    var contactId    = hiddenInput  ? (hiddenInput.value.trim()  || null) : null;
    var contactName  = searchInput  ? (searchInput.value.trim()  || '')   : '';
    var typedName    = (document.getElementById('legacyLetterTypedName') || {}).value || '';
    var recipientName = contactId ? contactName : (typedName.trim() || contactName);

    var data = {
        contactId:     contactId,
        recipientName: recipientName,
        title:         (document.getElementById('legacyLetterTitle')        || {}).value || '',
        instructions:  (document.getElementById('legacyLetterInstructions') || {}).value || '',
        body:          (document.getElementById('legacyLetterBody')         || {}).value || '',
        updatedAt:     firebase.firestore.FieldValue.serverTimestamp()
    };

    var status = document.getElementById('legacyLetterSaveStatus');
    userCol('legacyLetters').doc(id).set(data, { merge: true })
        .then(function() {
            if (status) { status.textContent = 'Saved.'; setTimeout(function() { if (status) status.textContent = ''; }, 2000); }
        })
        .catch(function(e) {
            console.error('Error saving letter:', e);
            if (status) status.textContent = 'Error saving.';
        });
}

function _legacyLetterPrint() {
    var hiddenInput = document.getElementById('legacyLetterContactPicker_id');
    var searchInput = document.getElementById('legacyLetterContactPicker_search');
    var contactId   = hiddenInput ? hiddenInput.value.trim() : '';
    var contactName = searchInput ? searchInput.value.trim() : '';
    var typedName   = (document.getElementById('legacyLetterTypedName') || {}).value.trim();
    var recipient   = contactId ? contactName : (typedName || contactName || '');

    var body    = (document.getElementById('legacyLetterBody') || {}).value || '';
    var dateStr = _legacyLetterCreatedAt
        ? _legacyLetterCreatedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    var printArea = document.getElementById('legacyLetterPrintArea');
    if (!printArea) return;

    printArea.innerHTML =
        (recipient ? '<div class="legacy-print-recipient">To: ' + _esc(recipient) + '</div>' : '') +
        '<div class="legacy-print-date">' + _esc(dateStr) + '</div>' +
        '<div class="legacy-print-body">' + _esc(body).replace(/\n/g, '<br>') + '</div>';

    window.print();
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
