// ============================================================
// App.js — Main application logic
// Handles page routing (hash-based) and shared UI behavior
// ============================================================

// ---------- Router ----------
// We use the URL hash (#main, #home, #house, etc.) to show/hide pages.

/**
 * List of top-level pages that map to nav links.
 * These pages clear the breadcrumb bar when shown.
 */
const TOP_LEVEL_PAGES = ['home', 'weeds', 'calendar', 'chemicals', 'actions', 'house', 'settings', 'settings-general', 'settings-contact-lists', 'main', 'search', 'activityreport', 'checklists', 'notes', 'chat', 'vehicles', 'garage', 'structures', 'life', 'journal', 'collections', 'changepassword', 'people', 'contacts', 'places', 'devnotes',
                         'health', 'health-visits', 'health-medications', 'health-conditions', 'health-concerns', 'health-bloodwork',
                         'health-vitals', 'health-insurance', 'health-emergency', 'health-appointments', 'health-care-team',
                         'life-calendar', 'life-projects'];

/**
 * All pages that can be shown (includes detail pages not in the nav).
 */
const ALL_PAGES = [
    ...TOP_LEVEL_PAGES,
    'zone', 'plant', 'weed', 'chemical', 'gpsmap', 'yardmap',
    'floor', 'room', 'thing', 'subthing', 'item', 'floorplan', 'panel', 'rooms', 'things', 'house-problems', 'house-projects', 'house-calendar-events', 'yard-projects', 'yard-problems', 'floorplanitem',
    'backup', 'vehicle',
    'garageroom', 'garagething', 'garagesubthing',
    'structure', 'structurething', 'structuresubthing',
    'journal-entry', 'journal-tracking', 'journal-categories',
    'collection', 'collectionitem',
    'place',
    'person', 'contact',
    'notebook', 'note',
    'health-allergies', 'health-supplements', 'health-vaccinations', 'health-eye',
    'health-visit', 'health-visit-step2', 'health-medications', 'health-conditions', 'health-concerns', 'health-concern', 'health-condition',
    'health-bloodwork-detail', 'health-insurance-detail',
    'life-event',
    'life-projects', 'life-project'
];

/**
 * House-context pages — switching to any of these shows the house nav.
 * Yard-context pages — switching to any of these shows the yard nav.
 * Shared pages (calendar, settings) keep whichever context was last active.
 */
const HOUSE_PAGES = ['house', 'floor', 'room', 'thing', 'subthing', 'item', 'floorplan', 'panel', 'rooms', 'things', 'house-problems', 'house-projects', 'house-calendar-events', 'floorplanitem'];
const YARD_PAGES  = ['main', 'home', 'zones', 'zone', 'plant', 'weeds', 'weed', 'chemicals', 'chemical', 'actions', 'gpsmap', 'yardmap', 'activityreport',
                     'structures', 'structure', 'structurething', 'structuresubthing', 'yard-projects', 'yard-problems'];
// NOTE: 'checklists' is intentionally NOT in any context list — it is a shared page
// that inherits the nav context that was active when the user clicked the Checklists link.
const LIFE_PAGES  = ['life', 'journal', 'journal-entry', 'journal-tracking', 'journal-categories', 'people', 'contacts', 'person', 'contact',
                     'notes', 'notebook', 'note',
                     'health', 'health-visits', 'health-visit', 'health-visit-step2',
                     'health-medications', 'health-conditions', 'health-concerns', 'health-concern', 'health-condition',
                     'health-allergies', 'health-supplements', 'health-vaccinations', 'health-eye',
                     'health-bloodwork', 'health-bloodwork-detail',
                     'health-vitals', 'health-insurance', 'health-insurance-detail', 'health-emergency',
                     'health-appointments', 'health-care-team',
                     'life-calendar', 'life-event',
                     'life-projects', 'life-project'];

/** Tracks which nav context is currently active ('yard', 'house', or 'life'). */
var currentNavContext = 'yard';

/**
 * Tracks the type of entity most recently loaded ('zone', 'floor', 'room',
 * 'vehicle', or null for top-level pages).  Used by clCaptureContext() to
 * determine which entity global is current vs. stale from a prior page.
 * Set in handleRoute() before each page load.
 */
window.clLastEntityType = null;

/**
 * Captures the current navigation context for the Checklists page.
 * Called in handleRoute() immediately before navigating to #checklists,
 * while entity globals (currentZone, currentRoom, etc.) are still fresh.
 *
 * Uses clLastEntityType to distinguish "I'm on a zone page" from "I was
 * on a zone page earlier but am now on a top-level yard page."
 *
 * @returns {Object}  — { type, id?, name? }
 */
function clCaptureContext() {
    var lastType = window.clLastEntityType;

    if (currentNavContext === 'life') {
        return { type: 'life' };
    }

    if (currentNavContext === 'house') {
        if (lastType === 'room' && window.currentRoom) {
            return { type: 'room', id: window.currentRoom.id, name: window.currentRoom.name };
        }
        if (lastType === 'floor' && window.currentFloor) {
            return { type: 'floor', id: window.currentFloor.id, name: window.currentFloor.name };
        }
        return { type: 'house' };
    }

    // Yard context (also covers garage / vehicle pages which share the yard nav)
    if (lastType === 'vehicle' && window.currentVehicle) {
        var v = window.currentVehicle;
        var vName = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
        return { type: 'vehicle', id: v.id, name: vName };
    }
    if (lastType === 'zone' && window.currentZone) {
        return { type: 'zone', id: window.currentZone.id, name: window.currentZone.name };
    }
    return { type: 'yard' };
}

/**
 * Navigate to a page by showing/hiding the right section.
 * Also swaps the nav bar between yard and house contexts.
 * @param {string} page - The page name (e.g., "home", "zone", "house")
 */
function showPage(page) {
    // Hide all page sections
    ALL_PAGES.forEach(function(p) {
        const el = document.getElementById('page-' + p);
        if (el) el.classList.add('hidden');
    });

    // Show the requested page
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) targetPage.classList.remove('hidden');

    // Update nav context (shared pages keep the current context)
    if (HOUSE_PAGES.indexOf(page) !== -1)     currentNavContext = 'house';
    else if (YARD_PAGES.indexOf(page) !== -1) currentNavContext = 'yard';
    else if (LIFE_PAGES.indexOf(page) !== -1) currentNavContext = 'life';

    // Toggle yard / house / life nav bars (desktop + mobile sections)
    var isHouse = currentNavContext === 'house';
    var isLife  = currentNavContext === 'life';
    var yardNavEl        = document.getElementById('yardNav');
    var houseNavEl       = document.getElementById('houseNav');
    var lifeNavEl        = document.getElementById('lifeNav');
    var mobileYardNavEl  = document.getElementById('mobileNavYard');
    var mobileHouseNavEl = document.getElementById('mobileNavHouse');
    var mobileLifeNavEl  = document.getElementById('mobileNavLife');
    if (yardNavEl)        yardNavEl.classList.toggle('hidden',  isHouse || isLife);
    if (houseNavEl)       houseNavEl.classList.toggle('hidden', !isHouse || isLife);
    if (lifeNavEl)        lifeNavEl.classList.toggle('hidden',  !isLife);
    if (mobileYardNavEl)  mobileYardNavEl.classList.toggle('hidden',  isHouse || isLife);
    if (mobileHouseNavEl) mobileHouseNavEl.classList.toggle('hidden', !isHouse || isLife);
    if (mobileLifeNavEl)  mobileLifeNavEl.classList.toggle('hidden',  !isLife);

    // Determine which nav link should be highlighted
    var navPage = page;
    if (page === 'zone' || page === 'plant' || page === 'gpsmap' || page === 'yardmap') navPage = 'home';
    if (page === 'structure' || page === 'structurething' || page === 'structuresubthing') navPage = 'structures';
    if (page === 'weed')       navPage = 'weeds';
    if (page === 'chemical')   navPage = 'chemicals';
    if (page === 'floor')      navPage = 'house';
    if (page === 'room')       navPage = 'house';
    if (page === 'thing')      navPage = 'house';
    if (page === 'floorplan')     navPage = 'house';
    if (page === 'floorplanitem') navPage = 'house';
    if (page === 'panel')         navPage = 'house';
    if (page === 'subthing')   navPage = 'house';
    if (page === 'item')       navPage = 'house';
    if (page === 'person')     navPage = 'people';   // Sub-page of people (legacy)
    if (page === 'contact')    navPage = 'contacts'; // Sub-page of contacts
    if (page === 'notebook')   navPage = 'notes';  // Sub-page of notes
    if (page === 'note')       navPage = 'notes';  // Sub-page of notes
    if (page === 'main')       navPage = '';       // No link highlighted on the landing page

    document.querySelectorAll('.nav-link').forEach(function(link) {
        link.classList.remove('active');
        if (navPage && link.getAttribute('data-page') === navPage) {
            link.classList.add('active');
        }
    });

    // On the landing page show only Settings + Sign Out in the nav;
    // on all other pages restore the full nav.
    document.body.classList.toggle('main-page', page === 'main');

    // Close mobile nav if open
    closeMobileNav();

    // Clear breadcrumbs and reset header title for top-level pages
    if (TOP_LEVEL_PAGES.includes(page)) {
        document.getElementById('breadcrumbBar').innerHTML = '';
        document.getElementById('headerTitle').innerHTML =
            '<a href="#main" class="home-link">' +
            escapeHtml(window.appName || 'My House') + '</a>';
    }
}

/**
 * Parse the URL hash and route to the correct page + load its data.
 */
function handleRoute() {
    const hash  = window.location.hash.slice(1) || 'main';
    const parts = hash.split('/');
    const page  = parts[0];
    const id    = parts[1] || null;

    if (page === 'zone' && id) {
        window.clLastEntityType = 'zone';
        showPage('zone');
        loadZoneDetail(id);
    } else if (page === 'plant' && id) {
        showPage('plant');
        loadPlantDetail(id);
    } else if (page === 'weed' && id) {
        showPage('weed');
        loadWeedDetail(id);
    } else if (page === 'home') {
        // #home was the original yard zones route, now redirects to main tiles landing page.
        // This ensures Android shortcuts and old bookmarks land on the correct screen.
        window.location.replace('#main');
        return;
    } else if (page === 'zones') {
        window.clLastEntityType = null;
        showPage('home');
        loadZonesList();
    } else if (page === 'main') {
        window.clLastEntityType = null;
        showPage('main');
    } else if (page === 'weeds') {
        showPage('weeds');
        loadWeedsList();
    } else if (page === 'calendar') {
        showPage('calendar');
        loadCalendar();
    } else if (page === 'chemical' && id) {
        showPage('chemical');
        loadChemicalDetail(id);
    } else if (page === 'chemicals') {
        showPage('chemicals');
        loadChemicalsList();
    } else if (page === 'actions') {
        showPage('actions');
        loadSavedActionsList();
    } else if (page === 'gpsmap' && id) {
        showPage('gpsmap');
        loadGpsMapPage(id);
    } else if (page === 'yardmap') {
        showPage('yardmap');
        loadYardMapPage();
    } else if (page === 'house') {
        window.clLastEntityType = null;
        showPage('house');
        loadHousePage();
    } else if (page === 'rooms') {
        showPage('rooms');
        loadRoomsPage();
    } else if (page === 'things') {
        showPage('things');
        loadThingsPage();
    } else if (page === 'yard-problems') {
        showPage('yard-problems');
        loadYardProblemsPage();
    } else if (page === 'yard-projects') {
        showPage('yard-projects');
        loadYardProjectsPage();
    } else if (page === 'house-projects') {
        showPage('house-projects');
        loadHouseProjectsPage();
    } else if (page === 'house-problems') {
        showPage('house-problems');
        loadHouseProblemsPage();
    } else if (page === 'house-calendar-events') {
        showPage('house-calendar-events');
        loadHouseCalendarEventsPage();
    } else if (page === 'floor' && id) {
        window.clLastEntityType = 'floor';
        showPage('floor');
        loadFloorDetail(id);
    } else if (page === 'room' && id) {
        window.clLastEntityType = 'room';
        showPage('room');
        loadRoomDetail(id);
    } else if (page === 'thing' && id) {
        showPage('thing');
        loadThingDetail(id);
    } else if (page === 'floorplan' && id) {
        showPage('floorplan');
        loadFloorPlanPage(id);
    } else if (page === 'floorplanitem' && id) {
        showPage('floorplanitem');
        loadFloorPlanItemPage(id, parts[2], parts[3]);
    } else if (page === 'panel' && id) {
        showPage('panel');
        loadPanelDetail(id);
    } else if (page === 'subthing' && id) {
        showPage('subthing');
        loadSubThingDetail(id);
    } else if (page === 'item' && id) {
        showPage('item');
        loadItemDetail(id);
    } else if (page === 'checklists') {
        // Capture context BEFORE showPage (entity globals still reflect the page the user came from)
        window.checklistsContext = clCaptureContext();
        showPage('checklists');
        loadChecklistsPage();
    } else if (page === 'activityreport') {
        showPage('activityreport');
        loadActivityReportPage();
    } else if (page === 'search') {
        showPage('search');
        loadSearchPage();
    } else if (page === 'settings') {
        showPage('settings');
        loadSettingsHub();
    } else if (page === 'settings-general') {
        showPage('settings-general');
        loadSettingsGeneralPage();
    } else if (page === 'settings-contact-lists') {
        showPage('settings-contact-lists');
        loadContactListsPage();
    } else if (page === 'changepassword') {
        showPage('changepassword');
        loadChangePasswordPage();
    } else if (page === 'backup') {
        showPage('backup');
        loadBackupPage();
    } else if (page === 'chat') {
        showPage('chat');
        loadChatPage();
    } else if (page === 'vehicles') {
        window.clLastEntityType = null;
        showPage('vehicles');
        loadVehiclesPage();
    } else if (page === 'vehicle' && id) {
        window.clLastEntityType = 'vehicle';
        showPage('vehicle');
        loadVehiclePage(id);
    } else if (page === 'garage') {
        window.clLastEntityType = null;
        showPage('garage');
        loadGaragePage();
    } else if (page === 'garageroom' && id) {
        showPage('garageroom');
        loadGarageRoomPage(id);
    } else if (page === 'garagething' && id) {
        showPage('garagething');
        loadGarageThingPage(id);
    } else if (page === 'garagesubthing' && id) {
        showPage('garagesubthing');
        loadGarageSubThingPage(id);
    } else if (page === 'structures') {
        showPage('structures');
        loadStructuresPage();
    } else if (page === 'structure' && id) {
        showPage('structure');
        loadStructurePage(id);
    } else if (page === 'structurething' && id) {
        showPage('structurething');
        loadStructureThingPage(id);
    } else if (page === 'structuresubthing' && id) {
        showPage('structuresubthing');
        loadStructureSubThingPage(id);
    // ---------- Collections routes ----------
    } else if (page === 'collections') {
        showPage('collections');
        loadCollectionsPage();
    } else if (page === 'collection' && id) {
        showPage('collection');
        loadCollectionPage(id);
    } else if (page === 'collectionitem' && id) {
        showPage('collectionitem');
        loadCollectionItemPage(id);
    // ---------- Life / Contacts routes ----------
    } else if (page === 'contacts') {
        showPage('contacts');
        loadContactsPage();
    } else if (page === 'contact' && id) {
        showPage('contact');
        loadContactDetail(id);
    // ---------- Life / People routes (legacy aliases — redirect to contacts) ----------
    } else if (page === 'people') {
        window.location.replace('#contacts');
        return;
    } else if (page === 'person' && id) {
        window.location.replace('#contact/' + id);
        return;
    // ---------- Life / Journal routes ----------
    } else if (page === 'life') {
        showPage('life');
        loadLifePage();
    } else if (page === 'journal') {
        showPage('journal');
        loadJournalPage();
    } else if (page === 'journal-entry') {
        showPage('journal-entry');
        // Form state is managed by openAddJournalEntry() or openEditJournalEntry().
        // If the user navigates here directly (e.g. back button) just show the page.
    } else if (page === 'journal-tracking') {
        showPage('journal-tracking');
        // Form state is managed by openAddTracking() or openEditTrackingItem().
    } else if (page === 'journal-categories') {
        showPage('journal-categories');
        loadJournalCategoriesPage();
    // ---------- Dev Notes route (shared scratchpad) ----------
    } else if (page === 'devnotes') {
        showPage('devnotes');
        loadDevNotesPage();
    // ---------- Notes routes ----------
    } else if (page === 'notes') {
        showPage('notes');
        loadNotesPage();
    } else if (page === 'notebook' && id) {
        showPage('notebook');
        loadNotebookPage(id);
    } else if (page === 'note' && id === 'new') {
        showPage('note');
        loadNewNotePage();
    } else if (page === 'note' && id) {
        showPage('note');
        loadNotePage(id);
    // ---------- Vitals routes ----------
    } else if (page === 'health-vitals') {
        showPage('health-vitals');
        loadVitalsPage();
    // ---------- Insurance routes ----------
    } else if (page === 'health-insurance' && id) {
        showPage('health-insurance-detail');
        loadInsuranceDetailPage(id);
    } else if (page === 'health-insurance') {
        showPage('health-insurance');
        loadInsurancePage();
    // ---------- Emergency Info route ----------
    } else if (page === 'health-emergency') {
        showPage('health-emergency');
        loadEmergencyPage();
    // ---------- Blood Work routes ----------
    } else if (page === 'health-bloodwork' && id) {
        showPage('health-bloodwork-detail');
        loadBloodWorkDetail(id);
    } else if (page === 'health-bloodwork') {
        showPage('health-bloodwork');
        loadBloodWorkPage();
    } else if (page === 'sb-issues') {
        showPage('sb-issues');
        loadSbIssuesPage();
    // ---------- My Health routes ----------
    } else if (page === 'health-visits') {
        showPage('health-visits');
        loadHealthVisitsPage();
    } else if (page === 'health-visit' && id) {
        showPage('health-visit');
        loadHealthVisitDetail(id);
    } else if (page === 'health-visit-step2' && id) {
        showPage('health-visit-step2');
        loadStep2Page(id);
    } else if (page === 'health-medications') {
        showPage('health-medications');
        loadMedicationsPage();
    } else if (page === 'health-conditions') {
        showPage('health-conditions');
        loadConditionsPage();
    } else if (page === 'health-concerns') {
        showPage('health-concerns');
        loadConcernsPage();
    } else if (page === 'health-concern' && id) {
        showPage('health-concern');
        loadConcernDetail(id);
    } else if (page === 'health-condition' && id) {
        showPage('health-condition');
        loadConditionDetail(id);
    // ---------- Appointments route ----------
    } else if (page === 'health-appointments') {
        showPage('health-appointments');
        loadAppointmentsPage();
    } else if (page === 'health-care-team') {
        showPage('health-care-team');
        loadCareTeam();
    } else if (page === 'health') {
        showPage('health');
        loadHealthPage();
    } else if (page === 'health-allergies') {
        showPage('health-allergies');
        loadAllergyPage();
    } else if (page === 'health-supplements') {
        showPage('health-supplements');
        loadSupplementPage();
    } else if (page === 'health-vaccinations') {
        showPage('health-vaccinations');
        loadVaccinationPage();
    } else if (page === 'health-eye') {
        showPage('health-eye');
        loadEyePage();
    } else if (page === 'life-calendar') {
        showPage('life-calendar');
        loadLifeCalendarPage();
    } else if (page === 'life-event' && id === 'new') {
        showPage('life-event');
        loadNewLifeEventPage();
    } else if (page === 'life-event' && id) {
        showPage('life-event');
        loadLifeEventPage(id);
    // ---------- Life Projects routes ----------
    } else if (page === 'life-projects') {
        showPage('life-projects');
        loadLifeProjectsPage();
    } else if (page === 'life-project' && id) {
        showPage('life-project');
        loadLifeProjectDetailPage(id);
    // ---------- Places routes ----------
    } else if (page === 'places') {
        showPage('places');
        loadPlacesPage();
    } else if (page === 'place' && id) {
        showPage('place');
        loadPlaceDetailPage(id);
    } else if (TOP_LEVEL_PAGES.includes(page)) {
        showPage(page);
    } else {
        // Unknown route — go to landing page
        showPage('main');
    }
}

// ---------- Mobile Navigation ----------

const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileNav    = document.getElementById('mobileNav');

function closeMobileNav() {
    mobileNav.classList.remove('open');
    hamburgerBtn.classList.remove('open');
}

hamburgerBtn.addEventListener('click', function() {
    mobileNav.classList.toggle('open');
    hamburgerBtn.classList.toggle('open');
});

// Close mobile nav when clicking any nav link inside it (both contexts)
mobileNav.querySelectorAll('.nav-link').forEach(function(link) {
    link.addEventListener('click', closeMobileNav);
});

// Wire house-context sign-out buttons to delegate to the main sign-out button
var signOutBtnHouse       = document.getElementById('signOutBtnHouse');
var signOutBtnMobileHouse = document.getElementById('signOutBtnMobileHouse');
if (signOutBtnHouse) {
    signOutBtnHouse.addEventListener('click', function() {
        document.getElementById('signOutBtn').click();
    });
}
if (signOutBtnMobileHouse) {
    signOutBtnMobileHouse.addEventListener('click', function() {
        document.getElementById('signOutBtnMobile').click();
    });
}

// Wire life-context sign-out buttons
var signOutBtnLife       = document.getElementById('signOutBtnLife');
var signOutBtnMobileLife = document.getElementById('signOutBtnMobileLife');
if (signOutBtnLife) {
    signOutBtnLife.addEventListener('click', function() {
        document.getElementById('signOutBtn').click();
    });
}
if (signOutBtnMobileLife) {
    signOutBtnMobileLife.addEventListener('click', function() {
        document.getElementById('signOutBtnMobile').click();
    });
}

// ---------- Initialize ----------

window.addEventListener('hashchange', handleRoute);

/**
 * Handle the Android (and desktop) back button.
 * If a modal is open, close it instead of letting the browser navigate away.
 * Because our routing uses hashchange (not popstate), this listener only fires
 * when a modal's pushState entry is being popped — the hash has NOT changed,
 * so handleRoute is NOT called.
 */
window.addEventListener('popstate', function() {
    // If a file picker (camera/gallery) is open, the mobile browser may fire
    // a popstate when the camera app closes. Ignore it — whatever modal
    // triggered the camera should stay open when the user returns.
    if (window._filePickerOpen) return;

    // If closeModal() itself called history.back(), this popstate was triggered
    // intentionally to keep history in sync — NOT by the user pressing back.
    // Ignore it so we don't accidentally close the next open modal in the stack.
    if (window._modalHistoryBack) {
        window._modalHistoryBack = false;
        return;
    }

    var openOverlay = document.querySelector('.modal-overlay.open');
    if (openOverlay) {
        // closeModal won't call history.back() again here because popstate has
        // already moved history.state back to the pre-modal entry.
        closeModal(openOverlay.id);
    }
});

/**
 * Called by auth.js once the user is confirmed signed in.
 * Loads the app name from Firestore first, then routes to the correct page.
 */
function initApp() {
    initAppName().then(function() {
        handleRoute();
    });
    _initTabIndentTextareas();
    console.log("Bishop app initialized.");
}

/**
 * Make Tab key insert spaces (instead of moving focus) in designated textareas.
 * Uses event delegation on document so it works even if the textarea
 * is rendered after this runs (modals, dynamically added pages, etc.).
 * Applies to: #journalEntryText, #noteTextInput
 */
function _initTabIndentTextareas() {
    var TAB_TARGETS = ['journalEntryText', 'noteTextInput'];
    var TAB_SPACES  = '    '; // 4 spaces per Tab press

    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Tab') return;
        var el = e.target;
        if (!el || el.tagName !== 'TEXTAREA') return;
        if (TAB_TARGETS.indexOf(el.id) === -1) return;

        // Prevent the browser from moving focus
        e.preventDefault();

        // Insert spaces at the cursor position
        var start = el.selectionStart;
        var end   = el.selectionEnd;
        el.value  = el.value.substring(0, start) + TAB_SPACES + el.value.substring(end);

        // Move cursor to after the inserted spaces
        el.selectionStart = el.selectionEnd = start + TAB_SPACES.length;
    });
}
