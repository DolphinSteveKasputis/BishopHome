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
const TOP_LEVEL_PAGES = ['home', 'weeds', 'calendar', 'chemicals', 'actions', 'house', 'settings', 'main', 'search', 'activityreport', 'checklists', 'notes', 'chat', 'vehicles', 'garage', 'structures'];

/**
 * All pages that can be shown (includes detail pages not in the nav).
 */
const ALL_PAGES = [
    ...TOP_LEVEL_PAGES,
    'zone', 'plant', 'weed', 'chemical', 'gpsmap', 'yardmap',
    'floor', 'room', 'thing', 'subthing', 'floorplan', 'panel', 'rooms', 'things',
    'backup', 'vehicle',
    'garageroom', 'garagething', 'garagesubthing',
    'structure', 'structurething', 'structuresubthing'
];

/**
 * House-context pages — switching to any of these shows the house nav.
 * Yard-context pages — switching to any of these shows the yard nav.
 * Shared pages (calendar, settings) keep whichever context was last active.
 */
const HOUSE_PAGES = ['house', 'floor', 'room', 'thing', 'subthing', 'floorplan', 'panel', 'rooms', 'things'];
const YARD_PAGES  = ['main', 'home', 'zone', 'plant', 'weeds', 'weed', 'chemicals', 'chemical', 'actions', 'gpsmap', 'yardmap', 'activityreport', 'checklists',
                     'structures', 'structure', 'structurething', 'structuresubthing'];

/** Tracks which nav context is currently active ('yard' or 'house'). */
var currentNavContext = 'yard';

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

    // Toggle yard vs house nav bars (desktop + mobile sections)
    var isHouse = currentNavContext === 'house';
    var yardNavEl        = document.getElementById('yardNav');
    var houseNavEl       = document.getElementById('houseNav');
    var mobileYardNavEl  = document.getElementById('mobileNavYard');
    var mobileHouseNavEl = document.getElementById('mobileNavHouse');
    if (yardNavEl)        yardNavEl.classList.toggle('hidden', isHouse);
    if (houseNavEl)       houseNavEl.classList.toggle('hidden', !isHouse);
    if (mobileYardNavEl)  mobileYardNavEl.classList.toggle('hidden', isHouse);
    if (mobileHouseNavEl) mobileHouseNavEl.classList.toggle('hidden', !isHouse);

    // Determine which nav link should be highlighted
    var navPage = page;
    if (page === 'zone' || page === 'plant' || page === 'gpsmap' || page === 'yardmap') navPage = 'home';
    if (page === 'structure' || page === 'structurething' || page === 'structuresubthing') navPage = 'structures';
    if (page === 'weed')       navPage = 'weeds';
    if (page === 'chemical')   navPage = 'chemicals';
    if (page === 'floor')      navPage = 'house';
    if (page === 'room')       navPage = 'house';
    if (page === 'thing')      navPage = 'house';
    if (page === 'floorplan')  navPage = 'house';
    if (page === 'panel')      navPage = 'house';
    if (page === 'subthing')   navPage = 'house';
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
        showPage('zone');
        loadZoneDetail(id);
    } else if (page === 'plant' && id) {
        showPage('plant');
        loadPlantDetail(id);
    } else if (page === 'weed' && id) {
        showPage('weed');
        loadWeedDetail(id);
    } else if (page === 'home') {
        showPage('home');
        loadZonesList();
    } else if (page === 'main') {
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
        showPage('house');
        loadHousePage();
    } else if (page === 'rooms') {
        showPage('rooms');
        loadRoomsPage();
    } else if (page === 'things') {
        showPage('things');
        loadThingsPage();
    } else if (page === 'floor' && id) {
        showPage('floor');
        loadFloorDetail(id);
    } else if (page === 'room' && id) {
        showPage('room');
        loadRoomDetail(id);
    } else if (page === 'thing' && id) {
        showPage('thing');
        loadThingDetail(id);
    } else if (page === 'floorplan' && id) {
        showPage('floorplan');
        loadFloorPlanPage(id);
    } else if (page === 'panel' && id) {
        showPage('panel');
        loadPanelDetail(id);
    } else if (page === 'subthing' && id) {
        showPage('subthing');
        loadSubThingDetail(id);
    } else if (page === 'checklists') {
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
        loadSettingsPage();
    } else if (page === 'backup') {
        showPage('backup');
        loadBackupPage();
    } else if (page === 'notes') {
        showPage('notes');
        loadNotesPage();
    } else if (page === 'chat') {
        showPage('chat');
        loadChatPage();
    } else if (page === 'vehicles') {
        showPage('vehicles');
        loadVehiclesPage();
    } else if (page === 'vehicle' && id) {
        showPage('vehicle');
        loadVehiclePage(id);
    } else if (page === 'garage') {
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

// ---------- Initialize ----------

window.addEventListener('hashchange', handleRoute);

/**
 * Called by auth.js once the user is confirmed signed in.
 * Loads the app name from Firestore first, then routes to the correct page.
 */
function initApp() {
    initAppName().then(function() {
        handleRoute();
    });
    console.log("Bishop app initialized.");
}
