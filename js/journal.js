// ============================================================
// Journal.js — Life / Journal feature
// Handles journal entries, tracking items, and categories.
//
// Firestore collections (all via userCol()):
//   journalEntries       — date, entryText, createdAt, updatedAt
//   journalTrackingItems — date, category, value, createdAt, updatedAt
//   journalCategories    — name, createdAt
// ============================================================

// ---------- Global State ----------

/** The journal entry currently being edited (or null when adding). */
window.currentJournalEntry = null;

/** The tracking item currently being edited (or null when adding). */
window.currentTrackingItem = null;

/** True when the journal-entry page is in edit mode. */
window.journalEditMode = false;

/** True when the journal-tracking page is in edit mode. */
window.journalTrackingEditMode = false;

/** Cached list of tracking categories: [{id, name}, ...] */
window.journalCategories = [];


// ============================================================
// Utility: format a Date object as YYYY-MM-DD (local time)
// (We use a local version so we never have UTC-offset surprises.)
// ============================================================
function journalFormatDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

/**
 * Format a YYYY-MM-DD string as "Monday, March 24, 2026" for display.
 * We parse the date manually to avoid timezone-shift issues.
 */
function journalFormatDateHeader(yyyyMmDd) {
    var parts = yyyyMmDd.split('-');
    // Use noon local time to avoid DST edge cases
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Format a Firestore Timestamp (or JS Date) as "7:02 AM".
 * @param {object|Date} ts - A Firestore Timestamp or JS Date
 */
function journalFormatTime(ts) {
    if (!ts) return '';
    var d = (ts.toDate) ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Escape HTML special characters to safely insert text into the DOM.
 * Uses the same escapeHtml() that zones.js defines globally, but we
 * guard with a fallback in case load order varies.
 */
function journalEscape(str) {
    if (typeof escapeHtml === 'function') return escapeHtml(str);
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}


// ============================================================
// Life Landing Page
// ============================================================

/**
 * Render the Life landing page.
 * Currently just shows the Journal tile — no Firestore needed.
 * Called by app.js when routing to #life.
 */
function loadLifePage() {
    // Nothing dynamic to load — the tile links are static HTML.
    // This function is a hook for future Life features.
}


// ============================================================
// Journal Main Page  (#journal)
// ============================================================

/**
 * Load the main journal page.
 * Restores the sticky date-range preference from Firestore, then
 * loads and renders journal data.
 * Called by app.js when routing to #journal.
 */
async function loadJournalPage() {
    // Wire up toolbar buttons (safe to call each time — replaces listeners)
    _journalWireToolbar();

    // Restore saved date range preference
    try {
        var settingDoc = await userCol('settings').doc('journal').get();
        if (settingDoc.exists) {
            var savedRange = settingDoc.data().defaultDateRange || '7';
            var sel = document.getElementById('journalRangeSelect');
            if (sel) sel.value = savedRange;
        }
    } catch (e) {
        // Non-fatal — just use the default dropdown value
        console.warn('Could not load journal range preference:', e);
    }

    // Show/hide custom range inputs based on current selection
    _journalToggleCustomRange();

    // Load and render the feed
    await loadJournalData();
}

/**
 * Wire all toolbar button click handlers.
 * Called each time the journal page loads so handlers are always fresh.
 */
function _journalWireToolbar() {
    var rangeSelect = document.getElementById('journalRangeSelect');
    if (rangeSelect) {
        rangeSelect.onchange = function() {
            _journalToggleCustomRange();
            if (rangeSelect.value !== 'custom') {
                saveJournalRangePreference(rangeSelect.value);
                loadJournalData();
            }
        };
    }

    var applyBtn = document.getElementById('journalCustomApplyBtn');
    if (applyBtn) {
        applyBtn.onclick = function() {
            saveJournalRangePreference('custom');
            loadJournalData();
        };
    }

    var goToDateBtn = document.getElementById('journalGoToDateBtn');
    if (goToDateBtn) {
        goToDateBtn.onclick = journalGoToDate;
    }

    var newEntryBtn = document.getElementById('journalNewEntryBtn');
    if (newEntryBtn) {
        newEntryBtn.onclick = openAddJournalEntry;
    }

    var addTrackingBtn = document.getElementById('journalAddTrackingBtn');
    if (addTrackingBtn) {
        addTrackingBtn.onclick = openAddTracking;
    }

    var manageCatsBtn = document.getElementById('journalManageCategoriesBtn');
    if (manageCatsBtn) {
        manageCatsBtn.onclick = function() {
            window.location.hash = '#journal-categories';
        };
    }
}

/**
 * Show or hide the custom date range inputs based on the dropdown value.
 */
function _journalToggleCustomRange() {
    var sel = document.getElementById('journalRangeSelect');
    var customDiv = document.getElementById('journalCustomRange');
    if (!sel || !customDiv) return;
    if (sel.value === 'custom') {
        customDiv.classList.remove('hidden');
    } else {
        customDiv.classList.add('hidden');
    }
}

/**
 * Calculate the from/to date range based on the current toolbar selection.
 * Returns { fromDate: 'YYYY-MM-DD', toDate: 'YYYY-MM-DD' }.
 */
function getJournalDateRange() {
    var sel = document.getElementById('journalRangeSelect');
    var today = new Date();
    var toDate = journalFormatDate(today);
    var fromDate;

    if (sel && sel.value === 'custom') {
        fromDate = document.getElementById('journalFromDate').value;
        toDate   = document.getElementById('journalToDate').value;
    } else {
        var days = parseInt((sel ? sel.value : '7'), 10) || 7;
        var from = new Date(today);
        from.setDate(from.getDate() - days + 1);
        fromDate = journalFormatDate(from);
    }

    return { fromDate: fromDate, toDate: toDate };
}

/**
 * Save the selected date range value to Firestore so it persists.
 * @param {string} value - The range value (e.g. '7', '30', 'custom')
 */
async function saveJournalRangePreference(value) {
    try {
        await userCol('settings').doc('journal').set(
            { defaultDateRange: value },
            { merge: true }
        );
    } catch (e) {
        console.warn('Could not save journal range preference:', e);
    }
}

/**
 * Query journal entries and tracking items for the current date range,
 * merge and group them by date, then render the feed.
 *
 * NOTE: These queries use compound orderBy (date desc + createdAt asc),
 * which requires composite indexes in Firestore.  The first time you run
 * this, Firestore will throw an error with a link to create the index.
 * That link will appear in the browser console — click it to create the
 * index in one step.
 */
async function loadJournalData() {
    var feedEl = document.getElementById('journalFeed');
    if (!feedEl) return;
    feedEl.innerHTML = '<p class="empty-state">Loading...</p>';

    var range = getJournalDateRange();
    if (!range.fromDate || !range.toDate) {
        feedEl.innerHTML = '<p class="empty-state">Please select a valid date range.</p>';
        return;
    }

    try {
        // Run both queries in parallel for speed
        var [entriesSnap, trackingSnap] = await Promise.all([
            userCol('journalEntries')
                .where('date', '>=', range.fromDate)
                .where('date', '<=', range.toDate)
                .orderBy('date', 'desc')
                .orderBy('createdAt', 'asc')
                .get(),
            userCol('journalTrackingItems')
                .where('date', '>=', range.fromDate)
                .where('date', '<=', range.toDate)
                .orderBy('date', 'desc')
                .orderBy('createdAt', 'asc')
                .get()
        ]);

        // Collect all items from both snapshots into a flat array
        var allItems = [];

        entriesSnap.forEach(function(doc) {
            allItems.push({ type: 'entry', id: doc.id, data: doc.data() });
        });

        trackingSnap.forEach(function(doc) {
            allItems.push({ type: 'tracking', id: doc.id, data: doc.data() });
        });

        // Group by date — build a map { 'YYYY-MM-DD': [items...] }
        var dateMap = {};
        allItems.forEach(function(item) {
            var d = item.data.date;
            if (!dateMap[d]) dateMap[d] = [];
            dateMap[d].push(item);
        });

        // Sort dates descending (newest first)
        var sortedDates = Object.keys(dateMap).sort().reverse();

        // Within each date, sort items by createdAt ascending (oldest time first)
        sortedDates.forEach(function(date) {
            dateMap[date].sort(function(a, b) {
                var ta = a.data.createdAt ? a.data.createdAt.toMillis() : 0;
                var tb = b.data.createdAt ? b.data.createdAt.toMillis() : 0;
                return ta - tb;
            });
        });

        // Build grouped structure for the renderer
        var grouped = sortedDates.map(function(date) {
            return { date: date, items: dateMap[date] };
        });

        renderJournalFeed(grouped);

    } catch (err) {
        console.error('Error loading journal data:', err);

        // Firestore composite index errors contain "index" in the message
        // and include a URL to create the index automatically.
        var msg = err.message || String(err);
        if (msg.indexOf('index') !== -1 || msg.indexOf('Index') !== -1) {
            feedEl.innerHTML =
                '<p class="empty-state" style="color:#b91c1c;">' +
                '<strong>Index required</strong> — Firestore needs a composite index for this query. ' +
                'Check the browser console for a link to create it automatically (one click). ' +
                'After creating the index, reload the page.</p>';
        } else {
            feedEl.innerHTML = '<p class="empty-state" style="color:#b91c1c;">Error loading journal data. See console for details.</p>';
        }
    }
}

/**
 * Render the journal feed into #journalFeed.
 * @param {Array} groupedData - Array of { date: 'YYYY-MM-DD', items: [...] }
 */
function renderJournalFeed(groupedData) {
    var feedEl = document.getElementById('journalFeed');
    if (!feedEl) return;

    if (groupedData.length === 0) {
        feedEl.innerHTML = '<p class="empty-state">No entries in this date range. Add your first entry!</p>';
        return;
    }

    var html = '';

    groupedData.forEach(function(group) {
        // Date header — e.g. "Monday, March 24, 2026"
        html += '<div class="journal-date-header" data-journal-date="' + journalEscape(group.date) + '">' +
                    journalFormatDateHeader(group.date) +
                '</div>';

        group.items.forEach(function(item) {
            if (item.type === 'entry') {
                html += _renderEntryCard(item.id, item.data);
            } else if (item.type === 'tracking') {
                html += _renderTrackingCard(item.id, item.data);
            }
        });
    });

    feedEl.innerHTML = html;
}

/**
 * Build the HTML for a single journal entry card.
 */
function _renderEntryCard(id, data) {
    var timeStr = journalFormatTime(data.createdAt);
    var text    = data.entryText || '';

    return '<div class="journal-item journal-item--entry">' +
               '<div class="journal-item-header">' +
                   '<span class="journal-item-time">📝 ' + journalEscape(timeStr) + '</span>' +
                   '<div class="journal-item-actions">' +
                       '<button class="btn btn-secondary btn-small" ' +
                               'onclick="openEditJournalEntry(\'' + id + '\')">Edit</button>' +
                       '<button class="btn btn-danger btn-small" ' +
                               'onclick="deleteJournalEntry(\'' + id + '\')">Delete</button>' +
                   '</div>' +
               '</div>' +
               '<div class="journal-item-text">' + journalEscape(text) + '</div>' +
           '</div>';
}

/**
 * Build the HTML for a single tracking item card.
 */
function _renderTrackingCard(id, data) {
    var timeStr   = journalFormatTime(data.createdAt);
    var category  = data.category || '';
    var value     = data.value || '';

    return '<div class="journal-item journal-item--tracking">' +
               '<div class="journal-item-header">' +
                   '<span class="journal-item-time">⚖️ ' + journalEscape(timeStr) + '</span>' +
                   '<div class="journal-item-actions">' +
                       '<button class="btn btn-secondary btn-small" ' +
                               'onclick="openEditTrackingItem(\'' + id + '\')">Edit</button>' +
                       '<button class="btn btn-danger btn-small" ' +
                               'onclick="deleteTrackingItem(\'' + id + '\')">Delete</button>' +
                   '</div>' +
               '</div>' +
               '<div>' +
                   '<span class="journal-tracking-category">' + journalEscape(category) + '</span>' +
                   '<span class="journal-tracking-value">' + journalEscape(value) + '</span>' +
               '</div>' +
           '</div>';
}


// ============================================================
// Go to Date
// ============================================================

/**
 * Scroll to the date header matching #journalGoToDateInput.
 * If no entries exist for that date, show a brief message.
 */
function journalGoToDate() {
    var input = document.getElementById('journalGoToDateInput');
    var msgEl = document.getElementById('journalGoToDateMsg');
    if (!input || !input.value) return;

    var dateStr = input.value; // YYYY-MM-DD
    var header = document.querySelector('[data-journal-date="' + dateStr + '"]');

    if (header) {
        header.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (msgEl) msgEl.classList.add('hidden');
    } else {
        if (msgEl) {
            msgEl.textContent = 'No entries for ' + journalFormatDateHeader(dateStr);
            msgEl.classList.remove('hidden');
            // Auto-hide after 3 seconds
            setTimeout(function() {
                msgEl.classList.add('hidden');
            }, 3000);
        }
    }
}


// ============================================================
// Journal Entry — Add / Edit  (#journal-entry full page)
// ============================================================

/**
 * Open the journal entry form in "add" mode.
 * Called by the "New Entry" button.
 */
function openAddJournalEntry() {
    window.journalEditMode = false;
    window.currentJournalEntry = null;

    var titleEl  = document.getElementById('journalEntryPageTitle');
    var dateEl   = document.getElementById('journalEntryDate');
    var textEl   = document.getElementById('journalEntryText');
    var deleteBtn = document.getElementById('journalEntryDeleteBtn');

    if (titleEl)  titleEl.textContent = 'New Journal Entry';
    if (dateEl)   dateEl.value = journalFormatDate(new Date());
    if (textEl)   textEl.value = '';
    if (deleteBtn) deleteBtn.classList.add('hidden');

    // Wire buttons
    _journalWireEntryPage();

    window.location.hash = '#journal-entry';

    // Focus the textarea after navigation settles
    setTimeout(function() {
        var ta = document.getElementById('journalEntryText');
        if (ta) ta.focus();
    }, 100);
}

/**
 * Open the journal entry form in "edit" mode.
 * Loads the entry from Firestore and pre-fills the form.
 * @param {string} id - The Firestore document ID
 */
async function openEditJournalEntry(id) {
    try {
        var doc = await userCol('journalEntries').doc(id).get();
        if (!doc.exists) {
            alert('Entry not found.');
            return;
        }

        var data = doc.data();
        window.currentJournalEntry = { id: id, ...data };
        window.journalEditMode = true;

        var titleEl   = document.getElementById('journalEntryPageTitle');
        var dateEl    = document.getElementById('journalEntryDate');
        var textEl    = document.getElementById('journalEntryText');
        var deleteBtn = document.getElementById('journalEntryDeleteBtn');

        if (titleEl)  titleEl.textContent = 'Edit Journal Entry';
        if (dateEl)   dateEl.value = data.date || '';
        if (textEl)   textEl.value = data.entryText || '';
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        // Wire buttons
        _journalWireEntryPage();

        window.location.hash = '#journal-entry';

        // Focus the textarea after navigation settles
        setTimeout(function() {
            var ta = document.getElementById('journalEntryText');
            if (ta) ta.focus();
        }, 100);

    } catch (err) {
        console.error('Error loading journal entry:', err);
        alert('Error loading entry. See console for details.');
    }
}

/**
 * Wire the Save, Cancel, Delete, and Voice buttons on the entry form.
 * Called every time the entry page opens.
 */
function _journalWireEntryPage() {
    var saveBtn   = document.getElementById('journalEntrySaveBtn');
    var cancelBtn = document.getElementById('journalEntryCancelBtn');
    var deleteBtn = document.getElementById('journalEntryDeleteBtn');

    if (saveBtn)   saveBtn.onclick   = saveJournalEntry;
    if (cancelBtn) cancelBtn.onclick = function() { window.location.hash = '#journal'; };
    if (deleteBtn) deleteBtn.onclick = function() {
        if (window.currentJournalEntry) {
            deleteJournalEntry(window.currentJournalEntry.id);
        }
    };

    // Initialize voice-to-text for the entry textarea
    initVoiceToText('journalEntryText', 'journalVoiceBtn');
}

/**
 * Save the current journal entry (add or edit).
 */
async function saveJournalEntry() {
    var dateEl = document.getElementById('journalEntryDate');
    var textEl = document.getElementById('journalEntryText');
    var saveBtn = document.getElementById('journalEntrySaveBtn');

    var date = dateEl ? dateEl.value.trim() : '';
    var text = textEl ? textEl.value.trim() : '';

    if (!date) {
        alert('Please select a date.');
        return;
    }
    if (!text) {
        alert('Please enter some text for the journal entry.');
        return;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
        if (window.journalEditMode && window.currentJournalEntry) {
            // Update existing entry
            await userCol('journalEntries').doc(window.currentJournalEntry.id).update({
                date:      date,
                entryText: text,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Add new entry
            await userCol('journalEntries').add({
                date:      date,
                entryText: text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        window.location.hash = '#journal';

    } catch (err) {
        console.error('Error saving journal entry:', err);
        alert('Error saving entry. See console for details.');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    }
}

/**
 * Delete a journal entry after confirmation.
 * @param {string} id - The Firestore document ID
 */
async function deleteJournalEntry(id) {
    if (!confirm('Delete this journal entry? This cannot be undone.')) return;

    try {
        await userCol('journalEntries').doc(id).delete();

        // If we're on the entry page, go back to the journal
        if (window.location.hash === '#journal-entry') {
            window.location.hash = '#journal';
        } else {
            // Reload the feed in place
            loadJournalData();
        }
    } catch (err) {
        console.error('Error deleting journal entry:', err);
        alert('Error deleting entry. See console for details.');
    }
}


// ============================================================
// Voice to Text
// ============================================================

/**
 * Initialize voice-to-text for a textarea.
 * Uses the browser's built-in Web Speech API (SpeechRecognition).
 * Works on desktop Chrome and Android Chrome.
 * Hides the button if the browser doesn't support it.
 *
 * @param {string} textareaId - ID of the textarea to append text to
 * @param {string} btnId      - ID of the mic button to toggle
 */
function initVoiceToText(textareaId, btnId) {
    var btn = document.getElementById(btnId);
    if (!btn) return;

    // Check for browser support
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        // Browser doesn't support speech recognition — hide the button
        btn.style.display = 'none';
        return;
    }

    // Show the button (in case it was previously hidden)
    btn.style.display = '';
    btn.textContent = '🎤 Speak';
    btn.classList.remove('journal-voice-active');

    var recognition = new SR();
    recognition.continuous   = true;   // Keep listening until stopped
    recognition.interimResults = false; // Only final results
    recognition.lang = 'en-US';

    var isListening = false;

    btn.onclick = function() {
        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (e) {
                console.warn('Speech recognition start error:', e);
            }
        }
    };

    recognition.onstart = function() {
        isListening = true;
        btn.textContent = '🔴 Listening...';
        btn.classList.add('journal-voice-active');
    };

    recognition.onresult = function(event) {
        var textarea = document.getElementById(textareaId);
        if (!textarea) return;

        // Collect all final results from this recognition session
        var transcript = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                transcript += event.results[i][0].transcript;
            }
        }

        if (transcript) {
            // Append to existing text with a space separator if needed
            var existing = textarea.value;
            if (existing && !existing.endsWith(' ') && !existing.endsWith('\n')) {
                textarea.value = existing + ' ' + transcript;
            } else {
                textarea.value = existing + transcript;
            }
        }
    };

    recognition.onend = function() {
        isListening = false;
        btn.textContent = '🎤 Speak';
        btn.classList.remove('journal-voice-active');
    };

    recognition.onerror = function(event) {
        console.warn('Speech recognition error:', event.error);
        isListening = false;
        btn.textContent = '🎤 Speak';
        btn.classList.remove('journal-voice-active');

        // Show a brief, non-intrusive error message
        if (event.error !== 'no-speech') {
            btn.textContent = '⚠️ Error';
            setTimeout(function() {
                btn.textContent = '🎤 Speak';
            }, 2000);
        }
    };
}


// ============================================================
// Tracking Items — Add / Edit  (#journal-tracking full page)
// ============================================================

/**
 * Load all tracking categories into window.journalCategories.
 * Called before opening the tracking form.
 */
async function loadJournalCategories() {
    try {
        var snap = await userCol('journalCategories').orderBy('name').get();
        window.journalCategories = [];
        snap.forEach(function(doc) {
            window.journalCategories.push({ id: doc.id, name: doc.data().name });
        });
    } catch (err) {
        console.error('Error loading journal categories:', err);
        window.journalCategories = [];
    }
}

/**
 * Open the tracking form in "add" mode.
 * Allows entering multiple category+value rows at once.
 */
async function openAddTracking() {
    window.journalTrackingEditMode = false;
    window.currentTrackingItem = null;

    // Load categories before building the form
    await loadJournalCategories();

    var titleEl    = document.getElementById('journalTrackingPageTitle');
    var dateEl     = document.getElementById('trackingDate');
    var container  = document.getElementById('trackingRowsContainer');
    var deleteBtn  = document.getElementById('trackingDeleteBtn');

    if (titleEl)   titleEl.textContent = 'Add Tracking';
    if (dateEl)    dateEl.value = journalFormatDate(new Date());
    if (container) container.innerHTML = '';
    if (deleteBtn) deleteBtn.classList.add('hidden');

    // Add one blank row to start
    addTrackingRow();

    // Wire page buttons
    _journalWireTrackingPage();

    window.location.hash = '#journal-tracking';
}

/**
 * Open the tracking form in "edit" mode for a single item.
 * Shows one pre-filled row.
 * @param {string} id - Firestore document ID of the tracking item
 */
async function openEditTrackingItem(id) {
    await loadJournalCategories();

    try {
        var doc = await userCol('journalTrackingItems').doc(id).get();
        if (!doc.exists) {
            alert('Tracking item not found.');
            return;
        }

        var data = doc.data();
        window.currentTrackingItem = { id: id, ...data };
        window.journalTrackingEditMode = true;

        var titleEl   = document.getElementById('journalTrackingPageTitle');
        var dateEl    = document.getElementById('trackingDate');
        var container = document.getElementById('trackingRowsContainer');
        var deleteBtn = document.getElementById('trackingDeleteBtn');

        if (titleEl)   titleEl.textContent = 'Edit Tracking Item';
        if (dateEl)    dateEl.value = data.date || journalFormatDate(new Date());
        if (container) container.innerHTML = '';
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        // Add a single pre-filled row
        addTrackingRow(data.category, data.value);

        // Wire page buttons
        _journalWireTrackingPage();

        window.location.hash = '#journal-tracking';

    } catch (err) {
        console.error('Error loading tracking item:', err);
        alert('Error loading tracking item. See console for details.');
    }
}

/**
 * Wire Save, Cancel, Delete, and Add Row buttons on the tracking form.
 */
function _journalWireTrackingPage() {
    var saveBtn       = document.getElementById('trackingSaveBtn');
    var cancelBtn     = document.getElementById('trackingCancelBtn');
    var deleteBtn     = document.getElementById('trackingDeleteBtn');
    var addRowBtn     = document.getElementById('trackingAddRowBtn');
    var addRowSection = document.getElementById('trackingAddRowSection');

    if (saveBtn)   saveBtn.onclick   = saveTracking;
    if (cancelBtn) cancelBtn.onclick = function() { window.location.hash = '#journal'; };
    if (deleteBtn) deleteBtn.onclick = function() {
        if (window.currentTrackingItem) {
            deleteTrackingItem(window.currentTrackingItem.id);
        }
    };

    // Hide "Add Row" button in edit mode (only one row)
    if (addRowSection) {
        addRowSection.style.display = window.journalTrackingEditMode ? 'none' : '';
    }
    if (addRowBtn) {
        addRowBtn.onclick = function() { addTrackingRow(); };
    }
}

/**
 * Append a new tracking row to #trackingRowsContainer.
 * Each row has: category dropdown, value input, remove button.
 *
 * @param {string} [preCategory] - Pre-select this category (for edit mode)
 * @param {string} [preValue]    - Pre-fill this value (for edit mode)
 */
function addTrackingRow(preCategory, preValue) {
    var container = document.getElementById('trackingRowsContainer');
    if (!container) return;

    var rowIndex = container.children.length;
    var rowId = 'trackingRow_' + Date.now() + '_' + rowIndex;

    // Build options for the category dropdown
    var optionsHtml = '<option value="">-- Select category --</option>';
    (window.journalCategories || []).forEach(function(cat) {
        var sel = (preCategory && cat.name === preCategory) ? ' selected' : '';
        optionsHtml += '<option value="' + journalEscape(cat.name) + '"' + sel + '>' +
                       journalEscape(cat.name) + '</option>';
    });
    optionsHtml += '<option value="__new__">New...</option>';

    var row = document.createElement('div');
    row.className = 'tracking-row';
    row.id = rowId;
    row.innerHTML =
        '<select class="tracking-cat-select" onchange="_trackingCatChanged(this)">' +
            optionsHtml +
        '</select>' +
        '<input type="text" class="tracking-new-cat-input hidden" placeholder="New category name">' +
        '<input type="text" class="tracking-value-input" placeholder="Value" value="' +
            journalEscape(preValue || '') + '">' +
        '<button type="button" class="tracking-row-remove" ' +
                'onclick="_removeTrackingRow(this)" title="Remove row">✕</button>';

    container.appendChild(row);

    // Update remove button visibility (hide if only 1 row)
    _updateTrackingRowRemoveBtns();
}

/**
 * Show or hide the "New category" text input when "New..." is selected.
 * @param {HTMLSelectElement} selectEl
 */
function _trackingCatChanged(selectEl) {
    var row = selectEl.closest('.tracking-row');
    var newInput = row.querySelector('.tracking-new-cat-input');
    if (selectEl.value === '__new__') {
        newInput.classList.remove('hidden');
        newInput.focus();
    } else {
        newInput.classList.add('hidden');
        newInput.value = '';
    }
}

/**
 * Remove a tracking row from the form.
 * @param {HTMLButtonElement} btn - The remove button that was clicked
 */
function _removeTrackingRow(btn) {
    var row = btn.closest('.tracking-row');
    if (row) row.remove();
    _updateTrackingRowRemoveBtns();
}

/**
 * Hide the remove button when there is only one row left
 * (so the user can't accidentally remove all rows).
 */
function _updateTrackingRowRemoveBtns() {
    var container = document.getElementById('trackingRowsContainer');
    if (!container) return;
    var rows = container.querySelectorAll('.tracking-row');
    rows.forEach(function(row, idx) {
        var btn = row.querySelector('.tracking-row-remove');
        if (btn) btn.style.visibility = (rows.length === 1) ? 'hidden' : 'visible';
    });
}

/**
 * Save all tracking rows (add mode) or update one row (edit mode).
 */
async function saveTracking() {
    var dateEl    = document.getElementById('trackingDate');
    var container = document.getElementById('trackingRowsContainer');
    var saveBtn   = document.getElementById('trackingSaveBtn');

    var date = dateEl ? dateEl.value.trim() : '';
    if (!date) {
        alert('Please select a date.');
        return;
    }

    // Collect rows
    var rows = container ? container.querySelectorAll('.tracking-row') : [];
    var itemsToSave = [];

    for (var i = 0; i < rows.length; i++) {
        var row      = rows[i];
        var catSel   = row.querySelector('.tracking-cat-select');
        var newCatIn = row.querySelector('.tracking-new-cat-input');
        var valIn    = row.querySelector('.tracking-value-input');

        var catName  = '';
        var value    = valIn ? valIn.value.trim() : '';

        if (catSel && catSel.value === '__new__') {
            // User typed a new category name
            catName = newCatIn ? newCatIn.value.trim() : '';
        } else {
            catName = catSel ? catSel.value.trim() : '';
        }

        // Skip rows where both category and value are empty
        if (!catName && !value) continue;

        itemsToSave.push({ catName: catName, isNew: catSel && catSel.value === '__new__', value: value });
    }

    if (itemsToSave.length === 0) {
        alert('Please enter at least one tracking item.');
        return;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
        // Save any newly created categories first
        for (var j = 0; j < itemsToSave.length; j++) {
            var item = itemsToSave[j];
            if (item.isNew && item.catName) {
                // Check if category already exists (may have been typed as duplicate)
                var exists = window.journalCategories.some(function(c) {
                    return c.name.toLowerCase() === item.catName.toLowerCase();
                });
                if (!exists) {
                    var newDoc = await userCol('journalCategories').add({
                        name:      item.catName,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    window.journalCategories.push({ id: newDoc.id, name: item.catName });
                }
            }
        }

        if (window.journalTrackingEditMode && window.currentTrackingItem) {
            // Edit mode — update single doc
            var single = itemsToSave[0];
            await userCol('journalTrackingItems').doc(window.currentTrackingItem.id).update({
                date:      date,
                category:  single.catName,
                value:     single.value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Add mode — save each row as a separate doc
            var savePromises = itemsToSave.map(function(item) {
                return userCol('journalTrackingItems').add({
                    date:      date,
                    category:  item.catName,
                    value:     item.value,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            await Promise.all(savePromises);
        }

        window.location.hash = '#journal';

    } catch (err) {
        console.error('Error saving tracking items:', err);
        alert('Error saving tracking items. See console for details.');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    }
}

/**
 * Delete a tracking item after confirmation.
 * @param {string} id - Firestore document ID
 */
async function deleteTrackingItem(id) {
    if (!confirm('Delete this tracking item? This cannot be undone.')) return;

    try {
        await userCol('journalTrackingItems').doc(id).delete();

        if (window.location.hash === '#journal-tracking') {
            window.location.hash = '#journal';
        } else {
            loadJournalData();
        }
    } catch (err) {
        console.error('Error deleting tracking item:', err);
        alert('Error deleting tracking item. See console for details.');
    }
}


// ============================================================
// Categories Management  (#journal-categories full page)
// ============================================================

/**
 * Load and render the categories management page.
 * Called by app.js when routing to #journal-categories.
 */
async function loadJournalCategoriesPage() {
    var listEl = document.getElementById('journalCategoriesList');
    if (listEl) listEl.innerHTML = '<p class="empty-state">Loading...</p>';

    // Wire the Add Category button
    var addBtn = document.getElementById('journalCategoryAddBtn');
    if (addBtn) {
        addBtn.onclick = function() {
            var form = document.getElementById('journalAddCategoryForm');
            var input = document.getElementById('journalNewCategoryInput');
            if (form) {
                form.style.display = 'flex';
                form.classList.remove('hidden');
            }
            if (input) { input.value = ''; input.focus(); }
        };
    }

    var saveNewBtn = document.getElementById('journalNewCategorySaveBtn');
    if (saveNewBtn) {
        saveNewBtn.onclick = function() {
            var input = document.getElementById('journalNewCategoryInput');
            var name = input ? input.value.trim() : '';
            if (name) addJournalCategory(name);
        };
    }

    var cancelNewBtn = document.getElementById('journalNewCategoryCancelBtn');
    if (cancelNewBtn) {
        cancelNewBtn.onclick = function() {
            var form = document.getElementById('journalAddCategoryForm');
            if (form) { form.style.display = 'none'; }
        };
    }

    // Load and render category list
    try {
        var snap = await userCol('journalCategories').orderBy('name').get();
        var cats = [];
        snap.forEach(function(doc) {
            cats.push({ id: doc.id, name: doc.data().name });
        });

        if (!listEl) return;

        if (cats.length === 0) {
            listEl.innerHTML = '<p class="empty-state">No categories yet. Add one above.</p>';
            return;
        }

        var html = '';
        cats.forEach(function(cat) {
            html += '<div class="journal-category-item" id="catItem_' + cat.id + '">' +
                        '<span class="journal-category-name" id="catName_' + cat.id + '">' +
                            journalEscape(cat.name) +
                        '</span>' +
                        '<input type="text" class="journal-category-edit-input hidden" ' +
                               'id="catInput_' + cat.id + '" value="' + journalEscape(cat.name) + '">' +
                        '<button class="btn btn-secondary btn-small" id="catEditBtn_' + cat.id + '" ' +
                                'onclick="_journalStartEditCategory(\'' + cat.id + '\')">Edit</button>' +
                        '<button class="btn btn-primary btn-small hidden" id="catSaveBtn_' + cat.id + '" ' +
                                'onclick="_journalSaveEditCategory(\'' + cat.id + '\')">Save</button>' +
                        '<button class="btn btn-danger btn-small" ' +
                                'onclick="deleteJournalCategory(\'' + cat.id + '\')">Delete</button>' +
                    '</div>';
        });
        listEl.innerHTML = html;

    } catch (err) {
        console.error('Error loading categories:', err);
        if (listEl) listEl.innerHTML = '<p class="empty-state" style="color:#b91c1c;">Error loading categories.</p>';
    }
}

/**
 * Switch a category row into inline edit mode.
 * @param {string} id - Category document ID
 */
function _journalStartEditCategory(id) {
    document.getElementById('catName_'    + id).classList.add('hidden');
    document.getElementById('catInput_'   + id).classList.remove('hidden');
    document.getElementById('catEditBtn_' + id).classList.add('hidden');
    document.getElementById('catSaveBtn_' + id).classList.remove('hidden');
    document.getElementById('catInput_'   + id).focus();
}

/**
 * Save a renamed category.
 * @param {string} id - Category document ID
 */
async function _journalSaveEditCategory(id) {
    var input = document.getElementById('catInput_' + id);
    var name = input ? input.value.trim() : '';
    if (!name) { alert('Category name cannot be empty.'); return; }
    await renameJournalCategory(id, name);
}

/**
 * Add a new tracking category.
 * @param {string} name - The category name
 */
async function addJournalCategory(name) {
    name = name.trim();
    if (!name) return;

    try {
        // Check for duplicate (case-insensitive)
        var snap = await userCol('journalCategories').get();
        var duplicate = false;
        snap.forEach(function(doc) {
            if (doc.data().name.toLowerCase() === name.toLowerCase()) duplicate = true;
        });
        if (duplicate) {
            alert('A category with that name already exists.');
            return;
        }

        await userCol('journalCategories').add({
            name:      name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Hide the add form and reload
        var form = document.getElementById('journalAddCategoryForm');
        if (form) form.style.display = 'none';

        loadJournalCategoriesPage();

    } catch (err) {
        console.error('Error adding category:', err);
        alert('Error adding category. See console for details.');
    }
}

/**
 * Rename an existing tracking category.
 * @param {string} id      - Category document ID
 * @param {string} newName - New category name
 */
async function renameJournalCategory(id, newName) {
    newName = newName.trim();
    if (!newName) return;

    try {
        await userCol('journalCategories').doc(id).update({ name: newName });
        loadJournalCategoriesPage();
    } catch (err) {
        console.error('Error renaming category:', err);
        alert('Error renaming category. See console for details.');
    }
}

/**
 * Delete a tracking category after confirmation.
 * @param {string} id - Category document ID
 */
async function deleteJournalCategory(id) {
    if (!confirm('Delete this category? This will not delete existing tracking items that used it.')) return;

    try {
        await userCol('journalCategories').doc(id).delete();
        loadJournalCategoriesPage();
    } catch (err) {
        console.error('Error deleting category:', err);
        alert('Error deleting category. See console for details.');
    }
}
