// ============================================================
// gcal.js — Google Calendar Integration
// Handles OAuth (Google Identity Services), token management,
// calendar create/find, and the authenticated API call wrapper
// used by calendar.js and lifecalendar.js in later phases.
// ============================================================

/** Cached settings from Firestore settings/googleCalendar. */
var _gcalSettings = null;

/** GIS token client (initialized once per session per clientId). */
var _gcalTokenClient = null;

// ============================================================
// Settings persistence
// ============================================================

/**
 * Load Google Calendar settings from Firestore and cache them locally.
 * Safe to call multiple times — subsequent calls replace the cache.
 * @returns {Object} Settings data (may be empty {} if never configured).
 */
async function gcalLoadSettings() {
    try {
        var doc = await userCol('settings').doc('googleCalendar').get();
        _gcalSettings = doc.exists ? doc.data() : {};
    } catch (err) {
        console.error('gcalLoadSettings error:', err);
        _gcalSettings = {};
    }
    return _gcalSettings;
}

/**
 * Merge-update Google Calendar settings in Firestore and in the local cache.
 * @param {Object} fields - Plain key/value pairs to merge in.
 */
async function gcalSaveSettings(fields) {
    if (!_gcalSettings) _gcalSettings = {};
    Object.assign(_gcalSettings, fields);
    try {
        var toWrite = Object.assign({}, fields, {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await userCol('settings').doc('googleCalendar').set(toWrite, { merge: true });
    } catch (err) {
        console.error('gcalSaveSettings error:', err);
    }
}

/**
 * Returns true if the user has a Client ID saved and is currently connected.
 */
function gcalIsConnected() {
    return !!(
        _gcalSettings &&
        _gcalSettings.clientId &&
        _gcalSettings.connected === true
    );
}

// ============================================================
// OAuth token management (Google Identity Services)
// ============================================================

/**
 * Initialize (or re-initialize) the GIS token client for the given Client ID.
 * Returns null if the GIS library hasn't loaded yet.
 * @param {string} clientId
 * @returns {Object|null}
 */
function _gcalInitTokenClient(clientId) {
    if (!window.google || !window.google.accounts) return null;
    return window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar',
        callback: function() {} // overridden per call
    });
}

/**
 * Ensure a valid access token is available.
 * First checks the cached token's expiry. If expired, attempts a silent
 * re-authorization (no popup if the user has already approved the app).
 * Only shows UI (toast) if silent re-auth fails and the user must reconnect.
 * @returns {Promise<boolean>} true if a valid token is now available.
 */
async function gcalEnsureToken() {
    if (!_gcalSettings) await gcalLoadSettings();
    var s = _gcalSettings;

    // Token still valid (60-second buffer so we don't use an about-to-expire token)
    if (s.accessToken && s.tokenExpiry && Date.now() < s.tokenExpiry - 60000) {
        return true;
    }

    if (!s.clientId) return false;

    // Initialize token client if needed
    if (!_gcalTokenClient) {
        _gcalTokenClient = _gcalInitTokenClient(s.clientId);
    }
    if (!_gcalTokenClient) {
        _gcalToast('Google Identity Services not ready — reload the page and try again');
        return false;
    }

    // Attempt silent re-auth (prompt: '' = no popup if already approved)
    return new Promise(function(resolve) {
        _gcalTokenClient.callback = async function(response) {
            if (response.error || !response.access_token) {
                await gcalSaveSettings({ connected: false, accessToken: '', tokenExpiry: 0 });
                if (typeof gcalRefreshSettingsUI === 'function') gcalRefreshSettingsUI();
                _gcalToast('Google Calendar disconnected — reconnect in Settings');
                resolve(false);
                return;
            }
            var expiry = Date.now() + (response.expires_in - 60) * 1000;
            await gcalSaveSettings({
                accessToken: response.access_token,
                tokenExpiry: expiry,
                connected: true
            });
            resolve(true);
        };
        _gcalTokenClient.requestAccessToken({ prompt: '' });
    });
}

// ============================================================
// Core API call wrapper
// ============================================================

/**
 * Make an authenticated Google Calendar API call.
 * Handles token refresh and retries once on 401.
 * Throws an Error with a .status property on non-OK responses.
 * @param {string} method  - 'GET' | 'POST' | 'PATCH' | 'DELETE'
 * @param {string} url     - Full Google Calendar API URL
 * @param {Object} [body]  - Request body (JSON-serialized automatically)
 * @returns {Promise<Object|null>} Parsed response JSON, or null for 204 No Content.
 */
async function gcalApiCall(method, url, body) {
    var ok = await gcalEnsureToken();
    if (!ok) throw new Error('GCal not authenticated');

    function buildOpts() {
        var opts = {
            method: method,
            headers: {
                'Authorization': 'Bearer ' + _gcalSettings.accessToken,
                'Content-Type': 'application/json'
            }
        };
        if (body) opts.body = JSON.stringify(body);
        return opts;
    }

    var resp = await fetch(url, buildOpts());

    // 401: token expired without being caught by our expiry check — retry once
    if (resp.status === 401) {
        await gcalSaveSettings({ accessToken: '', tokenExpiry: 0 });
        ok = await gcalEnsureToken();
        if (!ok) throw new Error('GCal re-auth failed');
        resp = await fetch(url, buildOpts());
    }

    if (resp.status === 204) return null; // DELETE returns No Content

    if (!resp.ok) {
        var errBody = '';
        try { errBody = await resp.text(); } catch (e) {}
        var err = new Error('GCal API error ' + resp.status);
        err.status  = resp.status;
        err.body    = errBody;
        throw err;
    }

    return resp.json();
}

// ============================================================
// Calendar management
// ============================================================

/**
 * Ensure the dedicated Bishop calendar exists in Google Calendar.
 * If gcalCalendarId is already stored in settings, returns it immediately.
 * Otherwise creates a new calendar and stores the returned ID.
 * @returns {Promise<string>} The Google Calendar ID.
 */
async function gcalEnsureCalendar() {
    if (!_gcalSettings) await gcalLoadSettings();

    if (_gcalSettings.gcalCalendarId) {
        return _gcalSettings.gcalCalendarId;
    }

    var calName = (_gcalSettings.calendarName || '').trim() || 'Bishop';
    var data = await gcalApiCall('POST', 'https://www.googleapis.com/calendar/v3/calendars', {
        summary: calName
    });
    await gcalSaveSettings({ gcalCalendarId: data.id });
    return data.id;
}

/**
 * Called when an API response indicates the Bishop calendar no longer exists.
 * Wipes stale IDs and re-creates the calendar.
 */
async function gcalHandleCalendarNotFound() {
    _gcalToast('Bishop calendar not found in Google — re-creating…');
    await gcalRecreateCalendar();
}

/**
 * Re-create the Bishop calendar from scratch.
 * Clears all gcalEventId / gcalEventIds from both event collections,
 * creates a new calendar in GCal, then triggers Sync All to re-populate.
 */
async function gcalRecreateCalendar() {
    // Wipe stale calendar ID so gcalEnsureCalendar() creates a fresh one
    await gcalSaveSettings({ gcalCalendarId: '' });

    // Clear event-level GCal IDs from both collections in a batch
    try {
        var calSnap  = await userCol('calendarEvents').get();
        var lifeSnap = await userCol('lifeEvents').get();
        var batch = firebase.firestore().batch();
        calSnap.forEach(function(d) {
            batch.update(d.ref, {
                gcalEventId:  firebase.firestore.FieldValue.delete(),
                gcalEventIds: firebase.firestore.FieldValue.delete()
            });
        });
        lifeSnap.forEach(function(d) {
            batch.update(d.ref, {
                gcalEventId: firebase.firestore.FieldValue.delete()
            });
        });
        await batch.commit();
    } catch (err) {
        console.error('gcalRecreateCalendar — error clearing event IDs:', err);
    }

    // Create the new calendar
    try {
        await gcalEnsureCalendar();
    } catch (err) {
        _gcalToast('Error re-creating calendar — check your connection');
        console.error('gcalRecreateCalendar — calendar create error:', err);
        return;
    }

    _gcalToast('Bishop calendar re-created — syncing events…');

    // Sync All is implemented in GC-5; call it if available
    if (typeof gcalSyncAll === 'function') gcalSyncAll();
}

// ============================================================
// Connect / Disconnect
// ============================================================

/**
 * Initiate a full OAuth consent flow (shows the Google account picker).
 * On success: stores the token, ensures the Bishop calendar exists,
 * refreshes the Settings UI, and fires the first-connect prompt (GC-5).
 */
async function gcalConnect() {
    if (!_gcalSettings) await gcalLoadSettings();

    var clientId = (_gcalSettings.clientId || '').trim();
    if (!clientId) {
        alert('Please enter and save your Client ID first.');
        return;
    }

    _gcalTokenClient = _gcalInitTokenClient(clientId);
    if (!_gcalTokenClient) {
        alert('Google Identity Services is still loading — wait a moment and try again.');
        return;
    }

    return new Promise(function(resolve) {
        _gcalTokenClient.callback = async function(response) {
            if (response.error || !response.access_token) {
                _gcalToast('Connection cancelled or failed — try again.');
                resolve(false);
                return;
            }

            var expiry = Date.now() + (response.expires_in - 60) * 1000;
            await gcalSaveSettings({
                accessToken: response.access_token,
                tokenExpiry: expiry,
                connected: true
            });

            // Ensure the Bishop calendar exists
            try {
                await gcalEnsureCalendar();
            } catch (err) {
                console.error('gcalConnect — calendar create error:', err);
                _gcalToast('Connected, but could not create calendar — try Recreate Calendar in Settings');
            }

            // Refresh Settings UI
            if (typeof gcalRefreshSettingsUI === 'function') gcalRefreshSettingsUI();

            // Fire first-connect bulk-sync prompt (GC-5)
            if (typeof gcalFirstConnectPrompt === 'function') gcalFirstConnectPrompt();

            resolve(true);
        };

        // 'consent' forces Google to show the account/scope screen on first connect
        _gcalTokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

/**
 * Soft-disconnect: clears the local token and pauses auto-sync.
 * GCal events and stored event IDs are left intact so reconnecting
 * resumes without duplicates.
 */
async function gcalDisconnect() {
    await gcalSaveSettings({ accessToken: '', tokenExpiry: 0, connected: false });
    _gcalTokenClient = null;
    if (typeof gcalRefreshSettingsUI === 'function') gcalRefreshSettingsUI();
    _gcalToast('Google Calendar disconnected');
}

// ============================================================
// Deep link helpers (Mode 1 — no API configured)
// ============================================================

/**
 * Convert YYYY-MM-DD to YYYYMMDD (GCal date format).
 * @param {string} dateStr
 * @returns {string}
 */
function _gcalFmtDate(dateStr) {
    return (dateStr || '').replace(/-/g, '');
}

/**
 * Return the next calendar day for a YYYY-MM-DD string.
 * Used because Google Calendar all-day end dates are exclusive.
 * @param {string} dateStr
 * @returns {string} YYYY-MM-DD
 */
function _gcalNextDay(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
}

/**
 * Convert HH:MM to HHMMSS (GCal time format, no separators).
 * @param {string} timeStr
 * @returns {string}
 */
function _gcalFmtTime(timeStr) {
    return (timeStr || '').replace(':', '') + '00';
}

/**
 * Build a "Add to Google Calendar" deep link for a yard calendar occurrence.
 * Produces an all-day event (yard events have no time fields).
 * @param {Object} occ - Occurrence object: { title, description, occurrenceDate }
 * @returns {string} URL
 */
function gcalYardDeepLink(occ) {
    var d = occ.occurrenceDate || '';
    var params = new URLSearchParams();
    params.set('action', 'TEMPLATE');
    params.set('text', occ.title || '');
    params.set('dates', _gcalFmtDate(d) + '/' + _gcalFmtDate(_gcalNextDay(d)));
    if (occ.description) params.set('details', occ.description);
    return 'https://calendar.google.com/calendar/render?' + params.toString();
}

/**
 * Build a "Add to Google Calendar" deep link for a life calendar event.
 * Produces a timed event if startTime is set, otherwise all-day.
 * @param {Object} ev   - Life event: { title, startDate, endDate, startTime, endTime,
 *                        location, description, status }
 * @param {Object} opts - Optional overrides: { categoryName, locationText }
 * @returns {string} URL
 */
function gcalLifeDeepLink(ev, opts) {
    opts = opts || {};
    var params = new URLSearchParams();
    params.set('action', 'TEMPLATE');

    // Title — prepend status prefix to match what GC-4 will do for API-synced events
    var title = ev.title || '';
    if (ev.status === 'attended') title = '\u2713 ' + title;
    else if (ev.status === 'didntgo') title = '\u2717 ' + title;
    params.set('text', title);

    // Dates
    var startDate = ev.startDate || '';
    var endDate   = ev.endDate   || startDate;
    var startTime = ev.startTime || '';
    var endTime   = ev.endTime   || '';

    if (startTime) {
        var startDT = _gcalFmtDate(startDate) + 'T' + _gcalFmtTime(startTime);
        var endDT   = endTime
            ? _gcalFmtDate(endDate) + 'T' + _gcalFmtTime(endTime)
            : _gcalFmtDate(endDate) + 'T235900'; // end of day if no end time
        params.set('dates', startDT + '/' + endDT);
    } else {
        // All-day — GCal end date is exclusive so add one day
        params.set('dates', _gcalFmtDate(startDate) + '/' + _gcalFmtDate(_gcalNextDay(endDate)));
    }

    // Location — prefer resolved text from opts, then fall back to ev.location
    var locationText = opts.locationText || ev.location || '';
    if (locationText) params.set('location', locationText);

    // Description + optional category name
    var desc = ev.description || '';
    if (opts.categoryName) {
        desc = desc ? desc + '\nCategory: ' + opts.categoryName : 'Category: ' + opts.categoryName;
    }
    if (desc) params.set('details', desc);

    return 'https://calendar.google.com/calendar/render?' + params.toString();
}

// ============================================================
// Yard Calendar Sync (Mode 2 — GC-3)
// ============================================================

/**
 * Build the Google Calendar API request body for a single yard event occurrence.
 * All yard events are all-day (no time fields).
 * @param {Object} event           - Firestore event doc data
 * @param {string} occurrenceDate  - YYYY-MM-DD
 * @returns {Object} GCal API event resource body
 */
function gcalBuildYardEventBody(event, occurrenceDate) {
    var isCompleted = event.completed ||
        (event.completedDates && event.completedDates.indexOf(occurrenceDate) >= 0);
    var summary = (isCompleted ? '\u2713 ' : '') + (event.title || '');

    var body = {
        summary: summary,
        start: { date: occurrenceDate },
        end:   { date: _gcalNextDay(occurrenceDate) },
        reminders: { useDefault: false, overrides: [] }
    };

    var mins = _gcalSettings && Number(_gcalSettings.defaultReminderMinutes);
    if (mins > 0) body.reminders.overrides.push({ method: 'popup', minutes: mins });
    if (event.description) body.description = event.description;
    return body;
}

/**
 * Generate all occurrence dates (YYYY-MM-DD[]) for a recurring event in a window,
 * ignoring cancelledDates so we can handle GCal deletion of cancelled dates.
 * @param {Object} event
 * @param {string} windowStart - YYYY-MM-DD inclusive
 * @param {string} windowEnd   - YYYY-MM-DD inclusive
 * @returns {string[]}
 */
function _gcalAllOccurrenceDates(event, windowStart, windowEnd) {
    // Pass with empty cancelledDates so generateOccurrences doesn't filter them out
    var ghost = Object.assign({}, event, { cancelledDates: [], completedDates: [] });
    var occs = generateOccurrences(ghost, windowStart, windowEnd);
    return occs.map(function(o) { return o.occurrenceDate; });
}

/**
 * Sync one yard calendarEvent document to Google Calendar.
 * Safe to call fire-and-forget; logs errors to console.
 * @param {Object} eventDoc - { id, ...firestoreData }
 */
async function gcalSyncYardEvent(eventDoc) {
    if (!gcalIsConnected()) return;

    var calId;
    try {
        calId = await gcalEnsureCalendar();
    } catch (err) {
        if (err.status === 404) await gcalHandleCalendarNotFound();
        else console.error('gcalSyncYardEvent — calendar error:', err);
        return;
    }

    var evBase = 'https://www.googleapis.com/calendar/v3/calendars/' +
        encodeURIComponent(calId) + '/events';

    // ── One-time event ──────────────────────────────────────────
    if (!eventDoc.recurring) {
        var body = gcalBuildYardEventBody(eventDoc, eventDoc.date);
        var existingId = eventDoc.gcalEventId || '';
        try {
            var result;
            if (existingId) {
                try {
                    result = await gcalApiCall('PATCH', evBase + '/' + encodeURIComponent(existingId), body);
                } catch (e) {
                    if (e.status !== 404) throw e;
                    result = await gcalApiCall('POST', evBase, body);
                    existingId = result.id;
                }
            } else {
                result = await gcalApiCall('POST', evBase, body);
                existingId = result.id;
            }
            await userCol('calendarEvents').doc(eventDoc.id).update({ gcalEventId: existingId });
        } catch (err) {
            if (err.status === 404) await gcalHandleCalendarNotFound();
            else console.error('gcalSyncYardEvent (one-time) error:', err);
        }
        return;
    }

    // ── Recurring event ─────────────────────────────────────────
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var winStart = formatDateISO(today);
    // 10-year window for yearly events, 12-month window otherwise
    var interval = (eventDoc.recurring && eventDoc.recurring.intervalDays) || 0;
    var winMonths = interval >= 365 ? 120 : 12;
    var winEndDate = new Date(today);
    winEndDate.setMonth(winEndDate.getMonth() + winMonths);
    var winEnd = formatDateISO(winEndDate);

    var allDates     = _gcalAllOccurrenceDates(eventDoc, winStart, winEnd);
    var cancelled    = eventDoc.cancelledDates   || [];
    var completed    = eventDoc.completedDates   || [];
    var idMap        = Object.assign({}, eventDoc.gcalEventIds || {});
    var updatedMap   = {};

    try {
        for (var i = 0; i < allDates.length; i++) {
            var dateStr  = allDates[i];
            var isCancelled  = cancelled.indexOf(dateStr) >= 0;
            var existingGcalId = idMap[dateStr] || '';

            if (isCancelled) {
                if (existingGcalId) {
                    try {
                        await gcalApiCall('DELETE', evBase + '/' + encodeURIComponent(existingGcalId));
                    } catch (e) {
                        if (e.status !== 404) throw e;
                    }
                }
                // Not added to updatedMap — effectively removed
            } else {
                var occBody = gcalBuildYardEventBody(
                    Object.assign({}, eventDoc, { completedDates: completed }),
                    dateStr
                );
                var newId;
                if (existingGcalId) {
                    try {
                        await gcalApiCall('PATCH', evBase + '/' + encodeURIComponent(existingGcalId), occBody);
                        newId = existingGcalId;
                    } catch (e) {
                        if (e.status !== 404) throw e;
                        var r = await gcalApiCall('POST', evBase, occBody);
                        newId = r.id;
                    }
                } else {
                    var r2 = await gcalApiCall('POST', evBase, occBody);
                    newId = r2.id;
                }
                updatedMap[dateStr] = newId;
            }
        }
        await userCol('calendarEvents').doc(eventDoc.id).update({ gcalEventIds: updatedMap });
    } catch (err) {
        if (err.status === 404) await gcalHandleCalendarNotFound();
        else console.error('gcalSyncYardEvent (recurring) error:', err);
    }
}

/**
 * Delete GCal event(s) for a yard event being removed from Firestore.
 * Must be called BEFORE deleting the Firestore document (we need the IDs).
 * @param {Object} eventDoc - { id, ...firestoreData }
 */
async function gcalDeleteYardEvent(eventDoc) {
    if (!gcalIsConnected()) return;
    if (!eventDoc.gcalEventId && !eventDoc.gcalEventIds) return;

    var calId;
    try {
        calId = await gcalEnsureCalendar();
    } catch (err) {
        // If calendar is gone, there's nothing to delete anyway
        return;
    }

    var evBase = 'https://www.googleapis.com/calendar/v3/calendars/' +
        encodeURIComponent(calId) + '/events';

    var idsToDelete = [];
    if (!eventDoc.recurring && eventDoc.gcalEventId) {
        idsToDelete.push(eventDoc.gcalEventId);
    } else if (eventDoc.gcalEventIds) {
        var keys = Object.keys(eventDoc.gcalEventIds);
        for (var k = 0; k < keys.length; k++) {
            idsToDelete.push(eventDoc.gcalEventIds[keys[k]]);
        }
    }

    for (var i = 0; i < idsToDelete.length; i++) {
        try {
            await gcalApiCall('DELETE', evBase + '/' + encodeURIComponent(idsToDelete[i]));
        } catch (err) {
            if (err.status !== 404) console.error('gcalDeleteYardEvent error:', err);
            // 404 = already gone, skip
        }
    }
}

// ============================================================
// Life Calendar Sync (Mode 2 — GC-4)
// ============================================================

/**
 * Build the Google Calendar API request body for a life event.
 * Timed if startTime is set; all-day if not. Multi-day if endDate set.
 * @param {Object} event         - lifeEvents Firestore doc data
 * @param {string} categoryName  - Resolved category name ('' if none)
 * @param {string} locationText  - Resolved location string ('' if none)
 * @returns {Object} GCal API event resource body
 */
function gcalBuildLifeEventBody(event, categoryName, locationText) {
    var prefix = '';
    if (event.status === 'attended') prefix = '\u2713 ';
    else if (event.status === 'didntgo') prefix = '\u2717 ';
    var summary = prefix + (event.title || '');

    var startDate = event.startDate || '';
    var endDate   = event.endDate   || startDate;
    var startTime = event.startTime || '';
    var endTime   = event.endTime   || '';
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    var start, end;
    if (startTime) {
        start = { dateTime: startDate + 'T' + startTime + ':00', timeZone: tz };
        end   = endTime
            ? { dateTime: endDate + 'T' + endTime + ':00', timeZone: tz }
            : { dateTime: endDate + 'T23:59:00', timeZone: tz };
    } else {
        // All-day — GCal end is exclusive, so add one day
        start = { date: startDate };
        end   = { date: _gcalNextDay(endDate) };
    }

    var desc = event.description || '';
    if (categoryName) desc = desc ? desc + '\nCategory: ' + categoryName : 'Category: ' + categoryName;

    var body = {
        summary: summary,
        start:   start,
        end:     end,
        reminders: { useDefault: false, overrides: [] }
    };

    var mins = _gcalSettings && Number(_gcalSettings.defaultReminderMinutes);
    if (mins > 0) body.reminders.overrides.push({ method: 'popup', minutes: mins });
    if (locationText) body.location = locationText;
    if (desc) body.description = desc;
    return body;
}

/**
 * Look up a life event's category name from Firestore.
 * @param {string} categoryId
 * @returns {Promise<string>}
 */
async function _gcalResolveCategoryName(categoryId) {
    if (!categoryId) return '';
    try {
        var snap = await userCol('lifeCategories').doc(categoryId).get();
        return snap.exists ? (snap.data().name || '') : '';
    } catch (e) { return ''; }
}

/**
 * Resolve a life event's location string.
 * Uses contact name if locationContactId is set, otherwise event.location.
 * @param {Object} event
 * @returns {Promise<string>}
 */
async function _gcalResolveLifeLocation(event) {
    if (event.locationContactId) {
        try {
            var snap = await userCol('people').doc(event.locationContactId).get();
            return snap.exists ? (snap.data().name || event.location || '') : (event.location || '');
        } catch (e) { return event.location || ''; }
    }
    return event.location || '';
}

/**
 * Sync one lifeEvents document to Google Calendar.
 * Safe to call fire-and-forget; logs errors to console.
 * @param {Object} eventDoc - { id, ...firestoreData }
 */
async function gcalSyncLifeEvent(eventDoc) {
    if (!gcalIsConnected()) return;

    var calId;
    try {
        calId = await gcalEnsureCalendar();
    } catch (err) {
        if (err.status === 404) await gcalHandleCalendarNotFound();
        else console.error('gcalSyncLifeEvent — calendar error:', err);
        return;
    }

    var evBase = 'https://www.googleapis.com/calendar/v3/calendars/' +
        encodeURIComponent(calId) + '/events';

    var categoryName = await _gcalResolveCategoryName(eventDoc.categoryId);
    var locationText = await _gcalResolveLifeLocation(eventDoc);
    var body = gcalBuildLifeEventBody(eventDoc, categoryName, locationText);
    var existingId = eventDoc.gcalEventId || '';

    try {
        var result;
        if (existingId) {
            try {
                result = await gcalApiCall('PATCH', evBase + '/' + encodeURIComponent(existingId), body);
            } catch (e) {
                if (e.status !== 404) throw e;
                result = await gcalApiCall('POST', evBase, body);
                existingId = result.id;
            }
        } else {
            result = await gcalApiCall('POST', evBase, body);
            existingId = result.id;
        }
        await userCol('lifeEvents').doc(eventDoc.id).update({ gcalEventId: existingId });
    } catch (err) {
        if (err.status === 404) await gcalHandleCalendarNotFound();
        else console.error('gcalSyncLifeEvent error:', err);
    }
}

/**
 * Delete the Google Calendar event for a life event being removed from Firestore.
 * Must be called BEFORE the Firestore delete (we need the gcalEventId).
 * @param {Object} eventDoc - { id, ...firestoreData }
 */
async function gcalDeleteLifeEvent(eventDoc) {
    if (!gcalIsConnected()) return;
    if (!eventDoc.gcalEventId) return;

    var calId;
    try {
        calId = await gcalEnsureCalendar();
    } catch (err) {
        return; // Calendar gone — nothing to delete
    }

    var evBase = 'https://www.googleapis.com/calendar/v3/calendars/' +
        encodeURIComponent(calId) + '/events';

    try {
        await gcalApiCall('DELETE', evBase + '/' + encodeURIComponent(eventDoc.gcalEventId));
    } catch (err) {
        if (err.status !== 404) console.error('gcalDeleteLifeEvent error:', err);
        // 404 = already gone, skip
    }
}

// ============================================================
// Toast notification
// ============================================================

/**
 * Show a brief toast message at the bottom of the screen.
 * Creates the element on first call; reuses it on subsequent calls.
 * @param {string} msg
 */
function _gcalToast(msg) {
    var t = document.getElementById('gcalToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'gcalToast';
        t.style.cssText = [
            'position:fixed', 'bottom:24px', 'left:50%',
            'transform:translateX(-50%)', 'background:#323232', 'color:#fff',
            'padding:10px 20px', 'border-radius:6px', 'z-index:9999',
            'font-size:14px', 'max-width:340px', 'text-align:center',
            'box-shadow:0 2px 8px rgba(0,0,0,.3)', 'display:none'
        ].join(';');
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(function() { t.style.display = 'none'; }, 3500);
}
