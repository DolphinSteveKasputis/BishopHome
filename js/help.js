// ============================================================
// help.js — In-app help system
// Fetches AppHelp.md once, parses screen sections, renders
// the Help Page, and handles the "Ask AI" Q&A flow.
// ============================================================

var _helpCache      = null;  // full AppHelp.md text, cached after first fetch
var _helpQA         = [];    // Q&A pairs for the current help page session
var _helpAiOpen     = false; // whether the Ask AI panel is expanded
var HELP_COMPACT_AT = 3;     // collapse older Q&A after this many visible pairs

// Maps URL route names to AppHelp.md section keys where they differ
var HELP_SECTION_MAP = {
    'zones'             : 'zones',
    'home'              : 'zones',   // legacy alias
    'concept-activities': 'concept:activities',
    'concept-photos'    : 'concept:photos',
    'concept-facts'     : 'concept:facts',
    'concept-problems'  : 'concept:problems',
    'concept-quicktasks': 'concept:quicktasks'
};

// Topic index — shown on #help/main as a clickable hub
var HELP_TOPIC_MAP = [
    {
        section: 'Yard & Garden',
        topics: [
            { label: 'Yard Home (Zones)',     key: 'zones'        },
            { label: 'Zone Detail',           key: 'zone'         },
            { label: 'Plant Detail',          key: 'plant'        },
            { label: 'Weeds',                 key: 'weeds'        },
            { label: 'Weed Detail',           key: 'weed'         },
            { label: 'Chemicals & Products',  key: 'chemicals'    },
            { label: 'Chemical Detail',       key: 'chemical'     },
            { label: 'Saved Actions',         key: 'actions'      },
            { label: 'Calendar Events',       key: 'calendar'     },
            { label: 'Activity Report',       key: 'activityreport'},
            { label: 'Yard Problems',         key: 'yard-problems'},
            { label: 'Yard Quick Tasks',      key: 'yard-projects'}
        ]
    },
    {
        section: 'Concepts',
        topics: [
            { label: 'Activities',  key: 'concept-activities' },
            { label: 'Photos',      key: 'concept-photos'     },
            { label: 'Facts',       key: 'concept-facts'      },
            { label: 'Problems',    key: 'concept-problems'   },
            { label: 'Quick Tasks', key: 'concept-quicktasks' }
        ]
    }
];

// Human-readable labels for screen names used in the page title
var HELP_SCREEN_LABELS = {
    'main'          : 'Getting Started',
    'zones'         : 'Yard — Zones',
    'zone'          : 'Zone Detail',
    'plant'         : 'Plant Detail',
    'weeds'         : 'Weeds',
    'weed'          : 'Weed Detail',
    'chemicals'     : 'Chemicals & Products',
    'chemical'      : 'Chemical Detail',
    'actions'       : 'Saved Actions',
    'calendar'      : 'Calendar Events',
    'activityreport': 'Activity Report',
    'gpsmap'        : 'GPS Map',
    'yardmap'       : 'Yard Map',
    'yard-problems' : 'Yard Problems',
    'yard-projects' : 'Yard Quick Tasks',
    'house'         : 'House',
    'floor'         : 'Floor Detail',
    'room'          : 'Room Detail',
    'thing'         : 'Thing Detail',
    'health'        : 'Health',
    'life'          : 'Life'
};

// ── Fetch & Parse ────────────────────────────────────────────

/**
 * Fetches AppHelp.md once and caches the result.
 */
async function _helpFetch() {
    if (_helpCache !== null) return _helpCache;
    var res = await fetch('AppHelp.md');
    if (!res.ok) throw new Error('Could not load help content (HTTP ' + res.status + ').');
    _helpCache = await res.text();
    return _helpCache;
}

/**
 * Extracts the content of a ## screen:key or ## concept:key section.
 * Returns null if not found.
 */
function _helpParseSection(fullText, key) {
    var escaped = key.replace(/[-]/g, '\\-');
    var re = new RegExp('##\\s+(?:screen|concept):' + escaped + '\\b([\\s\\S]*?)(?=\\n##\\s|$)', 'i');
    var m  = fullText.match(re);
    return m ? m[1].trim() : null;
}

// ── Page Load ────────────────────────────────────────────────

/**
 * Called by the router when navigating to #help/{screenName}.
 */
async function loadHelpPage(screenName) {
    // Reset session state for this help page
    _helpQA    = [];
    _helpAiOpen = false;

    var sectionKey = HELP_SECTION_MAP[screenName] || screenName || 'main';
    var label      = HELP_SCREEN_LABELS[screenName]
                     || _helpTitleCase(screenName || 'help');

    // Set page title
    var titleEl = document.getElementById('helpPageTitle');
    if (titleEl) titleEl.textContent = 'Help: ' + label;

    // Reset Ask AI panel to closed state
    var aiSection = document.getElementById('helpAskAiSection');
    var aiBtn     = document.getElementById('helpAskAiBtn');
    var qaThread  = document.getElementById('helpQaThread');
    var inputEl   = document.getElementById('helpAiInput');
    if (aiSection) aiSection.classList.add('hidden');
    if (aiBtn)     aiBtn.textContent = '? Ask AI';
    if (qaThread)  qaThread.innerHTML = '';
    if (inputEl)   inputEl.value = '';

    // Show loading state in content area
    var contentEl = document.getElementById('helpStaticContent');
    if (contentEl) contentEl.innerHTML = '<p class="help-loading">Loading…</p>';

    try {
        var fullText    = await _helpFetch();
        var sectionText = _helpParseSection(fullText, sectionKey);

        // Fall back to main if no content found for this screen
        if (!sectionText) {
            sectionText = _helpParseSection(fullText, 'main');
            if (sectionText && titleEl) titleEl.textContent = 'Help: Getting Started';
        }
        if (!sectionText) sectionText = '_No help content is available for this screen yet._';

        var renderedContent = _helpRenderContent(sectionText);
        // On the main/index page, prepend the clickable topic index
        if (sectionKey === 'main') {
            renderedContent = _helpRenderIndex() + renderedContent;
        }
        if (contentEl) contentEl.innerHTML = renderedContent;
    } catch (e) {
        if (contentEl) {
            contentEl.innerHTML =
                '<p class="help-error">Help content could not be loaded. Check your connection and try again.</p>';
        }
    }
}

function _helpTitleCase(str) {
    return str.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

/**
 * Renders section text as HTML.
 * Parses optional sub-sections: ### Quick Help, ### Details, ### See Also.
 * Quick Help is always shown; Details is behind "Show more ▾"; See Also is a styled link list.
 */
function _helpRenderContent(sectionText) {
    // Strip See Also block before further parsing so it doesn't bleed into Details
    var seeAlsoHtml  = '';
    var seeAlsoMatch = sectionText.match(/###\s+See Also\s*\n([\s\S]*?)(?=###\s|$)/i);
    if (seeAlsoMatch) {
        seeAlsoHtml  = '<div class="help-see-also"><strong>See Also:</strong>' +
                       marked.parse(seeAlsoMatch[1].trim()) + '</div>';
        sectionText  = sectionText.replace(seeAlsoMatch[0], '');
    }

    var quickMatch   = sectionText.match(/###\s+Quick Help\s*\n([\s\S]*?)(?=###\s+Details|$)/i);
    var detailsMatch = sectionText.match(/###\s+Details\s*\n([\s\S]*?)(?=###\s|$)/i);

    var mainHtml;
    if (quickMatch && detailsMatch) {
        var quickHtml   = marked.parse(quickMatch[1].trim());
        var detailsHtml = marked.parse(detailsMatch[1].trim());
        mainHtml = '<div class="help-quick">' + quickHtml + '</div>' +
                   '<div class="help-details-toggle">' +
                   '<button class="help-show-more-btn" onclick="helpToggleDetails(this)" aria-expanded="false">' +
                   'Show more ▾</button>' +
                   '</div>' +
                   '<div class="help-details hidden">' + detailsHtml + '</div>';
    } else {
        mainHtml = marked.parse(sectionText);
    }

    return mainHtml + seeAlsoHtml;
}

/**
 * Renders the clickable topic index for #help/main.
 */
function _helpRenderIndex() {
    var html = '<div class="help-index">';
    HELP_TOPIC_MAP.forEach(function(group) {
        html += '<div class="help-index-section"><h3>' + _helpEscape(group.section) + '</h3><ul class="help-index-list">';
        group.topics.forEach(function(t) {
            html += '<li><a class="help-index-link" href="#help/' + t.key + '">' + _helpEscape(t.label) + '</a></li>';
        });
        html += '</ul></div>';
    });
    html += '</div>';
    return html;
}

/**
 * Toggles the Details section open/closed.
 */
function helpToggleDetails(btn) {
    var detailsEl  = btn.closest('.help-static-content').querySelector('.help-details');
    var isNowOpen  = detailsEl.classList.toggle('hidden') === false;
    btn.textContent    = isNowOpen ? 'Show less ▴' : 'Show more ▾';
    btn.setAttribute('aria-expanded', isNowOpen ? 'true' : 'false');
}

// ── Ask AI panel ─────────────────────────────────────────────

/**
 * Toggles the Ask AI input panel open/closed.
 * Called by the "? Ask AI" button.
 */
function helpToggleAskAi() {
    _helpAiOpen = !_helpAiOpen;
    var aiSection = document.getElementById('helpAskAiSection');
    var aiBtn     = document.getElementById('helpAskAiBtn');
    if (_helpAiOpen) {
        aiSection.classList.remove('hidden');
        aiBtn.textContent = '✕ Close AI';
        var inputEl = document.getElementById('helpAiInput');
        if (inputEl) inputEl.focus();
    } else {
        aiSection.classList.add('hidden');
        aiBtn.textContent = '? Ask AI';
    }
}

/**
 * Sends the typed question to the LLM and appends the answer.
 * Called by the Send button and Ctrl+Enter.
 */
async function helpSendQuestion() {
    var inputEl = document.getElementById('helpAiInput');
    var sendBtn = document.getElementById('helpAiSendBtn');
    var question = (inputEl ? inputEl.value : '').trim();
    if (!question) return;

    // Clear input and disable while waiting
    inputEl.value    = '';
    inputEl.disabled = true;
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

    // Add Q with null answer (shows "Thinking…")
    _helpQA.push({ question: question, answer: null });
    _helpRenderQaThread();

    try {
        var answer = await _helpCallLLM(question);
        _helpQA[_helpQA.length - 1].answer = answer;
    } catch (e) {
        _helpQA[_helpQA.length - 1].answer = '_Sorry, there was an error: ' + e.message + '_';
    }

    inputEl.disabled = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
    _helpRenderQaThread();
    if (inputEl) inputEl.focus();
}

// ── Q&A Thread ───────────────────────────────────────────────

/**
 * Re-renders the Q&A thread. The 3 most recent pairs are always visible;
 * older pairs are collapsed into a toggle.
 */
function _helpRenderQaThread() {
    var el = document.getElementById('helpQaThread');
    if (!el) return;
    if (_helpQA.length === 0) { el.innerHTML = ''; return; }

    var html         = '';
    var collapseCount = Math.max(0, _helpQA.length - HELP_COMPACT_AT);

    // Collapsible section for older Q&A pairs
    if (collapseCount > 0) {
        var olderLabel = 'Show ' + collapseCount + ' earlier question' +
                         (collapseCount > 1 ? 's' : '') + ' ▾';
        html += '<div class="help-qa-collapse">';
        html += '<button class="help-qa-collapse-btn" onclick="helpToggleOlderQa(this)">' +
                olderLabel + '</button>';
        html += '<div class="help-qa-older hidden">';
        // Render older pairs newest-first within the collapsed section
        for (var i = collapseCount - 1; i >= 0; i--) {
            html += _helpQaPairHtml(_helpQA[i]);
        }
        html += '</div></div>';
    }

    // The most recent pairs (up to HELP_COMPACT_AT), newest first
    for (var j = _helpQA.length - 1; j >= collapseCount; j--) {
        html += _helpQaPairHtml(_helpQA[j]);
    }

    el.innerHTML = html;
}

function _helpQaPairHtml(pair) {
    var answerHtml = (pair.answer === null)
        ? '<div class="help-qa-answer help-qa-pending">Thinking…</div>'
        : '<div class="help-qa-answer">' + marked.parse(pair.answer) + '</div>';

    return '<div class="help-qa-pair">' +
           '<div class="help-qa-question">' + _helpEscape(pair.question) + '</div>' +
           answerHtml +
           '</div>';
}

/**
 * Toggles the collapsed older-questions section.
 */
function helpToggleOlderQa(btn) {
    var olderDiv = btn.nextElementSibling;
    var isNowHidden = olderDiv.classList.toggle('hidden');
    var count = Math.max(0, _helpQA.length - HELP_COMPACT_AT);
    btn.textContent = isNowHidden
        ? 'Show ' + count + ' earlier question' + (count > 1 ? 's' : '') + ' ▾'
        : 'Hide earlier questions ▲';
}

function _helpEscape(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ── LLM Call ─────────────────────────────────────────────────

/**
 * Sends the question to the configured LLM with the full AppHelp.md as context.
 * Each call is independent (stateless) — no conversation history is passed.
 */
async function _helpCallLLM(question) {
    var fullHelp = await _helpFetch();

    var doc = await userCol('settings').doc('llm').get();
    if (!doc.exists) {
        throw new Error('LLM not configured. Go to Settings to add your API key.');
    }

    var cfg      = doc.data();
    var provider = cfg.provider || 'openai';
    var apiKey   = cfg.apiKey   || '';
    var model    = cfg.model    || '';

    var ENDPOINTS = {
        openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o'  },
        grok:   { url: 'https://api.x.ai/v1/chat/completions',       model: 'grok-3'  }
    };
    var ep = ENDPOINTS[provider] || ENDPOINTS.openai;

    var systemPrompt =
        'You are a helpful assistant for the MyLife personal tracking app. ' +
        'Answer the user\'s question using only the help documentation provided below. ' +
        'Be concise, friendly, and direct. If the answer is not covered in the documentation, say so clearly.\n\n' +
        '--- BEGIN HELP DOCUMENTATION ---\n' + fullHelp + '\n--- END HELP DOCUMENTATION ---';

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
                { role: 'user',   content: question     }
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

// ── Nav Helper ───────────────────────────────────────────────

/**
 * Called by the ? link in all nav bars.
 * Reads the current hash and navigates to #help/{screenName}.
 */
function openHelpForCurrentScreen(e) {
    e.preventDefault();
    var hash       = window.location.hash.slice(1) || 'main';
    var screenName = hash.split('/')[0];
    // Don't recurse into help/help
    if (screenName === 'help') return;
    window.location.hash = '#help/' + screenName;
}
