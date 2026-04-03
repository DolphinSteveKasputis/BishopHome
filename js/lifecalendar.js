// ============================================================
// lifecalendar.js — Life Calendar feature
// Personal event tracking with categories, mini logs, and
// journal integration.
// ============================================================

// ---------- Module State ----------

/** The currently loaded life event (for detail page). */
window.currentLifeEvent = null;

/**
 * Pre-filled date for new event creation.
 * Set by loadLifeCalendarPage() when user clicks a day cell.
 * Consumed (and cleared) by loadNewLifeEventPage().
 */
window._newEventDate = null;

// ---------- Page Loaders (stubs — filled out in later phases) ----------

/**
 * Load the Life Calendar main page (#life-calendar).
 * Shows a monthly/multi-month grid of events with category color coding.
 */
function loadLifeCalendarPage() {
    const section = document.getElementById('page-life-calendar');
    if (!section) return;

    section.innerHTML = `
        <div class="page-header">
            <div class="breadcrumb">
                <a href="#life" class="breadcrumb-link">Life</a>
                <span class="breadcrumb-sep"> › </span>
                <span>Calendar</span>
            </div>
            <h2>Life Calendar</h2>
        </div>
        <div style="padding: 16px; color: var(--text-muted);">
            <p>Life Calendar — coming soon.</p>
            <p style="margin-top:8px;">
                <a href="#life-event/new" class="btn btn-primary">+ New Event</a>
            </p>
        </div>
    `;
}

/**
 * Load the New Life Event page (#life-event/new).
 * Pre-fills the date from window._newEventDate if set.
 */
function loadNewLifeEventPage() {
    const prefillDate = window._newEventDate || '';
    window._newEventDate = null; // consume it

    const section = document.getElementById('page-life-event');
    if (!section) return;

    section.innerHTML = `
        <div class="page-header">
            <div class="breadcrumb">
                <a href="#life" class="breadcrumb-link">Life</a>
                <span class="breadcrumb-sep"> › </span>
                <a href="#life-calendar" class="breadcrumb-link">Calendar</a>
                <span class="breadcrumb-sep"> › </span>
                <span>New Event</span>
            </div>
            <h2>New Event</h2>
        </div>
        <div style="padding: 16px; color: var(--text-muted);">
            <p>New Life Event form — coming soon.</p>
            ${prefillDate ? `<p>Date: ${prefillDate}</p>` : ''}
        </div>
    `;
}

/**
 * Load the Life Event detail page (#life-event/{id}).
 * @param {string} id - Firestore document ID of the life event
 */
function loadLifeEventPage(id) {
    window.currentLifeEvent = null;

    const section = document.getElementById('page-life-event');
    if (!section) return;

    section.innerHTML = `
        <div class="page-header">
            <div class="breadcrumb">
                <a href="#life" class="breadcrumb-link">Life</a>
                <span class="breadcrumb-sep"> › </span>
                <a href="#life-calendar" class="breadcrumb-link">Calendar</a>
                <span class="breadcrumb-sep"> › </span>
                <span>Event</span>
            </div>
            <h2>Event Detail</h2>
        </div>
        <div style="padding: 16px; color: var(--text-muted);">
            <p>Life Event detail — coming soon. (ID: ${id})</p>
        </div>
    `;
}
