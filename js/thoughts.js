// ============================================================
// thoughts.js — Thoughts section landing page
// ============================================================

function loadThoughtsPage() {
    // Count Top 10 Lists and update the tile label
    userCol('top10lists').get().then(function(snap) {
        var el = document.getElementById('top10ListsCount');
        if (el) el.textContent = 'Top 10 Lists (' + snap.size + ')';
    }).catch(function(err) {
        console.error('loadThoughtsPage error:', err);
    });
}
