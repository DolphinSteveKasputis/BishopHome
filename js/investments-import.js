// investments-import.js
// Snapshot Import screen (#investments/import)
// Lets the user upload a spreadsheet screenshot, uses AI vision to extract the data,
// shows a review grid with editable column-to-account mappings, then writes to Firestore.

// ─── Module State ─────────────────────────────────────────────────────────────

var _importState = {
    groupId:       null,
    snapshotType:  'monthly',
    imageBase64:   null,
    imageType:     'image/png',
    imageDataUrl:  null,
    parsed:        null,   // { columns: [...], rows: [...] } from AI
    existingDates: new Set(),
    accounts:      [],
    groups:        []
};

// ─── Page Load ────────────────────────────────────────────────────────────────

async function loadInvestmentsImportPage() {
    document.getElementById('breadcrumbBar').innerHTML =
        '<a href="#investments">Financial</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<a href="#investments/snapshots">Snapshots</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>Import</span>';
    document.getElementById('headerTitle').innerHTML =
        '<a href="#main" class="home-link">' + escapeHtml(window.appName || 'My Life') + '</a>';

    var container = document.getElementById('page-investments-import');
    container.innerHTML = '<div class="invest-summary-loading">Loading…</div>';

    try {
        await _investLoadGroups();
        _importState.groups  = _investGroups;
        _importState.groupId = _investSnapshotsGroupId
                            || _investActiveGroupId
                            || (_investGroups.length ? _investGroups[0].id : null);

        if (_importState.groupId) {
            var group = _investGroups.find(function(g) { return g.id === _importState.groupId; });
            _importState.accounts = await _importLoadAccounts(group);
        }

        _importRenderForm();
    } catch (e) {
        container.innerHTML = '<p class="error-text">Failed to load: ' + escapeHtml(e.message) + '</p>';
    }
}

// Load account metadata for a group — no holdings fetch needed here
async function _importLoadAccounts(group) {
    var personIds = (group && group.personIds) ? group.personIds : ['self'];
    var all = [];

    for (var i = 0; i < personIds.length; i++) {
        var ns = personIds[i];
        var snap = await userCol('investments').doc(ns).collection('accounts')
            .orderBy('sortOrder').get();
        snap.forEach(function(doc) {
            var d = doc.data();
            if (!d.archived && d.ownerType !== 'joint') {
                all.push({ id: doc.id, _ns: ns, name: d.name || '', accountType: d.accountType || '', ownerType: 'individual' });
            }
        });
    }

    // Joint accounts stored under 'self'
    if (personIds.indexOf('self') >= 0) {
        var selfSnap = await userCol('investments').doc('self').collection('accounts').get();
        selfSnap.forEach(function(doc) {
            var d = doc.data();
            if (d.ownerType === 'joint' && !d.archived && d.primaryContactId) {
                var alreadyIn      = all.find(function(a) { return a.id === doc.id; });
                var coOwnerInGroup = personIds.indexOf(d.primaryContactId) >= 0;
                if (!alreadyIn && coOwnerInGroup) {
                    all.push({ id: doc.id, _ns: 'self', name: d.name || '', accountType: d.accountType || '', ownerType: 'joint' });
                }
            }
        });
    }

    return all;
}

// ─── Step 1: Upload Form ──────────────────────────────────────────────────────

function _importRenderForm() {
    var container = document.getElementById('page-investments-import');

    var groupOpts = _importState.groups.map(function(g) {
        return '<option value="' + escapeHtml(g.id) + '"' +
            (g.id === _importState.groupId ? ' selected' : '') + '>' +
            escapeHtml(g.name) + '</option>';
    }).join('');

    container.innerHTML = [
        '<div class="page-content">',
        '<div class="page-header">',
            '<h2>📥 Import Snapshots</h2>',
        '</div>',
        '<div class="section-card">',
            '<p class="invest-import-desc">',
                'Upload a screenshot of your spreadsheet. AI will read the numbers and map each column ',
                'to your accounts. Review the grid, adjust any mismatched dropdowns, then click Import.',
            '</p>',

            _importState.groups.length > 1 ? (
                '<div class="form-group">' +
                '<label>Group</label>' +
                '<select id="importGroupSel" onchange="_importGroupChanged(this.value)">' + groupOpts + '</select>' +
                '</div>'
            ) : '',

            '<div class="form-group">',
                '<label>Snapshot Type</label>',
                '<select id="importTypeSel">',
                    '<option value="weekly">Weekly</option>',
                    '<option value="monthly" selected>Monthly</option>',
                    '<option value="yearly">Yearly</option>',
                '</select>',
            '</div>',

            '<div class="form-group">',
                '<label>Screenshot</label>',
                '<div class="invest-import-file-row">',
                    '<input type="file" id="importImageFile" accept="image/*" onchange="_importImageSelected(this)">',
                    '<button class="btn btn-secondary btn-small" onclick="_importPasteImage()" title="Paste image from clipboard">+ Paste</button>',
                '</div>',
                '<div id="importImagePreview" class="invest-import-preview"></div>',
            '</div>',

            '<div id="importParseStatus" class="invest-import-status" style="display:none"></div>',

            '<div class="form-actions">',
                '<button class="btn btn-primary" id="importParseBtn" onclick="_importParse()" disabled>Parse with AI</button>',
                '<a href="#investments/snapshots" class="btn btn-secondary">Cancel</a>',
            '</div>',
        '</div>',

        '<div id="importGridSection"></div>',
        '</div>'
    ].join('');
}

async function _importGroupChanged(groupId) {
    _importState.groupId = groupId;
    var group = _importState.groups.find(function(g) { return g.id === groupId; });
    _importState.accounts = group ? await _importLoadAccounts(group) : [];
    if (_importState.parsed) _importRenderGrid();
}

function _importImageSelected(input) {
    var file = input.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        var dataUrl = e.target.result;
        var comma   = dataUrl.indexOf(',');
        _importState.imageBase64  = dataUrl.substring(comma + 1);
        _importState.imageType    = file.type || 'image/png';
        _importState.imageDataUrl = dataUrl;

        document.getElementById('importImagePreview').innerHTML =
            '<img src="' + dataUrl + '" class="invest-import-thumb">';
        document.getElementById('importParseBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

async function _importPasteImage() {
    try {
        var items = await navigator.clipboard.read();
        var imageItem = null;
        for (var i = 0; i < items.length; i++) {
            var type = items[i].types.find(function(t) { return t.startsWith('image/'); });
            if (type) { imageItem = { item: items[i], type: type }; break; }
        }
        if (!imageItem) {
            alert('No image found in clipboard. Copy a screenshot first, then click Paste.');
            return;
        }
        var blob   = await imageItem.item.getType(imageItem.type);
        var reader = new FileReader();
        reader.onload = function(e) {
            var dataUrl  = e.target.result;
            var comma    = dataUrl.indexOf(',');
            _importState.imageBase64  = dataUrl.substring(comma + 1);
            _importState.imageType    = imageItem.type;
            _importState.imageDataUrl = dataUrl;
            document.getElementById('importImagePreview').innerHTML =
                '<img src="' + dataUrl + '" class="invest-import-thumb">';
            document.getElementById('importParseBtn').disabled = false;
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        // Permission denied or no clipboard access
        alert('Could not read clipboard: ' + e.message + '\n\nTry clicking the file input instead.');
    }
}

// ─── Step 2: Parse with AI ────────────────────────────────────────────────────

async function _importParse() {
    if (!_importState.imageBase64) return;

    var btn    = document.getElementById('importParseBtn');
    var status = document.getElementById('importParseStatus');
    btn.disabled    = true;
    btn.textContent = 'Parsing…';
    status.style.display = '';
    status.className = 'invest-import-status';
    status.textContent = 'Sending screenshot to AI…';

    try {
        _importState.snapshotType = document.getElementById('importTypeSel').value;

        var prompt = _importBuildPrompt(_importState.accounts, _importState.snapshotType);
        var raw    = await _importCallVision(_importState.imageBase64, _importState.imageType, prompt);

        // Strip markdown fences if the model wraps its JSON
        var json = raw.trim();
        if (json.startsWith('```')) {
            json = json.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();
        }
        _importState.parsed = JSON.parse(json);

        if (!_importState.parsed.columns || !_importState.parsed.rows) {
            throw new Error('Unexpected response format from AI.');
        }

        // Validate that every account mapping actually exists in our account list
        _importState.parsed.columns.forEach(function(col) {
            if (col.mapping && col.mapping.startsWith('account:')) {
                var acctId = col.mapping.substring(8);
                var found  = _importState.accounts.find(function(a) { return a.id === acctId; });
                if (!found) {
                    col.mapping   = 'ignore';
                    col.uncertain = true;
                }
            }
        });

        // Load existing snapshot dates to warn about duplicates
        var existingSnap = await _investSnapshotCol()
            .where('groupId', '==', _importState.groupId)
            .where('type', '==', _importState.snapshotType)
            .get();
        _importState.existingDates = new Set();
        existingSnap.forEach(function(doc) {
            var d = doc.data();
            if (d.date) _importState.existingDates.add(d.date);
        });

        status.style.display = 'none';
        btn.textContent      = 'Parse with AI';
        btn.disabled         = false;
        _importRenderGrid();

    } catch (e) {
        status.className    = 'invest-import-status invest-import-status--error';
        status.textContent  = 'Error: ' + e.message;
        btn.disabled        = false;
        btn.textContent     = 'Parse with AI';
    }
}

function _importBuildPrompt(accounts, snapshotType) {
    var accountList = accounts.map(function(a) {
        return '  ' + a.id + ' | ' + a.name + ' | ' + (a.accountType || '') + ' | ' + a.ownerType;
    }).join('\n');

    return [
        'You are extracting financial snapshot data from a spreadsheet screenshot.',
        '',
        'SNAPSHOT TYPE: ' + snapshotType,
        '',
        'ACCOUNTS IN MY APP (format: id | name | accountType | ownerType):',
        accountList,
        '',
        'TASK: Extract every data row visible in the screenshot.',
        'For each spreadsheet column determine its mapping:',
        '  "netWorth"            → grand total / overall portfolio value (usually the largest column)',
        '  "category:roth"       → Roth retirement total',
        '  "category:preTax"     → Pre-tax / traditional retirement total',
        '  "category:brokerage"  → Taxable brokerage total',
        '  "category:cash"       → Emergency / bank cash total',
        '  "category:invCash"    → Invested cash / money-market total',
        '  "account:{id}"        → a specific account from the list above — use its exact id',
        '  "ignore"              → skip this column (person group headers, blank columns, running subtotals)',
        '',
        'Set uncertain=true when:',
        '  - Multiple accounts could plausibly match the column name',
        '  - No account in the list matches the column name',
        '  - The column purpose is ambiguous',
        '',
        'RETURN ONLY valid JSON (no markdown, no commentary):',
        '{',
        '  "columns": [',
        '    { "header": "<text>", "mapping": "<mapping>", "uncertain": false }',
        '  ],',
        '  "rows": [',
        '    { "date": "YYYY-MM-DD", "values": [<number or null>, ...] }',
        '  ]',
        '}',
        '',
        'Additional rules:',
        '  - values array length must equal columns array length',
        '  - Strip $ and commas from numbers — return plain numbers',
        '  - Use null for empty or missing cells',
        '  - Infer the full year from context if only month/day is shown',
        '  - Dates like "1/1/2026" → "2026-01-01"'
    ].join('\n');
}

async function _importCallVision(imageBase64, imageType, prompt) {
    var doc = await userCol('settings').doc('llm').get();
    if (!doc.exists) throw new Error('LLM not configured. Go to Settings → AI to add your API key.');

    var cfg      = doc.data();
    var provider = cfg.provider || 'openai';
    var apiKey   = cfg.apiKey   || '';
    var model    = cfg.model    || '';

    var ENDPOINTS = {
        openai: { url: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4o' },
        grok:   { url: 'https://api.x.ai/v1/chat/completions',       defaultModel: 'grok-2-vision-1212' }
    };
    var ep = ENDPOINTS[provider] || ENDPOINTS.openai;

    // Force a vision-capable model if the configured model can't handle images
    var visionModel = model || ep.defaultModel;
    if (provider === 'openai' && visionModel === 'gpt-4o-mini') visionModel = 'gpt-4o';
    if (provider === 'grok'   && !visionModel.includes('vision')) visionModel = 'grok-2-vision-1212';

    var res = await fetch(ep.url, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body   : JSON.stringify({
            model   : visionModel,
            messages: [{
                role   : 'user',
                content: [
                    { type: 'text',      text:      prompt },
                    { type: 'image_url', image_url: { url: 'data:' + imageType + ';base64,' + imageBase64 } }
                ]
            }],
            max_completion_tokens: 4000
        })
    });

    if (!res.ok) {
        var err = await res.json().catch(function() { return {}; });
        throw new Error((err.error && err.error.message) || 'API error ' + res.status);
    }
    var data = await res.json();
    return data.choices[0].message.content;
}

// ─── Step 3: Review Grid ──────────────────────────────────────────────────────

function _importRenderGrid() {
    var section  = document.getElementById('importGridSection');
    var parsed   = _importState.parsed;
    var accounts = _importState.accounts;

    if (!parsed || !parsed.columns || !parsed.rows) { section.innerHTML = ''; return; }

    // Build the dropdown option HTML for each column header
    var categoryOptions = [
        '<option value="netWorth">Net Worth (total)</option>',
        '<option value="category:roth">Category: Roth</option>',
        '<option value="category:preTax">Category: Pre-Tax</option>',
        '<option value="category:brokerage">Category: Brokerage</option>',
        '<option value="category:cash">Category: Cash</option>',
        '<option value="category:invCash">Category: Inv Cash</option>',
        '<option value="ignore">— ignore —</option>'
    ].join('');

    var accountOptionHtml = accounts.map(function(a) {
        return '<option value="account:' + escapeHtml(a.id) + '">' + escapeHtml(a.name) + '</option>';
    }).join('');

    // Header row — one <th> per column with a dropdown + column name label
    var headerCells = '<th class="invest-import-th-date">Date</th>';
    parsed.columns.forEach(function(col, i) {
        var uncertain = col.uncertain ? ' invest-import-uncertain' : '';
        headerCells +=
            '<th class="invest-import-col-header' + uncertain + '">' +
                '<div class="invest-import-col-name" title="' + escapeHtml(col.header) + '">' +
                    escapeHtml(col.header) +
                '</div>' +
                '<select class="invest-import-col-sel" data-col="' + i + '" onchange="_importColChange(this)">' +
                    categoryOptions + accountOptionHtml +
                '</select>' +
            '</th>';
    });

    // Data rows
    var dataRows = parsed.rows.map(function(row) {
        var isDupe   = _importState.existingDates.has(row.date);
        var dupeTag  = isDupe
            ? ' <span class="invest-import-dupe-badge" title="A snapshot already exists for this date and will be overwritten">overwrite</span>'
            : '';
        var cells = '<td class="invest-import-td-date">' + escapeHtml(row.date) + dupeTag + '</td>';
        row.values.forEach(function(val) {
            var display = (val === null || val === undefined) ? '—' : _investFmtCurrency(val);
            cells += '<td class="invest-import-val">' + display + '</td>';
        });
        return '<tr' + (isDupe ? ' class="invest-import-dupe-row"' : '') + '>' + cells + '</tr>';
    }).join('');

    var dupeCount      = parsed.rows.filter(function(r) { return _importState.existingDates.has(r.date); }).length;
    var uncertainCount = parsed.columns.filter(function(c) { return c.uncertain; }).length;

    var warnings = '';
    if (uncertainCount > 0) {
        warnings += '<div class="invest-import-warning invest-import-warning--yellow">' +
            '⚠ ' + uncertainCount + ' column' + (uncertainCount > 1 ? 's' : '') +
            ' (highlighted yellow) could not be matched confidently — please review the dropdowns.' +
            '</div>';
    }
    if (dupeCount > 0) {
        warnings += '<div class="invest-import-warning invest-import-warning--orange">' +
            '⚠ ' + dupeCount + ' row' + (dupeCount > 1 ? 's' : '') +
            ' already have a snapshot for the same date and will be overwritten.' +
            '</div>';
    }

    section.innerHTML =
        '<div class="section-card invest-import-grid-card">' +
            '<h3>Review</h3>' +
            warnings +
            '<p class="invest-import-grid-hint">Adjust any column header dropdowns if the AI mapped a column incorrectly.</p>' +
            '<div class="invest-import-grid-wrap">' +
                '<table class="invest-import-grid">' +
                    '<thead><tr>' + headerCells + '</tr></thead>' +
                    '<tbody>' + dataRows + '</tbody>' +
                '</table>' +
            '</div>' +
            '<div class="form-actions invest-import-grid-actions">' +
                '<button class="btn btn-primary" id="importExecBtn" onclick="_importExecute()">' +
                    'Import ' + parsed.rows.length + ' Snapshot' + (parsed.rows.length !== 1 ? 's' : '') +
                '</button>' +
                '<button class="btn btn-secondary" onclick="_importReset()">Start Over</button>' +
            '</div>' +
        '</div>';

    // Set dropdown values after the DOM exists
    var sels = section.querySelectorAll('.invest-import-col-sel');
    sels.forEach(function(sel, i) {
        var mapping = parsed.columns[i] ? (parsed.columns[i].mapping || 'ignore') : 'ignore';
        // Only set if the option exists; otherwise leave at default
        if (sel.querySelector('option[value="' + mapping + '"]')) {
            sel.value = mapping;
        }
    });
}

function _importColChange(sel) {
    var colIdx = parseInt(sel.dataset.col, 10);
    _importState.parsed.columns[colIdx].mapping   = sel.value;
    _importState.parsed.columns[colIdx].uncertain = false;
    sel.closest('th').classList.remove('invest-import-uncertain');
}

function _importReset() {
    _importState.parsed        = null;
    _importState.imageBase64   = null;
    _importState.imageDataUrl  = null;
    document.getElementById('importGridSection').innerHTML    = '';
    document.getElementById('importImageFile').value          = '';
    document.getElementById('importImagePreview').innerHTML   = '';
    document.getElementById('importParseBtn').disabled        = true;
    document.getElementById('importParseBtn').textContent     = 'Parse with AI';
    document.getElementById('importParseStatus').style.display = 'none';
}

// ─── Step 4: Import ───────────────────────────────────────────────────────────

async function _importExecute() {
    var parsed = _importState.parsed;
    if (!parsed) return;

    var btn = document.getElementById('importExecBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }

    try {
        var snapshotType = _importState.snapshotType;
        var groupId      = _importState.groupId;
        var accounts     = _importState.accounts;
        var columns      = parsed.columns;

        // Delete any existing snapshots that would be overwritten
        var datesToOverwrite = parsed.rows
            .filter(function(r) { return _importState.existingDates.has(r.date); })
            .map(function(r) { return r.date; });

        if (datesToOverwrite.length > 0) {
            var existingAll = await _investSnapshotCol()
                .where('groupId', '==', groupId)
                .where('type', '==', snapshotType)
                .get();
            var delBatch = db.batch();
            existingAll.forEach(function(doc) {
                if (datesToOverwrite.indexOf(doc.data().date) >= 0) {
                    delBatch.delete(doc.ref);
                }
            });
            await delBatch.commit();
        }

        // Write new snapshot documents
        var writes = parsed.rows.map(function(row) {
            var perCategory = { roth: 0, preTax: 0, brokerage: 0, cash: 0, invCash: 0 };
            var perAccount  = {};
            var netWorth    = 0;

            columns.forEach(function(col, i) {
                var val     = row.values[i];
                var mapping = col.mapping || 'ignore';
                if (val === null || val === undefined || mapping === 'ignore') return;

                if      (mapping === 'netWorth')           { netWorth = val; }
                else if (mapping === 'category:roth')      { perCategory.roth      = val; }
                else if (mapping === 'category:preTax')    { perCategory.preTax    = val; }
                else if (mapping === 'category:brokerage') { perCategory.brokerage = val; }
                else if (mapping === 'category:cash')      { perCategory.cash      = val; }
                else if (mapping === 'category:invCash')   { perCategory.invCash   = val; }
                else if (mapping.startsWith('account:')) {
                    var acctId = mapping.substring(8);
                    var acct   = accounts.find(function(a) { return a.id === acctId; });
                    perAccount[acctId] = {
                        id      : acctId,
                        name    : acct ? (acct.name || acctId) : acctId,
                        type    : acct ? (acct.accountType || '') : '',
                        ns      : acct ? (acct._ns || 'self') : 'self',
                        holdings: 0,
                        cash    : 0,
                        pending : 0,
                        total   : val
                    };
                }
            });

            return _investSnapshotCol().add({
                groupId   : groupId,
                type      : snapshotType,
                date      : row.date,
                netWorth  : netWorth,
                invested  : 0,
                perCategory: perCategory,
                perAccount : perAccount,
                notes     : null,
                createdAt : firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await Promise.all(writes);

        // Show success
        document.getElementById('importGridSection').innerHTML =
            '<div class="section-card" style="margin-top:16px">' +
                '<p class="success-text">✓ Imported ' + parsed.rows.length + ' snapshot' +
                    (parsed.rows.length !== 1 ? 's' : '') + ' successfully.</p>' +
                '<div class="form-actions">' +
                    '<a href="#investments/snapshots" class="btn btn-primary">View Snapshots</a>' +
                    '<button class="btn btn-secondary" onclick="_importReset();' +
                        'document.getElementById(\'importGridSection\').innerHTML=\'\'">Import More</button>' +
                '</div>' +
            '</div>';

    } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'Import'; }
        alert('Import failed: ' + e.message);
    }
}
