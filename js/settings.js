// ============================================================
// Settings.js — App settings page
// Loads and saves settings from Firestore collection 'settings',
// document 'main'. Fields: address, parcelId.
// ============================================================

/**
 * Load settings from Firestore and populate the form fields.
 * Called by app.js when routing to #settings.
 */
async function loadSettingsPage() {
    var addressEl  = document.getElementById('settingsAddress');
    var parcelIdEl = document.getElementById('settingsParcelId');
    var savedMsg   = document.getElementById('settingsSavedMsg');

    // Clear form while loading
    addressEl.value  = '';
    parcelIdEl.value = '';
    savedMsg.classList.add('hidden');

    try {
        var doc = await db.collection('settings').doc('main').get();
        if (doc.exists) {
            var data       = doc.data();
            addressEl.value  = data.address  || '';
            parcelIdEl.value = data.parcelId || '';
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
}

/**
 * Save settings to Firestore using merge so other future fields are preserved.
 */
async function saveSettings() {
    var saveBtn    = document.getElementById('settingsSaveBtn');
    var savedMsg   = document.getElementById('settingsSavedMsg');
    var addressEl  = document.getElementById('settingsAddress');
    var parcelIdEl = document.getElementById('settingsParcelId');

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving...';
    savedMsg.classList.add('hidden');

    try {
        await db.collection('settings').doc('main').set({
            address:   addressEl.value.trim(),
            parcelId:  parcelIdEl.value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

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

// ---------- Button Wire-Up ----------

document.getElementById('settingsSaveBtn').addEventListener('click', saveSettings);
