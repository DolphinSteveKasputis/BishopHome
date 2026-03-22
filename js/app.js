// ============================================================
// App.js — Main application logic
// Handles page routing (hash-based) and shared UI behavior
// ============================================================

// ---------- Router ----------
// We use the URL hash (#home, #weeds, #calendar, etc.) to show/hide pages.
// This means no server-side routing is needed — it's all client-side.

/**
 * List of top-level pages that map to nav links.
 * Each key matches a hash value AND a data-page attribute AND a page section id.
 */
const TOP_LEVEL_PAGES = ['home', 'weeds', 'calendar', 'chemicals', 'actions'];

/**
 * All pages that can be shown (includes detail pages that aren't in the nav).
 */
const ALL_PAGES = [...TOP_LEVEL_PAGES, 'zone', 'plant', 'weed', 'chemical', 'gpsmap', 'yardmap'];

/**
 * Navigate to a page by showing/hiding the right section.
 * @param {string} page - The page name (e.g., "home", "zone", "plant")
 */
function showPage(page) {
    // Hide all page sections
    ALL_PAGES.forEach(function(p) {
        const el = document.getElementById('page-' + p);
        if (el) {
            el.classList.add('hidden');
        }
    });

    // Show the requested page
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    // Update active state on nav links (both desktop and mobile)
    // Map detail pages to their parent nav link
    var navPage = page;
    if (page === 'zone' || page === 'plant' || page === 'gpsmap' || page === 'yardmap') navPage = 'home';
    if (page === 'weed') navPage = 'weeds';
    if (page === 'chemical') navPage = 'chemicals';

    document.querySelectorAll('.nav-link').forEach(function(link) {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === navPage) {
            link.classList.add('active');
        }
    });

    // Close mobile nav if open
    closeMobileNav();

    // Clear breadcrumbs for top-level pages
    if (TOP_LEVEL_PAGES.includes(page)) {
        document.getElementById('breadcrumbBar').innerHTML = '';
    }
}

/**
 * Parse the URL hash and route to the correct page.
 * Hash format examples:
 *   #home           -> home page (zone list)
 *   #zone/abc123    -> zone detail page for zone with id "abc123"
 *   #plant/xyz789   -> plant detail page for plant with id "xyz789"
 *   #weeds          -> weeds page
 *   #calendar       -> calendar page
 *   #chemicals      -> chemicals page
 *   #actions        -> saved actions page
 */
function handleRoute() {
    const hash = window.location.hash.slice(1) || 'home';  // Remove the '#', default to 'home'
    const parts = hash.split('/');
    const page = parts[0];
    const id = parts[1] || null;

    // Show the correct page section and load its data
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
    } else if (TOP_LEVEL_PAGES.includes(page)) {
        showPage(page);
    } else {
        // Unknown route — go home
        showPage('home');
        loadZonesList();
    }
}

// ---------- Mobile Navigation ----------

const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileNav = document.getElementById('mobileNav');

function closeMobileNav() {
    mobileNav.classList.remove('open');
    hamburgerBtn.classList.remove('open');
}

hamburgerBtn.addEventListener('click', function() {
    mobileNav.classList.toggle('open');
    hamburgerBtn.classList.toggle('open');
});

// Close mobile nav when clicking a link inside it
mobileNav.querySelectorAll('.nav-link').forEach(function(link) {
    link.addEventListener('click', closeMobileNav);
});

// ---------- Initialize ----------

// Listen for hash changes (back/forward buttons, clicking links)
window.addEventListener('hashchange', handleRoute);

/**
 * Called by auth.js once the user is confirmed signed in.
 * Starts the routing so pages can load.
 */
function initApp() {
    handleRoute();
    console.log("Bishop app initialized.");
}
