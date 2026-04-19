// ============================================================
// Search.js — Global search across all entity types
// Searches all named entities by name/title; results link
// directly to each entity's detail page.
// ============================================================

var searchDebounceTimer = null;
var SEARCH_DEBOUNCE_MS  = 350;   // Wait this long after last keystroke before firing

/**
 * Called by the router when navigating to #search.
 * Auto-focuses the input on desktop and wires the listener (once).
 */
function loadSearchPage() {
    var input   = document.getElementById('searchInput');
    var results = document.getElementById('searchResults');
    var empty   = document.getElementById('searchEmptyState');
    if (!input) return;

    // Clear previous run
    results.innerHTML = '';
    empty.classList.add('hidden');

    // Wire up input handler only once (guard with a data flag)
    if (!input.dataset.wired) {
        input.dataset.wired = 'true';
        input.addEventListener('input', function () {
            clearTimeout(searchDebounceTimer);
            var q = input.value.trim();

            // Need at least 2 chars before searching
            if (q.length < 2) {
                results.innerHTML = '';
                empty.classList.add('hidden');
                return;
            }

            searchDebounceTimer = setTimeout(function () {
                runSearch(q);
            }, SEARCH_DEBOUNCE_MS);
        });
    }

    // Auto-focus on desktop; skip on mobile to avoid the keyboard popping up
    // before the user is ready
    if (window.innerWidth > 640) {
        input.focus();
    }
}

/**
 * Load all docs from all searchable collections, filter by name/title,
 * and render grouped results.
 * @param {string} query - The raw search string entered by the user
 */
function runSearch(query) {
    var q         = query.toLowerCase();
    var resultsEl = document.getElementById('searchResults');
    var emptyEl   = document.getElementById('searchEmptyState');

    resultsEl.innerHTML = '<p class="search-loading">Searching…</p>';
    emptyEl.classList.add('hidden');

    // Define every collection to search.
    // urlFn builds the hash URL to navigate to when the user clicks a result.
    // nameField: which doc field holds the display name ('name' or 'title').
    var colDefs = [
        // ── Yard ──
        { col: 'plants',             label: 'Plants',               icon: '🌱', nameField: 'name',  urlFn: function(id) { return '#plant/'           + id; } },
        { col: 'zones',              label: 'Zones',                icon: '🗺️',  nameField: 'name',  urlFn: function(id) { return '#zone/'            + id; } },
        { col: 'chemicals',          label: 'Chemicals',            icon: '🧪', nameField: 'name',  urlFn: function(id) { return '#chemical/'        + id; } },
        { col: 'weeds',              label: 'Weeds',                icon: '🌿', nameField: 'name',  urlFn: function(id) { return '#weed/'            + id; } },
        // ── House ──
        { col: 'floors',             label: 'Floors',               icon: '🏠', nameField: 'name',  urlFn: function(id) { return '#floor/'           + id; } },
        { col: 'rooms',              label: 'Rooms',                icon: '🚪', nameField: 'name',  urlFn: function(id) { return '#room/'            + id; } },
        { col: 'things',             label: 'Things',               icon: '📦', nameField: 'name',  urlFn: function(id) { return '#thing/'           + id; } },
        { col: 'subThings',          label: 'Sub-Things',           icon: '🔩', nameField: 'name',  urlFn: function(id) { return '#subthing/'        + id; } },
        // ── Structures ──
        { col: 'structures',         label: 'Structures',           icon: '🏗️', nameField: 'name',  urlFn: function(id) { return '#structure/'       + id; } },
        { col: 'structureThings',    label: 'Structure Things',     icon: '📦', nameField: 'name',  urlFn: function(id) { return '#structurething/'  + id; } },
        { col: 'structureSubThings', label: 'Structure Sub-Things', icon: '🔩', nameField: 'name',  urlFn: function(id) { return '#structuresubthing/' + id; } },
        // ── Garage ──
        { col: 'garageRooms',        label: 'Garage Areas',         icon: '🚗', nameField: 'name',  urlFn: function(id) { return '#garageroom/'      + id; } },
        { col: 'garageThings',       label: 'Garage Things',        icon: '📦', nameField: 'name',  urlFn: function(id) { return '#garagething/'     + id; } },
        { col: 'garageSubThings',    label: 'Garage Sub-Things',    icon: '🔩', nameField: 'name',  urlFn: function(id) { return '#garagesubthing/' + id; } },
        // ── Vehicles ──
        { col: 'vehicles',           label: 'Vehicles',             icon: '🚙', nameField: 'name',  urlFn: function(id) { return '#vehicle/'         + id; } },
        // ── Collections ──
        { col: 'collections',        label: 'Collections',          icon: '🗃️', nameField: 'name',  urlFn: function(id) { return '#collection/'      + id; } },
        { col: 'collectionItems',    label: 'Collection Items',     icon: '🏷️', nameField: 'name',  urlFn: function(id) { return '#collectionitem/'  + id; } },
        // ── Life ──
        { col: 'people',             label: 'Contacts',             icon: '👤', nameField: 'name',  urlFn: function(id) { return '#contact/'         + id; } },
        { col: 'notebooks',          label: 'Notebooks',            icon: '📓', nameField: 'name',  urlFn: function(id) { return '#notebook/'        + id; } },
        { col: 'places',             label: 'Places',               icon: '📍', nameField: 'name',  urlFn: function(id) { return '#place/'           + id; } },
        { col: 'lifeProjects',       label: 'Life Projects',        icon: '✈️', nameField: 'title', urlFn: function(id) { return '#life-project/'    + id; } },
        // ── Thoughts ──
        { col: 'memories',           label: 'Memories',             icon: '💭', nameField: 'title', urlFn: function(id) { return '#memory-edit/'     + id; } },
        { col: 'views',              label: 'My Views',             icon: '💬', nameField: 'title', urlFn: function(id) { return '#view/'            + id; } },
        { col: 'top10lists',         label: 'Top 10 Lists',         icon: '🔟', nameField: 'title', urlFn: function(id) { return '#top10list-edit/'  + id; } },
    ];

    // Fetch ALL docs from every collection in parallel.
    // We load everything (not just matches) so we can build cross-reference
    // name maps — e.g. show which zone a plant lives in.
    var promises = colDefs.map(function (def) {
        return userCol(def.col).get().then(function (snap) {
            var all = [];
            snap.forEach(function (doc) {
                all.push({ id: doc.id, data: doc.data() });
            });
            return { def: def, all: all };
        });
    });

    Promise.all(promises).then(function (loaded) {

        // Build name maps keyed by collection → { docId: name }
        // Used to add helpful hints under each result (e.g. zone name for a plant)
        var nameMap = {};
        loaded.forEach(function (g) {
            nameMap[g.def.col] = {};
            g.all.forEach(function (item) {
                nameMap[g.def.col][item.id] = item.data.name || item.data.title || '';
            });
        });

        // Filter each collection's docs by the search term
        resultsEl.innerHTML = '';
        var totalFound = 0;

        loaded.forEach(function (g) {
            var matches = g.all.filter(function (item) {
                var val = (item.data[g.def.nameField] || '').toLowerCase();
                return val.indexOf(q) !== -1;
            });

            if (matches.length === 0) return;
            totalFound += matches.length;
            resultsEl.appendChild(renderSearchGroup(g.def, matches, nameMap));
        });

        if (totalFound === 0) {
            emptyEl.textContent = 'No results found for "' + escapeHtml(query) + '".';
            emptyEl.classList.remove('hidden');
        }

    }).catch(function (err) {
        console.error('Search error:', err);
        resultsEl.innerHTML = '';
        emptyEl.textContent = 'Search error — please try again.';
        emptyEl.classList.remove('hidden');
    });
}

/**
 * Build a DOM element for one result group (one entity type).
 * Adds a subtle hint line beneath each result where useful context exists.
 *
 * @param {object} def     - Collection definition (label, icon, col, urlFn, nameField)
 * @param {Array}  matches - Array of {id, data} objects that matched the query
 * @param {object} nameMap - Cross-reference map: col → {docId: name}
 * @returns {HTMLElement}
 */
function renderSearchGroup(def, matches, nameMap) {
    var section = document.createElement('div');
    section.className = 'search-group';

    // Heading: icon + type label + count
    var heading = document.createElement('h3');
    heading.className = 'search-group-heading';
    heading.textContent = def.icon + '\u2009' + def.label + ' (' + matches.length + ')';
    section.appendChild(heading);

    var list = document.createElement('ul');
    list.className = 'search-group-list';

    matches.forEach(function (item) {
        var li = document.createElement('li');

        // Main clickable link
        var a = document.createElement('a');
        a.href        = def.urlFn(item.id);
        a.className   = 'search-result-name';
        a.textContent = item.data[def.nameField] || item.data.name || item.data.title || '(Unnamed)';
        li.appendChild(a);

        // Optional secondary hint showing the parent context
        var hint = _searchGetHint(def.col, item.data, nameMap);
        if (hint) {
            var span = document.createElement('span');
            span.className   = 'search-result-hint';
            span.textContent = hint;
            li.appendChild(span);
        }

        list.appendChild(li);
    });

    section.appendChild(list);
    return section;
}

/**
 * Return a short hint string showing the parent entity name, or '' if none.
 */
function _searchGetHint(col, data, nameMap) {
    switch (col) {
        case 'plants':             return (nameMap['zones']          || {})[data.zoneId]          || '';
        case 'things':             return (nameMap['rooms']          || {})[data.roomId]           || '';
        case 'subThings':          return (nameMap['things']         || {})[data.thingId]          || '';
        case 'structureThings':    return (nameMap['structures']     || {})[data.structureId]      || '';
        case 'structureSubThings': return (nameMap['structureThings']|| {})[data.thingId]          || '';
        case 'garageThings':       return (nameMap['garageRooms']    || {})[data.roomId]           || '';
        case 'garageSubThings':    return (nameMap['garageThings']   || {})[data.thingId]          || '';
        case 'collectionItems':    return (nameMap['collections']    || {})[data.collectionId]     || '';
        case 'notebooks':          return '';  // top-level, no parent
        default:                   return '';
    }
}
