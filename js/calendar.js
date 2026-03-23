// ============================================================
// Calendar.js — Calendar event management and display
// Supports one-time and recurring events (weekly, monthly, every X days).
// Displays events chronologically grouped by month.
// Shows a configurable range (default: next 3 months).
// Firestore collection: "calendarEvents"
//
// calendarEvents fields:
//   title, description, date (ISO string), recurring (null or {type, intervalDays}),
//   targetType? ('zone'|'plant'|null), targetId? (string|null),
//   zoneIds? (string[], IDs of linked zones — multi-zone support),
//   savedActionId? (string|null),
//   completed (boolean, for one-time events),
//   completedDates (string[], ISO dates of completed recurring occurrences),
//   cancelledDates (string[], ISO dates of deleted single occurrences of a recurring event)
// ============================================================

// ---------- Module State ----------

/** How many months ahead to display (default 3). */
var calendarRangeMonths = 3;

/**
 * Reload callback stored when opening the event modal from a zone/plant page.
 * After saving, this function is called instead of loadCalendar().
 */
var calendarEventModalReloadFn = null;

/**
 * Occurrence currently being completed (stored for use by handleCompleteEvent).
 */
var pendingCompleteOccurrence = null;

/**
 * Pending recurring-event delete (stored while the deleteRecurringModal is open).
 */
var pendingDeleteRecurring = null;

// ---------- Load & Display Calendar ----------

/**
 * Loads all calendar events, generates upcoming uncompleted occurrences,
 * and renders them grouped by month. Also loads the overdue section.
 */
async function loadCalendar() {
    var container = document.getElementById('calendarEventsContainer');
    var emptyState = document.getElementById('calendarEmptyState');
    var rangeSelect = document.getElementById('calendarRangeSelect');

    // Read range from dropdown
    calendarRangeMonths = parseInt(rangeSelect.value) || 3;

    // Calculate date range: today through N months from now
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var rangeStart = formatDateISO(today);

    var rangeEndDate = new Date(today);
    rangeEndDate.setMonth(rangeEndDate.getMonth() + calendarRangeMonths);
    var rangeEnd = formatDateISO(rangeEndDate);

    // Load overdue section first
    await loadOverdueEvents();

    try {
        var snapshot = await userCol('calendarEvents').get();

        container.innerHTML = '';

        if (snapshot.empty) {
            emptyState.textContent = 'No calendar events yet \u2014 add one to get started!';
            emptyState.style.display = 'block';
            return;
        }

        // Collect all events
        var events = [];
        snapshot.forEach(function(doc) {
            events.push({ id: doc.id, ...doc.data() });
        });

        // Generate all occurrences within the display range
        var showCompleted = document.getElementById('showCompletedCalendarEvents').checked;
        var allOccurrences = [];
        events.forEach(function(event) {
            var occurrences = generateOccurrences(event, rangeStart, rangeEnd);
            // Filter to uncompleted only, unless "Show completed" is checked
            var relevant = showCompleted ? occurrences : occurrences.filter(function(occ) { return !occ.completed; });
            allOccurrences = allOccurrences.concat(relevant);
        });

        // Sort by occurrence date
        allOccurrences.sort(function(a, b) {
            return a.occurrenceDate.localeCompare(b.occurrenceDate);
        });

        if (allOccurrences.length === 0) {
            emptyState.textContent = 'No events in the next ' + calendarRangeMonths +
                ' month' + (calendarRangeMonths > 1 ? 's' : '') + '.';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Group by month and render
        var currentMonth = '';
        allOccurrences.forEach(function(occ) {
            var monthKey = occ.occurrenceDate.substring(0, 7); // "YYYY-MM"

            if (monthKey !== currentMonth) {
                currentMonth = monthKey;
                var monthHeader = document.createElement('h3');
                monthHeader.className = 'calendar-month-header';
                var parts = monthKey.split('-');
                var monthDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                monthHeader.textContent = monthDate.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                });
                container.appendChild(monthHeader);
            }

            var card = createCalendarEventCard(occ, loadCalendar);
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading calendar:', error);
        emptyState.textContent = 'Error loading calendar events.';
        emptyState.style.display = 'block';
    }
}

// ---------- Load Events for Zone / Plant Target ----------

/**
 * Loads upcoming calendar events tied to a specific zone or plant,
 * and renders them as compact event cards.
 * @param {string} targetType - "zone" or "plant"
 * @param {string} targetId - The target's Firestore document ID.
 * @param {string} containerId - The ID of the container element.
 * @param {string} emptyStateId - The ID of the empty-state message element.
 */
async function loadEventsForTarget(targetType, targetId, containerId, emptyStateId, months) {
    months = months || 3;
    var container = document.getElementById(containerId);
    var emptyState = document.getElementById(emptyStateId);

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var rangeStart = formatDateISO(today);
    var rangeEndDate = new Date(today);
    rangeEndDate.setMonth(rangeEndDate.getMonth() + months);
    var rangeEnd = formatDateISO(rangeEndDate);

    try {
        container.innerHTML = '';

        // Use a map to deduplicate events by ID (needed when running multiple queries).
        var eventsMap = {};

        if (targetType === 'zone') {
            // Query 1: old-style targetType/targetId links directly to this zone
            var snap1 = await userCol('calendarEvents')
                .where('targetType', '==', 'zone')
                .where('targetId', '==', targetId)
                .get();
            snap1.forEach(function(doc) {
                eventsMap[doc.id] = { id: doc.id, ...doc.data() };
            });

            // Query 2: new-style zoneIds array-contains this zone
            var snap2 = await userCol('calendarEvents')
                .where('zoneIds', 'array-contains', targetId)
                .get();
            snap2.forEach(function(doc) {
                eventsMap[doc.id] = { id: doc.id, ...doc.data() };
            });

            // Query 3: plant-linked events for any plant in this zone or its sub-zones.
            // Get all zone IDs in the hierarchy under this zone, then find plants in those zones,
            // then find calendar events tied to those plants.
            var allZoneIds = await getDescendantZoneIds(targetId);
            var allZoneChunks = chunkArray(allZoneIds, 30);
            var plantIds = [];
            for (var z = 0; z < allZoneChunks.length; z++) {
                var plantSnap = await userCol('plants')
                    .where('zoneId', 'in', allZoneChunks[z])
                    .get();
                plantSnap.forEach(function(doc) { plantIds.push(doc.id); });
            }
            var plantChunks = chunkArray(plantIds, 30);
            for (var p = 0; p < plantChunks.length; p++) {
                var evSnap = await userCol('calendarEvents')
                    .where('targetType', '==', 'plant')
                    .where('targetId', 'in', plantChunks[p])
                    .get();
                evSnap.forEach(function(doc) {
                    eventsMap[doc.id] = { id: doc.id, ...doc.data() };
                });
            }

        } else {
            // For plants: single query by targetType/targetId
            var snapshot = await userCol('calendarEvents')
                .where('targetType', '==', targetType)
                .where('targetId', '==', targetId)
                .get();
            snapshot.forEach(function(doc) {
                eventsMap[doc.id] = { id: doc.id, ...doc.data() };
            });
        }

        var events = Object.values(eventsMap);

        if (events.length === 0) {
            emptyState.textContent = 'No calendar events.';
            emptyState.style.display = 'block';
            return;
        }

        // Generate upcoming uncompleted occurrences
        var allOccurrences = [];
        events.forEach(function(event) {
            var occurrences = generateOccurrences(event, rangeStart, rangeEnd);
            var upcoming = occurrences.filter(function(occ) { return !occ.completed; });
            allOccurrences = allOccurrences.concat(upcoming);
        });

        allOccurrences.sort(function(a, b) {
            return a.occurrenceDate.localeCompare(b.occurrenceDate);
        });

        if (allOccurrences.length === 0) {
            emptyState.textContent = 'No upcoming events in next ' + months + ' month' + (months === 1 ? '' : 's') + '.';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Reload function for cards on this target's page
        var reloadFn = function() {
            loadEventsForTarget(targetType, targetId, containerId, emptyStateId, months);
        };

        allOccurrences.forEach(function(occ) {
            var card = createCalendarEventCard(occ, reloadFn);
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading events for target:', error);
        emptyState.textContent = 'Error loading events.';
        emptyState.style.display = 'block';
    }
}

// ---------- Load Overdue Events ----------

/**
 * Finds past calendar events that were NOT completed and shows them
 * in the calendarOverdueSection on the calendar page.
 */
async function loadOverdueEvents() {
    var section = document.getElementById('calendarOverdueSection');
    var container = document.getElementById('calendarOverdueContainer');

    container.innerHTML = '';

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    try {
        var snapshot = await userCol('calendarEvents').get();

        if (snapshot.empty) {
            section.style.display = 'none';
            return;
        }

        var events = [];
        snapshot.forEach(function(doc) {
            events.push({ id: doc.id, ...doc.data() });
        });

        // Find overdue: one-time events past due and not completed;
        // recurring events with uncompleted past occurrences
        var overdueOccurrences = [];

        events.forEach(function(event) {
            // For the overdue check, look from event.date back to yesterday
            var eventStartDate = new Date(event.date + 'T00:00:00');
            if (eventStartDate >= today) return; // Event hasn't started yet — not overdue

            if (!event.recurring) {
                // One-time event: overdue if not completed
                if (!event.completed) {
                    overdueOccurrences.push({
                        eventId: event.id,
                        title: event.title,
                        description: event.description || '',
                        occurrenceDate: event.date,
                        recurring: null,
                        completed: false,
                        targetType: event.targetType || null,
                        targetId: event.targetId || null,
                        savedActionId: event.savedActionId || null,
                        overdue: true
                    });
                }
            } else {
                // Recurring: find all past occurrences not in completedDates
                var completedDates = event.completedDates || [];
                var rangeEnd = formatDateISO(yesterday);
                var pastOccs = generateOccurrences(event, event.date, rangeEnd);
                pastOccs.forEach(function(occ) {
                    if (!occ.completed) {
                        occ.overdue = true;
                        overdueOccurrences.push(occ);
                    }
                });
            }
        });

        if (overdueOccurrences.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        // Sort most-recent overdue first
        overdueOccurrences.sort(function(a, b) {
            return b.occurrenceDate.localeCompare(a.occurrenceDate);
        });

        overdueOccurrences.forEach(function(occ) {
            var card = createCalendarEventCard(occ, loadCalendar);
            card.classList.add('calendar-overdue-card');
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading overdue events:', error);
        section.style.display = 'none';
    }
}

// ---------- Generate Occurrences ----------

/**
 * Given a calendar event and a date range, generates all occurrence dates
 * that fall within the range. Occurrence objects carry completion state,
 * targetType, targetId, and savedActionId from the parent event.
 *
 * @param {Object} event - The calendar event document data (with id).
 * @param {string} rangeStart - ISO date string "YYYY-MM-DD" for range start.
 * @param {string} rangeEnd - ISO date string "YYYY-MM-DD" for range end.
 * @returns {Array} Array of occurrence objects with occurrenceDate added.
 */
function generateOccurrences(event, rangeStart, rangeEnd) {
    var occurrences = [];
    var rangeStartDate = new Date(rangeStart + 'T00:00:00');
    var rangeEndDate = new Date(rangeEnd + 'T23:59:59');
    var completedDates = event.completedDates || [];
    var cancelledDates = event.cancelledDates || [];

    if (!event.recurring) {
        // One-time event — just check if it falls in range
        var eventDate = new Date(event.date + 'T00:00:00');
        if (eventDate >= rangeStartDate && eventDate <= rangeEndDate) {
            occurrences.push({
                eventId: event.id,
                title: event.title,
                description: event.description || '',
                occurrenceDate: event.date,
                recurring: null,
                completed: !!event.completed,
                targetType: event.targetType || null,
                targetId: event.targetId || null,
                savedActionId: event.savedActionId || null,
                zoneIds: event.zoneIds || []
            });
        }
        return occurrences;
    }

    // Recurring event — generate occurrences
    var startDate = new Date(event.date + 'T00:00:00');
    var originalDay = startDate.getDate();
    var type = event.recurring.type;
    var intervalDays = event.recurring.intervalDays || 14;

    var current = new Date(startDate);
    var maxIterations = 1000; // Safety limit
    var count = 0;

    // Fast-forward past dates before the range
    while (current < rangeStartDate && count < maxIterations) {
        current = advanceRecurringDate(current, type, intervalDays, originalDay);
        count++;
    }

    // Generate occurrences within the range
    while (current <= rangeEndDate && count < maxIterations) {
        var dateStr = formatDateISO(current);
        // Skip occurrences that were individually deleted
        if (cancelledDates.indexOf(dateStr) === -1) {
            occurrences.push({
                eventId: event.id,
                title: event.title,
                description: event.description || '',
                occurrenceDate: dateStr,
                recurring: event.recurring,
                completed: completedDates.indexOf(dateStr) >= 0,
                targetType: event.targetType || null,
                targetId: event.targetId || null,
                savedActionId: event.savedActionId || null,
                zoneIds: event.zoneIds || []
            });
        }

        current = advanceRecurringDate(current, type, intervalDays, originalDay);
        count++;
    }

    return occurrences;
}

/**
 * Advances a date to the next recurrence.
 * @param {Date} date - The current occurrence date.
 * @param {string} type - "weekly", "monthly", or "every_x_days".
 * @param {number} intervalDays - Number of days for every_x_days type.
 * @param {number} originalDay - The original day-of-month (for monthly clamping).
 * @returns {Date} A new Date object for the next occurrence.
 */
function advanceRecurringDate(date, type, intervalDays, originalDay) {
    var next = new Date(date);

    if (type === 'weekly') {
        next.setDate(next.getDate() + 7);
    } else if (type === 'monthly') {
        // Move to same day next month, clamping to end of month
        var nextMonth = next.getMonth() + 1;
        var nextYear = next.getFullYear();
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear++;
        }
        var lastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
        next = new Date(nextYear, nextMonth, Math.min(originalDay, lastDay));
    } else if (type === 'every_x_days') {
        next.setDate(next.getDate() + intervalDays);
    }

    return next;
}

// ---------- Create Event Card ----------

/**
 * Creates a DOM element for a single calendar event occurrence.
 * @param {Object} occ - An occurrence object from generateOccurrences().
 * @param {Function} reloadFn - Callback to call after edit/delete/complete.
 * @returns {HTMLElement} The event card element.
 */
function createCalendarEventCard(occ, reloadFn) {
    var card = document.createElement('div');
    card.className = 'calendar-event-card';
    if (occ.completed) {
        card.classList.add('calendar-event-card--completed');
    }

    // Date line
    var dateLine = document.createElement('div');
    dateLine.className = 'calendar-event-date';
    var dateObj = new Date(occ.occurrenceDate + 'T00:00:00');
    dateLine.textContent = dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    card.appendChild(dateLine);

    // Title
    var title = document.createElement('div');
    title.className = 'calendar-event-title';
    title.textContent = occ.title;
    card.appendChild(title);

    // Description (if any)
    if (occ.description) {
        var desc = document.createElement('div');
        desc.className = 'calendar-event-desc';
        desc.textContent = occ.description;
        card.appendChild(desc);
    }

    // Zone / plant association line — populated async
    var targetEl = document.createElement('div');
    targetEl.className = 'calendar-event-target';
    card.appendChild(targetEl);
    (async function() {
        try {
            if (occ.targetType === 'plant' && occ.targetId) {
                var plantDoc = await userCol('plants').doc(occ.targetId).get();
                if (plantDoc.exists) {
                    targetEl.textContent = 'Plant: ' + plantDoc.data().name;
                }
            } else if (occ.zoneIds && occ.zoneIds.length > 0) {
                var zoneNames = [];
                for (var zi = 0; zi < occ.zoneIds.length; zi++) {
                    var zDoc = await userCol('zones').doc(occ.zoneIds[zi]).get();
                    if (zDoc.exists) zoneNames.push(zDoc.data().name);
                }
                if (zoneNames.length > 0) {
                    targetEl.textContent = (zoneNames.length === 1 ? 'Zone: ' : 'Zones: ') + zoneNames.join(', ');
                }
            } else if ((occ.targetType === 'floor' || occ.targetType === 'room' || occ.targetType === 'thing') && occ.targetId) {
                // House context label — resolved by house.js to keep calendar.js yard-agnostic
                if (typeof getHouseContextLabel === 'function') {
                    var houseLabel = await getHouseContextLabel(occ.targetType, occ.targetId);
                    if (houseLabel) targetEl.textContent = houseLabel;
                }
            }
        } catch (e) { /* silently skip if lookup fails */ }
    })();

    // Recurring badge
    if (occ.recurring) {
        var badge = document.createElement('div');
        badge.className = 'calendar-recurring-badge';
        var label = '\u{1F504} '; // 🔄
        if (occ.recurring.type === 'weekly') label += 'Weekly';
        else if (occ.recurring.type === 'monthly') label += 'Monthly';
        else if (occ.recurring.type === 'every_x_days') {
            label += 'Every ' + (occ.recurring.intervalDays || 14) + ' days';
        }
        badge.textContent = label;
        card.appendChild(badge);
    }

    // Completed badge
    if (occ.completed) {
        var completedBadge = document.createElement('span');
        completedBadge.className = 'calendar-completed-badge';
        completedBadge.textContent = '\u2713 Completed';
        card.appendChild(completedBadge);
    }

    // Overdue badge
    if (occ.overdue) {
        var overdueBadge = document.createElement('span');
        overdueBadge.className = 'calendar-overdue-badge';
        overdueBadge.textContent = 'OVERDUE';
        card.appendChild(overdueBadge);
    }

    // Inline reschedule row — built early so the button click handler can reference it.
    // Hidden by default; revealed when the Reschedule button is clicked.
    var rescheduleRow = null;
    if (occ.overdue) {
        rescheduleRow = document.createElement('div');
        rescheduleRow.className = 'cal-reschedule-row hidden';

        var reschedLabel = document.createElement('label');
        reschedLabel.className = 'cal-reschedule-label';
        reschedLabel.textContent = 'New date:';
        rescheduleRow.appendChild(reschedLabel);

        var reschedInput = document.createElement('input');
        reschedInput.type = 'date';
        reschedInput.className = 'cal-reschedule-input';
        rescheduleRow.appendChild(reschedInput);

        var reschedConfirmBtn = document.createElement('button');
        reschedConfirmBtn.className = 'btn btn-small btn-primary';
        reschedConfirmBtn.textContent = 'Confirm';
        reschedConfirmBtn.addEventListener('click', function() {
            var newDate = reschedInput.value;
            if (!newDate) { alert('Please pick a new date.'); return; }
            calHandleReschedule(occ, newDate, reloadFn);
        });
        rescheduleRow.appendChild(reschedConfirmBtn);

        var reschedCancelBtn = document.createElement('button');
        reschedCancelBtn.className = 'btn btn-small btn-secondary';
        reschedCancelBtn.textContent = 'Cancel';
        reschedCancelBtn.addEventListener('click', function() {
            rescheduleRow.classList.add('hidden');
        });
        rescheduleRow.appendChild(reschedCancelBtn);
    }

    // Action buttons
    var actions = document.createElement('div');
    actions.className = 'calendar-event-actions';

    // Complete button — only shown for uncompleted occurrences
    if (!occ.completed) {
        var completeBtn = document.createElement('button');
        completeBtn.className = 'btn btn-small btn-complete';
        completeBtn.textContent = 'Complete';
        completeBtn.addEventListener('click', function() {
            openCompleteEventModal(occ, reloadFn);
        });
        actions.appendChild(completeBtn);
    }

    // Reschedule button — only shown for overdue occurrences
    if (occ.overdue) {
        var rescheduleBtn = document.createElement('button');
        rescheduleBtn.className = 'btn btn-small btn-reschedule';
        rescheduleBtn.textContent = 'Reschedule';
        rescheduleBtn.addEventListener('click', function() {
            rescheduleRow.classList.toggle('hidden');
            if (!rescheduleRow.classList.contains('hidden')) {
                reschedInput.focus();
            }
        });
        actions.appendChild(rescheduleBtn);
    }

    var editBtn = document.createElement('button');
    editBtn.className = 'btn btn-small btn-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function() {
        openEditCalendarEventModal(occ.eventId, reloadFn, occ.occurrenceDate);
    });
    actions.appendChild(editBtn);

    var copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-small btn-secondary';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', function() {
        openCopyCalendarEventModal(occ.eventId, reloadFn);
    });
    actions.appendChild(copyBtn);

    card.appendChild(actions);

    // Append the reschedule row below the action buttons (only for overdue cards)
    if (rescheduleRow) {
        card.appendChild(rescheduleRow);
    }

    return card;
}

// ---------- Reschedule Overdue Event ----------

/**
 * Reschedules an overdue calendar event occurrence to a new date.
 *
 * For one-time events: the event's `date` field is updated directly.
 * For recurring events: the overdue occurrence date is added to `cancelledDates`
 * (so it stops showing as overdue), and the series `date` anchor is updated to
 * the new date so the pattern continues forward from there.
 *
 * @param {Object} occ     - The occurrence object from createCalendarEventCard.
 * @param {string} newDate - ISO date string "YYYY-MM-DD" for the new date.
 * @param {Function} reloadFn - Callback to refresh the calendar after saving.
 */
async function calHandleReschedule(occ, newDate, reloadFn) {
    try {
        var eventRef = userCol('calendarEvents').doc(occ.eventId);

        if (!occ.recurring) {
            // One-time event: simply move the date forward
            await eventRef.update({ date: newDate });
        } else {
            // Recurring event: cancel this specific occurrence and shift the series
            // anchor to the new date so all future occurrences flow from there.
            await eventRef.update({
                date: newDate,
                cancelledDates: firebase.firestore.FieldValue.arrayUnion(occ.occurrenceDate)
            });
        }

        if (typeof reloadFn === 'function') reloadFn();

    } catch (err) {
        console.error('Error rescheduling event:', err);
        alert('Error rescheduling event. Please try again.');
    }
}

// ---------- Complete Event Modal ----------

/**
 * Opens the complete-event confirm modal.
 * @param {Object} occ - The occurrence object.
 * @param {Function} reloadFn - Callback to call after completing.
 */
function openCompleteEventModal(occ, reloadFn) {
    var dateObj = new Date(occ.occurrenceDate + 'T00:00:00');
    var dateStr = dateObj.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });

    document.getElementById('completeEventInfo').textContent = occ.title + ' — ' + dateStr;
    document.getElementById('completeEventNotesInput').value = '';

    pendingCompleteOccurrence = { occ: occ, reloadFn: reloadFn };

    openModal('completeEventModal');
    document.getElementById('completeEventNotesInput').focus();
}

/**
 * Handles confirming a complete-event action.
 * Creates an activity record and marks the event/occurrence as completed.
 */
async function handleCompleteEvent() {
    if (!pendingCompleteOccurrence) return;

    var occ = pendingCompleteOccurrence.occ;
    var reloadFn = pendingCompleteOccurrence.reloadFn;
    var notes = document.getElementById('completeEventNotesInput').value.trim();

    closeModal('completeEventModal');
    pendingCompleteOccurrence = null;

    try {
        // Collect chemicalIds from the saved action (if any)
        var chemicalIds = [];
        if (occ.savedActionId) {
            try {
                var actionDoc = await userCol('savedActions').doc(occ.savedActionId).get();
                if (actionDoc.exists) {
                    chemicalIds = normalizeChemicalIds(actionDoc.data());
                }
            } catch (e) { /* ignore */ }
        }

        // Create one activity per linked target.
        // Plant-linked events: one activity for the plant.
        // Zone-linked events: one activity per zone in zoneIds[].
        var zoneIds = occ.zoneIds || [];
        if (occ.targetType === 'plant' && occ.targetId) {
            await userCol('activities').add({
                targetType: 'plant',
                targetId: occ.targetId,
                description: occ.title,
                date: occ.occurrenceDate,
                notes: notes,
                chemicalIds: chemicalIds,
                savedActionId: occ.savedActionId || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            for (var i = 0; i < zoneIds.length; i++) {
                await userCol('activities').add({
                    targetType: 'zone',
                    targetId: zoneIds[i],
                    description: occ.title,
                    date: occ.occurrenceDate,
                    notes: notes,
                    chemicalIds: chemicalIds,
                    savedActionId: occ.savedActionId || null,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        // Mark the event as completed in Firestore
        var eventRef = userCol('calendarEvents').doc(occ.eventId);
        if (!occ.recurring) {
            // One-time event: mark as completed
            await eventRef.update({
                completed: true,
                completedAt: occ.occurrenceDate
            });
        } else {
            // Recurring event: add this occurrence date to completedDates array
            await eventRef.update({
                completedDates: firebase.firestore.FieldValue.arrayUnion(occ.occurrenceDate)
            });
        }

        console.log('Event completed:', occ.title, occ.occurrenceDate, '— activities created:', occ.targetType === 'plant' ? 1 : zoneIds.length);

        // Reload the activity history if we're on a zone/plant detail page
        if (occ.targetType === 'plant' && occ.targetId) {
            loadActivities('plant', occ.targetId, 'plantActivityContainer', 'plantActivityEmptyState');
        } else if (zoneIds.length > 0) {
            // Reload activity for any zone currently displayed
            if (window.currentZone && zoneIds.indexOf(window.currentZone.id) >= 0) {
                loadActivities('zone', window.currentZone.id, 'zoneActivityContainer', 'zoneActivityEmptyState');
            }
        }

        // Reload the event list
        if (typeof reloadFn === 'function') {
            reloadFn();
        }

    } catch (error) {
        console.error('Error completing event:', error);
        alert('Error completing event. Check console for details.');
    }
}

// ---------- Add Event Modal ----------

/**
 * Opens the add-event modal with blank fields.
 * @param {string|null} targetType - Optional: "zone" or "plant" (when called from a detail page).
 * @param {string|null} targetId - Optional: The target's Firestore document ID.
 * @param {Function|null} reloadFn - Optional: Callback to reload after save.
 */
async function openAddCalendarEventModal(targetType, targetId, reloadFn) {
    var modal = document.getElementById('calendarEventModal');
    var modalTitle = document.getElementById('calendarEventModalTitle');

    modalTitle.textContent = 'Add Event';

    document.getElementById('calEventTitleInput').value = '';
    document.getElementById('calEventDescInput').value = '';
    document.getElementById('calEventTypeSelect').value = 'one-time';
    document.getElementById('calEventDateInput').value = '';
    document.getElementById('calEventFrequencySelect').value = 'weekly';
    document.getElementById('calEventIntervalInput').value = '14';

    modal.dataset.mode = 'add';
    modal.dataset.targetType = targetType || '';
    modal.dataset.targetId = targetId || '';
    modal.dataset.occurrenceDate = '';

    // Hide delete button in add mode
    document.getElementById('calEventDeleteBtn').style.display = 'none';

    // Show linked entity label if opened from a zone/plant
    var linkedEntityEl = document.getElementById('calEventLinkedEntity');
    if (targetType && targetId) {
        var entityName = await resolveTargetName(targetType, targetId);
        linkedEntityEl.textContent = 'Adding event for: ' + entityName;
        linkedEntityEl.style.display = 'block';
    } else {
        linkedEntityEl.style.display = 'none';
    }

    // Show zone checkboxes — hidden for plant-linked events, visible otherwise
    var zoneSection = document.getElementById('calEventZoneSection');
    if (targetType === 'plant') {
        zoneSection.style.display = 'none';
    } else {
        zoneSection.style.display = 'block';
        // Pre-check the current zone if opened from a zone page
        var preSelected = (targetType === 'zone' && targetId) ? [targetId] : [];
        await loadCalEventZoneCheckboxes(preSelected);
    }

    // Load saved actions into dropdown
    await populateSavedActionsDropdown('calEventSavedActionSelect', null);

    // Store reload callback
    calendarEventModalReloadFn = reloadFn || null;

    toggleRecurringOptions();
    openModal('calendarEventModal');
    document.getElementById('calEventTitleInput').focus();
}

// ---------- Edit Event Modal ----------

/**
 * Opens the edit-event modal, loading the event data from Firestore.
 * @param {string} eventId - The calendar event's Firestore document ID.
 * @param {Function|null} reloadFn - Optional: Callback to reload after save.
 * @param {string|null} occurrenceDate - For recurring events: the specific occurrence date being edited.
 *   Stored in modal.dataset.occurrenceDate so the delete handler can offer per-occurrence delete.
 */
async function openEditCalendarEventModal(eventId, reloadFn, occurrenceDate) {
    var modal = document.getElementById('calendarEventModal');
    var modalTitle = document.getElementById('calendarEventModalTitle');

    modalTitle.textContent = 'Edit Event';

    try {
        var doc = await userCol('calendarEvents').doc(eventId).get();
        if (!doc.exists) {
            alert('Event not found.');
            return;
        }

        var event = doc.data();

        document.getElementById('calEventTitleInput').value = event.title || '';
        document.getElementById('calEventDescInput').value = event.description || '';
        document.getElementById('calEventDateInput').value = event.date || '';

        if (event.recurring) {
            document.getElementById('calEventTypeSelect').value = 'recurring';
            document.getElementById('calEventFrequencySelect').value = event.recurring.type || 'weekly';
            document.getElementById('calEventIntervalInput').value = event.recurring.intervalDays || 14;
        } else {
            document.getElementById('calEventTypeSelect').value = 'one-time';
            document.getElementById('calEventFrequencySelect').value = 'weekly';
            document.getElementById('calEventIntervalInput').value = '14';
        }

        modal.dataset.mode = 'edit';
        modal.dataset.editId = eventId;
        modal.dataset.targetType = event.targetType || '';
        modal.dataset.targetId = event.targetId || '';
        modal.dataset.occurrenceDate = occurrenceDate || '';

        // Show delete button in edit mode
        document.getElementById('calEventDeleteBtn').style.display = 'inline-block';

        // For plant-linked events: show read-only plant label, hide zone section.
        // For everything else: hide label, show editable zone checkboxes.
        var linkedEntityEl = document.getElementById('calEventLinkedEntity');
        var zoneSection = document.getElementById('calEventZoneSection');

        if (event.targetType === 'plant' && event.targetId) {
            var entityName = await resolveTargetName('plant', event.targetId);
            linkedEntityEl.textContent = 'Linked to plant: ' + entityName;
            linkedEntityEl.style.display = 'block';
            zoneSection.style.display = 'none';
        } else {
            linkedEntityEl.style.display = 'none';
            zoneSection.style.display = 'block';
            // Pre-select from zoneIds; fall back to targetId for old-style zone-linked events
            var currentZoneIds = event.zoneIds || [];
            if (currentZoneIds.length === 0 && event.targetType === 'zone' && event.targetId) {
                currentZoneIds = [event.targetId];
            }
            await loadCalEventZoneCheckboxes(currentZoneIds);
        }

        // Load saved actions dropdown with current selection
        await populateSavedActionsDropdown('calEventSavedActionSelect', event.savedActionId || null);

        // Store reload callback
        calendarEventModalReloadFn = reloadFn || null;

        toggleRecurringOptions();
        openModal('calendarEventModal');
        document.getElementById('calEventTitleInput').focus();

    } catch (error) {
        console.error('Error loading event for edit:', error);
        alert('Error loading event.');
    }
}

// ---------- Copy Event Modal ----------

/**
 * Opens the add-event modal pre-filled with a copy of an existing event.
 * The date is cleared so the user must pick a new date.
 * @param {string} eventId - The source event's Firestore document ID.
 * @param {Function|null} reloadFn - Optional: Callback to reload after save.
 */
async function openCopyCalendarEventModal(eventId, reloadFn) {
    var modal = document.getElementById('calendarEventModal');
    var modalTitle = document.getElementById('calendarEventModalTitle');

    modalTitle.textContent = 'Copy Event';

    try {
        var doc = await userCol('calendarEvents').doc(eventId).get();
        if (!doc.exists) {
            alert('Event not found.');
            return;
        }

        var event = doc.data();

        document.getElementById('calEventTitleInput').value = event.title || '';
        document.getElementById('calEventDescInput').value = event.description || '';

        // Set to one-time with blank date so user must pick a new date
        document.getElementById('calEventTypeSelect').value = 'one-time';
        document.getElementById('calEventDateInput').value = '';
        document.getElementById('calEventFrequencySelect').value = 'weekly';
        document.getElementById('calEventIntervalInput').value = '14';

        modal.dataset.mode = 'add'; // It's a new event (copy)
        modal.dataset.targetType = '';
        modal.dataset.targetId = '';

        // Hide delete button in copy mode
        document.getElementById('calEventDeleteBtn').style.display = 'none';

        document.getElementById('calEventLinkedEntity').style.display = 'none';

        // Show empty zone checkboxes (copy starts with no zone selections)
        var zoneSection = document.getElementById('calEventZoneSection');
        zoneSection.style.display = 'block';
        await loadCalEventZoneCheckboxes([]);

        // Load saved actions dropdown (no pre-selection for a copy)
        await populateSavedActionsDropdown('calEventSavedActionSelect', null);

        calendarEventModalReloadFn = reloadFn || null;

        toggleRecurringOptions();
        openModal('calendarEventModal');
        document.getElementById('calEventDateInput').focus();

    } catch (error) {
        console.error('Error loading event for copy:', error);
        alert('Error loading event.');
    }
}

// ---------- Save Event ----------

/**
 * Handles the save button in the calendar event modal (add or edit).
 */
async function handleCalendarEventModalSave() {
    var modal = document.getElementById('calendarEventModal');
    var title = document.getElementById('calEventTitleInput').value.trim();
    var description = document.getElementById('calEventDescInput').value.trim();
    var eventType = document.getElementById('calEventTypeSelect').value;
    var date = document.getElementById('calEventDateInput').value;
    var frequency = document.getElementById('calEventFrequencySelect').value;
    var intervalDays = parseInt(document.getElementById('calEventIntervalInput').value) || 14;
    var savedActionId = document.getElementById('calEventSavedActionSelect').value || null;

    // Collect selected zone IDs (only shown for non-plant events)
    var zoneIds = [];
    var zoneSection = document.getElementById('calEventZoneSection');
    if (zoneSection.style.display !== 'none') {
        var zoneCheckboxes = document.querySelectorAll('#calEventZoneCheckboxList input[type="checkbox"]:checked');
        zoneCheckboxes.forEach(function(cb) {
            zoneIds.push(cb.value);
        });
    }

    if (!title) {
        alert('Please enter a title.');
        return;
    }

    if (!date) {
        alert('Please select a date.');
        return;
    }

    // Require at least one zone or plant to be linked
    var isPlantLinked = (modal.dataset.targetType === 'plant') && !!modal.dataset.targetId;
    if (!isPlantLinked && zoneIds.length === 0) {
        alert('Please link this event to at least one zone (or open it from a plant page).');
        return;
    }

    // Build recurring object (null for one-time)
    var recurring = null;
    if (eventType === 'recurring') {
        recurring = { type: frequency };
        if (frequency === 'every_x_days') {
            recurring.intervalDays = intervalDays;
        }
    }

    var targetType = modal.dataset.targetType || null;
    var targetId = modal.dataset.targetId || null;
    var mode = modal.dataset.mode;

    try {
        if (mode === 'add') {
            await userCol('calendarEvents').add({
                title: title,
                description: description,
                date: date,
                recurring: recurring,
                targetType: targetType || null,
                targetId: targetId || null,
                zoneIds: zoneIds,
                savedActionId: savedActionId,
                completed: false,
                completedDates: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Calendar event added:', title);

        } else if (mode === 'edit') {
            var eventId = modal.dataset.editId;
            await userCol('calendarEvents').doc(eventId).update({
                title: title,
                description: description,
                date: date,
                recurring: recurring,
                targetType: targetType || null,
                targetId: targetId || null,
                zoneIds: zoneIds,
                savedActionId: savedActionId
            });
            console.log('Calendar event updated:', title);
        }

        closeModal('calendarEventModal');

        // Call the stored reload function, or fall back to loadCalendar
        if (typeof calendarEventModalReloadFn === 'function') {
            calendarEventModalReloadFn();
        } else {
            loadCalendar();
        }

    } catch (error) {
        console.error('Error saving calendar event:', error);
        alert('Error saving event. Check console for details.');
    }
}

// ---------- Delete Event ----------

/**
 * Deletes a calendar event after confirmation.
 * For recurring events, warns that ALL occurrences will be deleted.
 * @param {string} eventId - The event's Firestore document ID.
 * @param {Function|null} reloadFn - Optional: Callback to reload after delete.
 */
async function handleDeleteCalendarEvent(eventId, reloadFn) {
    try {
        await userCol('calendarEvents').doc(eventId).delete();
        console.log('Calendar event deleted:', eventId);

        if (typeof reloadFn === 'function') {
            reloadFn();
        } else {
            loadCalendar();
        }

    } catch (error) {
        console.error('Error deleting calendar event:', error);
        alert('Error deleting event. Check console for details.');
    }
}

// ---------- Helpers ----------

/**
 * Populates the saved action dropdown in the calendar event modal.
 * @param {string} selectId - The ID of the select element.
 * @param {string|null} selectedId - The ID to pre-select (or null for none).
 */
async function populateSavedActionsDropdown(selectId, selectedId) {
    var select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- None --</option>';

    try {
        var actions = await getAllSavedActions();
        actions.forEach(function(action) {
            var option = document.createElement('option');
            option.value = action.id;
            option.textContent = action.name;
            if (action.id === selectedId) option.selected = true;
            select.appendChild(option);
        });
    } catch (e) {
        console.error('Error loading saved actions for calendar modal:', e);
    }
}

/**
 * When a saved action is selected in the calendar event modal,
 * pre-fill the title and description from the saved action.
 */
async function handleCalEventSavedActionSelect() {
    var actionId = document.getElementById('calEventSavedActionSelect').value;
    if (!actionId) return;

    try {
        var doc = await userCol('savedActions').doc(actionId).get();
        if (!doc.exists) return;
        var action = doc.data();
        if (action.name) {
            document.getElementById('calEventTitleInput').value = action.name;
        }
        if (action.description) {
            document.getElementById('calEventDescInput').value = action.description;
        }
    } catch (e) {
        console.error('Error loading saved action for calendar modal:', e);
    }
}

/**
 * Resolves a targetType/targetId to a human-readable name.
 * @param {string} targetType - "zone" or "plant"
 * @param {string} targetId - The Firestore document ID.
 * @returns {Promise<string>} The entity name.
 */
async function resolveTargetName(targetType, targetId) {
    try {
        var collection = targetType === 'plant' ? 'plants' : 'zones';
        var doc = await userCol(collection).doc(targetId).get();
        if (doc.exists) return doc.data().name || targetId;
    } catch (e) { /* ignore */ }
    return targetId;
}

// ---------- Zone Checkbox Helper ----------

/**
 * Populates the zone checkbox list in the calendar event modal.
 * Loads all zones in hierarchy order and pre-checks the given IDs.
 * @param {string[]} selectedZoneIds - Zone IDs to pre-check.
 */
async function loadCalEventZoneCheckboxes(selectedZoneIds) {
    var container = document.getElementById('calEventZoneCheckboxList');
    container.innerHTML = '<p style="margin:0;font-size:0.85rem;color:#888">Loading zones...</p>';

    try {
        var snapshot = await userCol('zones').get();
        var allZones = [];
        snapshot.forEach(function(doc) {
            allZones.push({ id: doc.id, ...doc.data() });
        });

        // buildZoneOptionsTree is defined in plants.js (loaded before calendar.js)
        var options = buildZoneOptionsTree(allZones, null, '');

        container.innerHTML = '';

        if (options.length === 0) {
            container.innerHTML = '<p class="empty-state" style="margin:0">No zones created yet.</p>';
            return;
        }

        options.forEach(function(opt) {
            var wrapper = document.createElement('label');
            wrapper.className = 'zone-checkbox-item';

            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = opt.id;
            checkbox.checked = selectedZoneIds.indexOf(opt.id) !== -1;

            var text = document.createElement('span');
            text.textContent = opt.label;

            wrapper.appendChild(checkbox);
            wrapper.appendChild(text);
            container.appendChild(wrapper);
        });

    } catch (error) {
        console.error('Error loading zones for calendar event modal:', error);
        container.innerHTML = '<p class="empty-state" style="margin:0">Error loading zones.</p>';
    }
}

// ---------- UI Helpers ----------

/**
 * Shows/hides the recurring options based on the event type dropdown.
 * Also updates the date label text.
 */
function toggleRecurringOptions() {
    var eventType = document.getElementById('calEventTypeSelect').value;
    var recurringOptions = document.getElementById('calRecurringOptions');
    var dateLabel = document.getElementById('calEventDateLabel');

    if (eventType === 'recurring') {
        recurringOptions.style.display = 'block';
        dateLabel.textContent = 'Start Date';
    } else {
        recurringOptions.style.display = 'none';
        dateLabel.textContent = 'Date';
    }

    toggleIntervalInput();
}

/**
 * Shows/hides the "Every X Days" interval input based on frequency selection.
 */
function toggleIntervalInput() {
    var frequency = document.getElementById('calEventFrequencySelect').value;
    var intervalGroup = document.getElementById('calIntervalGroup');

    if (frequency === 'every_x_days') {
        intervalGroup.style.display = 'block';
    } else {
        intervalGroup.style.display = 'none';
    }
}

// ---------- Date Formatting Helpers ----------

/**
 * Formats a Date object as "YYYY-MM-DD".
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
function formatDateISO(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

// ---------- Delete Recurring Event Modal ----------

/**
 * Opens the modal that lets the user choose: delete just this occurrence or all occurrences.
 * @param {string} eventId - The calendar event's Firestore document ID.
 * @param {string} occurrenceDate - ISO date string of the specific occurrence being deleted.
 * @param {string} title - The event title (for display in the modal).
 * @param {Function} reloadFn - Callback to reload after delete.
 */
function openDeleteRecurringModal(eventId, occurrenceDate, title, reloadFn) {
    var dateObj = new Date(occurrenceDate + 'T00:00:00');
    var dateStr = dateObj.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
    document.getElementById('deleteRecurringInfo').textContent = title + ' — ' + dateStr;
    pendingDeleteRecurring = { eventId: eventId, occurrenceDate: occurrenceDate, reloadFn: reloadFn };
    openModal('deleteRecurringModal');
}

/**
 * Deletes only the current occurrence of a recurring event by adding it to cancelledDates[].
 * The event document remains; other occurrences are unaffected.
 */
async function handleDeleteThisOccurrence() {
    if (!pendingDeleteRecurring) return;
    var eventId = pendingDeleteRecurring.eventId;
    var occurrenceDate = pendingDeleteRecurring.occurrenceDate;
    var reloadFn = pendingDeleteRecurring.reloadFn;
    pendingDeleteRecurring = null;
    closeModal('deleteRecurringModal');

    try {
        await userCol('calendarEvents').doc(eventId).update({
            cancelledDates: firebase.firestore.FieldValue.arrayUnion(occurrenceDate)
        });
        console.log('Cancelled occurrence:', occurrenceDate, 'for event:', eventId);
        if (typeof reloadFn === 'function') reloadFn();
        else loadCalendar();
    } catch (error) {
        console.error('Error cancelling occurrence:', error);
        alert('Error deleting occurrence. Check console for details.');
    }
}

/**
 * Deletes all occurrences of a recurring event by removing the Firestore document.
 * Shows a final confirmation before proceeding.
 */
async function handleDeleteAllOccurrences() {
    if (!pendingDeleteRecurring) return;
    var eventId = pendingDeleteRecurring.eventId;
    var reloadFn = pendingDeleteRecurring.reloadFn;
    pendingDeleteRecurring = null;
    closeModal('deleteRecurringModal');

    if (!confirm('Delete ALL occurrences of this recurring event? This cannot be undone.')) return;
    handleDeleteCalendarEvent(eventId, reloadFn);
}

// ---------- Home Page Calendar (compact) ----------

/**
 * Loads upcoming calendar events for display on the My Yard home page.
 * Shows a compact list of events for the next 3 months.
 */
async function loadHomeCalendar() {
    var container = document.getElementById('homeCalendarContainer');
    var emptyState = document.getElementById('homeCalendarEmptyState');

    var rangeMonths = 3;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var rangeStart = formatDateISO(today);

    var rangeEndDate = new Date(today);
    rangeEndDate.setMonth(rangeEndDate.getMonth() + rangeMonths);
    var rangeEnd = formatDateISO(rangeEndDate);

    try {
        var snapshot = await userCol('calendarEvents').get();

        container.innerHTML = '';

        if (snapshot.empty) {
            emptyState.textContent = 'No upcoming events.';
            emptyState.style.display = 'block';
            return;
        }

        var events = [];
        snapshot.forEach(function(doc) {
            events.push({ id: doc.id, ...doc.data() });
        });

        var allOccurrences = [];
        events.forEach(function(event) {
            var occurrences = generateOccurrences(event, rangeStart, rangeEnd);
            var upcoming = occurrences.filter(function(occ) { return !occ.completed; });
            allOccurrences = allOccurrences.concat(upcoming);
        });

        allOccurrences.sort(function(a, b) {
            return a.occurrenceDate.localeCompare(b.occurrenceDate);
        });

        if (allOccurrences.length === 0) {
            emptyState.textContent = 'No upcoming events in the next 3 months.';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Show up to 10 upcoming events as full cards with Complete/Edit/Copy/Delete
        var limit = Math.min(allOccurrences.length, 10);
        for (var i = 0; i < limit; i++) {
            var card = createCalendarEventCard(allOccurrences[i], loadHomeCalendar);
            container.appendChild(card);
        }

        if (allOccurrences.length > limit) {
            var moreLink = document.createElement('div');
            moreLink.className = 'home-calendar-more';
            moreLink.innerHTML = '<a href="#calendar">' + (allOccurrences.length - limit) + ' more events \u203A</a>';
            container.appendChild(moreLink);
        }

    } catch (error) {
        console.error('Error loading home calendar:', error);
        emptyState.textContent = 'Error loading calendar.';
        emptyState.style.display = 'block';
    }
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    // "Add Event" button on calendar page
    document.getElementById('addCalendarEventBtn').addEventListener('click', function() {
        openAddCalendarEventModal(null, null, loadCalendar);
    });

    // Range dropdown change — reload calendar
    document.getElementById('calendarRangeSelect').addEventListener('change', function() {
        loadCalendar();
    });

    // "Show completed" checkbox — reload calendar to include/exclude completed events
    document.getElementById('showCompletedCalendarEvents').addEventListener('change', function() {
        loadCalendar();
    });

    // Calendar event modal — Save button
    document.getElementById('calEventSaveBtn').addEventListener('click', handleCalendarEventModalSave);

    // Calendar event modal — Delete button (edit mode only)
    // For recurring events with a known occurrence date, offer per-occurrence or all-occurrences delete.
    // For one-time events (or recurring without occurrence context), use a simple confirm.
    document.getElementById('calEventDeleteBtn').addEventListener('click', async function() {
        var modal = document.getElementById('calendarEventModal');
        var eventId = modal.dataset.editId;
        var occurrenceDate = modal.dataset.occurrenceDate || '';
        var reloadFn = typeof calendarEventModalReloadFn === 'function' ? calendarEventModalReloadFn : loadCalendar;

        try {
            var doc = await userCol('calendarEvents').doc(eventId).get();
            if (!doc.exists) return;
            var event = doc.data();

            if (event.recurring && occurrenceDate) {
                // Recurring event opened from a specific occurrence card — offer choice
                closeModal('calendarEventModal');
                openDeleteRecurringModal(eventId, occurrenceDate, event.title, reloadFn);
            } else {
                // One-time event, or recurring opened without a specific date context
                var message = event.recurring
                    ? 'This is a recurring event. Deleting it will remove ALL occurrences. Continue?'
                    : 'Are you sure you want to delete this event?';
                if (!confirm(message)) return;
                closeModal('calendarEventModal');
                handleDeleteCalendarEvent(eventId, reloadFn);
            }
        } catch (e) {
            if (!confirm('Are you sure you want to delete this event?')) return;
            closeModal('calendarEventModal');
            handleDeleteCalendarEvent(eventId, reloadFn);
        }
    });

    // Calendar event modal — Cancel button
    document.getElementById('calEventCancelBtn').addEventListener('click', function() {
        closeModal('calendarEventModal');
    });

    // Calendar event modal — Close on overlay click
    document.getElementById('calendarEventModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('calendarEventModal');
    });

    // Calendar event modal — Enter key on title to save
    document.getElementById('calEventTitleInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleCalendarEventModalSave();
    });

    // Event type dropdown change — toggle recurring options
    document.getElementById('calEventTypeSelect').addEventListener('change', function() {
        toggleRecurringOptions();
    });

    // Frequency dropdown change — toggle interval input
    document.getElementById('calEventFrequencySelect').addEventListener('change', function() {
        toggleIntervalInput();
    });

    // Saved action dropdown in calendar modal — auto-fill title/description
    document.getElementById('calEventSavedActionSelect').addEventListener('change', handleCalEventSavedActionSelect);

    // Delete recurring modal — "Delete This Occurrence" button
    document.getElementById('deleteThisOccurrenceBtn').addEventListener('click', handleDeleteThisOccurrence);

    // Delete recurring modal — "Delete All Occurrences" button
    document.getElementById('deleteAllOccurrencesBtn').addEventListener('click', handleDeleteAllOccurrences);

    // Delete recurring modal — Cancel button
    document.getElementById('deleteRecurringCancelBtn').addEventListener('click', function() {
        closeModal('deleteRecurringModal');
        pendingDeleteRecurring = null;
    });

    // Delete recurring modal — Close on overlay click
    document.getElementById('deleteRecurringModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal('deleteRecurringModal');
            pendingDeleteRecurring = null;
        }
    });

    // Complete event modal — Confirm button
    document.getElementById('completeEventConfirmBtn').addEventListener('click', handleCompleteEvent);

    // Complete event modal — Cancel button
    document.getElementById('completeEventCancelBtn').addEventListener('click', function() {
        closeModal('completeEventModal');
        pendingCompleteOccurrence = null;
    });

    // Complete event modal — Close on overlay click
    document.getElementById('completeEventModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal('completeEventModal');
            pendingCompleteOccurrence = null;
        }
    });
});
