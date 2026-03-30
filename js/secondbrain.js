// ============================================================
// SecondBrain — Natural Language Command Interface
// Phase A: Full UI pipeline + write stubs
// Phase B: Real Firestore writes for all 13 action types
// Phase C: Context-aware targeting, Try Again, command history
// ============================================================

// ---------- State ----------
var _sbContext    = null;   // cached context snapshot
var _sbContextExp = 0;      // cache expiry (ms)
var _sbPhotos     = [];     // [{dataUrl, name}] attached photos
var _sbLastResult = null;   // last parsed LLM result {action, payload}
var _sbLastText   = '';     // last text sent (for Try Again)
var _sbThinking   = false;  // true while LLM call in progress
var _sbPageCtx    = null;   // current page context {type, id, name} or null

var SB_CACHE_MS       = 5 * 60 * 1000;  // 5-minute context cache TTL
var SB_HISTORY_KEY    = '_sbHistory';   // localStorage key for command history
var SB_HISTORY_MAX    = 10;             // max history entries
var _sbLastRawResponse = '';            // raw LLM response string, saved for issue reporting

// ---------- Which entity types are valid targets per action ----------
var SB_TARGET_TYPES = {
    LOG_ACTIVITY:  ['zone','plant','weed','vehicle','floor','room','thing','subthing',
                    'garageroom','garagething','garagesubthing',
                    'structure','structurething','structuresubthing'],
    ADD_PROBLEM:   ['zone','plant','weed','vehicle','floor','room','thing','subthing',
                    'garageroom','garagething','garagesubthing',
                    'structure','structurething','structuresubthing'],
    ADD_FACT:      ['zone','plant','weed','vehicle','person','floor','room','thing','subthing',
                    'garageroom','garagething','garagesubthing',
                    'structure','structurething','structuresubthing'],
    ADD_PROJECT:   ['zone','plant','vehicle','floor','room','thing','garageroom','structure'],
    ADD_THING:     ['room','thing','garageroom','garagething','structure','structurething'],
    ATTACH_PHOTOS: ['zone','plant','weed','vehicle','person','floor','room','thing','subthing',
                    'garageroom','garagething','garagesubthing',
                    'structure','structurething','structuresubthing'],
    // MOVE_THING — destination types for things vs subthings
    // Things move to locations (room/garageroom/structure)
    // SubThings move to parent things (thing/garagething/structurething)
    MOVE_THING_DEST: ['room','garageroom','structure','thing','garagething','structurething']
};

// ---------- Display metadata ----------
var SB_ICONS = {
    ADD_JOURNAL_ENTRY:  '📓', ADD_CALENDAR_EVENT: '📅', LOG_ACTIVITY:       '🌿',
    ADD_PROBLEM:        '⚠️', ADD_IMPORTANT_DATE: '🎂', LOG_MILEAGE:        '🚗',
    ADD_FACT:           '📋', ADD_PROJECT:        '🔨', LOG_INTERACTION:    '👥',
    ADD_WEED:           '🌱', ADD_TRACKING_ENTRY: '📊', ADD_THING:          '📦',
    ATTACH_PHOTOS:      '📷', MOVE_THING:         '🚚', ADD_PLANT:          '🪴',
    UNKNOWN_ACTION:     '❓'
};
var SB_LABELS = {
    ADD_JOURNAL_ENTRY:  'Add Journal Entry',  ADD_CALENDAR_EVENT: 'Add Calendar Event',
    LOG_ACTIVITY:       'Log Activity',        ADD_PROBLEM:        'Add Problem',
    ADD_IMPORTANT_DATE: 'Add Important Date',  LOG_MILEAGE:        'Log Mileage',
    ADD_FACT:           'Add Fact',            ADD_PROJECT:        'Add Project',
    LOG_INTERACTION:    'Log Interaction',     ADD_WEED:           'Add Weed',
    ADD_TRACKING_ENTRY: 'Add Tracking Entry',  ADD_THING:          'Add Item',
    ATTACH_PHOTOS:      'Attach Photos',       MOVE_THING:         'Move Item',
    ADD_PLANT:          'Add Plant',           UNKNOWN_ACTION:     'Unknown Action'
};

// ============================================================
// UTILITY HELPERS
// ============================================================

function _sbToday() {
    var d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function _sbNow() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function _sbEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _sbRecurringLabel(r) {
    if (!r) return 'None';
    if (r.type === 'weekly')       return 'Weekly';
    if (r.type === 'monthly')      return 'Monthly';
    if (r.type === 'intervalDays') return 'Every ' + r.intervalDays + ' days';
    return r.type || 'Recurring';
}

// ============================================================
// CONTEXT BUILDER
// Queries all Firestore collections and builds a lean context
// snapshot (IDs + names only) for the LLM. Cached 5 minutes.
// ============================================================

async function _sbBuildContext() {
    var now = Date.now();
    if (_sbContext && now < _sbContextExp) return _sbContext;

    try {
        var [
            zonesSnap, plantsSnap, peopleSnap, vehiclesSnap,
            weedsSnap, chemSnap, catSnap,
            floorsSnap, roomsSnap, thingsSnap, subThingsSnap,
            gRoomsSnap, gThingsSnap, gSubSnap,
            strSnap, strThingsSnap, strSubSnap
        ] = await Promise.all([
            userCol('zones').get(),
            userCol('plants').get(),
            userCol('people').get(),
            userCol('vehicles').get(),
            userCol('weeds').get(),
            userCol('chemicals').get(),
            userCol('journalCategories').get(),
            userCol('floors').get(),
            userCol('rooms').get(),
            userCol('things').get(),
            userCol('subThings').get(),
            userCol('garageRooms').get(),
            userCol('garageThings').get(),
            userCol('garageSubThings').get(),
            userCol('structures').get(),
            userCol('structureThings').get(),
            userCol('structureSubThings').get()
        ]);

        // --- Zones (build hierarchy) ---
        var zonesById = {};
        zonesSnap.forEach(function(d) {
            zonesById[d.id] = Object.assign({ id: d.id, children: [] }, d.data());
        });
        var rootZones = [];
        Object.values(zonesById).forEach(function(z) {
            if (z.parentId && zonesById[z.parentId]) {
                zonesById[z.parentId].children.push(z);
            } else {
                rootZones.push(z);
            }
        });
        function cleanZone(z) {
            return { id: z.id, name: z.name, children: (z.children || []).map(cleanZone) };
        }

        // --- Plants ---
        var plants = [];
        plantsSnap.forEach(function(d) {
            var p = d.data();
            plants.push({
                id: d.id, name: p.name || '',
                zoneId: p.zoneId || null,
                zoneName: (p.zoneId && zonesById[p.zoneId]) ? zonesById[p.zoneId].name : null
            });
        });

        // --- People ---
        var people = [];
        peopleSnap.forEach(function(d) { people.push({ id: d.id, name: d.data().name || '' }); });

        // --- Vehicles ---
        var vehicles = [];
        vehiclesSnap.forEach(function(d) {
            var v = d.data();
            vehicles.push({
                id: d.id,
                label: [v.year, v.make, v.model].filter(Boolean).join(' '),
                nickname: v.nickname || null
            });
        });

        // --- Weeds, Chemicals, Categories ---
        var weeds = [], chemicals = [], trackingCategories = [];
        weedsSnap.forEach(function(d) { weeds.push({ id: d.id, name: d.data().name || '' }); });
        chemSnap.forEach(function(d)  { chemicals.push({ id: d.id, name: d.data().name || '' }); });
        catSnap.forEach(function(d)   { trackingCategories.push({ id: d.id, name: d.data().name || '' }); });

        // --- House (floors → rooms → things → subThings) ---
        var floorsById = {}, roomsById = {}, thingsById = {};
        floorsSnap.forEach(function(d) {
            floorsById[d.id] = { id: d.id, name: d.data().name || '', type: 'floor', rooms: [] };
        });
        roomsSnap.forEach(function(d) {
            roomsById[d.id] = { id: d.id, name: d.data().name || '', type: 'room',
                                floorId: d.data().floorId, things: [] };
        });
        thingsSnap.forEach(function(d) {
            thingsById[d.id] = { id: d.id, name: d.data().name || '', type: 'thing',
                                 roomId: d.data().roomId, subthings: [] };
        });
        subThingsSnap.forEach(function(d) {
            var st = d.data();
            if (st.thingId && thingsById[st.thingId]) {
                thingsById[st.thingId].subthings.push({ id: d.id, name: st.name || '' });
            }
        });
        Object.values(thingsById).forEach(function(t) {
            if (t.roomId && roomsById[t.roomId]) {
                roomsById[t.roomId].things.push(
                    { id: t.id, name: t.name, subthings: t.subthings });
            }
        });
        Object.values(roomsById).forEach(function(r) {
            if (r.floorId && floorsById[r.floorId]) {
                floorsById[r.floorId].rooms.push(
                    { id: r.id, name: r.name, type: 'room', things: r.things });
            }
        });
        var house = Object.values(floorsById);

        // --- Garage (garageRooms → garageThings → garageSubThings) ---
        // garageThings use 'roomId' for their parent garageRoom
        // garageSubThings use 'thingId' for their parent garageThing
        var gRoomsById = {}, gThingsById = {};
        gRoomsSnap.forEach(function(d) {
            gRoomsById[d.id] = { id: d.id, name: d.data().name || '', type: 'garageroom', things: [] };
        });
        gThingsSnap.forEach(function(d) {
            gThingsById[d.id] = { id: d.id, name: d.data().name || '', type: 'garagething',
                                  roomId: d.data().roomId, subthings: [] };
        });
        gSubSnap.forEach(function(d) {
            var gs = d.data();
            if (gs.thingId && gThingsById[gs.thingId]) {
                gThingsById[gs.thingId].subthings.push({ id: d.id, name: gs.name || '' });
            }
        });
        Object.values(gThingsById).forEach(function(gt) {
            if (gt.roomId && gRoomsById[gt.roomId]) {
                gRoomsById[gt.roomId].things.push(
                    { id: gt.id, name: gt.name, subthings: gt.subthings });
            }
        });
        var garage = Object.values(gRoomsById);

        // --- Structures (structures → structureThings → structureSubThings) ---
        // structureThings use 'structureId' for parent
        // structureSubThings use 'thingId' for parent structureThing
        var structById = {}, strThingsById = {};
        strSnap.forEach(function(d) {
            structById[d.id] = { id: d.id, name: d.data().name || '', type: 'structure', things: [] };
        });
        strThingsSnap.forEach(function(d) {
            strThingsById[d.id] = { id: d.id, name: d.data().name || '', type: 'structurething',
                                    structureId: d.data().structureId, subthings: [] };
        });
        strSubSnap.forEach(function(d) {
            var ss = d.data();
            if (ss.thingId && strThingsById[ss.thingId]) {
                strThingsById[ss.thingId].subthings.push({ id: d.id, name: ss.name || '' });
            }
        });
        Object.values(strThingsById).forEach(function(st) {
            if (st.structureId && structById[st.structureId]) {
                structById[st.structureId].things.push(
                    { id: st.id, name: st.name, subthings: st.subthings });
            }
        });
        var structures = Object.values(structById);

        // --- Assemble final context ---
        _sbContext = {
            today: _sbToday(), currentTime: _sbNow(),
            zones: rootZones.map(cleanZone),
            plants: plants, people: people, vehicles: vehicles,
            weeds: weeds, chemicals: chemicals,
            trackingCategories: trackingCategories,
            house: house, garage: garage, structures: structures
        };
        _sbContextExp = now + SB_CACHE_MS;
        return _sbContext;

    } catch (err) {
        console.error('SecondBrain: context build failed', err);
        return null;
    }
}

// ============================================================
// FLATTEN CONTEXT → TARGET DROPDOWN OPTIONS
// Returns [{value:"type::id", label:"...", type, id}]
// ============================================================

function _sbFlattenTargets(allowedTypes) {
    var allow = new Set(allowedTypes);
    var opts  = [];
    var ctx   = _sbContext;
    if (!ctx) return opts;

    function add(type, id, label) {
        if (allow.has(type)) opts.push({ value: type + '::' + id, label: label, type: type, id: id });
    }

    // Zones (recursive)
    function walkZone(z, prefix) {
        var label = prefix ? prefix + ' › ' + z.name : z.name;
        add('zone', z.id, label);
        (z.children || []).forEach(function(c) { walkZone(c, label); });
    }
    (ctx.zones    || []).forEach(function(z) { walkZone(z, ''); });
    (ctx.plants   || []).forEach(function(p) {
        add('plant', p.id, p.name + (p.zoneName ? ' (' + p.zoneName + ')' : ''));
    });
    (ctx.people   || []).forEach(function(p) { add('person',  p.id, p.name); });
    (ctx.vehicles || []).forEach(function(v) {
        add('vehicle', v.id, v.label + (v.nickname ? ' (' + v.nickname + ')' : ''));
    });
    (ctx.weeds    || []).forEach(function(w) { add('weed', w.id, w.name); });

    // House
    (ctx.house || []).forEach(function(floor) {
        add('floor', floor.id, floor.name);
        (floor.rooms || []).forEach(function(room) {
            var rl = floor.name + ' / ' + room.name;
            add('room', room.id, rl);
            (room.things || []).forEach(function(thing) {
                var tl = rl + ' / ' + thing.name;
                add('thing', thing.id, tl);
                (thing.subthings || []).forEach(function(st) {
                    add('subthing', st.id, tl + ' / ' + st.name);
                });
            });
        });
    });

    // Garage
    (ctx.garage || []).forEach(function(gr) {
        var grl = 'Garage / ' + gr.name;
        add('garageroom', gr.id, grl);
        (gr.things || []).forEach(function(gt) {
            var gtl = grl + ' / ' + gt.name;
            add('garagething', gt.id, gtl);
            (gt.subthings || []).forEach(function(gst) {
                add('garagesubthing', gst.id, gtl + ' / ' + gst.name);
            });
        });
    });

    // Structures
    (ctx.structures || []).forEach(function(str) {
        var sl = 'Structures / ' + str.name;
        add('structure', str.id, sl);
        (str.things || []).forEach(function(st) {
            var stl = sl + ' / ' + st.name;
            add('structurething', st.id, stl);
            (st.subthings || []).forEach(function(sst) {
                add('structuresubthing', sst.id, stl + ' / ' + sst.name);
            });
        });
    });

    return opts;
}

// ============================================================
// SYSTEM PROMPT BUILDER
// Injects context JSON and today's date/time.
// ============================================================

function _sbBuildSystemPrompt(ctx) {
    // Send a lean copy of context (no internal JS references)
    var ctxJson = JSON.stringify({
        today: ctx.today, currentTime: ctx.currentTime,
        zones: ctx.zones, plants: ctx.plants, people: ctx.people,
        vehicles: ctx.vehicles, weeds: ctx.weeds, chemicals: ctx.chemicals,
        trackingCategories: ctx.trackingCategories,
        house: ctx.house, garage: ctx.garage, structures: ctx.structures
    });

    return [
'You are a data extraction assistant for a home, yard, and life tracking app called Bishop.',
'',
'The user will give you a natural language command and may have attached photos.',
'Your ONLY job is to return a single valid JSON object — nothing else.',
'No explanation. No markdown. No code fences. Just the raw JSON object.',
'',
'Today is ' + ctx.today + '. Current time is ' + ctx.currentTime + '.',
'',
"Use the user's data below to resolve names to IDs. Pick the closest match.",
'Set "ambiguous":true if you are not confident. Full house paths in targetLabel (e.g. "1st Floor / Office").',
'',
ctxJson,
'',
'Classify into exactly one action. Return UNKNOWN_ACTION if nothing fits.',
'',
'ADD_JOURNAL_ENTRY — journal/diary entry or personal thought.',
'{"action":"ADD_JOURNAL_ENTRY","payload":{"date":"YYYY-MM-DD","entryTime":"HH:MM","entryText":"full text","mentionedPersonIds":[],"mentionedPersonNames":[]}}',
'',
'ADD_CALENDAR_EVENT — schedule/reminder/future task.',
'{"action":"ADD_CALENDAR_EVENT","payload":{"title":"short title","date":"YYYY-MM-DD","description":"","recurring":null}}',
'recurring: null | {"type":"weekly"} | {"type":"monthly"} | {"type":"intervalDays","intervalDays":N}',
'',
'LOG_ACTIVITY — physical task done on any entity (yard work, maintenance, painting, cleaning, etc.).',
'{"action":"LOG_ACTIVITY","payload":{"targetType":"zone|plant|weed|vehicle|floor|room|thing|subthing|garageroom|garagething|garagesubthing|structure|structurething|structuresubthing","targetId":"id","targetLabel":"full path","description":"what was done","date":"YYYY-MM-DD","notes":"","chemicalIds":[],"chemicalLabels":[],"unknownChemicals":[],"ambiguous":false}}',
'',
'ADD_PROBLEM — issue or concern with any entity.',
'{"action":"ADD_PROBLEM","payload":{"targetType":"zone|plant|weed|vehicle|floor|room|thing|subthing|garageroom|garagething|garagesubthing|structure|structurething|structuresubthing","targetId":"id","targetLabel":"full path","description":"problem","notes":"","dateLogged":"YYYY-MM-DD","ambiguous":false}}',
'',
'ADD_IMPORTANT_DATE — birthday, anniversary, or important date for a person.',
'{"action":"ADD_IMPORTANT_DATE","payload":{"personId":"id or null","personName":"name","personFound":true,"label":"Birthday|Anniversary|etc","month":1,"day":1,"year":null,"notes":""}}',
'',
'LOG_MILEAGE — current vehicle odometer reading.',
'{"action":"LOG_MILEAGE","payload":{"vehicleId":"id","vehicleLabel":"name","mileage":12345,"date":"YYYY-MM-DD","notes":""}}',
'',
'ADD_FACT — factual attribute about any entity (size, spec, date, preference).',
'{"action":"ADD_FACT","payload":{"targetType":"zone|plant|weed|vehicle|person|floor|room|thing|subthing|garageroom|garagething|garagesubthing|structure|structurething|structuresubthing","targetId":"id","targetLabel":"full path","label":"label","value":"value","ambiguous":false}}',
'',
'ADD_PROJECT — future improvement or task to track (not a calendar event).',
'{"action":"ADD_PROJECT","payload":{"targetType":"zone|plant|vehicle|floor|room|thing|garageroom|structure","targetId":"id","targetLabel":"full path","title":"title","notes":"","ambiguous":false}}',
'',
'LOG_INTERACTION — meeting, talking to, or spending time with a person.',
'{"action":"LOG_INTERACTION","payload":{"personId":"id or null","personName":"name","personFound":true,"date":"YYYY-MM-DD","notes":"summary"}}',
'',
'ADD_PLANT — adding a new physical plant to a zone. Identify from photo if provided. Check plants list: if a plant with same/similar name already exists in that zone, set duplicateExists:true and existingPlantId/existingPlantName.',
'{"action":"ADD_PLANT","payload":{"name":"plant name","zoneId":"id","zoneLabel":"zone name","notes":"","duplicateExists":false,"existingPlantId":"id or null","existingPlantName":"name or null","ambiguous":false}}',
'',
'ADD_WEED — finding/adding a weed. If photos attached try to identify species. If the weed name matches an existing weed in context, set alreadyExists:true and existingWeedId. Include zoneIds even when alreadyExists.',
'{"action":"ADD_WEED","payload":{"name":"weed name","existingWeedId":"id or null","alreadyExists":false,"zoneIds":[],"zoneLabels":[],"treatmentMethod":"","applicationTiming":"","notes":""}}',
'',
'ADD_TRACKING_ENTRY — personal health/life metric (weight, BP, sleep, steps, etc.).',
'{"action":"ADD_TRACKING_ENTRY","payload":{"date":"YYYY-MM-DD","categoryId":"id or null","categoryName":"name","categoryExists":true,"value":"value"}}',
'',
'ADD_THING — add a tracked item to a room/garage/structure; identify from photos if possible.',
'{"action":"ADD_THING","payload":{"parentType":"room|thing|garageroom|garagething|structure|structurething","parentId":"id","parentLabel":"full path","name":"item name","notes":"","hasPhotos":true,"ambiguous":false}}',
'',
'MOVE_THING — move one or more items (things or subthings) to a new location. All items must be the same type and all move to the same destination (all-or-nothing). Things move to locations (room/garageroom/structure). SubThings move to parent things (thing/garagething/structurething).',
'{"action":"MOVE_THING","payload":{"itemType":"thing|subthing|garagething|garagesubthing|structurething|structuresubthing","itemIds":["id"],"itemLabels":["name"],"destParentType":"room|garageroom|structure|thing|garagething|structurething","destParentId":"id","destParentLabel":"full path","ambiguous":false}}',
'',
'ATTACH_PHOTOS — attach photos to an existing record, no new record created.',
'{"action":"ATTACH_PHOTOS","payload":{"targetType":"zone|plant|weed|vehicle|person|floor|room|thing|subthing|garageroom|garagething|garagesubthing|structure|structurething|structuresubthing","targetId":"id","targetLabel":"full path","caption":"optional","ambiguous":false}}',
'',
'UNKNOWN_ACTION — nothing above fits.',
'{"action":"UNKNOWN_ACTION","payload":{"raw":"user text","llmNote":"reason"}}',
'',
'Rules: 1) Return ONLY the JSON. 2) Dates default to ' + ctx.today +
'. 3) Times default to ' + ctx.currentTime +
'. 4) Resolve names to IDs. 5) unknownChemicals[] for LOG_ACTIVITY with unrecognized chemical names.',
// Inject current page context if the user opened SecondBrain while viewing a specific record
(_sbPageCtx ? (
    '\nCURRENT PAGE CONTEXT: The user is viewing a ' + _sbPageCtx.type +
    ' named "' + _sbPageCtx.name + '" (id: ' + _sbPageCtx.id + '). ' +
    'If their command refers to this entity (e.g. "it has a problem", "add a fact to it"), ' +
    'use this as the target.'
) : '')
    ].join('\n');
}

// ============================================================
// LLM CALL
// Reads provider settings from Firestore and calls the API.
// Adds a system message — unlike chat.js which only sends user.
// ============================================================

async function _sbCallLLM(systemPrompt, userText) {
    var doc = await userCol('settings').doc('llm').get();
    if (!doc.exists) throw new Error('LLM not configured. Go to Settings to add your API key.');

    var cfg = doc.data();
    var provider = cfg.provider || 'openai';
    var apiKey   = cfg.apiKey   || '';
    var model    = cfg.model    || '';

    var ENDPOINTS = {
        openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o'  },
        grok:   { url: 'https://api.x.ai/v1/chat/completions',       model: 'grok-3'  }
    };
    var ep = ENDPOINTS[provider] || ENDPOINTS.openai;

    // Build user content: string for text-only, array when photos attached
    var userContent;
    if (_sbPhotos.length === 0) {
        userContent = userText;
    } else {
        userContent = _sbPhotos.map(function(p) {
            return { type: 'image_url', image_url: { url: p.dataUrl } };
        });
        userContent.push({ type: 'text', text: userText });
    }

    var res = await fetch(ep.url, {
        method : 'POST',
        headers: {
            'Content-Type' : 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model   : model || ep.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userContent  }
            ]
        })
    });

    if (!res.ok) {
        var errData = await res.json().catch(function() { return {}; });
        throw new Error((errData.error && errData.error.message) || 'LLM error: HTTP ' + res.status);
    }
    var data = await res.json();
    return data.choices[0].message.content;
}

// ============================================================
// RESPONSE PARSER
// Strips markdown fences (safety net) then JSON.parses.
// Falls back to UNKNOWN_ACTION if parse fails.
// ============================================================

function _sbParseResponse(raw) {
    var clean = (raw || '').trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '');
    try {
        var obj = JSON.parse(clean);
        if (obj && obj.action) return obj;
    } catch (e) {
        console.warn('SecondBrain: JSON parse failed', e, '\nRaw:', raw);
    }
    return {
        action: 'UNKNOWN_ACTION',
        payload: { raw: raw, llmNote: 'Response could not be parsed as JSON.' }
    };
}

// ============================================================
// PHOTO HANDLING
// ============================================================

function _sbAddPhotoFromFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    compressImage(file).then(function(dataUrl) {
        _sbPhotos.push({ dataUrl: dataUrl, name: file.name || 'photo.jpg' });
        _sbRenderPhotoStrip();
    }).catch(function(err) {
        console.error('SecondBrain: photo compress failed', err);
    });
}

function _sbRemovePhoto(idx) {
    _sbPhotos.splice(idx, 1);
    _sbRenderPhotoStrip();
}

function _sbRenderPhotoStrip() {
    var strip = document.getElementById('sbPhotoStrip');
    if (!strip) return;
    if (_sbPhotos.length === 0) {
        strip.innerHTML = '';
        strip.classList.add('hidden');
        return;
    }
    strip.classList.remove('hidden');
    strip.innerHTML = _sbPhotos.map(function(p, i) {
        return '<div class="sb-thumb">' +
            '<img src="' + p.dataUrl + '" alt="photo">' +
            '<button class="sb-thumb-remove" onclick="_sbRemovePhoto(' + i + ')">×</button>' +
            '</div>';
    }).join('');
}

// ============================================================
// PAGE CONTEXT — reads global state to detect current entity
// ============================================================

/**
 * Reads the currently-viewed entity from global app state.
 * Used to inject a "current context" hint into the system prompt
 * so "it has aphids" targets the plant the user is viewing.
 * Returns {type, id, name} or null.
 */
function _sbReadPageContext() {
    // Check each global state variable the app sets when drilling into records
    if (window.currentPlant && window.currentPlant.id) {
        return { type: 'plant', id: window.currentPlant.id,
                 name: window.currentPlant.name || 'current plant' };
    }
    if (window.currentZone && window.currentZone.id) {
        return { type: 'zone', id: window.currentZone.id,
                 name: window.currentZone.name || 'current zone' };
    }
    if (window.currentWeed && window.currentWeed.id) {
        return { type: 'weed', id: window.currentWeed.id,
                 name: window.currentWeed.name || 'current weed' };
    }
    if (window.currentChemical && window.currentChemical.id) {
        return { type: 'chemical', id: window.currentChemical.id,
                 name: window.currentChemical.name || 'current chemical' };
    }
    if (window.currentVehicle && window.currentVehicle.id) {
        return { type: 'vehicle', id: window.currentVehicle.id,
                 name: window.currentVehicle.name || 'current vehicle' };
    }
    if (window.currentPerson && window.currentPerson.id) {
        return { type: 'person', id: window.currentPerson.id,
                 name: window.currentPerson.name || 'current person' };
    }
    if (window.currentRoom && window.currentRoom.id) {
        return { type: 'room', id: window.currentRoom.id,
                 name: window.currentRoom.name || 'current room' };
    }
    if (window.currentThing && window.currentThing.id) {
        return { type: 'thing', id: window.currentThing.id,
                 name: window.currentThing.name || 'current item' };
    }
    if (window.currentStructure && window.currentStructure.id) {
        return { type: 'structure', id: window.currentStructure.id,
                 name: window.currentStructure.name || 'current structure' };
    }
    return null;
}

// ============================================================
// COMMAND HISTORY — persisted in localStorage
// ============================================================

/**
 * Saves a completed command to the history log.
 */
function _sbSaveHistory(action, text) {
    try {
        var history = JSON.parse(localStorage.getItem(SB_HISTORY_KEY) || '[]');
        history.unshift({
            action:    action,
            label:     SB_LABELS[action] || action,
            icon:      SB_ICONS[action]  || '❓',
            text:      text,
            timestamp: Date.now()
        });
        history = history.slice(0, SB_HISTORY_MAX);
        localStorage.setItem(SB_HISTORY_KEY, JSON.stringify(history));
    } catch (e) { /* localStorage unavailable — ignore */ }
}

/**
 * Renders the recent command history into #sbHistoryList.
 * Clicking a history item re-populates the text field.
 */
function _sbRenderHistory() {
    var container = document.getElementById('sbHistoryList');
    if (!container) return;

    var history;
    try {
        history = JSON.parse(localStorage.getItem(SB_HISTORY_KEY) || '[]');
    } catch (e) { history = []; }

    if (!history.length) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    var html = '<div class="sb-history-heading">Recent commands</div>';
    history.forEach(function(item) {
        var ago = _sbTimeAgo(item.timestamp);
        html += '<div class="sb-history-item" data-text="' + _sbEsc(item.text) + '">' +
            '<span class="sb-history-icon">' + (item.icon || '❓') + '</span>' +
            '<span class="sb-history-body">' +
                '<span class="sb-history-label">' + _sbEsc(item.label) + '</span>' +
                '<span class="sb-history-text">' + _sbEsc(item.text) + '</span>' +
            '</span>' +
            '<span class="sb-history-ago">' + _sbEsc(ago) + '</span>' +
            '</div>';
    });
    container.innerHTML = html;

    // Click to re-populate text field
    container.querySelectorAll('.sb-history-item').forEach(function(el) {
        el.addEventListener('click', function() {
            var t = document.getElementById('sbTextInput');
            if (t) { t.value = el.dataset.text || ''; t.focus(); }
        });
    });
}

/** Returns a human-friendly "X min ago" string for a timestamp. */
function _sbTimeAgo(ts) {
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)  return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

// ============================================================
// INPUT MODAL
// ============================================================

/**
 * Opens the SecondBrain input modal. Called from the home screen button.
 */
function openSecondBrain() {
    // Capture current page context at open time — not at send time,
    // since user may open SecondBrain while on a plant/zone/room page.
    _sbPageCtx = _sbReadPageContext();

    _sbPhotos = [];
    _sbRenderPhotoStrip();
    document.getElementById('sbTextInput').value = '';
    _sbSetThinking(false);

    document.getElementById('sbInputModal').classList.add('open');

    // Show page context hint if applicable
    _sbRenderPageCtxHint();

    // Show recent command history
    _sbRenderHistory();

    // Wire voice-to-text (appends to sbTextInput)
    initVoiceToText('sbTextInput', 'sbMicBtn');

    // Pre-warm context in background
    _sbBuildContext();
}

/**
 * Shows or hides the "Current context" banner in the input modal.
 */
function _sbRenderPageCtxHint() {
    var hint = document.getElementById('sbPageCtxHint');
    if (!hint) return;
    if (_sbPageCtx) {
        hint.textContent = '📍 Context: ' + _sbPageCtx.type + ' — ' + _sbPageCtx.name;
        hint.classList.remove('hidden');
    } else {
        hint.classList.add('hidden');
    }
}

function _sbCloseInput() {
    document.getElementById('sbInputModal').classList.remove('open');
    _sbSetThinking(false);
}

function _sbSetThinking(on) {
    _sbThinking = on;
    var content = document.getElementById('sbInputContent');
    var spinner = document.getElementById('sbInputSpinner');
    if (content) content.classList.toggle('hidden', on);
    if (spinner) spinner.classList.toggle('hidden', !on);
}

async function _sbHandleSend() {
    var text = (document.getElementById('sbTextInput').value || '').trim();
    if (!text) {
        alert('Please speak or type a command first.');
        return;
    }
    if (_sbThinking) return;

    _sbLastText = text;  // save for Try Again
    _sbSetThinking(true);

    try {
        var ctx = await _sbBuildContext();
        if (!ctx) throw new Error('Could not load your data. Please try again.');

        // Refresh timestamp to right now
        ctx.today       = _sbToday();
        ctx.currentTime = _sbNow();

        var systemPrompt = _sbBuildSystemPrompt(ctx);
        var raw          = await _sbCallLLM(systemPrompt, text);
        _sbLastRawResponse = raw;  // save for issue reporting
        var result       = _sbParseResponse(raw);

        _sbLastResult = result;
        _sbCloseInput();
        _sbShowConfirmation(result);

    } catch (err) {
        console.error('SecondBrain error:', err);
        _sbSetThinking(false);
        alert('QuickLog error: ' + err.message);
    }
}

// ============================================================
// CONFIRMATION MODAL
// ============================================================

function _sbShowConfirmation(result) {
    var action  = (result && result.action)  || 'UNKNOWN_ACTION';
    var payload = (result && result.payload) || {};

    document.getElementById('sbConfirmTitle').textContent =
        (SB_ICONS[action] || '❓') + ' ' + (SB_LABELS[action] || action);

    document.getElementById('sbConfirmFields').innerHTML   = _sbRenderConfirmFields(action, payload);
    document.getElementById('sbConfirmWarnings').innerHTML = _sbRenderWarnings(action, payload);

    // Photo preview strip
    _sbRenderConfirmPhotos();

    // UNKNOWN_ACTION: hide confirm buttons, show Try Again
    var isUnknown = (action === 'UNKNOWN_ACTION');
    document.getElementById('sbConfirmGoBtn').classList.toggle('hidden',       isUnknown);
    document.getElementById('sbConfirmDoneBtn').classList.toggle('hidden',     isUnknown);
    document.getElementById('sbConfirmTryAgainBtn').classList.toggle('hidden', !isUnknown);

    document.getElementById('sbConfirmModal').classList.add('open');
}

/**
 * Renders actual photo thumbnails in the confirmation modal.
 * Replaces the old text-only "N photos will be attached" badge.
 */
function _sbRenderConfirmPhotos() {
    var container = document.getElementById('sbConfirmPhotoNote');
    if (!container) return;

    if (_sbPhotos.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    var html = '<div class="sb-confirm-photo-strip">';
    _sbPhotos.forEach(function(p) {
        html += '<img class="sb-confirm-thumb" src="' + p.dataUrl + '" alt="attached photo">';
    });
    html += '</div>' +
            '<div class="sb-confirm-photo-label">📷 ' +
            _sbPhotos.length + ' photo' + (_sbPhotos.length > 1 ? 's' : '') +
            ' will be attached</div>';

    container.innerHTML = html;
    container.classList.remove('hidden');
}

function _sbCloseConfirm() {
    document.getElementById('sbConfirmModal').classList.remove('open');
    _sbLastResult = null;
}

/**
 * Try Again — closes the confirm modal and re-opens the input modal
 * with the previous command text restored. User can edit and re-send.
 */
function _sbHandleTryAgain() {
    _sbCloseConfirm();
    // Re-open input with previous text
    var inp = document.getElementById('sbTextInput');
    if (inp) inp.value = _sbLastText || '';
    _sbSetThinking(false);
    _sbRenderPageCtxHint();
    _sbRenderHistory();
    document.getElementById('sbInputModal').classList.add('open');
    initVoiceToText('sbTextInput', 'sbMicBtn');
}

// --- Warning banners shown above the confirm buttons ---
function _sbRenderWarnings(action, payload) {
    var html = '';
    var p = payload || {};

    if ((action === 'ADD_IMPORTANT_DATE' || action === 'LOG_INTERACTION') && p.personFound === false) {
        html += '<div class="sb-warning">⚠ "' + _sbEsc(p.personName || '') +
                '" was not found in your People list. Confirming will create them as a new person.</div>';
    }
    if (action === 'LOG_ACTIVITY' && p.unknownChemicals && p.unknownChemicals.length) {
        p.unknownChemicals.forEach(function(c) {
            html += '<div class="sb-warning">⚠ "' + _sbEsc(c) +
                    '" is not in your chemicals list — it will be added on confirm.</div>';
        });
    }
    if (action === 'ADD_TRACKING_ENTRY' && p.categoryExists === false) {
        html += '<div class="sb-info">ℹ New tracking category "' +
                _sbEsc(p.categoryName || '') + '" will be created.</div>';
    }
    // ATTACH_PHOTOS requires at least one photo
    if (action === 'ATTACH_PHOTOS' && _sbPhotos.length === 0) {
        html += '<div class="sb-warning">⚠ No photos are attached. Cancel and add photos before confirming.</div>';
    }
    // ADD_THING / ADD_PLANT: note when item name was inferred from a photo
    if ((action === 'ADD_THING' || action === 'ADD_PLANT') && _sbPhotos.length > 0 && p.name) {
        html += '<div class="sb-info">📷 Name was identified from your photo — verify it looks right.</div>';
    }
    return html;
}

// --- Field row wrapper ---
function _sbFieldRow(labelText, controlHtml) {
    return '<div class="sb-field-row">' +
        '<label class="sb-field-label">' + _sbEsc(labelText) + '</label>' +
        '<div class="sb-field-control">' + controlHtml + '</div>' +
        '</div>';
}

// --- Go to Existing — close confirm and navigate without writing ---
function _sbGoToExisting(type, id) {
    _sbCloseConfirm();
    var hash = _sbTypeHash(type, id);
    if (hash) window.location.hash = hash;
}

// --- Target dropdown (entity picker) ---
function _sbTargetDropdown(allowedTypes, payload, fieldKey) {
    fieldKey = fieldKey || 'target';
    var opts = _sbFlattenTargets(allowedTypes);
    var currentVal = '';
    if (fieldKey === 'parent') {
        currentVal = (payload.parentType && payload.parentId)
            ? payload.parentType + '::' + payload.parentId : '';
    } else if (fieldKey === 'dest') {
        currentVal = (payload.destParentType && payload.destParentId)
            ? payload.destParentType + '::' + payload.destParentId : '';
    } else {
        currentVal = (payload.targetType && payload.targetId)
            ? payload.targetType + '::' + payload.targetId : '';
    }
    var isAmbiguous = payload.ambiguous;

    var html = '<select class="sb-field' + (isAmbiguous ? ' sb-ambiguous' : '') +
               '" data-field="' + fieldKey + '">';
    html += '<option value="">— select —</option>';
    opts.forEach(function(o) {
        html += '<option value="' + _sbEsc(o.value) + '"' +
                (o.value === currentVal ? ' selected' : '') + '>' + _sbEsc(o.label) + '</option>';
    });
    html += '</select>';
    if (isAmbiguous) {
        html += '<div class="sb-ambiguous-note">⚠ Target was uncertain — please verify</div>';
    }
    return html;
}

// --- Person dropdown ---
function _sbPersonDropdown(payload) {
    var people = (_sbContext && _sbContext.people) || [];
    var html = '<select class="sb-field" data-field="personId">';
    html += '<option value="">— select person —</option>';
    people.forEach(function(p) {
        html += '<option value="' + _sbEsc(p.id) + '"' +
                (p.id === payload.personId ? ' selected' : '') + '>' + _sbEsc(p.name) + '</option>';
    });
    if (payload.personFound === false) {
        html += '<option value="__new__" selected>➕ Create "' +
                _sbEsc(payload.personName || '') + '"</option>';
    }
    html += '</select>';
    return html;
}

// --- Person category dropdown (used when creating a new person) ---
function _sbPersonCategorySelect(fieldName, selectedVal) {
    var cats = ['Family', 'Friend', 'Coworker', 'Neighbor', 'Acquaintance', 'Other'];
    var html = '<select class="sb-field" data-field="' + _sbEsc(fieldName) + '">';
    html += '<option value="">— optional —</option>';
    cats.forEach(function(c) {
        html += '<option value="' + _sbEsc(c) + '"' +
                (c === selectedVal ? ' selected' : '') + '>' + _sbEsc(c) + '</option>';
    });
    html += '</select>';
    return html;
}

// --- Per-action field rendering ---
function _sbRenderConfirmFields(action, payload) {
    var p = payload || {};
    var html = '';

    switch (action) {

        case 'ADD_JOURNAL_ENTRY':
            html += _sbFieldRow('Date',
                '<input type="date" class="sb-field" data-field="date" value="' + _sbEsc(p.date || _sbToday()) + '">');
            html += _sbFieldRow('Time',
                '<input type="time" class="sb-field" data-field="entryTime" value="' + _sbEsc(p.entryTime || _sbNow()) + '">');
            html += _sbFieldRow('Entry',
                '<textarea class="sb-field" data-field="entryText" rows="5">' + _sbEsc(p.entryText || '') + '</textarea>');
            if (p.mentionedPersonNames && p.mentionedPersonNames.length) {
                html += _sbFieldRow('Mentions',
                    p.mentionedPersonNames.map(function(n) {
                        return '<span class="sb-tag">' + _sbEsc(n) + '</span>';
                    }).join(' '));
            }
            break;

        case 'ADD_CALENDAR_EVENT':
            html += _sbFieldRow('Title',
                '<input type="text" class="sb-field" data-field="title" value="' + _sbEsc(p.title || '') + '">');
            html += _sbFieldRow('Date',
                '<input type="date" class="sb-field" data-field="date" value="' + _sbEsc(p.date || _sbToday()) + '">');
            html += _sbFieldRow('Description',
                '<textarea class="sb-field" data-field="description" rows="2">' + _sbEsc(p.description || '') + '</textarea>');
            if (p.recurring) {
                html += _sbFieldRow('Recurring',
                    '<span class="sb-tag">' + _sbEsc(_sbRecurringLabel(p.recurring)) + '</span>');
            }
            break;

        case 'LOG_ACTIVITY':
            html += _sbFieldRow('Target',      _sbTargetDropdown(SB_TARGET_TYPES.LOG_ACTIVITY, p));
            html += _sbFieldRow('Description',
                '<input type="text" class="sb-field" data-field="description" value="' + _sbEsc(p.description || '') + '">');
            html += _sbFieldRow('Date',
                '<input type="date" class="sb-field" data-field="date" value="' + _sbEsc(p.date || _sbToday()) + '">');
            html += _sbFieldRow('Notes',
                '<textarea class="sb-field" data-field="notes" rows="2">' + _sbEsc(p.notes || '') + '</textarea>');
            if (p.chemicalLabels && p.chemicalLabels.length) {
                html += _sbFieldRow('Chemicals',
                    p.chemicalLabels.map(function(c) {
                        return '<span class="sb-tag">' + _sbEsc(c) + '</span>';
                    }).join(' '));
            }
            break;

        case 'ADD_PROBLEM':
            html += _sbFieldRow('Target',      _sbTargetDropdown(SB_TARGET_TYPES.ADD_PROBLEM, p));
            html += _sbFieldRow('Description',
                '<input type="text" class="sb-field" data-field="description" value="' + _sbEsc(p.description || '') + '">');
            html += _sbFieldRow('Date',
                '<input type="date" class="sb-field" data-field="dateLogged" value="' + _sbEsc(p.dateLogged || _sbToday()) + '">');
            html += _sbFieldRow('Notes',
                '<textarea class="sb-field" data-field="notes" rows="2">' + _sbEsc(p.notes || '') + '</textarea>');
            break;

        case 'ADD_IMPORTANT_DATE':
            html += _sbFieldRow('Person', _sbPersonDropdown(p));
            html += _sbFieldRow('Label',
                '<input type="text" class="sb-field" data-field="label" list="sbDateLabelList" value="' + _sbEsc(p.label || '') + '">' +
                '<datalist id="sbDateLabelList">' +
                    '<option value="Birthday"><option value="Anniversary"><option value="Work Anniversary">' +
                    '<option value="Graduation"><option value="Memorial Day"><option value="Other">' +
                '</datalist>');
            html += _sbFieldRow('Month',
                '<input type="number" class="sb-field" data-field="month" min="1" max="12" value="' + _sbEsc(p.month || '') + '">');
            html += _sbFieldRow('Day',
                '<input type="number" class="sb-field" data-field="day" min="1" max="31" value="' + _sbEsc(p.day || '') + '">');
            html += _sbFieldRow('Year',
                '<input type="number" class="sb-field" data-field="year" placeholder="optional" value="' + _sbEsc(p.year || '') + '">');
            // When creating a new person: show optional fields to enrich their record
            if (p.personFound === false) {
                html += '<div class="sb-new-person-section">' +
                        '<div class="sb-new-person-heading">New person — additional details (optional)</div>' +
                        _sbFieldRow('Category', _sbPersonCategorySelect('newPersonCategory', '')) +
                        _sbFieldRow('Notes', '<input type="text" class="sb-field" data-field="newPersonNotes"' +
                            ' placeholder="e.g. college friend, neighbor">') +
                        '</div>';
            }
            break;

        case 'LOG_MILEAGE': {
            var vehicles = (_sbContext && _sbContext.vehicles) || [];
            var vSel = '<select class="sb-field" data-field="vehicleId">';
            vSel += '<option value="">— select vehicle —</option>';
            vehicles.forEach(function(v) {
                vSel += '<option value="' + _sbEsc(v.id) + '"' +
                        (v.id === p.vehicleId ? ' selected' : '') + '>' + _sbEsc(v.label) + '</option>';
            });
            vSel += '</select>';
            html += _sbFieldRow('Vehicle', vSel);
            html += _sbFieldRow('Mileage',
                '<input type="number" class="sb-field" data-field="mileage" value="' + _sbEsc(p.mileage || '') + '">');
            html += _sbFieldRow('Date',
                '<input type="date" class="sb-field" data-field="date" value="' + _sbEsc(p.date || _sbToday()) + '">');
            html += _sbFieldRow('Notes',
                '<input type="text" class="sb-field" data-field="notes" value="' + _sbEsc(p.notes || '') + '">');
            break;
        }

        case 'ADD_FACT':
            html += _sbFieldRow('Target', _sbTargetDropdown(SB_TARGET_TYPES.ADD_FACT, p));
            html += _sbFieldRow('Label',
                '<input type="text" class="sb-field" data-field="label" value="' + _sbEsc(p.label || '') + '">');
            html += _sbFieldRow('Value',
                '<input type="text" class="sb-field" data-field="value" value="' + _sbEsc(p.value || '') + '">');
            break;

        case 'ADD_PROJECT':
            html += _sbFieldRow('Target', _sbTargetDropdown(SB_TARGET_TYPES.ADD_PROJECT, p));
            html += _sbFieldRow('Title',
                '<input type="text" class="sb-field" data-field="title" value="' + _sbEsc(p.title || '') + '">');
            html += _sbFieldRow('Notes',
                '<textarea class="sb-field" data-field="notes" rows="2">' + _sbEsc(p.notes || '') + '</textarea>');
            break;

        case 'LOG_INTERACTION':
            html += _sbFieldRow('Person', _sbPersonDropdown(p));
            html += _sbFieldRow('Date',
                '<input type="date" class="sb-field" data-field="date" value="' + _sbEsc(p.date || _sbToday()) + '">');
            html += _sbFieldRow('What happened',
                '<textarea class="sb-field" data-field="notes" rows="3">' + _sbEsc(p.notes || '') + '</textarea>');
            // When creating a new person: show optional fields to enrich their record
            if (p.personFound === false) {
                html += '<div class="sb-new-person-section">' +
                        '<div class="sb-new-person-heading">New person — additional details (optional)</div>' +
                        _sbFieldRow('Category', _sbPersonCategorySelect('newPersonCategory', '')) +
                        _sbFieldRow('Notes', '<input type="text" class="sb-field" data-field="newPersonNotes"' +
                            ' placeholder="e.g. college friend, neighbor">') +
                        '</div>';
            }
            break;

        case 'ADD_PLANT': {
            var plantZoneOpts = _sbFlattenTargets(['zone']);
            var plantZoneSel = '<select class="sb-field' + (p.ambiguous ? ' sb-ambiguous' : '') +
                               '" data-field="zoneId">';
            plantZoneSel += '<option value="">— select zone —</option>';
            plantZoneOpts.forEach(function(z) {
                plantZoneSel += '<option value="' + _sbEsc(z.id) + '"' +
                                (z.id === p.zoneId ? ' selected' : '') + '>' + _sbEsc(z.label) + '</option>';
            });
            plantZoneSel += '</select>';
            if (p.ambiguous) {
                plantZoneSel += '<div class="sb-ambiguous-note">⚠ Zone was uncertain — please verify</div>';
            }
            html += _sbFieldRow('Plant Name',
                '<input type="text" class="sb-field" data-field="name" value="' + _sbEsc(p.name || '') + '">');
            html += _sbFieldRow('Zone', plantZoneSel);
            html += _sbFieldRow('Notes',
                '<textarea class="sb-field" data-field="notes" rows="2">' + _sbEsc(p.notes || '') + '</textarea>');
            // Duplicate warning: plant with same name already in this zone
            if (p.duplicateExists && p.existingPlantId) {
                html += '<div class="sb-warning">⚠ "' + _sbEsc(p.existingPlantName || p.name || '') +
                        '" already exists in this zone. Confirming will add a second one. ' +
                        '<button type="button" class="sb-link-btn" ' +
                        'onclick="_sbGoToExisting(\'plant\',\'' + _sbEsc(p.existingPlantId) + '\')">' +
                        'Go to Existing →</button></div>';
            }
            break;
        }

        case 'ADD_WEED': {
            var zoneOpts = _sbFlattenTargets(['zone']);
            var zChecks = '<div class="sb-zone-checks">';
            zoneOpts.forEach(function(z) {
                var chk = (p.zoneIds && p.zoneIds.indexOf(z.id) > -1) ? ' checked' : '';
                zChecks += '<label class="sb-check-label">' +
                    '<input type="checkbox" data-field="zoneIds" value="' + _sbEsc(z.id) + '"' + chk + '> ' +
                    _sbEsc(z.label) + '</label>';
            });
            zChecks += '</div>';

            if (p.alreadyExists && p.existingWeedId) {
                // Weed exists — only show zone picker + go-to link; no need to re-enter name/treatment/timing
                html += '<div class="sb-warning">⚠ "' + _sbEsc(p.name || '') + '" already exists. ' +
                        'Confirming will add the selected zone(s) to it. ' +
                        '<button type="button" class="sb-link-btn" ' +
                        'onclick="_sbGoToExisting(\'weed\',\'' + _sbEsc(p.existingWeedId) + '\')">' +
                        'Go to Existing →</button></div>';
                html += _sbFieldRow('Add to Zone(s)', zChecks);
            } else {
                // New weed — show all fields
                html += _sbFieldRow('Weed Name',
                    '<input type="text" class="sb-field" data-field="name" value="' + _sbEsc(p.name || '') + '">');
                html += _sbFieldRow('Zone(s)', zChecks);
                html += _sbFieldRow('Treatment',
                    '<input type="text" class="sb-field" data-field="treatmentMethod" value="' + _sbEsc(p.treatmentMethod || '') + '">');
                html += _sbFieldRow('Timing',
                    '<input type="text" class="sb-field" data-field="applicationTiming" value="' + _sbEsc(p.applicationTiming || '') + '">');
            }
            break;
        }

        case 'ADD_TRACKING_ENTRY': {
            var cats = (_sbContext && _sbContext.trackingCategories) || [];
            var catSel = '<select class="sb-field" data-field="categoryId">';
            catSel += '<option value="">— select category —</option>';
            cats.forEach(function(c) {
                catSel += '<option value="' + _sbEsc(c.id) + '"' +
                          (c.id === p.categoryId ? ' selected' : '') + '>' + _sbEsc(c.name) + '</option>';
            });
            if (p.categoryExists === false) {
                catSel += '<option value="__new__" selected>➕ New: ' +
                          _sbEsc(p.categoryName || '') + '</option>';
            }
            catSel += '</select>';

            // Label the value field with the category name when known (e.g. "Value (Weight)")
            var valueLabel = p.categoryName ? 'Value (' + p.categoryName + ')' : 'Value';

            html += _sbFieldRow('Category', catSel);
            html += _sbFieldRow(valueLabel,
                '<input type="text" class="sb-field" data-field="value" value="' + _sbEsc(p.value || '') + '">');
            html += _sbFieldRow('Date',
                '<input type="date" class="sb-field" data-field="date" value="' + _sbEsc(p.date || _sbToday()) + '">');

            // When creating a new category, let the user optionally specify a unit
            if (p.categoryExists === false) {
                html += '<div class="sb-new-person-section">' +
                        '<div class="sb-new-person-heading">New category — additional details (optional)</div>' +
                        _sbFieldRow('Unit',
                            '<input type="text" class="sb-field" data-field="newCategoryUnit"' +
                            ' placeholder="e.g. lbs, bpm, hours, steps, mg/dL">') +
                        '</div>';
            }
            break;
        }

        case 'MOVE_THING': {
            // Show read-only tags for each item being moved
            var itemLabels = p.itemLabels || [];
            var itemTags = itemLabels.map(function(lbl) {
                return '<span class="sb-tag">' + _sbEsc(lbl) + '</span>';
            }).join(' ');
            html += _sbFieldRow('Items',
                '<div class="sb-field-tags">' + (itemTags || '<em>No items identified</em>') + '</div>');
            html += _sbFieldRow('Move To',
                _sbTargetDropdown(SB_TARGET_TYPES.MOVE_THING_DEST, p, 'dest'));
            break;
        }

        case 'ADD_THING':
            html += _sbFieldRow('Parent',    _sbTargetDropdown(SB_TARGET_TYPES.ADD_THING, p, 'parent'));
            html += _sbFieldRow('Item Name',
                '<input type="text" class="sb-field" data-field="name" value="' + _sbEsc(p.name || '') + '">');
            html += _sbFieldRow('Notes',
                '<textarea class="sb-field" data-field="notes" rows="2">' + _sbEsc(p.notes || '') + '</textarea>');
            break;

        case 'ATTACH_PHOTOS':
            html += _sbFieldRow('Target',  _sbTargetDropdown(SB_TARGET_TYPES.ATTACH_PHOTOS, p));
            html += _sbFieldRow('Caption',
                '<input type="text" class="sb-field" data-field="caption" value="' + _sbEsc(p.caption || '') + '">');
            break;

        case 'UNKNOWN_ACTION':
            html += '<div class="sb-unknown-raw"><strong>You said:</strong> ' + _sbEsc(p.raw || '') + '</div>';
            if (p.llmNote) {
                html += '<div class="sb-unknown-note">' + _sbEsc(p.llmNote) + '</div>';
            }
            html += '<p class="sb-unknown-msg">QuickLog didn\'t recognize this command. Try rephrasing or use the app directly.</p>';
            break;

        default:
            html += '<pre class="sb-raw-json">' + _sbEsc(JSON.stringify(payload, null, 2)) + '</pre>';
    }

    return html;
}

// ============================================================
// READ EDITED FIELDS BACK FROM CONFIRMATION MODAL
// ============================================================

function _sbReadConfirmFields() {
    var modal   = document.getElementById('sbConfirmModal');
    var updated = Object.assign({}, (_sbLastResult && _sbLastResult.payload) || {});

    // Scalar fields
    modal.querySelectorAll('.sb-field[data-field]').forEach(function(el) {
        var f = el.dataset.field;
        if (el.type === 'checkbox') return;  // handled separately
        updated[f] = el.value;
    });

    // Target dropdown → split "type::id" into targetType + targetId
    var targetSel = modal.querySelector('select[data-field="target"]');
    if (targetSel && targetSel.value) {
        var parts = targetSel.value.split('::');
        updated.targetType = parts[0] || null;
        updated.targetId   = parts[1] || null;
    }

    // Parent dropdown (ADD_THING) → parentType + parentId
    var parentSel = modal.querySelector('select[data-field="parent"]');
    if (parentSel && parentSel.value) {
        var pparts = parentSel.value.split('::');
        updated.parentType = pparts[0] || null;
        updated.parentId   = pparts[1] || null;
    }

    // Dest dropdown (MOVE_THING) → destParentType + destParentId
    var destSel = modal.querySelector('select[data-field="dest"]');
    if (destSel && destSel.value) {
        var dparts = destSel.value.split('::');
        updated.destParentType = dparts[0] || null;
        updated.destParentId   = dparts[1] || null;
    }

    // Zone checkboxes (ADD_WEED)
    var zoneChecks = modal.querySelectorAll('input[type="checkbox"][data-field="zoneIds"]');
    if (zoneChecks.length) {
        updated.zoneIds = [];
        zoneChecks.forEach(function(cb) { if (cb.checked) updated.zoneIds.push(cb.value); });
    }

    return updated;
}

// ============================================================
// EXECUTE ACTION  (Phase A: stubs — no Firestore writes yet)
// ============================================================

async function _sbHandleConfirmGo()   { await _sbExecuteAction(true);  }
async function _sbHandleConfirmDone() { await _sbExecuteAction(false); }

async function _sbExecuteAction(navigate) {
    if (!_sbLastResult) return;

    var action  = _sbLastResult.action;
    var payload = _sbReadConfirmFields();

    // ATTACH_PHOTOS requires photos — hard guard before writing
    if (action === 'ATTACH_PHOTOS' && _sbPhotos.length === 0) {
        alert('No photos are attached. Please cancel and add photos first.');
        return;
    }

    var goBtn   = document.getElementById('sbConfirmGoBtn');
    var doneBtn = document.getElementById('sbConfirmDoneBtn');
    if (goBtn)   { goBtn.disabled   = true; goBtn.textContent   = 'Saving...'; }
    if (doneBtn) { doneBtn.disabled = true; }

    try {
        var newId = await _sbWrite(action, payload);

        // Invalidate context cache — new data was written
        _sbContextExp = 0;

        // Save to command history
        _sbSaveHistory(action, _sbLastText);

        _sbCloseConfirm();

        if (navigate) {
            _sbNavigateTo(action, payload, newId);
        } else {
            _sbToast((SB_LABELS[action] || action) + ' saved!');
        }

    } catch (err) {
        console.error('SecondBrain write error:', err);
        alert('Error saving: ' + err.message);
        if (goBtn)   { goBtn.disabled   = false; goBtn.textContent   = '✓ Confirm & Go'; }
        if (doneBtn) { doneBtn.disabled = false; doneBtn.textContent = '✓ Confirm & Done'; }
    }
}

// ============================================================
// WRITE LIBRARY  — Phase B: real Firestore writes
// Each case saves to the correct collection(s), auto-creates
// related records as needed (new person, new chemical, etc.),
// and calls _sbSavePhotos() when photos are attached.
// ============================================================

async function _sbWrite(action, payload) {
    var ts    = firebase.firestore.FieldValue.serverTimestamp();
    var newId = null;
    var ref;

    switch (action) {

        // ---- Journal Entry -----------------------------------
        case 'ADD_JOURNAL_ENTRY': {
            ref = await userCol('journalEntries').add({
                date:               payload.date      || _sbToday(),
                entryTime:          payload.entryTime || _sbNow(),
                entryText:          payload.entryText || '',
                mentionedPersonIds: Array.isArray(payload.mentionedPersonIds)
                                        ? payload.mentionedPersonIds : [],
                createdAt:          ts
            });
            newId = ref.id;
            // Photos: journalEntries don't have a photo targetType — skip
            break;
        }

        // ---- Calendar Event ----------------------------------
        case 'ADD_CALENDAR_EVENT': {
            ref = await userCol('calendarEvents').add({
                title:          payload.title       || '',
                description:    payload.description || '',
                date:           payload.date        || _sbToday(),
                recurring:      payload.recurring   || null,
                completed:      false,
                completedDates: [],
                cancelledDates: [],
                createdAt:      ts
            });
            newId = ref.id;
            // Photos not applicable to calendar events
            break;
        }

        // ---- Log Activity ------------------------------------
        case 'LOG_ACTIVITY': {
            // Auto-create any chemicals the LLM named but couldn't find
            var chemIds = Array.isArray(payload.chemicalIds) ? payload.chemicalIds.slice() : [];
            if (Array.isArray(payload.unknownChemicals)) {
                for (var i = 0; i < payload.unknownChemicals.length; i++) {
                    var uName = (payload.unknownChemicals[i] || '').trim();
                    if (uName) {
                        var cRef = await userCol('chemicals').add({ name: uName, notes: '', createdAt: ts });
                        chemIds.push(cRef.id);
                    }
                }
            }
            ref = await userCol('activities').add({
                targetType:  payload.targetType  || '',
                targetId:    payload.targetId    || '',
                description: payload.description || '',
                date:        payload.date        || _sbToday(),
                notes:       payload.notes       || '',
                chemicalIds: chemIds,
                createdAt:   ts
            });
            newId = ref.id;
            // Attach photos to the target entity (plant, zone, etc.)
            await _sbSavePhotos(payload.targetType, payload.targetId, '');
            return newId;
        }

        // ---- Add Problem ------------------------------------
        case 'ADD_PROBLEM': {
            ref = await userCol('problems').add({
                targetType:  payload.targetType  || '',
                targetId:    payload.targetId    || '',
                description: payload.description || '',
                notes:       payload.notes       || '',
                status:      'open',
                dateLogged:  payload.dateLogged  || _sbToday(),
                resolvedAt:  null,
                createdAt:   ts
            });
            newId = ref.id;
            // Attach photos to the target entity
            await _sbSavePhotos(payload.targetType, payload.targetId, '');
            return newId;
        }

        // ---- Add Important Date -----------------------------
        case 'ADD_IMPORTANT_DATE': {
            var personId = payload.personId;
            // Create person if not found in People list
            if (!personId || personId === '__new__') {
                var newPersonDoc = {
                    name:      payload.personName || 'Unknown Person',
                    createdAt: ts
                };
                // Optional enrichment fields from the confirm screen
                if (payload.newPersonCategory) newPersonDoc.category = payload.newPersonCategory;
                if (payload.newPersonNotes)    newPersonDoc.notes    = payload.newPersonNotes;
                // First attached photo becomes the profile photo
                if (_sbPhotos.length > 0)      newPersonDoc.profilePhotoData = _sbPhotos[0].dataUrl;
                var pRef = await userCol('people').add(newPersonDoc);
                personId = pRef.id;
            }
            await userCol('peopleImportantDates').add({
                personId:  personId,
                label:     payload.label || '',
                month:     parseInt(payload.month, 10) || 1,
                day:       parseInt(payload.day,   10) || 1,
                year:      payload.year ? parseInt(payload.year, 10) : null,
                notes:     payload.notes || '',
                createdAt: ts
            });
            newId = personId;  // navigate to the person's page
            // Save all photos to the person's gallery too
            await _sbSavePhotos('person', personId, '');
            return newId;
        }

        // ---- Log Mileage ------------------------------------
        case 'LOG_MILEAGE': {
            ref = await userCol('mileageLogs').add({
                vehicleId: payload.vehicleId || '',
                date:      payload.date      || _sbToday(),
                mileage:   parseFloat(payload.mileage) || 0,
                notes:     payload.notes     || '',
                createdAt: ts
            });
            newId = ref.id;
            // No photo target for mileage logs
            break;
        }

        // ---- Add Fact ---------------------------------------
        case 'ADD_FACT': {
            ref = await userCol('facts').add({
                targetType: payload.targetType || '',
                targetId:   payload.targetId   || '',
                label:      payload.label      || '',
                value:      payload.value      || '',
                createdAt:  ts
            });
            newId = ref.id;
            // Attach photos to the target entity
            await _sbSavePhotos(payload.targetType, payload.targetId, '');
            return newId;
        }

        // ---- Add Project ------------------------------------
        case 'ADD_PROJECT': {
            ref = await userCol('projects').add({
                targetType:  payload.targetType || '',
                targetId:    payload.targetId   || '',
                title:       payload.title      || '',
                notes:       payload.notes      || '',
                status:      'active',
                items:       [],
                completedAt: null,
                createdAt:   ts
            });
            newId = ref.id;
            break;
        }

        // ---- Log Interaction --------------------------------
        case 'LOG_INTERACTION': {
            var personId = payload.personId;
            if (!personId || personId === '__new__') {
                var newPersonDoc = {
                    name:      payload.personName || 'Unknown Person',
                    createdAt: ts
                };
                // Optional enrichment fields from the confirm screen
                if (payload.newPersonCategory) newPersonDoc.category = payload.newPersonCategory;
                if (payload.newPersonNotes)    newPersonDoc.notes    = payload.newPersonNotes;
                // First attached photo becomes the profile photo
                if (_sbPhotos.length > 0)      newPersonDoc.profilePhotoData = _sbPhotos[0].dataUrl;
                var pRef = await userCol('people').add(newPersonDoc);
                personId = pRef.id;
            }
            await userCol('peopleInteractions').add({
                personId:  personId,
                date:      payload.date  || _sbToday(),
                text:      payload.notes || '',
                createdAt: ts
            });
            newId = personId;  // navigate to person's page
            // Save all photos to the person's gallery too
            await _sbSavePhotos('person', personId, '');
            return newId;
        }

        // ---- Add Plant --------------------------------------
        case 'ADD_PLANT': {
            ref = await userCol('plants').add({
                name:      payload.name   || '',
                zoneId:    payload.zoneId || '',
                notes:     payload.notes  || '',
                metadata:  {},
                createdAt: ts
            });
            newId = ref.id;
            await _sbSavePhotos('plant', newId, payload.name || '');
            return newId;
        }

        // ---- Add Weed ---------------------------------------
        case 'ADD_WEED': {
            var weedId;
            if (payload.alreadyExists && payload.existingWeedId) {
                // Weed exists — merge any new zones into its zoneIds array
                weedId = payload.existingWeedId;
                var wSnap = await userCol('weeds').doc(weedId).get();
                var existingZones = (wSnap.exists && Array.isArray(wSnap.data().zoneIds))
                    ? wSnap.data().zoneIds : [];
                var merged = Array.from(new Set(existingZones.concat(payload.zoneIds || [])));
                await userCol('weeds').doc(weedId).update({ zoneIds: merged });
            } else {
                // New weed record
                var wRef = await userCol('weeds').add({
                    name:              payload.name              || '',
                    treatmentMethod:   payload.treatmentMethod   || '',
                    applicationTiming: payload.applicationTiming || '',
                    notes:             payload.notes             || '',
                    zoneIds:           Array.isArray(payload.zoneIds) ? payload.zoneIds : [],
                    createdAt:         ts
                });
                weedId = wRef.id;
            }
            newId = weedId;
            // Photos go directly to the weed record
            await _sbSavePhotos('weed', weedId, '');
            return newId;
        }

        // ---- Add Tracking Entry -----------------------------
        case 'ADD_TRACKING_ENTRY': {
            var catId   = payload.categoryId   || '';
            var catName = payload.categoryName || '';
            // Create category if the LLM flagged it as new (or user typed a new name)
            if (!catId || catId === '__new__') {
                var catDoc = { name: catName, createdAt: ts };
                // Save unit if the user filled it in (e.g. "lbs", "bpm")
                if (payload.newCategoryUnit && payload.newCategoryUnit.trim()) {
                    catDoc.unit = payload.newCategoryUnit.trim();
                }
                var catRef = await userCol('journalCategories').add(catDoc);
                catId = catRef.id;
            } else {
                // Resolve name from cached context (tracking items are keyed by name, not id)
                var ctxCat = (_sbContext && _sbContext.trackingCategories || [])
                    .find(function(c) { return c.id === catId; });
                if (ctxCat) catName = ctxCat.name;
            }
            ref = await userCol('journalTrackingItems').add({
                date:      payload.date  || _sbToday(),
                category:  catName,
                value:     payload.value || '',
                createdAt: ts,
                updatedAt: ts
            });
            newId = ref.id;
            break;
        }

        // ---- Add Thing (room/thing/garageroom/etc.) ---------
        case 'ADD_THING': {
            // Map parent entity type → which collection to write and what parent field to use
            var thingColMap = {
                'room':           { col: 'things',             parentField: 'roomId'      },
                'thing':          { col: 'subThings',          parentField: 'thingId'     },
                'garageroom':     { col: 'garageThings',       parentField: 'roomId'      },
                'garagething':    { col: 'garageSubThings',    parentField: 'thingId'     },
                'structure':      { col: 'structureThings',    parentField: 'structureId' },
                'structurething': { col: 'structureSubThings', parentField: 'thingId'     }
            };
            var parentType = payload.parentType || '';
            var mapping    = thingColMap[parentType];
            if (!mapping) throw new Error('SecondBrain ADD_THING: unknown parentType "' + parentType + '"');

            var newDoc = { name: payload.name || '', notes: payload.notes || '', createdAt: ts };
            newDoc[mapping.parentField] = payload.parentId || '';

            ref = await userCol(mapping.col).add(newDoc);
            newId = ref.id;

            // Resolve photo targetType for the new entity
            var thingPhotoTypeMap = {
                'room':           'thing',
                'thing':          'subthing',
                'garageroom':     'garagething',
                'garagething':    'garagesubthing',
                'structure':      'structurething',
                'structurething': 'structuresubthing'
            };
            await _sbSavePhotos(thingPhotoTypeMap[parentType] || 'thing', newId, payload.name || '');
            return newId;
        }

        // ---- Move Item (thing or subthing) ------------------
        case 'MOVE_THING': {
            var mvItemType = payload.itemType || '';
            var mvItemIds  = payload.itemIds  || [];
            var mvDestType = payload.destParentType || '';
            var mvDestId   = payload.destParentId   || '';

            if (!mvItemIds.length) throw new Error('MOVE_THING: no items to move.');
            if (!mvDestId)         throw new Error('MOVE_THING: no destination selected.');

            // Map itemType → Firestore collection
            var mvCollMap = {
                'thing':             'things',
                'garagething':       'garageThings',
                'structurething':    'structureThings',
                'subthing':          'subThings',
                'garagesubthing':    'garageSubThings',
                'structuresubthing': 'structureSubThings'
            };
            var mvCollection = mvCollMap[mvItemType];
            if (!mvCollection) throw new Error('MOVE_THING: unknown itemType "' + mvItemType + '"');

            var mvIsSubThing = mvItemType.indexOf('subthing') !== -1;

            for (var k = 0; k < mvItemIds.length; k++) {
                var mvItemId = mvItemIds[k];
                if (mvIsSubThing) {
                    // SubThing: update thingId to point to the new parent thing
                    await userCol(mvCollection).doc(mvItemId).update({ thingId: mvDestId });
                } else {
                    // Thing: clear old parent fields, set new one
                    var mvUpdate = {};
                    mvUpdate.roomId      = firebase.firestore.FieldValue.delete();
                    mvUpdate.structureId = firebase.firestore.FieldValue.delete();
                    if (mvDestType === 'room' || mvDestType === 'garageroom') {
                        mvUpdate.roomId = mvDestId;
                    } else if (mvDestType === 'structure') {
                        mvUpdate.structureId = mvDestId;
                    }
                    await userCol(mvCollection).doc(mvItemId).update(mvUpdate);
                }
            }

            newId = mvDestId;
            return newId;
        }

        // ---- Attach Photos ----------------------------------
        case 'ATTACH_PHOTOS': {
            await _sbSavePhotos(payload.targetType, payload.targetId, payload.caption || '');
            newId = payload.targetId;
            return newId;
        }

        default:
            throw new Error('SecondBrain: unhandled action "' + action + '"');
    }

    return newId;
}

// ============================================================
// PHOTO SAVE HELPER
// Saves all currently attached _sbPhotos to the photos
// collection, linked to the given targetType / targetId.
// ============================================================

async function _sbSavePhotos(targetType, targetId, caption) {
    if (!_sbPhotos.length || !targetType || !targetId) return;
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    for (var i = 0; i < _sbPhotos.length; i++) {
        await userCol('photos').add({
            targetType: targetType,
            targetId:   targetId,
            imageData:  _sbPhotos[i].dataUrl,
            caption:    caption || '',
            createdAt:  ts
        });
    }
}

// ============================================================
// NAVIGATION  (Confirm & Go)
// ============================================================

function _sbNavigateTo(action, payload, newId) {
    var hash = null;
    var id   = (newId && newId !== '__phase_a__') ? newId : null;

    switch (action) {
        case 'ADD_JOURNAL_ENTRY':   hash = '#journal';           break;
        case 'ADD_CALENDAR_EVENT':  hash = '#calendar';          break;
        case 'ADD_TRACKING_ENTRY':  hash = '#journal-tracking';  break;
        case 'ADD_PLANT':
            hash = id ? '#plant/' + id : '#home';
            break;
        case 'ADD_WEED':
            hash = id ? '#weed/' + id : '#weeds';
            break;
        case 'ADD_IMPORTANT_DATE':
        case 'LOG_INTERACTION':
            hash = (id || payload.personId) ? '#person/' + (id || payload.personId) : '#life';
            break;
        case 'LOG_MILEAGE':
            hash = payload.vehicleId ? _sbTypeHash('vehicle', payload.vehicleId) : '#home';
            break;
        case 'LOG_ACTIVITY':
        case 'ADD_PROBLEM':
        case 'ADD_FACT':
        case 'ADD_PROJECT':
        case 'ATTACH_PHOTOS':
            hash = _sbTypeHash(payload.targetType, payload.targetId);
            break;
        case 'ADD_THING':
            hash = _sbTypeHash(payload.parentType, payload.parentId);
            break;
        case 'MOVE_THING':
            hash = _sbTypeHash(payload.destParentType, payload.destParentId);
            break;
    }

    if (hash) {
        window.location.hash = hash;
    } else {
        _sbToast((SB_LABELS[action] || action) + ' saved!');
    }
}

function _sbTypeHash(type, id) {
    var map = {
        zone: '#zone/', plant: '#plant/', vehicle: '#vehicle/', weed: '#weed/',
        person: '#person/', floor: '#floor/', room: '#room/', thing: '#thing/',
        subthing: '#subthing/', garageroom: '#garageroom/', garagething: '#garagething/',
        garagesubthing: '#garagesubthing/', structure: '#structure/',
        structurething: '#structurething/', structuresubthing: '#structuresubthing/'
    };
    var base = map[type];
    return (base && id) ? base + id : '#home';
}

// ============================================================
// HELP MODAL
// ============================================================

// All actions with icon, label, description, and example utterances
var SB_HELP_ACTIONS = [
    {
        action: 'ADD_JOURNAL_ENTRY',
        icon: '📓', label: 'Add Journal Entry',
        desc: 'Log a personal diary entry, thought, or note.',
        examples: [
            'This morning I had a great walk around the neighborhood',
            'Feeling tired today, stayed home and relaxed',
            'Had a long talk with Connie about the new deck'
        ]
    },
    {
        action: 'ADD_CALENDAR_EVENT',
        icon: '📅', label: 'Add Calendar Event',
        desc: 'Schedule something in the future or set a reminder.',
        examples: [
            'Remind me to change the oil on April 15th',
            'Schedule a fertilizer application every 6 weeks',
            'Set a reminder to check the sump pump in the spring'
        ]
    },
    {
        action: 'LOG_ACTIVITY',
        icon: '🌿', label: 'Log Activity',
        desc: 'Record a task you just did on any plant, zone, vehicle, room, structure, or item.',
        examples: [
            'I just mowed the back yard',
            'Painted the office walls',
            'Cleaned out the garage',
            'Fixed the shed roof',
            'Washed the truck'
        ]
    },
    {
        action: 'ADD_PROBLEM',
        icon: '⚠️', label: 'Add Problem',
        desc: 'Flag an issue or concern with any entity.',
        examples: [
            'The shed roof is leaking near the back corner',
            'The rose bush has black spots on the leaves',
            'The garage door is sticking when it\'s cold',
            'The truck is making a rattling noise'
        ]
    },
    {
        action: 'ADD_FACT',
        icon: '📋', label: 'Add Fact',
        desc: 'Record a factual detail about any entity — dimensions, specs, dates, preferences.',
        examples: [
            'The front garden bed is 120 square feet',
            'The truck has a tow capacity of 10,000 lbs',
            'The shed was built in 2018',
            'The office is 14 by 12 feet'
        ]
    },
    {
        action: 'ADD_PROJECT',
        icon: '🔨', label: 'Add Project',
        desc: 'Track a future improvement or task (not a scheduled reminder).',
        examples: [
            'I want to install drip irrigation in the back yard',
            'Need to repaint the shed door',
            'Replace the carpet in the office',
            'Build a raised garden bed by the mailbox'
        ]
    },
    {
        action: 'ADD_IMPORTANT_DATE',
        icon: '🎂', label: 'Add Important Date',
        desc: 'Record a birthday, anniversary, or other important date for a person.',
        examples: [
            'Jake\'s birthday is March 15th',
            'Connie and I got married on June 3rd 2001',
            'Mom\'s work anniversary is in October'
        ]
    },
    {
        action: 'LOG_MILEAGE',
        icon: '🚗', label: 'Log Mileage',
        desc: 'Record the current odometer reading on a vehicle.',
        examples: [
            'The truck is at 87,500 miles',
            'Just hit 45,000 on the SUV'
        ]
    },
    {
        action: 'LOG_INTERACTION',
        icon: '👥', label: 'Log Interaction',
        desc: 'Log a conversation, visit, or time spent with someone.',
        examples: [
            'Had lunch with Jake, talked about the fishing trip',
            'Connie stopped by today, we walked around the yard',
            'Called my brother about Thanksgiving plans'
        ]
    },
    {
        action: 'ADD_WEED',
        icon: '🌱', label: 'Add Weed',
        desc: 'Record a weed found in the yard. Attach a photo and the AI will try to identify it. If the weed already exists, you\'ll be offered to add the zone to it or go to the existing record.',
        examples: [
            'There\'s crabgrass showing up along the back fence',
            'Found some wild onions near the mailbox',
            'attach a photo and say "add this weed to the front yard"',
            'I see crabgrass in the back yard again'
        ]
    },
    {
        action: 'ADD_PLANT',
        icon: '🪴', label: 'Add Plant',
        desc: 'Add a new plant to a zone. Attach a photo and the AI will try to identify it. If the same plant already exists in that zone, you\'ll have the option to go to the existing one or add a second.',
        examples: [
            'I planted a new azalea in the front yard',
            'Add this hosta to the bed by the mailbox',
            'attach a photo and say "add this plant to the right side of the porch"',
            'Put 3 mums in the back garden bed'
        ]
    },
    {
        action: 'ADD_TRACKING_ENTRY',
        icon: '📊', label: 'Add Tracking Entry',
        desc: 'Log a personal health or life metric.',
        examples: [
            'My weight today is 182',
            'Blood pressure this morning was 118 over 76',
            'Slept 7.5 hours last night',
            'Walked 8,200 steps today'
        ]
    },
    {
        action: 'ADD_THING',
        icon: '📦', label: 'Add Item',
        desc: 'Add a tracked item to any room, garage area, or structure. Attach a photo and the AI identifies it.',
        examples: [
            'Add this lamp to the office',
            'Add this to my garage workbench',
            'Add this tool to the shed shelves',
            'attach a photo and say "add this to the living room"'
        ]
    },
    {
        action: 'MOVE_THING',
        icon: '🚚', label: 'Move Item',
        desc: 'Move one or more tracked items to a new location. All items go from the same source to the same destination.',
        examples: [
            'I moved the chainsaw from the shed to the garage',
            'I moved the chainsaw and ladder from the shed to the garage',
            'Move the drill to the workbench',
            'I moved the extension cord to the basement storage room'
        ]
    },
    {
        action: 'ATTACH_PHOTOS',
        icon: '📷', label: 'Attach Photos',
        desc: 'Attach photos to an existing record without creating anything new. Requires at least one photo.',
        examples: [
            'Add these photos to the back yard',
            'Attach this to the shed',
            'Add this picture to the truck'
        ]
    }
];

function _sbOpenHelp() {
    var container = document.getElementById('sbHelpContent');
    if (container) {
        var html = '';
        SB_HELP_ACTIONS.forEach(function(item) {
            html += '<div class="sb-help-action">' +
                '<div class="sb-help-action-header">' +
                    '<span class="sb-help-icon">' + item.icon + '</span>' +
                    '<span class="sb-help-label">' + _sbEsc(item.label) + '</span>' +
                '</div>' +
                '<div class="sb-help-desc">' + _sbEsc(item.desc) + '</div>' +
                '<ul class="sb-help-examples">' +
                item.examples.map(function(ex) {
                    return '<li>"' + _sbEsc(ex) + '"</li>';
                }).join('') +
                '</ul>' +
                '</div>';
        });
        container.innerHTML = html;
    }
    document.getElementById('sbHelpModal').classList.add('open');
}

function _sbCloseHelp() {
    document.getElementById('sbHelpModal').classList.remove('open');
}

// ============================================================
// REPORT ISSUE
// Saves the prompt, raw LLM response, and photo flag to
// the sbIssues collection so the user can review and share.
// ============================================================

async function _sbReportIssue() {
    var action = (_sbLastResult && _sbLastResult.action) || 'UNKNOWN';
    var btn = document.getElementById('sbReportIssueBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
        await userCol('sbIssues').add({
            promptText:    _sbLastText        || '',
            hasPhotos:     _sbPhotos.length   >  0,
            rawResponse:   _sbLastRawResponse || '',
            parsedAction:  action,
            createdAt:     firebase.firestore.FieldValue.serverTimestamp()
        });
        if (btn) { btn.textContent = '✓ Reported'; }
        setTimeout(function() {
            if (btn) { btn.disabled = false; btn.textContent = '⚑ Report Issue'; }
        }, 2500);
        _sbToast('Issue reported — view in Settings → QuickLog Issues');
    } catch (err) {
        console.error('SecondBrain: report issue failed', err);
        if (btn) { btn.disabled = false; btn.textContent = '⚑ Report Issue'; }
        alert('Could not save issue: ' + err.message);
    }
}

// ============================================================
// TOAST
// ============================================================

function _sbToast(msg) {
    var t = document.getElementById('sbToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    t.classList.add('sb-toast-show');
    setTimeout(function() {
        t.classList.add('hidden');
        t.classList.remove('sb-toast-show');
    }, 3000);
}

// ============================================================
// DOM EVENT LISTENERS
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

    // Home screen button
    var homeBtn = document.getElementById('sbHomeBtn');
    if (homeBtn) homeBtn.addEventListener('click', openSecondBrain);

    // Camera / Gallery
    // Set a flag so the popstate handler in app.js knows NOT to close the modal
    // when the camera app closes and fires a popstate event on mobile browsers.
    // Uses the shared window._filePickerOpen flag (also used by photos.js staging).
    document.getElementById('sbCameraBtn').addEventListener('click', function() {
        window._filePickerOpen = true;
        document.getElementById('sbCameraInput').click();
    });
    document.getElementById('sbGalleryBtn').addEventListener('click', function() {
        window._filePickerOpen = true;
        document.getElementById('sbGalleryInput').click();
    });
    document.getElementById('sbCameraInput').addEventListener('change', function() {
        window._filePickerOpen = false;
        if (this.files[0]) _sbAddPhotoFromFile(this.files[0]);
        this.value = '';
    });
    document.getElementById('sbGalleryInput').addEventListener('change', function() {
        window._filePickerOpen = false;
        Array.from(this.files).forEach(function(f) { _sbAddPhotoFromFile(f); });
        this.value = '';
    });
    // Also clear the flag if the user cancels without selecting a file
    // (change never fires in that case; focus returning to window is our signal).
    window.addEventListener('focus', function() {
        setTimeout(function() { window._filePickerOpen = false; }, 500);
    });

    // Send (button + Enter key in textarea)
    document.getElementById('sbSendBtn').addEventListener('click', _sbHandleSend);
    document.getElementById('sbTextInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sbHandleSend(); }
    });

    // Cancel input
    document.getElementById('sbCancelInputBtn').addEventListener('click', _sbCloseInput);

    // Help button
    document.getElementById('sbHelpBtn').addEventListener('click', _sbOpenHelp);
    document.getElementById('sbHelpCloseBtn').addEventListener('click', _sbCloseHelp);
    document.getElementById('sbHelpModal').addEventListener('click', function(e) {
        if (e.target === this) _sbCloseHelp();
    });

    // Close input on overlay click
    document.getElementById('sbInputModal').addEventListener('click', function(e) {
        if (e.target === this) _sbCloseInput();
    });

    // Confirm / Done / Cancel / Try Again / Report Issue
    document.getElementById('sbConfirmGoBtn').addEventListener('click',       _sbHandleConfirmGo);
    document.getElementById('sbConfirmDoneBtn').addEventListener('click',     _sbHandleConfirmDone);
    document.getElementById('sbConfirmCancelBtn').addEventListener('click',   _sbCloseConfirm);
    document.getElementById('sbConfirmTryAgainBtn').addEventListener('click', _sbHandleTryAgain);
    document.getElementById('sbReportIssueBtn').addEventListener('click',     _sbReportIssue);

    // Close confirm on overlay click
    document.getElementById('sbConfirmModal').addEventListener('click', function(e) {
        if (e.target === this) _sbCloseConfirm();
    });
});
