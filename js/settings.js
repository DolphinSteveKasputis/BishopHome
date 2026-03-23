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

    // Clear form while loading
    appNameEl.value  = '';
    addressEl.value  = '';
    parcelIdEl.value = '';
    savedMsg.classList.add('hidden');

    try {
        var doc = await db.collection('settings').doc('main').get();
        if (doc.exists) {
            var data         = doc.data();
            appNameEl.value  = data.appName  || '';
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
    var appNameEl  = document.getElementById('settingsAppName');
    var addressEl  = document.getElementById('settingsAddress');
    var parcelIdEl = document.getElementById('settingsParcelId');

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving...';
    savedMsg.classList.add('hidden');

    try {
        var newAppName = appNameEl.value.trim() || 'My House';

        await db.collection('settings').doc('main').set({
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
        var doc = await db.collection('settings').doc('main').get();
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

// ---------- Button Wire-Up ----------

document.getElementById('settingsSaveBtn').addEventListener('click', saveSettings);
