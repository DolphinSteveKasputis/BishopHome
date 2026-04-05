// ============================================================
// Settings.js — App settings page
// Loads and saves settings from Firestore collection 'settings',
// document 'main'. Fields: appName, address, parcelId.
// ============================================================

/**
 * Loads the Settings Hub page — no async work needed, just a static card grid.
 * Called by app.js when routing to #settings.
 */
function loadSettingsHub() {
    // Nothing to load — the hub is purely static HTML cards.
}

/**
 * Load general settings from Firestore and populate the form fields.
 * Called by app.js when routing to #settings-general.
 */
async function loadSettingsGeneralPage() {
    var appNameEl   = document.getElementById('settingsAppName');
    var addressEl   = document.getElementById('settingsAddress');
    var parcelIdEl  = document.getElementById('settingsParcelId');
    var cityStateEl = document.getElementById('settingsCityState');
    var savedMsg    = document.getElementById('settingsSavedMsg');
    backupLoadLastMsg();  // show last backup timestamp

    // Clear form while loading
    appNameEl.value   = '';
    addressEl.value   = '';
    parcelIdEl.value  = '';
    cityStateEl.value = '';
    savedMsg.classList.add('hidden');

    try {
        var doc = await userCol('settings').doc('main').get();
        if (doc.exists) {
            var data          = doc.data();
            appNameEl.value   = data.appName   || '';
            addressEl.value   = data.address   || '';
            parcelIdEl.value  = data.parcelId  || '';
            cityStateEl.value = data.cityState || '';
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }

    loadLlmSettings();
    loadFoursquareSettings();
}

/**
 * Save settings to Firestore using merge so other future fields are preserved.
 */
async function saveSettings() {
    var saveBtn     = document.getElementById('settingsSaveBtn');
    var savedMsg    = document.getElementById('settingsSavedMsg');
    var appNameEl   = document.getElementById('settingsAppName');
    var addressEl   = document.getElementById('settingsAddress');
    var parcelIdEl  = document.getElementById('settingsParcelId');
    var cityStateEl = document.getElementById('settingsCityState');

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving...';
    savedMsg.classList.add('hidden');

    try {
        var newAppName = appNameEl.value.trim() || 'My House';

        await userCol('settings').doc('main').set({
            appName:   newAppName,
            address:   addressEl.value.trim(),
            parcelId:  parcelIdEl.value.trim(),
            cityState: cityStateEl.value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update the live header immediately without requiring a page reload
        window.appName = newAppName;
        updateHeaderTitle();

        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save Settings';
        savedMsg.classList.remove('hidden');

        // Fade the confirmation out after 2 seconds
        setTimeout(function() {
            savedMsg.classList.add('hidden');
        }, 2000);

    } catch (err) {
        console.error('Error saving settings:', err);
        alert('Error saving settings — please try again.');
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save Settings';
    }
}

// ---------- App Name Init (called once on startup from initApp) ----------

/**
 * Load appName from Firestore on app init and cache it in window.appName.
 * Falls back to 'My House' if the setting has never been saved.
 * Returns a Promise so initApp() can wait for it before routing.
 */
async function initAppName() {
    try {
        var doc = await userCol('settings').doc('main').get();
        window.appName = (doc.exists && doc.data().appName)
            ? doc.data().appName
            : 'My House';
    } catch (e) {
        window.appName = 'My House';
    }
    updateHeaderTitle();
}

/**
 * Update the header title link to reflect the current window.appName.
 * Only replaces the header content when it is showing the simple home-link
 * (i.e. a top-level page is active). Breadcrumb pages write their own richer
 * header HTML and must not be overwritten.
 */
function updateHeaderTitle() {
    var el = document.getElementById('headerTitle');
    if (!el) return;
    // Check for the plain home-link without any breadcrumb separator
    if (el.querySelector('a.home-link') && !el.querySelector('.header-zone-sep')) {
        el.innerHTML = '<a href="#main" class="home-link">' +
            escapeHtml(window.appName || 'My House') + '</a>';
    }
}

// ============================================================
// Backup & Restore Page
// ============================================================

/**
 * Called by app.js when routing to #backup.
 * Refreshes the "last backup" timestamp shown on the page.
 */
function loadBackupPage() {
    backupLoadLastMsg();
}

// ============================================================
// Backup
// ============================================================

// Collections included in the DATA backup (everything except photos)
var BACKUP_DATA_COLLECTIONS = [
    'activities', 'breakerPanels', 'calendarEvents', 'chemicals',
    'collections', 'collectionItems',
    'facts', 'floorPlans', 'floors', 'garageRooms', 'garageSubThings', 'garageThings',
    'gpsShapes', 'journalCategories', 'journalEntries', 'journalTrackingItems',
    'mileageLogs', 'plants',
    'problems', 'projects', 'rooms', 'savedActions', 'settings',
    'structures', 'structureSubThings', 'structureThings',
    'people', 'peopleCategories', 'peopleImportantDates', 'peopleInteractions',
    'subThings', 'tags', 'things', 'vehicles', 'weeds', 'zones'
];

/**
 * Build a timestamp string for the filename: YYYY-MM-DD_HHmm
 */
function backupTimestamp() {
    var now = new Date();
    var pad = function(n) { return String(n).padStart(2, '0'); };
    return now.getFullYear() + '-' +
           pad(now.getMonth() + 1) + '-' +
           pad(now.getDate()) + '_' +
           pad(now.getHours()) +
           pad(now.getMinutes());
}

/**
 * Read all documents from a list of user collections and return as
 * a plain object: { collectionName: [ { id, data }, ... ], ... }
 */
async function backupReadCollections(collectionNames) {
    var result = {};
    for (var i = 0; i < collectionNames.length; i++) {
        var name = collectionNames[i];
        var snap = await userCol(name).get();
        result[name] = [];
        snap.forEach(function(doc) {
            // Convert Firestore Timestamps to ISO strings so JSON.stringify works
            var raw  = doc.data();
            var data = backupSerialize(raw);
            result[name].push({ id: doc.id, data: data });
        });
    }
    return result;
}

/**
 * Recursively convert Firestore Timestamps → ISO strings so the
 * object can be safely JSON-serialized.
 */
function backupSerialize(obj) {
    if (obj === null || obj === undefined) return obj;
    if (obj.toDate && typeof obj.toDate === 'function') {
        // Firestore Timestamp
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(backupSerialize);
    }
    if (typeof obj === 'object') {
        var out = {};
        Object.keys(obj).forEach(function(k) {
            out[k] = backupSerialize(obj[k]);
        });
        return out;
    }
    return obj;
}

/**
 * Trigger a browser download of a JSON object as a .json file.
 */
function backupDownload(filename, payload) {
    var json = JSON.stringify(payload, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Main backup handler — reads collections and triggers downloads.
 */
async function runBackup() {
    var btn        = document.getElementById('backupBtn');
    var statusMsg  = document.getElementById('backupStatusMsg');
    var withPhotos = document.getElementById('backupPhotosToggle').checked;
    var appName    = (window.appName || 'Bishop').replace(/\s+/g, '_');
    var ts         = backupTimestamp();

    btn.disabled    = true;
    btn.textContent = 'Preparing\u2026';
    statusMsg.textContent = '';
    statusMsg.classList.remove('hidden');

    try {
        // ---- Data file ----
        statusMsg.textContent = 'Reading data\u2026';
        var dataCollections = await backupReadCollections(BACKUP_DATA_COLLECTIONS);
        var dataPayload = {
            version    : 1,
            type       : 'data',
            exportedAt : new Date().toISOString(),
            appName    : window.appName || 'Bishop',
            collections: dataCollections
        };
        backupDownload(appName + '_Data_' + ts + '.json', dataPayload);

        // ---- Photos file (optional) ----
        if (withPhotos) {
            statusMsg.textContent = 'Reading photos\u2026';
            var photoCollections = await backupReadCollections(['photos']);
            var photoPayload = {
                version    : 1,
                type       : 'photos',
                exportedAt : new Date().toISOString(),
                appName    : window.appName || 'Bishop',
                collections: photoCollections
            };
            backupDownload(appName + '_Photos_' + ts + '.json', photoPayload);
        }

        // ---- Done ----
        var photoCount = withPhotos
            ? (dataCollections ? 0 : 0)  // photos counted separately
            : 0;
        statusMsg.textContent = withPhotos
            ? '\u2713 Data and photos files downloaded'
            : '\u2713 Data file downloaded';

        // Record last backup time in localStorage
        var lastBackupStr = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
        localStorage.setItem('lastBackup', lastBackupStr);
        document.getElementById('backupLastMsg').textContent =
            'Last backup: ' + lastBackupStr;

    } catch (err) {
        console.error('Backup error:', err);
        statusMsg.textContent = 'Error: ' + err.message;
        statusMsg.style.color = '#c62828';
    } finally {
        btn.disabled    = false;
        btn.textContent = '\u2B07 Download Backup';
    }
}

/**
 * Show the last backup timestamp from localStorage when the settings
 * page loads.
 */
function backupLoadLastMsg() {
    var last = localStorage.getItem('lastBackup');
    var el   = document.getElementById('backupLastMsg');
    if (el) {
        el.textContent = last ? 'Last backup: ' + last : 'Last backup: never';
    }
}

// ============================================================
// Restore
// ============================================================

/**
 * Log a line to the restore progress area.
 */
function restoreLog(msg, cls) {
    var log  = document.getElementById('restoreLog');
    var line = document.createElement('div');
    line.textContent = msg;
    if (cls) line.style.color = cls;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

/**
 * Update the progress bar fill (0–100).
 */
function restoreSetProgress(pct) {
    document.getElementById('restoreProgressFill').style.width = pct + '%';
}

/**
 * Delete all documents in a user collection in batches of 400.
 */
async function restoreDeleteCollection(colName) {
    var snap = await userCol(colName).get();
    if (snap.empty) return;
    var docs   = snap.docs;
    var i      = 0;
    while (i < docs.length) {
        var batch = db.batch();
        var chunk = docs.slice(i, i + 400);
        chunk.forEach(function(d) { batch.delete(userCol(colName).doc(d.id)); });
        await batch.commit();
        i += 400;
    }
}

/**
 * Write documents from a backup collection array in batches of 400.
 * Each entry is { id, data }.
 */
async function restoreWriteCollection(colName, docs) {
    var i = 0;
    while (i < docs.length) {
        var batch = db.batch();
        var chunk = docs.slice(i, i + 400);
        chunk.forEach(function(entry) {
            batch.set(userCol(colName).doc(entry.id), entry.data);
        });
        await batch.commit();
        i += 400;
    }
}

/**
 * Core restore: given a parsed backup payload, wipe + rewrite each collection.
 */
async function runRestore(payload) {
    var collections = Object.keys(payload.collections);
    var total       = collections.length;
    var progress    = document.getElementById('restoreProgress');
    var log         = document.getElementById('restoreLog');

    // Show progress area
    log.innerHTML = '';
    restoreSetProgress(0);
    progress.classList.remove('hidden');

    restoreLog('Starting restore of ' + total + ' collection(s)\u2026');

    for (var i = 0; i < collections.length; i++) {
        var name = collections[i];
        var docs = payload.collections[name];
        restoreLog('\u2192 ' + name + ': deleting existing\u2026');
        await restoreDeleteCollection(name);
        restoreLog('\u2192 ' + name + ': writing ' + docs.length + ' document(s)\u2026');
        await restoreWriteCollection(name, docs);
        restoreLog('\u2713 ' + name + ' done (' + docs.length + ')', '#2e7d32');
        restoreSetProgress(Math.round(((i + 1) / total) * 100));
    }

    restoreLog('\n\u2705 Restore complete!', '#2e7d32');
    restoreSetProgress(100);
}

/**
 * Handle a file selected for restore.
 * Validates the JSON, shows confirmation, then runs restore.
 * @param {File}   file       - The selected .json file
 * @param {string} expectType - 'data' or 'photos'
 */
function handleRestoreFile(file, expectType) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var payload;
        try {
            payload = JSON.parse(e.target.result);
        } catch (err) {
            alert('Invalid file — could not parse JSON.');
            return;
        }

        // Validate
        if (!payload.version || !payload.type || !payload.collections) {
            alert('This does not look like a Bishop backup file.');
            return;
        }
        if (payload.type !== expectType) {
            alert('Wrong file type. Expected a "' + expectType + '" backup file but got "' + payload.type + '".');
            return;
        }

        // Show confirmation — user must type RESTORE
        var exportedAt = payload.exportedAt
            ? new Date(payload.exportedAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit'
              })
            : 'unknown date';

        var msg = 'This will REPLACE all current ' + expectType + ' with the backup from ' +
                  exportedAt + '.\n\nThis cannot be undone.\n\nType RESTORE to confirm:';
        var answer = prompt(msg);
        if (answer !== 'RESTORE') {
            alert('Restore cancelled — you must type RESTORE exactly.');
            return;
        }

        // Disable both restore buttons during operation
        document.getElementById('restoreDataBtn').disabled   = true;
        document.getElementById('restorePhotosBtn').disabled = true;

        runRestore(payload)
            .catch(function(err) {
                restoreLog('ERROR: ' + err.message, '#c62828');
                console.error('Restore error:', err);
            })
            .finally(function() {
                document.getElementById('restoreDataBtn').disabled   = false;
                document.getElementById('restorePhotosBtn').disabled = false;
            });
    };
    reader.readAsText(file);
}

// ============================================================
// LLM Settings
// ============================================================

/**
 * Show or hide the model picker depending on the selected provider.
 * Only OpenAI has a model choice right now.
 * Also updates the Help button state.
 */
function updateLlmModelVisibility() {
    var provider = document.getElementById('llmProvider').value;
    var modelGroup = document.getElementById('llmModelGroup');
    if (provider === 'openai') {
        modelGroup.classList.remove('hidden');
    } else {
        modelGroup.classList.add('hidden');
    }
    updateLlmHelpBtn();
}

/**
 * Update the LLM Help button text and enabled state based on the selected provider.
 * If no provider is selected, the button is disabled and says "Select an LLM first".
 */
function updateLlmHelpBtn() {
    var provider = document.getElementById('llmProvider').value;
    var btn = document.getElementById('llmHelpBtn');
    if (!btn) return;
    if (!provider) {
        btn.textContent = 'Select an LLM first';
        btn.disabled = true;
    } else {
        btn.textContent = 'Help';
        btn.disabled = false;
    }
}

/**
 * Open the LLM help modal showing only the relevant provider's instructions.
 */
function openLlmHelp() {
    var provider = document.getElementById('llmProvider').value;
    document.getElementById('llmHelpOpenAI').style.display = (provider === 'openai') ? '' : 'none';
    document.getElementById('llmHelpGrok').style.display   = (provider === 'grok')   ? '' : 'none';
    document.getElementById('llmHelpModalTitle').textContent =
        provider === 'openai' ? 'How to Get a ChatGPT (OpenAI) API Key'
                              : 'How to Get a Grok (xAI) API Key';
    openModal('llmHelpModal');
}

/**
 * Test the LLM API key by sending "What is 2+2?" and showing the response.
 */
async function testLlmKey() {
    var provider = document.getElementById('llmProvider').value;
    var apiKey   = document.getElementById('llmApiKey').value.trim();

    if (!provider) { alert('Please select an LLM provider first.'); return; }
    if (!apiKey)   { alert('Please enter an API key first.'); return; }

    var btn      = document.getElementById('llmTestBtn');
    var resultEl = document.getElementById('llmTestResult');
    btn.disabled    = true;
    btn.textContent = 'Testing\u2026';
    resultEl.classList.add('hidden');
    resultEl.style.color = '';

    var endpoint, model;
    if (provider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        model    = document.getElementById('llmModel').value || 'gpt-4o-mini';
    } else {
        endpoint = 'https://api.x.ai/v1/chat/completions';
        model    = 'grok-3-mini';
    }

    try {
        var resp = await fetch(endpoint, {
            method : 'POST',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model                : model,
                messages             : [{ role: 'user', content: 'What is 2+2?' }],
                max_completion_tokens: 20
            })
        });

        if (resp.ok) {
            var data   = await resp.json();
            var answer = (data.choices && data.choices[0] && data.choices[0].message)
                ? data.choices[0].message.content.trim()
                : '(no response text)';
            resultEl.textContent = '\u2713 Key works! Response: \u201c' + answer + '\u201d';
            resultEl.style.color = '#2e7d32';
        } else {
            var errData = await resp.json().catch(function() { return {}; });
            var msg = (errData.error && errData.error.message) || resp.statusText;
            resultEl.textContent = '\u2717 Error ' + resp.status + ': ' + msg;
            resultEl.style.color = '#c62828';
        }
    } catch (err) {
        resultEl.textContent = '\u2717 Network error: ' + err.message;
        resultEl.style.color = '#c62828';
    }

    resultEl.classList.remove('hidden');
    btn.disabled    = false;
    btn.textContent = 'Test';
}

/**
 * Test the Foursquare API key by doing a simple nearby search.
 * Uses a hardcoded location (NYC) so GPS is not required.
 */
async function testFoursquareKey() {
    var apiKey = document.getElementById('foursquareApiKey').value.trim();
    if (!apiKey) { alert('Please enter your Foursquare API key first.'); return; }

    var btn      = document.getElementById('foursquareTestBtn');
    var resultEl = document.getElementById('foursquareTestResult');
    btn.disabled    = true;
    btn.textContent = 'Testing\u2026';
    resultEl.classList.add('hidden');
    resultEl.style.color = '';

    try {
        var resp = await fetch(
            'https://api.foursquare.com/v3/places/search?query=coffee&ll=40.7128,-74.0060&limit=1',
            { headers: { 'Authorization': apiKey, 'Accept': 'application/json' } }
        );

        if (resp.ok) {
            var data  = await resp.json();
            var count = (data.results && data.results.length) || 0;
            var name  = (count > 0 && data.results[0].name) ? data.results[0].name : '';
            resultEl.textContent = '\u2713 Key works!' + (name ? ' Found: ' + name : '');
            resultEl.style.color = '#2e7d32';
        } else {
            var errText = await resp.text().catch(function() { return ''; });
            var errMsg;
            try {
                var errData = JSON.parse(errText);
                errMsg = errData.message || errData.error || errText;
            } catch (e) {
                errMsg = errText || resp.statusText || '(no details)';
            }
            resultEl.textContent = '\u2717 Error ' + resp.status + ': ' + errMsg;
            resultEl.style.color = '#c62828';
        }
    } catch (err) {
        resultEl.textContent = '\u2717 Network error: ' + err.message;
        resultEl.style.color = '#c62828';
    }

    resultEl.classList.remove('hidden');
    btn.disabled    = false;
    btn.textContent = 'Test';
}

/**
 * Load LLM provider + API key + model from Firestore and populate the form.
 */
async function loadLlmSettings() {
    try {
        var doc = await userCol('settings').doc('llm').get();
        if (doc.exists) {
            var d = doc.data();
            document.getElementById('llmProvider').value = d.provider || '';
            document.getElementById('llmApiKey').value   = d.apiKey   || '';
            if (d.model) {
                document.getElementById('llmModel').value = d.model;
            }
            updateLlmModelVisibility(); // also calls updateLlmHelpBtn
        }
    } catch (err) {
        console.error('Error loading LLM settings:', err);
    }
    updateLlmHelpBtn(); // ensure button reflects state even if no saved settings
}

/**
 * Save LLM provider + API key to Firestore.
 */
async function saveLlmSettings() {
    var saveBtn   = document.getElementById('llmSaveBtn');
    var savedMsg  = document.getElementById('llmSavedMsg');
    var provider  = document.getElementById('llmProvider').value;
    var apiKey    = document.getElementById('llmApiKey').value.trim();
    var model     = (provider === 'openai')
                        ? document.getElementById('llmModel').value
                        : '';   // Grok has only one model; leave blank to use default

    if (!provider) {
        alert('Please select an LLM provider.');
        return;
    }
    if (!apiKey) {
        alert('Please enter your API key.');
        return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving\u2026';
    savedMsg.classList.add('hidden');

    try {
        await userCol('settings').doc('llm').set({
            provider  : provider,
            apiKey    : apiKey,
            model     : model,
            updatedAt : firebase.firestore.FieldValue.serverTimestamp()
        });

        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save AI Settings';
        savedMsg.classList.remove('hidden');
        setTimeout(function() { savedMsg.classList.add('hidden'); }, 2000);

    } catch (err) {
        console.error('Error saving LLM settings:', err);
        alert('Error saving AI settings — please try again.');
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save AI Settings';
    }
}

// ---------- Foursquare API Key ----------

/**
 * Load the Foursquare API key from Firestore and populate the field.
 * Stored alongside the LLM key in userCol('settings').doc('llm').
 */
async function loadFoursquareSettings() {
    try {
        var doc = await userCol('settings').doc('llm').get();
        if (doc.exists && doc.data().foursquareApiKey) {
            document.getElementById('foursquareApiKey').value = doc.data().foursquareApiKey;
        }
    } catch (err) {
        console.error('Error loading Foursquare settings:', err);
    }
}

/**
 * Save the Foursquare API key to Firestore (merge so LLM key is preserved).
 */
async function saveFoursquareSettings() {
    var saveBtn  = document.getElementById('foursquareSaveBtn');
    var savedMsg = document.getElementById('foursquareSavedMsg');
    var apiKey   = document.getElementById('foursquareApiKey').value.trim();

    if (!apiKey) {
        alert('Please paste your Foursquare API key before saving.');
        return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving\u2026';
    savedMsg.classList.add('hidden');

    try {
        await userCol('settings').doc('llm').set(
            { foursquareApiKey: apiKey, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save Places Key';
        savedMsg.classList.remove('hidden');
        setTimeout(function() { savedMsg.classList.add('hidden'); }, 2000);
    } catch (err) {
        console.error('Error saving Foursquare key:', err);
        alert('Error saving key — please try again.');
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save Places Key';
    }
}

// ---------- Button Wire-Up ----------

document.getElementById('settingsSaveBtn').addEventListener('click', saveSettings);
document.getElementById('backupBtn').addEventListener('click', runBackup);
document.getElementById('llmSaveBtn').addEventListener('click', saveLlmSettings);
document.getElementById('llmProvider').addEventListener('change', updateLlmModelVisibility);
document.getElementById('foursquareSaveBtn').addEventListener('click', saveFoursquareSettings);
document.getElementById('foursquareTestBtn').addEventListener('click', testFoursquareKey);
document.getElementById('foursquareHelpBtn').addEventListener('click', function() {
    openModal('foursquareHelpModal');
});
document.getElementById('llmHelpBtn').addEventListener('click', openLlmHelp);
document.getElementById('llmTestBtn').addEventListener('click', testLlmKey);

// Show/hide toggle for the LLM API key field
document.getElementById('llmApiKeyToggle').addEventListener('click', function() {
    var input = document.getElementById('llmApiKey');
    if (input.type === 'password') {
        input.type        = 'text';
        this.textContent  = 'Hide';
    } else {
        input.type        = 'password';
        this.textContent  = 'Show';
    }
});

// Show/hide toggle for the Foursquare API key field
document.getElementById('foursquareApiKeyToggle').addEventListener('click', function() {
    var input = document.getElementById('foursquareApiKey');
    if (input.type === 'password') {
        input.type        = 'text';
        this.textContent  = 'Hide';
    } else {
        input.type        = 'password';
        this.textContent  = 'Show';
    }
});

// Restore — data
document.getElementById('restoreDataBtn').addEventListener('click', function() {
    document.getElementById('restoreDataFile').value = '';
    document.getElementById('restoreDataFile').click();
});
document.getElementById('restoreDataFile').addEventListener('change', function() {
    if (this.files && this.files[0]) handleRestoreFile(this.files[0], 'data');
});

// Restore — photos
document.getElementById('restorePhotosBtn').addEventListener('click', function() {
    document.getElementById('restorePhotosFile').value = '';
    document.getElementById('restorePhotosFile').click();
});
document.getElementById('restorePhotosFile').addEventListener('change', function() {
    if (this.files && this.files[0]) handleRestoreFile(this.files[0], 'photos');
});
