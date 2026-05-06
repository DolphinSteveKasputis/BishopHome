// ============================================================
// investments-ai.js — AI Investment Analysis
// Assembles a financial snapshot payload, calls the configured
// LLM, and displays a plain-English analysis. Results cached
// per group in investmentConfig/aiAnalysis_{groupId}.
// ============================================================

// ---------- Module State ----------

var _investAiBackRoute = 'investments'; // where the Back button returns
var _investAiGroupId   = null;          // group currently being analyzed
var _investAiAnalysis  = null;          // most-recent response text (for follow-up use)

// ---------- System Prompts ----------

var _INVEST_AI_SYSTEM = [
    'You are a personal financial analysis assistant. The user will provide a JSON snapshot of their household financial picture.',
    'Your job is to analyze that data and produce a clear, honest, plain-English assessment — written like a knowledgeable friend who understands retirement planning, not like a formal financial advisor.',
    '',
    'Be direct. If something looks good, say so. If something looks concerning, say that too.',
    'Do not hedge every sentence with disclaimers. One brief disclaimer at the very end of your response is sufficient.',
    '',
    'Use dollar amounts, percentages, and ages from the data — show your math in plain terms when it adds clarity.',
    'Use the projectedRoR value from the JSON as the expected annual return. Do not substitute the 4% rule or any other default.',
    'Do not make up numbers that are not in the data.',
    '',
    'Structure your response exactly as follows:',
    '',
    '**Summary**',
    'Two to four sentences. The big picture — are they in good shape, behind, or somewhere in between? What is the most important thing to know?',
    '',
    '---',
    '',
    '**1. Retirement Readiness**',
    'Using the configured return rate and after-tax percentage from the JSON, project whether the portfolio is on track to support retirement at each person\'s configured retirement age.',
    'Show the math briefly: projected portfolio value at retirement, annual income it generates, and how that compares to each budget scenario.',
    '',
    '**2. Budget Gap Analysis**',
    'For each budget listed, calculate the projected income gap or surplus at retirement.',
    'Income sources: Social Security (at each person\'s configured retirement age) plus portfolio withdrawals using the configured RoR.',
    'Show the gap per budget scenario so they can see which lifestyle is feasible.',
    '',
    '**3. Social Security Strategy**',
    'Look at the SS breakpoints for each person. Does waiting from 62 to 67 or 67 to 70 make a meaningful difference given their ages and portfolio size?',
    'Flag whether early claiming or delayed claiming makes more sense given the data.',
    '',
    '**4. Portfolio Composition**',
    'Comment on the Roth vs. Pre-Tax vs. Brokerage vs. Cash split.',
    'Is the mix appropriate for their age and timeline? Flag any obvious tax diversification gaps (e.g., heavily pre-tax with no Roth, meaning all withdrawals will be taxed).',
    '',
    '**5. Concentration Risk**',
    'Look at the top holdings. Flag any position representing more than ~15-20% of total portfolio value.',
    'Also note if accounts are overly concentrated in one person\'s name.',
    '',
    '**6. Cash Position**',
    'How much is in cash or investment cash (pending deployment)?',
    'Is that appropriate as a buffer, or excessive relative to their spending and portfolio size?',
    '',
    '**7. Key Observations**',
    'Anything else worth flagging that does not fit neatly above. Skip this section if nothing stands out.',
    '',
    '---',
    '',
    '*Brief disclaimer: This is an automated analysis based on the data provided. It is not professional financial advice. Consult a licensed advisor for decisions with significant consequences.*'
].join('\n');

var _INVEST_AI_FOLLOWUP_SYSTEM = [
    'You are a personal financial analysis assistant. You previously analyzed a household\'s financial data and produced a written analysis.',
    'The user now has a follow-up question. Answer their question directly and concisely, drawing on the financial data and your prior analysis.',
    'Do not repeat or re-summarize the full analysis. One brief disclaimer at the end if needed.'
].join('\n');

// ---------- Page Loader ----------

async function loadInvestmentsAiPage() {
    _investAiAnalysis = null;

    document.getElementById('breadcrumbBar').innerHTML =
        '<a href="#investments">Financial</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>AI Analysis</span>';
    document.getElementById('headerTitle').innerHTML =
        '<a href="#main" class="home-link">' + escapeHtml(window.appName || 'My Life') + '</a>';

    var page = document.getElementById('page-investments-ai');
    if (!page) return;
    page.innerHTML = '<p class="muted-text">Loading…</p>';

    await _investLoadGroups();
    await _investLoadConfig();
    await _investLoadAll();

    // Resolve active group
    if (!_investAiGroupId) {
        _investAiGroupId = _investActiveGroupId ||
            localStorage.getItem('investActiveGroupId') ||
            (_investGroups.length > 0 ? _investGroups[0].id : null);
    }

    await _investAiRender();
}

// ---------- Page Renderer ----------

async function _investAiRender() {
    var page = document.getElementById('page-investments-ai');
    if (!page) return;

    var group     = _investGroups.find(function(g) { return g.id === _investAiGroupId; });
    var groupName = group ? group.name : 'Unknown Group';
    var cached    = await _investAiLoadCache(_investAiGroupId);

    var cachedHtml = '';
    if (cached && cached.responseText) {
        var runAt = cached.runAt ? new Date(cached.runAt).toLocaleString() : '';
        cachedHtml =
            '<div class="invest-ai-divider"><span>Last Analysis</span></div>' +
            '<div class="invest-ai-cached-notice">' +
                '<span>' +
                    'Cached result for <strong>' + escapeHtml(cached.groupName || groupName) + '</strong>' +
                    (runAt ? ' — run ' + escapeHtml(runAt) : '') +
                '</span>' +
                '<button class="btn btn-secondary btn-small" onclick="_investAiRunAnalysis()">Re-run</button>' +
            '</div>' +
            (cached.question
                ? '<div class="invest-ai-question-asked">Question asked: <em>' + escapeHtml(cached.question) + '</em></div>'
                : '') +
            '<div class="invest-ai-response">' + marked.parse(cached.responseText) + '</div>' +
            _investAiFollowupSectionHtml();
    }

    page.innerHTML =
        '<div class="page-header">' +
            '<button class="btn btn-secondary btn-small" onclick="location.hash=\'' + escapeHtml(_investAiBackRoute) + '\'">&larr; Back</button>' +
            '<h2>🤖 AI Analysis</h2>' +
        '</div>' +
        '<div class="invest-ai-group-name muted-text">' + escapeHtml(groupName) + '</div>' +

        '<div class="invest-ai-run-section">' +
            '<div class="form-group">' +
                '<label>Specific question <span class="field-optional">(optional)</span></label>' +
                '<textarea id="investAiQuestion" rows="3" ' +
                    'placeholder="e.g. Am I on track to retire at 65? Should I move more into Roth?"></textarea>' +
            '</div>' +
            '<button class="btn btn-primary" id="investAiRunBtn" onclick="_investAiRunAnalysis()">✨ Ask AI</button>' +
        '</div>' +

        '<div id="investAiStatus"></div>' +
        '<div id="investAiResult"></div>' +
        cachedHtml;
}

// Returns the follow-up question textarea + response area HTML.
function _investAiFollowupSectionHtml() {
    return '<div class="invest-ai-followup-section">' +
        '<div class="form-group">' +
            '<label>Ask a follow-up question</label>' +
            '<textarea id="investAiFollowup" rows="3" ' +
                'placeholder="e.g. Should I convert some pre-tax to Roth now?"></textarea>' +
        '</div>' +
        '<button class="btn btn-secondary btn-small" id="investAiFollowupBtn" ' +
            'onclick="_investAiRunFollowUp()">Ask follow-up</button>' +
    '</div>' +
    '<div id="investAiFollowupResult"></div>';
}

// ---------- Call 1 — Full Analysis ----------

async function _investAiRunAnalysis() {
    var btn      = document.getElementById('investAiRunBtn');
    var statusEl = document.getElementById('investAiStatus');
    var resultEl = document.getElementById('investAiResult');
    var question = (document.getElementById('investAiQuestion') || {}).value || '';

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyzing…'; }
    if (statusEl) statusEl.innerHTML =
        '<div class="invest-ai-loading">⏳ Analyzing your portfolio — this may take 15–30 seconds…</div>';
    if (resultEl) resultEl.innerHTML = '';

    try {
        var payload = await _investAiBuildPayload(_investAiGroupId);
        var userMsg = 'Here is my financial data:\n```json\n' +
            JSON.stringify(payload, null, 2) + '\n```';
        if (question.trim()) {
            userMsg += '\n\nIn addition to your general analysis, please specifically address: ' + question.trim();
        }

        var responseText = await _investAiCallLLM(_INVEST_AI_SYSTEM, userMsg);
        _investAiAnalysis = responseText;

        // Cache result per group
        var groupName = ((_investGroups.find(function(g) { return g.id === _investAiGroupId; })) || {}).name || '';
        await _investAiSaveCache(_investAiGroupId, {
            responseText : responseText,
            question     : question.trim(),
            groupId      : _investAiGroupId,
            groupName    : groupName,
            asOfDate     : payload.asOfDate,
            runAt        : new Date().toISOString()
        });

        if (statusEl) statusEl.innerHTML = '';
        if (resultEl) resultEl.innerHTML =
            '<div class="invest-ai-divider"><span>Analysis</span></div>' +
            (question.trim()
                ? '<div class="invest-ai-question-asked">Question asked: <em>' + escapeHtml(question.trim()) + '</em></div>'
                : '') +
            '<div class="invest-ai-response">' + marked.parse(responseText) + '</div>' +
            _investAiFollowupSectionHtml();

    } catch (err) {
        if (statusEl) statusEl.innerHTML =
            '<p class="error-text">Error: ' + escapeHtml(err.message) + '</p>';
    }

    if (btn) { btn.disabled = false; btn.textContent = '✨ Ask AI'; }
}

// ---------- Call 2 — Follow-Up Question ----------

async function _investAiRunFollowUp() {
    var followupEl     = document.getElementById('investAiFollowup');
    var followupResult = document.getElementById('investAiFollowupResult');
    var btn            = document.getElementById('investAiFollowupBtn');
    if (!followupEl || !followupResult) return;

    var question = followupEl.value.trim();
    if (!question) { followupEl.focus(); return; }

    // Prefer fresh analysis from this session; fall back to cached
    var priorAnalysis = _investAiAnalysis;
    if (!priorAnalysis) {
        var cached = await _investAiLoadCache(_investAiGroupId);
        priorAnalysis = cached ? cached.responseText : null;
    }
    if (!priorAnalysis) {
        followupResult.innerHTML =
            '<p class="error-text">No prior analysis found. Run a full analysis first.</p>';
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Thinking…'; }
    followupResult.innerHTML = '<div class="invest-ai-loading">⏳ Thinking…</div>';

    try {
        var payload = await _investAiBuildPayload(_investAiGroupId);
        var userMsg =
            'Here is my financial data:\n```json\n' +
            JSON.stringify(payload, null, 2) + '\n```\n\n' +
            'Here is the analysis you previously provided:\n' + priorAnalysis + '\n\n' +
            'My follow-up question: ' + question;

        var responseText = await _investAiCallLLM(_INVEST_AI_FOLLOWUP_SYSTEM, userMsg);

        followupResult.innerHTML =
            '<div class="invest-ai-followup-response">' +
                '<div class="invest-ai-followup-q"><strong>Q:</strong> ' + escapeHtml(question) + '</div>' +
                '<div class="invest-ai-followup-a">' + marked.parse(responseText) + '</div>' +
            '</div>';

    } catch (err) {
        followupResult.innerHTML =
            '<p class="error-text">Error: ' + escapeHtml(err.message) + '</p>';
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Ask follow-up'; }
}

// ---------- LLM HTTP Call ----------

async function _investAiCallLLM(systemPrompt, userText) {
    var doc = await userCol('settings').doc('llm').get();
    if (!doc.exists) throw new Error('LLM not configured. Go to Settings → AI to add your API key.');

    var cfg      = doc.data();
    var provider = cfg.provider || 'openai';
    var apiKey   = cfg.apiKey   || '';
    var model    = cfg.model    || '';

    var ENDPOINTS = {
        openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
        grok:   { url: 'https://api.x.ai/v1/chat/completions',       model: 'grok-3'  }
    };
    var ep = ENDPOINTS[provider] || ENDPOINTS.openai;

    var res = await fetch(ep.url, {
        method : 'POST',
        headers: {
            'Content-Type' : 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model                : model || ep.model,
            messages             : [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userText     }
            ],
            max_completion_tokens: 4000
        })
    });

    if (!res.ok) {
        var errData = await res.json().catch(function() { return {}; });
        throw new Error((errData.error && errData.error.message) || 'LLM error: HTTP ' + res.status);
    }
    var data = await res.json();
    return data.choices[0].message.content;
}

// ---------- Cache Helpers ----------

async function _investAiLoadCache(groupId) {
    try {
        var doc = await userCol('investmentConfig').doc('aiAnalysis_' + groupId).get();
        return doc.exists ? doc.data() : null;
    } catch (e) {
        return null;
    }
}

async function _investAiSaveCache(groupId, data) {
    await userCol('investmentConfig').doc('aiAnalysis_' + groupId).set(data);
}

// ---------- Payload Builder ----------

async function _investAiBuildPayload(groupId) {
    var group = _investGroups.find(function(g) { return g.id === groupId; });
    if (!group) throw new Error('Group not found.');

    var today     = new Date();
    var todayStr  = today.toISOString().slice(0, 10);
    var personIds = group.personIds || ['self'];

    // Person display names
    var personNames = { self: 'Me' };
    (_investPeople || []).forEach(function(p) { personNames[p.id] = p.name; });

    // Current age per person (best-effort via birthday lookup)
    var personAges = {};
    var meAgeInfo  = await _investGetMeAge();
    if (meAgeInfo.age !== undefined) personAges['self'] = meAgeInfo.age;

    for (var pi = 0; pi < personIds.length; pi++) {
        var pid = personIds[pi];
        if (pid === 'self' || personAges[pid] !== undefined) continue;
        try {
            var dSnap = await userCol('peopleImportantDates').where('personId', '==', pid).get();
            dSnap.forEach(function(d) {
                var lbl = (d.data().label || '').toLowerCase().replace(/\s+/g, '');
                if ((lbl === 'birthday' || lbl === 'bday' || lbl === 'birthdate') && d.data().year) {
                    var age = today.getFullYear() - parseInt(d.data().year);
                    var m = d.data().month || 0, dy = d.data().day || 0;
                    if (m && dy && (today.getMonth() + 1 < m ||
                        (today.getMonth() + 1 === m && today.getDate() < dy))) age--;
                    personAges[pid] = age;
                }
            });
        } catch (e) { /* skip — age stays null */ }
    }

    // Members array
    var retireAges = _investConfig.retirementAges || {};
    var members = personIds.map(function(pid) {
        var currentAge   = (personAges[pid] !== undefined) ? personAges[pid] : null;
        var retireAge    = retireAges[pid] ? parseInt(retireAges[pid]) : null;
        var yearsToRetire = (currentAge !== null && retireAge) ? Math.max(0, retireAge - currentAge) : null;
        return {
            label            : personNames[pid] || pid,
            currentAge       : currentAge,
            retirementAge    : retireAge,
            yearsToRetirement: yearsToRetire
        };
    });

    // Accounts + holdings — reuse existing group loader for consistency
    var accounts      = await _investLoadGroupAccounts(group);
    var cats          = _investComputeGroupTotals(accounts);
    var holdingRollup = {};

    var accountList = accounts.map(function(acct) {
        var holdings = (acct._holdings || []).map(function(h) {
            var value      = (h.shares || 0) * (h.lastPrice || 0);
            var costBasisTotal = (h.costBasis != null && h.shares != null)
                ? Math.round(h.costBasis * h.shares * 100) / 100
                : null;
            if (h.ticker) {
                if (!holdingRollup[h.ticker]) {
                    holdingRollup[h.ticker] = { companyName: h.companyName || '', totalValue: 0 };
                }
                holdingRollup[h.ticker].totalValue += value;
            }
            var holding = {
                ticker          : h.ticker      || '',
                companyName     : h.companyName || '',
                shares          : h.shares      || 0,
                lastPrice       : h.lastPrice   || 0,
                value           : Math.round(value * 100) / 100
            };
            if (costBasisTotal !== null) {
                holding.costBasisPerShare  = Math.round(h.costBasis * 100) / 100;
                holding.totalCostBasis     = costBasisTotal;
                holding.estimatedGainLoss  = Math.round((value - costBasisTotal) * 100) / 100;
            }
            return holding;
        });
        return {
            name       : acct.nickname || '(untitled)',
            type       : _investTypeLabel(acct.accountType || ''),
            owner      : personNames[acct._ns] || acct._ns,
            cashBalance: acct.cashBalance || 0,
            holdings   : holdings
        };
    });

    var totalValue  = cats.netWorth;
    var topHoldings = Object.keys(holdingRollup).map(function(ticker) {
        return {
            ticker        : ticker,
            companyName   : holdingRollup[ticker].companyName,
            totalValue    : Math.round(holdingRollup[ticker].totalValue * 100) / 100,
            pctOfPortfolio: totalValue > 0
                ? Math.round(holdingRollup[ticker].totalValue / totalValue * 1000) / 10
                : 0
        };
    }).sort(function(a, b) { return b.totalValue - a.totalValue; }).slice(0, 15);

    // SS benefits — all breakpoints per person (most recent snapshot)
    var allSsSnap  = await userCol('ssBenefits').get();
    var ssByPerson = {};
    allSsSnap.forEach(function(d) {
        var data = d.data();
        if (!ssByPerson[data.personId]) ssByPerson[data.personId] = [];
        ssByPerson[data.personId].push(data);
    });
    Object.keys(ssByPerson).forEach(function(pid) {
        ssByPerson[pid].sort(function(a, b) {
            return (b.asOfDate || '').localeCompare(a.asOfDate || '');
        });
    });

    var socialSecurity = personIds
        .filter(function(pid) { return ssByPerson[pid] && ssByPerson[pid].length > 0; })
        .map(function(pid) {
            var entries = (ssByPerson[pid][0].entries || [])
                .map(function(e) {
                    return { claimAge: parseInt(e.age), monthly: parseFloat(e.monthly) || 0 };
                })
                .sort(function(a, b) { return a.claimAge - b.claimAge; });
            return { person: personNames[pid] || pid, benefits: entries };
        });

    // Budgets — all non-archived, category totals only
    var budgetSnap      = await userCol('budgets').where('isArchived', '==', false).get();
    var appSettingsDoc  = await userCol('settings').doc('app').get().catch(function() { return { exists: false, data: function() { return {}; } }; });
    var defaultBudgetId = _investConfig.selectedBudgetId ||
        (appSettingsDoc.exists ? (appSettingsDoc.data().defaultBudgetId || null) : null);

    var budgets = [];
    for (var bi = 0; bi < budgetSnap.docs.length; bi++) {
        var bDoc    = budgetSnap.docs[bi];
        var bData   = bDoc.data();
        var bRes    = await Promise.all([
            bDoc.ref.collection('categories').orderBy('sortOrder').get(),
            bDoc.ref.collection('lineItems').get()
        ]);
        var catsSnap  = bRes[0];
        var itemsSnap = bRes[1];

        var catMap = {};
        catsSnap.docs.forEach(function(cd) {
            catMap[cd.id] = { name: cd.data().name || '', monthly: 0 };
        });
        var monthlyTotal = 0;
        itemsSnap.docs.forEach(function(id) {
            var item = id.data();
            var amt  = parseFloat(item.amount) || 0;
            monthlyTotal += amt;
            if (catMap[item.categoryId]) catMap[item.categoryId].monthly += amt;
        });

        budgets.push({
            name        : bData.name || 'Budget',
            monthlyTotal: Math.round(monthlyTotal * 100) / 100,
            annualTotal : Math.round(monthlyTotal * 12 * 100) / 100,
            isDefault   : bDoc.id === defaultBudgetId,
            categories  : Object.values(catMap)
                .filter(function(c) { return c.monthly > 0; })
                .map(function(c) {
                    return { name: c.name, monthly: Math.round(c.monthly * 100) / 100 };
                })
        });
    }

    return {
        asOfDate        : todayStr,
        group           : { name: group.name, members: members },
        socialSecurity  : socialSecurity,
        portfolioSummary: {
            totalValue       : Math.round(totalValue * 100) / 100,
            byCategory       : {
                roth          : Math.round(cats.roth      * 100) / 100,
                preTax        : Math.round(cats.preTax    * 100) / 100,
                brokerage     : cats.brokerageCostBasisKnown ? {
                    total               : Math.round(cats.brokerage * 100) / 100,
                    costBasis           : Math.round(cats.brokerageCostBasisTotal * 100) / 100,
                    estimatedTaxableGain: Math.round((cats.brokerage - cats.brokerageCostBasisTotal) * 100) / 100
                } : Math.round(cats.brokerage * 100) / 100,
                cash          : Math.round(cats.cash      * 100) / 100,
                investmentCash: Math.round(cats.invCash   * 100) / 100
            },
            topHoldingsByValue: topHoldings
        },
        accounts        : accountList,
        budgets         : budgets,
        investmentConfig: {
            projectedRoR: _investConfig.projectedRoR || 0.06,
            afterTaxPct : _investConfig.afterTaxPct  || 0.82
        }
    };
}
