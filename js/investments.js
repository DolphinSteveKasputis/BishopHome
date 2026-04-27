// ============================================================
// investments.js — Investments
// Person-scoped financial account tracking.
// Canonical storage for accounts shared with Legacy Financial.
// Encryption via legacy-crypto.js (same passphrase as Legacy).
// ============================================================

// ---------- Constants ----------

var INVEST_ACCOUNT_TYPES = [
    { value: '',                     label: '— Select type —' },
    { value: 'checking',             label: 'Checking' },
    { value: 'savings',              label: 'Savings' },
    { value: 'money-market',         label: 'Money Market' },
    { value: 'cd',                   label: 'CD' },
    { value: 'roth-ira',             label: 'Roth IRA' },
    { value: 'traditional-ira',      label: 'Traditional IRA' },
    { value: 'roth-401k',            label: 'Roth 401k' },
    { value: 'traditional-401k',     label: 'Traditional 401k' },
    { value: 'self-directed-401k',   label: 'Self-directed 401k' },
    { value: '403b',                 label: '403b' },
    { value: 'brokerage-individual', label: 'Brokerage (Individual)' },
    { value: 'brokerage-joint',      label: 'Brokerage (Joint)' },
    { value: 'hsa',                  label: 'HSA' },
    { value: '529',                  label: '529 College Savings' },
    { value: 'other',                label: 'Other' }
];

// Legacy type groupings — still used by Legacy Financial badge coloring
var _INVEST_BANK_TYPES       = ['checking', 'savings', 'money-market', 'cd'];
var _INVEST_RETIREMENT_TYPES = ['roth-ira', 'traditional-ira', 'roth-401k', 'traditional-401k', 'self-directed-401k', '403b'];
var _INVEST_BROKERAGE_TYPES  = ['brokerage-individual', 'brokerage-joint'];
var _INVEST_TAX_ADV_TYPES    = ['hsa', '529'];

// Tax-category buckets used by portfolio summary grouping
var _INVEST_ROTH_TYPES   = ['roth-ira', 'roth-401k'];
var _INVEST_PRETAX_TYPES = ['traditional-ira', 'traditional-401k', 'self-directed-401k', '403b', 'hsa', '529'];
var _INVEST_BROKER_TYPES = ['brokerage-individual', 'brokerage-joint'];
var _INVEST_CASH_TYPES   = ['checking', 'savings', 'money-market', 'cd'];

function _investTypeLabel(value) {
    var t = INVEST_ACCOUNT_TYPES.find(function(t) { return t.value === value; });
    return (t && t.value) ? t.label : 'Account';
}

// Legacy badge class — used by Legacy Financial account cards
function _investBadgeClass(type) {
    if (_INVEST_BANK_TYPES.indexOf(type) >= 0)       return 'invest-badge--bank';
    if (_INVEST_RETIREMENT_TYPES.indexOf(type) >= 0) return 'invest-badge--retirement';
    if (_INVEST_BROKERAGE_TYPES.indexOf(type) >= 0)  return 'invest-badge--brokerage';
    if (_INVEST_TAX_ADV_TYPES.indexOf(type) >= 0)    return 'invest-badge--tax-adv';
    return 'invest-badge--other';
}

// Tax category badge — used by Investments account cards and portfolio summary
function _investTaxCategoryInfo(type) {
    if (_INVEST_ROTH_TYPES.indexOf(type) >= 0)    return { label: 'Roth',      cls: 'invest-badge--roth' };
    if (_INVEST_PRETAX_TYPES.indexOf(type) >= 0)  return { label: 'Pre-Tax',   cls: 'invest-badge--pretax' };
    if (_INVEST_BROKER_TYPES.indexOf(type) >= 0)  return { label: 'Brokerage', cls: 'invest-badge--brokerage' };
    if (_INVEST_CASH_TYPES.indexOf(type) >= 0)    return { label: 'Cash',      cls: 'invest-badge--cash' };
    return { label: 'Other', cls: 'invest-badge--other' };
}

// ---------- Module State ----------

var _investPersonFilter = 'self';   // 'self' or a people doc ID
var _investPeople       = [];       // [{id, name}] enrolled contacts
var _investAccounts     = [];       // account docs for the current person (may include joint from self)
var _investShowArchived = false;
var _investExpandedIds  = {};       // {accountId: bool}
var _investRevealedIds  = {};       // {accountId: bool} — sensitive fields decrypted & shown
var _investDecryptCache = {};       // {accountId: {accountNumber, username, password}}

// ---------- Firestore Path ----------

function _investCol() {
    return userCol('investments').doc(_investPersonFilter).collection('accounts');
}

// ---------- Hub Page Loader ----------

function loadInvestmentsPage() {
    document.getElementById('breadcrumbBar').innerHTML =
        '<a href="#life">Life</a><span class="separator">&rsaquo;</span><span>Investments</span>';
    document.getElementById('headerTitle').innerHTML =
        '<a href="#main" class="home-link">' + escapeHtml(window.appName || 'My Life') + '</a>';

    var page = document.getElementById('page-investments');
    if (!page) return;

    page.innerHTML =
        '<div class="page-header"><h2>📈 Investments</h2></div>' +
        '<div class="invest-hub">' +
            '<a class="invest-hub-card" href="#investments/accounts">' +
                '<span class="invest-hub-icon">🏦</span>' +
                '<div class="invest-hub-text">' +
                    '<div class="invest-hub-title">Accounts</div>' +
                    '<div class="invest-hub-desc">View and manage all investment and bank accounts</div>' +
                '</div>' +
                '<span class="invest-hub-arrow">›</span>' +
            '</a>' +
            '<div class="invest-hub-card invest-hub-card--soon">' +
                '<span class="invest-hub-icon">📊</span>' +
                '<div class="invest-hub-text">' +
                    '<div class="invest-hub-title">Summary</div>' +
                    '<div class="invest-hub-desc">Portfolio overview — Day / Week / Month / YTD gains</div>' +
                '</div>' +
                '<span class="invest-hub-badge">Coming soon</span>' +
            '</div>' +
            '<div class="invest-hub-card invest-hub-card--soon">' +
                '<span class="invest-hub-icon">📷</span>' +
                '<div class="invest-hub-text">' +
                    '<div class="invest-hub-title">Snapshots</div>' +
                    '<div class="invest-hub-desc">Historical portfolio snapshots over time</div>' +
                '</div>' +
                '<span class="invest-hub-badge">Coming soon</span>' +
            '</div>' +
        '</div>';
}

// ---------- Accounts Sub-page Loader ----------

async function loadInvestmentsAccountsPage() {
    document.getElementById('breadcrumbBar').innerHTML =
        '<a href="#investments">Investments</a><span class="separator">&rsaquo;</span><span>Accounts</span>';
    document.getElementById('headerTitle').innerHTML =
        '<a href="#main" class="home-link">' + escapeHtml(window.appName || 'My Life') + '</a>';
    await _investLoadAll();
    _investRenderPage();
}

// ---------- Data Loading ----------

async function _investLoadAll() {
    var settingsDoc = await userCol('settings').doc('investments').get();
    _investPeople = [];
    if (settingsDoc.exists) {
        var enrolledIds = (settingsDoc.data().enrolledPersonIds || []).filter(Boolean);
        var fetches = enrolledIds.map(function(pid) {
            return userCol('people').doc(pid).get().then(function(d) {
                return d.exists ? { id: pid, name: d.data().name || pid } : null;
            });
        });
        var results = await Promise.all(fetches);
        _investPeople = results.filter(Boolean).sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });
    }
    await _investLoadAccounts();
}

async function _investLoadAccounts() {
    _investExpandedIds = {};
    _investRevealedIds = {};
    _investDecryptCache = {};

    var snap = await _investCol().orderBy('sortOrder').get();
    _investAccounts = [];
    snap.forEach(function(doc) {
        _investAccounts.push(Object.assign({ id: doc.id, _ns: _investPersonFilter }, doc.data()));
    });

    // When viewing a contact, also pull joint accounts stored under 'self' that list them as co-owner.
    // These are loaded client-side to avoid needing a composite Firestore index.
    if (_investPersonFilter !== 'self') {
        var selfSnap = await userCol('investments').doc('self').collection('accounts').get();
        selfSnap.forEach(function(doc) {
            var data = doc.data();
            if (data.ownerType === 'joint' && data.primaryContactId === _investPersonFilter) {
                _investAccounts.push(Object.assign({ id: doc.id, _ns: 'self', _joint: true }, data));
            }
        });
    }
}

// ---------- Accounts Page Render ----------

function _investRenderPage() {
    var page = document.getElementById('page-investments-accounts');
    if (!page) return;

    var personOpts = '<option value="self"' + (_investPersonFilter === 'self' ? ' selected' : '') + '>Me</option>';
    _investPeople.forEach(function(p) {
        personOpts += '<option value="' + escapeHtml(p.id) + '"' +
            (_investPersonFilter === p.id ? ' selected' : '') + '>' +
            escapeHtml(p.name) + '</option>';
    });

    page.innerHTML =
        '<div class="page-header">' +
            '<h2>🏦 Accounts</h2>' +
            '<div class="page-header-actions">' +
                '<div class="invest-manage-wrap">' +
                    '<button class="btn btn-secondary" onclick="_investToggleManageMenu(event)">Manage ▾</button>' +
                    '<div class="invest-manage-menu" id="investManageMenu">' +
                        '<button onclick="_investOpenPeopleModal()">Manage People</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="invest-person-row">' +
            '<label class="invest-person-label">Person:</label>' +
            '<select id="investPersonSel" onchange="_investOnPersonChange()">' + personOpts + '</select>' +
        '</div>' +
        '<div class="invest-toolbar">' +
            '<button class="btn btn-primary" onclick="window.location.hash=\'#investments/accounts/add\'">+ Add Account</button>' +
            '<button class="btn btn-secondary" id="investShowArchivedBtn" onclick="_investToggleArchived()">' +
                (_investShowArchived ? 'Hide Archived' : 'Show Archived') +
            '</button>' +
        '</div>' +
        '<div id="investAccountList"></div>';

    _investRenderList();
}

function _investRenderList() {
    var container = document.getElementById('investAccountList');
    if (!container) return;

    var list = _investAccounts.filter(function(a) {
        return _investShowArchived || !a.archived;
    });

    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state">No accounts yet. Add one above.</div>';
        return;
    }

    var html = '';

    if (_investPersonFilter === 'self') {
        var myAccounts    = list.filter(function(a) { return a.ownerType !== 'joint'; });
        var jointAccounts = list.filter(function(a) { return a.ownerType === 'joint'; });

        if (myAccounts.length > 0) {
            html += '<div class="invest-group-header">My Accounts</div>' +
                    '<div id="investSortableList" class="invest-card-group">';
            myAccounts.forEach(function(a) { html += _investCardHtml(a); });
            html += '</div>';
        }
        if (jointAccounts.length > 0) {
            html += '<div class="invest-group-header">Joint Accounts</div>' +
                    '<div class="invest-card-group">';
            jointAccounts.forEach(function(a) { html += _investCardHtml(a); });
            html += '</div>';
        }
    } else {
        var personName    = (_investPeople.find(function(p) { return p.id === _investPersonFilter; }) || {}).name || 'Accounts';
        var ownAccounts   = list.filter(function(a) { return !a._joint; });
        var jointAccounts = list.filter(function(a) { return !!a._joint; });

        if (ownAccounts.length > 0) {
            html += '<div class="invest-group-header">' + escapeHtml(personName) + '\'s Accounts</div>' +
                    '<div class="invest-card-group">';
            ownAccounts.forEach(function(a) { html += _investCardHtml(a); });
            html += '</div>';
        }
        if (jointAccounts.length > 0) {
            html += '<div class="invest-group-header">Joint Accounts</div>' +
                    '<div class="invest-card-group">';
            jointAccounts.forEach(function(a) { html += _investCardHtml(a); });
            html += '</div>';
        }
    }

    container.innerHTML = html;

    // Only "My Accounts" (non-joint, self namespace) is drag-reorderable
    var sortableEl = document.getElementById('investSortableList');
    if (sortableEl && window.Sortable) {
        Sortable.create(sortableEl, {
            handle: '.invest-drag-handle',
            animation: 150,
            onEnd: function(evt) { _investOnReorder(evt); }
        });
    }
}

function _investCardHtml(acct) {
    var isExpanded = !!_investExpandedIds[acct.id];
    var taxInfo    = _investTaxCategoryInfo(acct.accountType || '');
    var typeLabel  = _investTypeLabel(acct.accountType || '');
    var isJoint    = !!acct._joint;       // came from self namespace via second-query
    var isDraggable = (_investPersonFilter === 'self') && (acct.ownerType !== 'joint') && !isJoint;

    var titleParts = [escapeHtml(acct.nickname || '(untitled)')];
    if (acct.institution) titleParts.push(escapeHtml(acct.institution));

    var header =
        '<div class="invest-card-header" onclick="_investToggleCard(\'' + acct.id + '\')">' +
            (isDraggable ? '<span class="invest-drag-handle" onclick="event.stopPropagation()">⠿</span>' : '') +
            '<span class="invest-type-badge ' + escapeHtml(taxInfo.cls) + '">' + escapeHtml(taxInfo.label) + '</span>' +
            '<span class="invest-card-title">' + titleParts.join(' — ') +
                (acct.last4 ? '<span class="invest-last4"> ····' + escapeHtml(acct.last4) + '</span>' : '') +
            '</span>' +
            (acct.archived ? '<span class="invest-archived-badge">Closed</span>' : '') +
            (isJoint ? '<span class="invest-joint-badge">Joint</span>' : '') +
            '<span class="invest-chevron">' + (isExpanded ? '▾' : '›') + '</span>' +
        '</div>';

    var body = '';
    if (isExpanded) {
        var isRevealed = !!_investRevealedIds[acct.id];
        var cache      = _investDecryptCache[acct.id] || {};
        var hasEnc     = acct.accountNumberEnc || acct.usernameEnc || acct.passwordEnc;

        body = '<div class="invest-card-body">';

        // Account type detail row
        body += '<div class="invest-detail-row">' +
            '<span class="invest-detail-label">Type</span>' +
            '<span class="invest-detail-value">' + escapeHtml(typeLabel) + '</span>' +
            '</div>';

        // Owner info
        if (acct.ownerType === 'joint') {
            var coOwnerName = '';
            if (acct.primaryContactId) {
                var contact = _investPeople.find(function(p) { return p.id === acct.primaryContactId; });
                coOwnerName = contact ? contact.name : acct.primaryContactId;
            }
            body += '<div class="invest-detail-row">' +
                '<span class="invest-detail-label">Owner</span>' +
                '<span class="invest-detail-value">Joint' +
                    (coOwnerName ? ' with ' + escapeHtml(coOwnerName) : '') +
                '</span>' +
                '</div>';
        }

        // Cash balance
        if (acct.cashBalance !== undefined && acct.cashBalance !== null && acct.cashBalance !== '') {
            body += '<div class="invest-detail-row">' +
                '<span class="invest-detail-label">Cash Balance</span>' +
                '<span class="invest-detail-value">$' + parseFloat(acct.cashBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</span>' +
                '</div>';
        }

        if (acct.url) {
            body += '<div class="invest-detail-row">' +
                '<span class="invest-detail-label">URL</span>' +
                '<span class="invest-detail-value"><a href="' + escapeHtml(acct.url) + '" target="_blank" rel="noopener">' + escapeHtml(acct.url) + '</a></span>' +
                '</div>';
        }
        if (acct.loginNotes) {
            body += '<div class="invest-detail-row">' +
                '<span class="invest-detail-label">Login Notes</span>' +
                '<span class="invest-detail-value">' + escapeHtml(acct.loginNotes) + '</span>' +
                '</div>';
        }
        if (acct.beneficiary) {
            body += '<div class="invest-detail-row">' +
                '<span class="invest-detail-label">Beneficiary</span>' +
                '<span class="invest-detail-value">' + escapeHtml(acct.beneficiary) + '</span>' +
                '</div>';
        }

        if (hasEnc) {
            body += '<div class="invest-sensitive-box">';
            if (!legacyIsUnlocked()) {
                body +=
                    '<div class="invest-sensitive-lock">' +
                        '<span>Sensitive fields are encrypted.</span>' +
                        '<button class="btn btn-secondary btn-small"' +
                            ' onclick="event.stopPropagation();_investRevealAccount(\'' + acct.id + '\')">' +
                            '🔓 Reveal Sensitive Info</button>' +
                    '</div>';
            } else {
                if (!isRevealed) {
                    body += '<button class="btn btn-secondary btn-small invest-reveal-btn"' +
                        ' onclick="event.stopPropagation();_investRevealAccount(\'' + acct.id + '\')">' +
                        '🔓 Reveal All</button>';
                } else {
                    body += '<button class="btn btn-secondary btn-small invest-reveal-btn"' +
                        ' onclick="event.stopPropagation();_investHideAccount(\'' + acct.id + '\')">' +
                        '🔒 Hide</button>';

                    if (acct.accountNumberEnc) {
                        body += '<div class="invest-detail-row">' +
                            '<span class="invest-detail-label">Account #</span>' +
                            '<span class="invest-detail-value invest-sensitive-val">' +
                            escapeHtml(cache.accountNumber || '(decrypt failed)') + '</span></div>';
                    }
                    if (acct.usernameEnc) {
                        body += '<div class="invest-detail-row">' +
                            '<span class="invest-detail-label">Username</span>' +
                            '<span class="invest-detail-value invest-sensitive-val">' +
                            escapeHtml(cache.username || '(decrypt failed)') + '</span></div>';
                    }
                    if (acct.passwordEnc) {
                        body += '<div class="invest-detail-row">' +
                            '<span class="invest-detail-label">Password</span>' +
                            '<span class="invest-detail-value invest-sensitive-val">' +
                            escapeHtml(cache.password || '(decrypt failed)') + '</span></div>';
                    }
                }
            }
            body += '</div>';
        }

        var acctNs = escapeHtml(acct._ns || _investPersonFilter);
        body +=
            '<div class="invest-card-actions">' +
                '<a class="btn btn-primary btn-small"' +
                    ' href="#investments/account/' + acctNs + '/' + acct.id + '"' +
                    ' onclick="event.stopPropagation()">View Detail</a>' +
                '<button class="btn btn-secondary btn-small"' +
                    ' onclick="event.stopPropagation();_investEditAccount(\'' + acct.id + '\',\'' + acctNs + '\')">Edit</button>' +
                (acct.archived
                    ? '<button class="btn btn-secondary btn-small"' +
                        ' onclick="event.stopPropagation();_investRestore(\'' + acct.id + '\')">Restore</button>'
                    : '<button class="btn btn-secondary btn-small"' +
                        ' onclick="event.stopPropagation();_investArchive(\'' + acct.id + '\')">Archive</button>') +
            '</div>' +
        '</div>';
    }

    return '<div class="invest-card' +
        (acct.archived  ? ' invest-card--archived'  : '') +
        (isExpanded     ? ' invest-card--expanded'  : '') +
        '" data-id="' + acct.id + '">' + header + body + '</div>';
}

// ---------- Card Interactions ----------

function _investToggleCard(id) {
    _investExpandedIds[id] = !_investExpandedIds[id];
    if (!_investExpandedIds[id]) {
        delete _investRevealedIds[id];
        delete _investDecryptCache[id];
    }
    _investRenderList();
}

async function _investRevealAccount(id) {
    if (!legacyIsUnlocked()) {
        _legacyRequireUnlock(function() { _investRevealAccount(id); });
        return;
    }
    var acct = _investAccounts.find(function(a) { return a.id === id; });
    if (!acct) return;

    var cache = {};
    try {
        if (acct.accountNumberEnc) cache.accountNumber = await legacyDecrypt(acct.accountNumberEnc) || '';
        if (acct.usernameEnc)      cache.username      = await legacyDecrypt(acct.usernameEnc)      || '';
        if (acct.passwordEnc)      cache.password      = await legacyDecrypt(acct.passwordEnc)      || '';
    } catch (e) {
        console.error('Investments decrypt error', e);
    }
    _investDecryptCache[id] = cache;
    _investRevealedIds[id]  = true;
    _investExpandedIds[id]  = true;
    _investRenderList();
}

function _investHideAccount(id) {
    delete _investRevealedIds[id];
    delete _investDecryptCache[id];
    _investRenderList();
}

// Navigate to edit form, switching person filter to the account's actual namespace first
function _investEditAccount(id, ns) {
    if (ns && ns !== _investPersonFilter) {
        _investPersonFilter = ns;
    }
    window.location.hash = '#investments/accounts/edit/' + id;
}

// ---------- Person Switcher ----------

async function _investOnPersonChange() {
    var sel = document.getElementById('investPersonSel');
    if (sel) _investPersonFilter = sel.value || 'self';
    await _investLoadAccounts();
    _investRenderList();
}

// ---------- Manage Menu ----------

function _investToggleManageMenu(e) {
    if (e) e.stopPropagation();
    var menu = document.getElementById('investManageMenu');
    var isOpen = menu.classList.toggle('open');
    if (isOpen) {
        setTimeout(function() {
            document.addEventListener('click', _investCloseManageMenu, { once: true });
        }, 0);
    }
}

function _investCloseManageMenu() {
    var menu = document.getElementById('investManageMenu');
    if (menu) menu.classList.remove('open');
}

// ---------- Manage People ----------

function _investOpenPeopleModal() {
    _investCloseManageMenu();
    _investRenderPeopleModal();
    openModal('investPeopleModal');
}

function _investRenderPeopleModal() {
    var body = document.getElementById('investPeopleListBody');
    if (!body) return;

    if (_investPeople.length === 0) {
        body.innerHTML = '<p class="invest-people-empty">No additional people added yet.</p>';
    } else {
        var html = '';
        _investPeople.forEach(function(p) {
            html += '<div class="invest-people-row">' +
                '<span>' + escapeHtml(p.name) + '</span>' +
                '<button class="btn btn-danger btn-small"' +
                    ' onclick="_investRemovePerson(\'' + escapeHtml(p.id) + '\')">Remove</button>' +
            '</div>';
        });
        body.innerHTML = html;
    }

    if (typeof buildContactPicker === 'function') {
        buildContactPicker('investPeoplePicker', {
            placeholder: 'Search contacts to add…',
            onSelect: function(contactId, contactName) {
                _investAddPerson(contactId, contactName);
            }
        });
    }
}

async function _investAddPerson(contactId, contactName) {
    if (_investPeople.find(function(p) { return p.id === contactId; })) return;
    _investPeople.push({ id: contactId, name: contactName });
    _investPeople.sort(function(a, b) { return a.name.localeCompare(b.name); });
    var ids = _investPeople.map(function(p) { return p.id; });
    await userCol('settings').doc('investments').set({ enrolledPersonIds: ids }, { merge: true });
    _investRenderPeopleModal();
    var searchInput = document.getElementById('investPeoplePicker_search');
    if (searchInput) searchInput.focus();
}

async function _investRemovePerson(contactId) {
    _investPeople = _investPeople.filter(function(p) { return p.id !== contactId; });
    var ids = _investPeople.map(function(p) { return p.id; });
    await userCol('settings').doc('investments').set({ enrolledPersonIds: ids }, { merge: true });
    if (_investPersonFilter === contactId) _investPersonFilter = 'self';
    _investRenderPeopleModal();
}

// ---------- Add / Edit Form Page ----------

var _investFormEditId = null;  // null = add mode; account ID = edit mode
var _investFormDraft  = null;  // basic field values preserved across passphrase unlock

async function loadInvestmentsFormPage(id) {
    _investFormEditId = id || null;
    var isNew = !id;
    var acct  = id ? _investAccounts.find(function(a) { return a.id === id; }) : null;

    // If navigated directly (e.g. back/forward) without the list in memory, load it first
    if (id && !acct) {
        await _investLoadAll();
        acct = _investAccounts.find(function(a) { return a.id === id; });
    }

    document.getElementById('breadcrumbBar').innerHTML =
        '<a href="#investments">Investments</a><span class="separator">&rsaquo;</span>' +
        '<a href="#investments/accounts">Accounts</a><span class="separator">&rsaquo;</span>' +
        '<span>' + (isNew ? 'Add Account' : 'Edit Account') + '</span>';
    document.getElementById('headerTitle').innerHTML =
        '<a href="#main" class="home-link">' + escapeHtml(window.appName || 'My Life') + '</a>';

    var typeOpts = '';
    INVEST_ACCOUNT_TYPES.forEach(function(t) {
        typeOpts += '<option value="' + escapeHtml(t.value) + '">' + escapeHtml(t.label) + '</option>';
    });

    // Build joint-contact options from enrolled people
    var jointOpts = '<option value="">— Select person —</option>';
    _investPeople.forEach(function(p) {
        jointOpts += '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</option>';
    });

    var page = document.getElementById('page-investments-form');
    if (!page) return;

    page.innerHTML =
        '<div class="page-header">' +
            '<h2>' + (isNew ? 'Add Account' : 'Edit Account') + '</h2>' +
        '</div>' +
        '<div class="invest-form">' +
            '<div class="form-group">' +
                '<label>Account Type *</label>' +
                '<select id="investFormType">' + typeOpts + '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Nickname *</label>' +
                '<input type="text" id="investFormNickname" placeholder="e.g. Fidelity Roth IRA">' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Owner</label>' +
                '<div class="invest-owner-radios">' +
                    '<label class="invest-radio-label">' +
                        '<input type="radio" name="investOwnerType" value="personal" onchange="_investToggleJointField()"> Personal' +
                    '</label>' +
                    '<label class="invest-radio-label">' +
                        '<input type="radio" name="investOwnerType" value="joint" onchange="_investToggleJointField()"> Joint' +
                    '</label>' +
                '</div>' +
            '</div>' +
            '<div class="form-group" id="investFormJointWrap" style="display:none">' +
                '<label>Joint With</label>' +
                '<select id="investFormJointContact">' + jointOpts + '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Institution</label>' +
                '<input type="text" id="investFormInstitution" placeholder="e.g. Fidelity Investments">' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Last 4 Digits</label>' +
                '<input type="text" id="investFormLast4" placeholder="1234" maxlength="4">' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Cash Balance ($)</label>' +
                '<input type="number" id="investFormCashBalance" placeholder="0.00" min="0" step="0.01">' +
            '</div>' +
            '<div class="form-group">' +
                '<label>URL</label>' +
                '<input type="url" id="investFormUrl" placeholder="https://...">' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Login Notes</label>' +
                '<textarea id="investFormLoginNotes" rows="3"' +
                    ' placeholder="2FA method, authenticator app, etc."></textarea>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Beneficiary</label>' +
                '<input type="text" id="investFormBeneficiary"' +
                    ' placeholder="Who inherits this account">' +
            '</div>' +
            '<div class="invest-form-sensitive-section">' +
                '<div class="invest-modal-sensitive-header">Sensitive Fields</div>' +
                '<div id="investFormSensitiveContent"></div>' +
            '</div>' +
            '<div class="invest-form-actions">' +
                '<button class="btn btn-primary" onclick="_investSaveForm()">Save</button>' +
                '<button class="btn btn-secondary" onclick="_investCancelForm()">Cancel</button>' +
            '</div>' +
        '</div>';

    // Populate fields — use preserved draft values if returning from passphrase prompt
    var d = _investFormDraft;
    _investVal('investFormType',        d ? d.accountType   : (acct ? acct.accountType  || '' : ''));
    _investVal('investFormNickname',    d ? d.nickname      : (acct ? acct.nickname     || '' : ''));
    _investVal('investFormInstitution', d ? d.institution   : (acct ? acct.institution  || '' : ''));
    _investVal('investFormLast4',       d ? d.last4         : (acct ? acct.last4        || '' : ''));
    _investVal('investFormCashBalance', d ? d.cashBalance   : (acct ? acct.cashBalance  != null ? acct.cashBalance : '' : ''));
    _investVal('investFormUrl',         d ? d.url           : (acct ? acct.url          || '' : ''));
    _investVal('investFormLoginNotes',  d ? d.loginNotes    : (acct ? acct.loginNotes   || '' : ''));
    _investVal('investFormBeneficiary', d ? d.beneficiary   : (acct ? acct.beneficiary  || '' : ''));

    // Set owner type radio
    var ownerType = d ? d.ownerType : (acct ? acct.ownerType || 'personal' : 'personal');
    var radios = document.querySelectorAll('input[name="investOwnerType"]');
    radios.forEach(function(r) { r.checked = (r.value === ownerType); });
    _investToggleJointField();

    // Set joint contact select
    var primaryContactId = d ? d.primaryContactId : (acct ? acct.primaryContactId || '' : '');
    _investVal('investFormJointContact', primaryContactId);

    _investFormDraft = null; // consumed

    await _investRenderSensitiveFields(acct);
}

function _investToggleJointField() {
    var selectedRadio = document.querySelector('input[name="investOwnerType"]:checked');
    var wrap = document.getElementById('investFormJointWrap');
    if (wrap) {
        wrap.style.display = (selectedRadio && selectedRadio.value === 'joint') ? '' : 'none';
    }
}

async function _investRenderSensitiveFields(acct) {
    var container = document.getElementById('investFormSensitiveContent');
    if (!container) return;

    if (!legacyIsUnlocked()) {
        container.innerHTML =
            '<div class="invest-modal-lock">' +
                '<span>Enter your Legacy passphrase to edit Account Number, Username, and Password.</span>' +
                '<button class="btn btn-secondary" onclick="_investUnlockForForm()">🔓 Unlock Sensitive Fields</button>' +
            '</div>';
        return;
    }

    var acctNum = '', uname = '', pwd = '';
    if (acct) {
        try {
            if (acct.accountNumberEnc) acctNum = await legacyDecrypt(acct.accountNumberEnc) || '';
            if (acct.usernameEnc)      uname   = await legacyDecrypt(acct.usernameEnc)      || '';
            if (acct.passwordEnc)      pwd     = await legacyDecrypt(acct.passwordEnc)      || '';
        } catch (e) { console.error('Investments form decrypt error', e); }
    }

    container.innerHTML =
        '<div class="form-group">' +
            '<label>Account Number</label>' +
            '<input type="text" id="investFormAcctNum" placeholder="Full account number"' +
                ' oninput="_investAutoLast4(this.value)">' +
        '</div>' +
        '<div class="form-group">' +
            '<label>Username</label>' +
            '<input type="text" id="investFormUsername" autocomplete="off" placeholder="Login username">' +
        '</div>' +
        '<div class="form-group">' +
            '<label>Password</label>' +
            '<input type="text" id="investFormPassword" autocomplete="off" placeholder="Login password">' +
        '</div>';

    _investVal('investFormAcctNum',  acctNum);
    _investVal('investFormUsername', uname);
    _investVal('investFormPassword', pwd);
}

function _investUnlockForForm() {
    // Capture what the user has typed so it survives the page re-render after unlock
    var selectedRadio = document.querySelector('input[name="investOwnerType"]:checked');
    _investFormDraft = {
        accountType:      (document.getElementById('investFormType')         || {}).value || '',
        nickname:         (document.getElementById('investFormNickname')     || {}).value || '',
        ownerType:        selectedRadio ? selectedRadio.value : 'personal',
        primaryContactId: (document.getElementById('investFormJointContact') || {}).value || '',
        institution:      (document.getElementById('investFormInstitution')  || {}).value || '',
        last4:            (document.getElementById('investFormLast4')        || {}).value || '',
        cashBalance:      (document.getElementById('investFormCashBalance')  || {}).value || '',
        url:              (document.getElementById('investFormUrl')          || {}).value || '',
        loginNotes:       (document.getElementById('investFormLoginNotes')   || {}).value || '',
        beneficiary:      (document.getElementById('investFormBeneficiary')  || {}).value || ''
    };
    _legacyRequireUnlock(function() {
        loadInvestmentsFormPage(_investFormEditId);
    });
}

async function _investSaveForm() {
    var accountType = (document.getElementById('investFormType')     || {}).value || '';
    var nickname    = ((document.getElementById('investFormNickname') || {}).value || '').trim();

    if (!accountType) { alert('Please select an account type.'); return; }
    if (!nickname)    { alert('Please enter a nickname.'); return; }

    var selectedRadio    = document.querySelector('input[name="investOwnerType"]:checked');
    var ownerType        = selectedRadio ? selectedRadio.value : 'personal';
    var primaryContactId = ownerType === 'joint'
        ? ((document.getElementById('investFormJointContact') || {}).value || '')
        : '';

    var cashBalanceRaw = ((document.getElementById('investFormCashBalance') || {}).value || '').trim();
    var cashBalance    = cashBalanceRaw !== '' ? parseFloat(cashBalanceRaw) : null;

    var id    = _investFormEditId;
    var isNew = !id;

    var data = {
        accountType:      accountType,
        nickname:         nickname,
        ownerType:        ownerType,
        primaryContactId: primaryContactId,
        institution:      ((document.getElementById('investFormInstitution') || {}).value || '').trim(),
        last4:            ((document.getElementById('investFormLast4')       || {}).value || '').replace(/\D/g, '').slice(0, 4),
        url:              ((document.getElementById('investFormUrl')         || {}).value || '').trim(),
        loginNotes:       ((document.getElementById('investFormLoginNotes')  || {}).value || '').trim(),
        beneficiary:      ((document.getElementById('investFormBeneficiary') || {}).value || '').trim()
    };

    if (cashBalance !== null && !isNaN(cashBalance)) {
        data.cashBalance = cashBalance;
    } else {
        data.cashBalance = firebase.firestore.FieldValue.delete();
    }

    // Encrypt sensitive fields only if passphrase is unlocked and fields are rendered
    if (legacyIsUnlocked() && document.getElementById('investFormAcctNum')) {
        var existing    = id ? _investAccounts.find(function(a) { return a.id === id; }) : null;
        var acctNumVal  = ((document.getElementById('investFormAcctNum')  || {}).value || '').trim();
        var usernameVal = ((document.getElementById('investFormUsername') || {}).value || '').trim();
        var passwordVal = ((document.getElementById('investFormPassword') || {}).value || '').trim();

        if (acctNumVal) {
            data.accountNumberEnc = await legacyEncrypt(acctNumVal);
        } else if (existing && existing.accountNumberEnc) {
            data.accountNumberEnc = firebase.firestore.FieldValue.delete();
        }
        if (usernameVal) {
            data.usernameEnc = await legacyEncrypt(usernameVal);
        } else if (existing && existing.usernameEnc) {
            data.usernameEnc = firebase.firestore.FieldValue.delete();
        }
        if (passwordVal) {
            data.passwordEnc = await legacyEncrypt(passwordVal);
        } else if (existing && existing.passwordEnc) {
            data.passwordEnc = firebase.firestore.FieldValue.delete();
        }
    }

    if (isNew) {
        data.sortOrder = _investAccounts.filter(function(a) { return !a.archived; }).length;
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await _investCol().add(data);
    } else {
        await _investCol().doc(id).update(data);
    }

    _investFormEditId = null;
    _investFormDraft  = null;
    window.location.hash = '#investments/accounts';
}

function _investCancelForm() {
    _investFormEditId = null;
    _investFormDraft  = null;
    window.location.hash = '#investments/accounts';
}

// ---------- Archive / Restore ----------

async function _investArchive(id) {
    if (!confirm('Archive this account? It will be hidden from the main list. You can restore it anytime with "Show Archived".')) return;
    await _investCol().doc(id).update({ archived: true });
    delete _investExpandedIds[id];
    await _investLoadAccounts();
    _investRenderList();
}

async function _investRestore(id) {
    await _investCol().doc(id).update({ archived: false });
    await _investLoadAccounts();
    _investRenderList();
}

// ---------- Drag-to-Reorder ----------

async function _investOnReorder(evt) {
    if (evt.oldIndex === evt.newIndex) return;
    // Only reorder personal (non-joint) accounts in self namespace
    var list = _investAccounts.filter(function(a) { return (!a.archived) && (!a._joint) && (a.ownerType !== 'joint'); });
    var moved = list.splice(evt.oldIndex, 1)[0];
    list.splice(evt.newIndex, 0, moved);

    var batch = firebase.firestore().batch();
    list.forEach(function(acct, i) {
        batch.update(_investCol().doc(acct.id), { sortOrder: i });
    });
    await batch.commit();
    await _investLoadAccounts();
}

// ---------- Show/Hide Archived ----------

function _investToggleArchived() {
    _investShowArchived = !_investShowArchived;
    var btn = document.getElementById('investShowArchivedBtn');
    if (btn) btn.textContent = _investShowArchived ? 'Hide Archived' : 'Show Archived';
    _investRenderList();
}

// ---------- Helpers ----------

function _investAutoLast4(value) {
    var digits = value.replace(/\D/g, '');
    if (digits.length >= 4) {
        _investVal('investFormLast4', digits.slice(-4));
    }
}

function _investVal(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value !== undefined && value !== null ? value : '';
}

// ============================================================
// ACCOUNT DETAIL PAGE  (#investments/account/:ns/:id)
// ============================================================

// ---------- Account Detail State ----------

var _investCurrentAccountNs  = 'self';
var _investCurrentAccountId  = null;
var _investCurrentHoldings   = [];
var _investHoldingEditId     = null;   // null = add mode; holding doc ID = edit mode

// ---------- Firestore Path for Holdings ----------

function _investHoldingCol(ns, accountId) {
    return userCol('investments').doc(ns).collection('accounts').doc(accountId).collection('holdings');
}

// ---------- Account Detail Page Loader ----------

async function loadInvestmentsAccountPage(ns, accountId) {
    _investCurrentAccountNs = ns || 'self';
    _investCurrentAccountId = accountId;

    // Ensure person context matches this account's namespace
    if (_investPersonFilter !== ns) {
        _investPersonFilter = ns;
    }

    // Load people list (needed to show co-owner name) and the account doc
    if (_investPeople.length === 0) {
        await _investLoadAll();
    }

    var acctDoc = await userCol('investments').doc(ns).collection('accounts').doc(accountId).get();
    if (!acctDoc.exists) {
        document.getElementById('page-investments-account').innerHTML =
            '<div class="page-header"><h2>Account Not Found</h2></div>' +
            '<p><a href="#investments/accounts">← Back to Accounts</a></p>';
        return;
    }
    var acct = Object.assign({ id: accountId, _ns: ns }, acctDoc.data());

    // Load holdings
    var holdSnap = await _investHoldingCol(ns, accountId).orderBy('ticker').get();
    _investCurrentHoldings = [];
    holdSnap.forEach(function(doc) {
        _investCurrentHoldings.push(Object.assign({ id: doc.id }, doc.data()));
    });

    document.getElementById('breadcrumbBar').innerHTML =
        '<a href="#investments">Investments</a><span class="separator">&rsaquo;</span>' +
        '<a href="#investments/accounts">Accounts</a><span class="separator">&rsaquo;</span>' +
        '<span>' + escapeHtml(acct.nickname || 'Account') + '</span>';
    document.getElementById('headerTitle').innerHTML =
        '<a href="#main" class="home-link">' + escapeHtml(window.appName || 'My Life') + '</a>';

    _investRenderAccountDetail(acct);
}

// ---------- Account Detail Render ----------

function _investRenderAccountDetail(acct) {
    var page = document.getElementById('page-investments-account');
    if (!page) return;

    var taxInfo   = _investTaxCategoryInfo(acct.accountType || '');
    var typeLabel = _investTypeLabel(acct.accountType || '');
    var isCash    = _INVEST_CASH_TYPES.indexOf(acct.accountType || '') >= 0;

    var coOwnerName = '';
    if (acct.ownerType === 'joint' && acct.primaryContactId) {
        var contact = _investPeople.find(function(p) { return p.id === acct.primaryContactId; });
        coOwnerName = contact ? contact.name : acct.primaryContactId;
    }

    var totals = _investComputeAccountTotals(_investCurrentHoldings, acct.cashBalance);

    // Header
    var html =
        '<div class="page-header">' +
            '<h2>' + escapeHtml(acct.nickname || 'Account') + '</h2>' +
            '<div class="page-header-actions">' +
                '<a class="btn btn-secondary" href="#investments/accounts/edit/' + acct.id + '">Edit Account</a>' +
            '</div>' +
        '</div>' +
        '<div class="invest-acct-meta">' +
            (acct.institution ? '<span class="invest-acct-institution">' + escapeHtml(acct.institution) + '</span>' : '') +
            '<span class="invest-type-badge ' + escapeHtml(taxInfo.cls) + '">' + escapeHtml(taxInfo.label) + '</span>' +
            '<span class="invest-acct-type-label">' + escapeHtml(typeLabel) + '</span>' +
        '</div>' +
        (acct.ownerType === 'joint' && coOwnerName
            ? '<div class="invest-acct-owner">Joint with ' + escapeHtml(coOwnerName) + '</div>'
            : '') +

        // Totals card
        '<div class="invest-totals-card">' +
            '<div class="invest-total-main">' +
                '<span class="invest-total-label">Total Value</span>' +
                '<span class="invest-total-value">' + _investFmtCurrency(totals.total) + '</span>' +
            '</div>' +
            (!isCash
                ? '<div class="invest-total-row">' +
                    '<span class="invest-total-sublabel">Holdings</span>' +
                    '<span class="invest-total-subvalue">' + _investFmtCurrency(totals.holdings) + '</span>' +
                  '</div>' +
                  '<div class="invest-total-row">' +
                    '<span class="invest-total-sublabel">Cash Balance</span>' +
                    '<span class="invest-total-subvalue">' + _investFmtCurrency(totals.cash) + '</span>' +
                  '</div>'
                : '') +
        '</div>';

    // Cash balance editor (shown for all account types, but labeled differently)
    var cashLabel = isCash ? 'Account Balance ($)' : 'Uninvested Cash Balance ($)';
    html +=
        '<div class="invest-cash-section">' +
            '<div class="invest-section-header">' + escapeHtml(cashLabel) + '</div>' +
            '<div class="invest-cash-row">' +
                '<input type="number" id="investDetailCash" class="invest-cash-input"' +
                    ' placeholder="0.00" min="0" step="0.01"' +
                    ' value="' + (acct.cashBalance != null ? acct.cashBalance : '') + '">' +
                '<button class="btn btn-primary btn-small" onclick="_investSaveCashBalance()">Save</button>' +
            '</div>' +
        '</div>';

    // Holdings section — only for non-cash accounts
    if (!isCash) {
        html +=
            '<div class="invest-section-header-row">' +
                '<div class="invest-section-header">Holdings</div>' +
                '<button class="btn btn-primary btn-small" onclick="_investOpenHoldingModal(null)">+ Add Holding</button>' +
            '</div>' +
            '<div id="investHoldingsList">' + _investHoldingsHtml() + '</div>';
    }

    // Update Prices placeholder (Phase 3)
    if (!isCash) {
        html +=
            '<div class="invest-update-prices-bar">' +
                '<button class="btn btn-secondary" disabled title="Coming in Phase 3">📡 Update Prices</button>' +
                '<span class="invest-prices-note">Price fetching coming soon</span>' +
            '</div>';
    }

    page.innerHTML = html;
}

function _investHoldingsHtml() {
    if (_investCurrentHoldings.length === 0) {
        return '<div class="empty-state">No holdings yet. Add one above.</div>';
    }
    var html = '<div class="invest-holdings-list">';
    _investCurrentHoldings.forEach(function(h) {
        var price = (h.lastPrice != null) ? '$' + h.lastPrice.toFixed(2) : '—';
        var value = (h.lastPrice != null && h.shares != null)
            ? _investFmtCurrency(h.shares * h.lastPrice)
            : '—';
        html +=
            '<div class="invest-holding-row">' +
                '<div class="invest-holding-main">' +
                    '<span class="invest-holding-ticker">' + escapeHtml(h.ticker || '') + '</span>' +
                    '<span class="invest-holding-name">' + escapeHtml(h.companyName || '') + '</span>' +
                '</div>' +
                '<div class="invest-holding-stats">' +
                    '<span class="invest-holding-stat"><span class="invest-holding-stat-label">Shares</span>' + (h.shares != null ? Number(h.shares).toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—') + '</span>' +
                    '<span class="invest-holding-stat"><span class="invest-holding-stat-label">Price</span>' + price + '</span>' +
                    '<span class="invest-holding-stat"><span class="invest-holding-stat-label">Value</span>' + value + '</span>' +
                '</div>' +
                '<div class="invest-holding-actions">' +
                    '<button class="btn btn-secondary btn-small" onclick="_investOpenHoldingModal(\'' + h.id + '\')">Edit</button>' +
                    '<button class="btn btn-danger btn-small" onclick="_investDeleteHolding(\'' + h.id + '\')">Delete</button>' +
                '</div>' +
            '</div>';
    });
    html += '</div>';
    return html;
}

// ---------- Holding Modal ----------

function _investOpenHoldingModal(holdingId) {
    _investHoldingEditId = holdingId || null;
    var isNew = !holdingId;
    var h = holdingId ? _investCurrentHoldings.find(function(x) { return x.id === holdingId; }) : null;

    document.getElementById('investHoldingModalTitle').textContent = isNew ? 'Add Holding' : 'Edit Holding';
    _investVal('investHoldingTicker',  h ? h.ticker      || '' : '');
    _investVal('investHoldingCompany', h ? h.companyName || '' : '');
    _investVal('investHoldingShares',  h ? h.shares      != null ? h.shares : '' : '');

    openModal('investHoldingModal');
    var tickerEl = document.getElementById('investHoldingTicker');
    if (tickerEl) setTimeout(function() { tickerEl.focus(); }, 50);
}

async function _investSaveHolding() {
    var ticker      = ((document.getElementById('investHoldingTicker')  || {}).value || '').trim().toUpperCase();
    var companyName = ((document.getElementById('investHoldingCompany') || {}).value || '').trim();
    var sharesRaw   = ((document.getElementById('investHoldingShares')  || {}).value || '').trim();

    if (!ticker)      { alert('Please enter a ticker symbol.'); return; }
    if (!companyName) { alert('Please enter a company or fund name.'); return; }

    var shares = sharesRaw !== '' ? parseFloat(sharesRaw) : null;
    if (sharesRaw !== '' && (isNaN(shares) || shares < 0)) {
        alert('Please enter a valid number of shares.');
        return;
    }

    var data = { ticker: ticker, companyName: companyName, shares: shares };

    var ns  = _investCurrentAccountNs;
    var aid = _investCurrentAccountId;

    if (_investHoldingEditId) {
        await _investHoldingCol(ns, aid).doc(_investHoldingEditId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await _investHoldingCol(ns, aid).add(data);
    }

    closeModal('investHoldingModal');

    // Reload holdings and re-render
    var holdSnap = await _investHoldingCol(ns, aid).orderBy('ticker').get();
    _investCurrentHoldings = [];
    holdSnap.forEach(function(doc) {
        _investCurrentHoldings.push(Object.assign({ id: doc.id }, doc.data()));
    });

    // Refresh the holdings list and totals in-place
    var acctDoc = await userCol('investments').doc(ns).collection('accounts').doc(aid).get();
    var acct    = Object.assign({ id: aid, _ns: ns }, acctDoc.data());
    _investRenderAccountDetail(acct);
}

async function _investDeleteHolding(holdingId) {
    if (!confirm('Delete this holding? This cannot be undone.')) return;
    var ns  = _investCurrentAccountNs;
    var aid = _investCurrentAccountId;
    await _investHoldingCol(ns, aid).doc(holdingId).delete();
    _investCurrentHoldings = _investCurrentHoldings.filter(function(h) { return h.id !== holdingId; });

    var holdingsList = document.getElementById('investHoldingsList');
    if (holdingsList) holdingsList.innerHTML = _investHoldingsHtml();

    // Re-render to update totals
    var acctDoc = await userCol('investments').doc(ns).collection('accounts').doc(aid).get();
    var acct    = Object.assign({ id: aid, _ns: ns }, acctDoc.data());
    _investRenderAccountDetail(acct);
}

// ---------- Cash Balance Save ----------

async function _investSaveCashBalance() {
    var ns  = _investCurrentAccountNs;
    var aid = _investCurrentAccountId;
    var raw = ((document.getElementById('investDetailCash') || {}).value || '').trim();
    var val = raw !== '' ? parseFloat(raw) : null;

    if (raw !== '' && isNaN(val)) { alert('Please enter a valid dollar amount.'); return; }

    var update = (val !== null) ? { cashBalance: val } : { cashBalance: firebase.firestore.FieldValue.delete() };
    await userCol('investments').doc(ns).collection('accounts').doc(aid).update(update);

    // Re-render with updated account
    var acctDoc = await userCol('investments').doc(ns).collection('accounts').doc(aid).get();
    var acct    = Object.assign({ id: aid, _ns: ns }, acctDoc.data());
    _investRenderAccountDetail(acct);
}

// ---------- Totals Computation ----------

function _investComputeAccountTotals(holdings, cashBalance) {
    var holdingsValue = holdings.reduce(function(sum, h) {
        if (h.lastPrice != null && h.shares != null) {
            return sum + h.shares * h.lastPrice;
        }
        return sum;
    }, 0);
    var cash = parseFloat(cashBalance || 0) || 0;
    return { holdings: holdingsValue, cash: cash, total: holdingsValue + cash };
}

// ---------- Currency Formatter ----------

function _investFmtCurrency(val) {
    if (val == null || isNaN(val)) return '—';
    return '$' + parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
