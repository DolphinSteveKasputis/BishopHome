// ============================================================
// Settings.js — App settings page
// Loads and saves settings from Firestore collection 'settings',
// document 'main'. Fields: appName, address, parcelId.
// ============================================================

/**
 * Load settings from Firestore and populate the form fields.
 * Called by app.js when routing to #settings.
 */
async function loadSettingsPage() {
    var appNameEl  = document.getElementById('settingsAppName');
    var addressEl  = document.getElementById('settingsAddress');
    var parcelIdEl = document.getElementById('settingsParcelId');
    var savedMsg   = document.getElementById('settingsSavedMsg');
    backupLoadLastMsg();  // show last backup timestamp

    // Clear form while loading
    appNameEl.value  = '';
    addressEl.value  = '';
    parcelIdEl.value = '';
    savedMsg.classList.add('hidden');

    try {
        var doc = await userCol('settings').doc('main').get();
        if (doc.exists) {
            var data         = doc.data();
            appNameEl.value  = data.appName  || '';
            addressEl.value  = data.address  || '';
            parcelIdEl.value = data.parcelId || '';
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }

    loadLlmSettings();
}

/**
 * Save settings to Firestore using merge so other future fields are preserved.
 */
async function saveSettings() {
    var saveBtn    = document.getElementById('settingsSaveBtn');
    var savedMsg   = document.getElementById('settingsSavedMsg');
    var appNameEl  = document.getElementById('settingsAppName');
    var addressEl  = document.getElementById('settingsAddress');
    var parcelIdEl = document.getElementById('settingsParcelId');

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving...';
    savedMsg.classList.add('hidden');

    try {
        var newAppName = appNameEl.value.trim() || 'My House';

        await userCol('settings').doc('main').set({
            appName:   newAppName,
            address:   addressEl.value.trim(),
            parcelId:  parcelIdEl.value.trim(),
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
// Backup
// ============================================================

// Collections included in the DATA backup (everything except photos)
var BACKUP_DATA_COLLECTIONS = [
    'activities', 'breakerPanels', 'calendarEvents', 'chemicals',
    'facts', 'floorPlans', 'floors', 'gpsShapes', 'plants',
    'problems', 'projects', 'rooms', 'savedActions', 'settings',
    'subThings', 'tags', 'things', 'weeds', 'zones'
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
 */
function updateLlmModelVisibility() {
    var provider = document.getElementById('llmProvider').value;
    var modelGroup = document.getElementById('llmModelGroup');
    if (provider === 'openai') {
        modelGroup.classList.remove('hidden');
    } else {
        modelGroup.classList.add('hidden');
    }
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
            updateLlmModelVisibility();
        }
    } catch (err) {
        console.error('Error loading LLM settings:', err);
    }
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

// ---------- Button Wire-Up ----------

document.getElementById('settingsSaveBtn').addEventListener('click', saveSettings);
document.getElementById('backupBtn').addEventListener('click', runBackup);
document.getElementById('llmSaveBtn').addEventListener('click', saveLlmSettings);
document.getElementById('llmProvider').addEventListener('change', updateLlmModelVisibility);

// Show/hide toggle for the API key field
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
