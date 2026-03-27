// ============================================================
// SecondBrain Issue Tracker
// Loads and displays reported LLM issues from the sbIssues
// Firestore collection. Allows copy-to-clipboard and delete.
// ============================================================

async function loadSbIssuesPage() {
    var container = document.getElementById('sbIssuesList');
    if (!container) return;
    container.innerHTML = '<p class="empty-msg">Loading…</p>';

    try {
        var snap = await userCol('sbIssues').orderBy('createdAt', 'desc').get();

        if (snap.empty) {
            container.innerHTML = '<p class="empty-msg">No issues reported yet.</p>';
            return;
        }

        var html = '';
        snap.forEach(function(doc) {
            var d  = doc.data();
            var id = doc.id;

            // Format timestamp
            var dateStr = '';
            if (d.createdAt && d.createdAt.toDate) {
                var dt = d.createdAt.toDate();
                dateStr = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            html +=
                '<div class="sb-issue-card" id="sbIssue-' + id + '">' +
                    '<div class="sb-issue-header">' +
                        '<span class="sb-issue-meta">' +
                            (dateStr ? dateStr + ' &nbsp;·&nbsp; ' : '') +
                            'Detected: <strong>' + _escIssue(d.parsedAction || '—') + '</strong>' +
                            ' &nbsp;·&nbsp; Photos: <strong>' + (d.hasPhotos ? 'Yes' : 'No') + '</strong>' +
                        '</span>' +
                        '<div class="sb-issue-actions">' +
                            '<button class="btn btn-secondary btn-sm" onclick="copySbIssue(\'' + id + '\')">📋 Copy</button>' +
                            '<button class="btn btn-danger btn-sm" onclick="deleteSbIssue(\'' + id + '\')">Delete</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="sb-issue-section-label">Prompt</div>' +
                    '<pre class="sb-issue-pre">' + _escIssue(d.promptText || '(empty)') + '</pre>' +
                    '<div class="sb-issue-section-label">Raw LLM Response</div>' +
                    '<pre class="sb-issue-pre">' + _escIssue(d.rawResponse || '(empty)') + '</pre>' +
                '</div>';
        });

        container.innerHTML = html;

    } catch (err) {
        console.error('loadSbIssuesPage error:', err);
        container.innerHTML = '<p class="empty-msg">Error loading issues: ' + _escIssue(err.message) + '</p>';
    }
}

/** HTML-escape helper (local to this file) */
function _escIssue(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Copy a single issue to the clipboard as plain text. */
function copySbIssue(id) {
    var card = document.getElementById('sbIssue-' + id);
    if (!card) return;

    // Pull text from the two <pre> blocks
    var pres  = card.querySelectorAll('.sb-issue-pre');
    var meta  = card.querySelector('.sb-issue-meta');
    var prompt   = pres[0] ? pres[0].textContent : '';
    var response = pres[1] ? pres[1].textContent : '';
    var metaText = meta ? meta.textContent.replace(/\s+/g, ' ').trim() : '';

    var text =
        '--- SecondBrain Issue Report ---\n' +
        metaText + '\n\n' +
        'PROMPT:\n' + prompt + '\n\n' +
        'RAW LLM RESPONSE:\n' + response + '\n' +
        '---';

    navigator.clipboard.writeText(text).then(function() {
        var btn = card.querySelector('button');
        if (btn) {
            var orig = btn.textContent;
            btn.textContent = '✓ Copied';
            setTimeout(function() { btn.textContent = orig; }, 2000);
        }
    }).catch(function(err) {
        alert('Copy failed: ' + err.message);
    });
}

/** Delete an issue from Firestore and remove its card from the DOM. */
async function deleteSbIssue(id) {
    if (!confirm('Delete this issue report?')) return;
    try {
        await userCol('sbIssues').doc(id).delete();
        var card = document.getElementById('sbIssue-' + id);
        if (card) card.remove();

        // Show empty message if no cards remain
        var container = document.getElementById('sbIssuesList');
        if (container && !container.querySelector('.sb-issue-card')) {
            container.innerHTML = '<p class="empty-msg">No issues reported yet.</p>';
        }
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
}
