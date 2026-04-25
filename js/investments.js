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

var _INVEST_BANK_TYPES       = ['checking', 'savings', 'money-market', 'cd'];
var _INVEST_RETIREMENT_TYPES = ['roth-ira', 'traditional-ira', 'roth-401k', 'traditional-401k', 'self-directed-401k', '403b'];
var _INVEST_BROKERAGE_TYPES  = ['brokerage-individual', 'brokerage-joint'];
var _INVEST_TAX_ADV_TYPES    = ['hsa', '529'];

function _investTypeLabel(value) {
    var t = INVEST_ACCOUNT_TYPES.find(function(t) { return t.value === value; });
    return (t && t.value) ? t.label : 'Account';
}

function _investBadgeClass(type) {
    if (_INVEST_BANK_TYPES.indexOf(type) >= 0)       return 'invest-badge--bank';
    if (_INVEST_RETIREMENT_TYPES.indexOf(type) >= 0) return 'invest-badge--retirement';
    if (_INVEST_BROKERAGE_TYPES.indexOf(type) >= 0)  return 'invest-badge--brokerage';
    if (_INVEST_TAX_ADV_TYPES.indexOf(type) >= 0)    return 'invest-badge--tax-adv';
    return 'invest-badge--other';
}

// ---------- Module State ----------

var _investPersonFilter = 'self';   // 'self' or a people doc ID
var _investPeople       = [];       // [{id, name}] enrolled contacts
var _investAccounts     = [];       // account docs for the current person
var _investShowArchived = false;
var _investExpandedIds  = {};       // {accountId: bool}
var _investRevealedIds  = {};       // {accountId: bool} — sensitive fields decrypted & shown
var _investDecryptCache = {};       // {accountId: {accountNumber, username, password}}

// ---------- Firestore Path ----------

function _investCol() {
    return userCol('investments').doc(_investPersonFilter).collection('accounts');
}

// ---------- Page Loader ----------

async function loadInvestmentsPage() {
    document.getElementById('breadcrumbBar').innerHTML =
        '<a href="#life">Life</a><span class="separator">&rsaquo;</span><span>Investments</span>';
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
        _investAccounts.push(Object.assign({ id: doc.id }, doc.data()));
    });
}

// ---------- Page Render ----------

function _investRenderPage() {
    var page = document.getElementById('page-investments');
    if (!page) return;

    var personOpts = '<option value="self"' + (_investPersonFilter === 'self' ? ' selected' : '') + '>Me</option>';
    _investPeople.forEach(function(p) {
        personOpts += '<option value="' + escapeHtml(p.id) + '"' +
            (_investPersonFilter === p.id ? ' selected' : '') + '>' +
            escapeHtml(p.name) + '</option>';
    });

    page.innerHTML =
        '<div class="page-header">' +
            '<h2>📈 Investments</h2>' +
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
            '<button class="btn btn-primary" onclick="window.location.hash=\'#investments/add\'">+ Add Account</button>' +
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

    var html = '<div id="investSortableList">';
    list.forEach(function(acct) { html += _investCardHtml(acct); });
    html += '</div>';
    container.innerHTML = html;

    if (window.Sortable) {
        Sortable.create(document.getElementById('investSortableList'), {
            handle: '.invest-drag-handle',
            animation: 150,
            onEnd: function(evt) { _investOnReorder(evt); }
        });
    }
}

function _investCardHtml(acct) {
    var isExpanded = !!_investExpandedIds[acct.id];
    var badgeClass = _investBadgeClass(acct.accountType || '');
    var typeLabel  = _investTypeLabel(acct.accountType || '');

    var titleParts = [escapeHtml(acct.nickname || '(untitled)')];
    if (acct.institution) titleParts.push(escapeHtml(acct.institution));

    var header =
        '<div class="invest-card-header" onclick="_investToggleCard(\'' + acct.id + '\')">' +
            '<span class="invest-drag-handle" onclick="event.stopPropagation()">⠿</span>' +
            '<span class="invest-type-badge ' + escapeHtml(badgeClass) + '">' + escapeHtml(typeLabel) + '</span>' +
            '<span class="invest-card-title">' + titleParts.join(' — ') +
                (acct.last4 ? '<span class="invest-last4"> ····' + escapeHtml(acct.last4) + '</span>' : '') +
            '</span>' +
            (acct.archived ? '<span class="invest-archived-badge">Closed</span>' : '') +
            '<span class="invest-chevron">' + (isExpanded ? '▾' : '›') + '</span>' +
        '</div>';

    var body = '';
    if (isExpanded) {
        var isRevealed = !!_investRevealedIds[acct.id];
        var cache      = _investDecryptCache[acct.id] || {};
        var hasEnc     = acct.accountNumberEnc || acct.usernameEnc || acct.passwordEnc;

        body = '<div class="invest-card-body">';

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
                // Not unlocked at all — show a single unlock button
                body +=
                    '<div class="invest-sensitive-lock">' +
                        '<span>Sensitive fields are encrypted.</span>' +
                        '<button class="btn btn-secondary btn-small"' +
                            ' onclick="event.stopPropagation();_investRevealAccount(\'' + acct.id + '\')">' +
                            '🔓 Reveal Sensitive Info</button>' +
                    '</div>';
            } else {
                // Passphrase is in memory — show reveal/hide toggle
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

        body +=
            '<div class="invest-card-actions">' +
                '<button class="btn btn-secondary btn-small"' +
                    ' onclick="event.stopPropagation();window.location.hash=\'#investments/edit/' + acct.id + '\'">Edit</button>' +
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
    _investDecryptCache[id]  = cache;
    _investRevealedIds[id]   = true;
    _investExpandedIds[id]   = true;
    _investRenderList();
}

function _investHideAccount(id) {
    delete _investRevealedIds[id];
    delete _investDecryptCache[id];
    _investRenderList();
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
    // Return focus to the search input so the user can add another person immediately
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
        '<span>' + (isNew ? 'Add Account' : 'Edit Account') + '</span>';
    document.getElementById('headerTitle').innerHTML =
        '<a href="#main" class="home-link">' + escapeHtml(window.appName || 'My Life') + '</a>';

    var typeOpts = '';
    INVEST_ACCOUNT_TYPES.forEach(function(t) {
        typeOpts += '<option value="' + escapeHtml(t.value) + '">' + escapeHtml(t.label) + '</option>';
    });

    var page = document.getElementById('page-investments-form');
    if (!page) return;

    page.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small back-btn"' +
                ' onclick="window.location.hash=\'#investments\'">← Investments</button>' +
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
                '<label>Institution</label>' +
                '<input type="text" id="investFormInstitution" placeholder="e.g. Fidelity Investments">' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Last 4 Digits</label>' +
                '<input type="text" id="investFormLast4" placeholder="1234" maxlength="4">' +
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
                '<label>Beneficiary / Joint Owner</label>' +
                '<input type="text" id="investFormBeneficiary"' +
                    ' placeholder="Who inherits or is on the account">' +
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

    // Populate basic fields — use preserved draft values if returning from passphrase prompt
    var d = _investFormDraft;
    _investVal('investFormType',        d ? d.accountType : (acct ? acct.accountType  || '' : ''));
    _investVal('investFormNickname',    d ? d.nickname    : (acct ? acct.nickname     || '' : ''));
    _investVal('investFormInstitution', d ? d.institution : (acct ? acct.institution  || '' : ''));
    _investVal('investFormLast4',       d ? d.last4       : (acct ? acct.last4        || '' : ''));
    _investVal('investFormUrl',         d ? d.url         : (acct ? acct.url          || '' : ''));
    _investVal('investFormLoginNotes',  d ? d.loginNotes  : (acct ? acct.loginNotes   || '' : ''));
    _investVal('investFormBeneficiary', d ? d.beneficiary : (acct ? acct.beneficiary  || '' : ''));
    _investFormDraft = null; // consumed

    await _investRenderSensitiveFields(acct);
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
    _investFormDraft = {
        accountType: (document.getElementById('investFormType')        || {}).value || '',
        nickname:    (document.getElementById('investFormNickname')    || {}).value || '',
        institution: (document.getElementById('investFormInstitution') || {}).value || '',
        last4:       (document.getElementById('investFormLast4')       || {}).value || '',
        url:         (document.getElementById('investFormUrl')         || {}).value || '',
        loginNotes:  (document.getElementById('investFormLoginNotes')  || {}).value || '',
        beneficiary: (document.getElementById('investFormBeneficiary') || {}).value || ''
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

    var id    = _investFormEditId;
    var isNew = !id;

    var data = {
        accountType:  accountType,
        nickname:     nickname,
        institution:  ((document.getElementById('investFormInstitution') || {}).value || '').trim(),
        last4:        ((document.getElementById('investFormLast4')       || {}).value || '').replace(/\D/g, '').slice(0, 4),
        url:          ((document.getElementById('investFormUrl')         || {}).value || '').trim(),
        loginNotes:   ((document.getElementById('investFormLoginNotes')  || {}).value || '').trim(),
        beneficiary:  ((document.getElementById('investFormBeneficiary') || {}).value || '').trim()
    };

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
    window.location.hash = '#investments';
}

function _investCancelForm() {
    _investFormEditId = null;
    _investFormDraft  = null;
    window.location.hash = '#investments';
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
    var list = _investAccounts.filter(function(a) { return _investShowArchived || !a.archived; });
    var moved = list.splice(evt.oldIndex, 1)[0];
    list.splice(evt.newIndex, 0, moved);

    var batch = firebase.firestore().batch();
    list.forEach(function(acct, i) {
        batch.update(_investCol().doc(acct.id), { sortOrder: i });
    });
    await batch.commit();
    await _investLoadAccounts();
    // No full re-render needed — DOM is already correct
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
    if (el) el.value = value !== undefined ? value : '';
}
