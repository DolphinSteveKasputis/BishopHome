/**
 * beneficiaries.js — "Who gets what" beneficiary assignment
 *
 * Shared helper _renderBeneficiaryRow() is used by house.js, garage.js,
 * structures.js, and collections.js to show the effective beneficiary
 * (own assignment or inherited from a parent entity) on detail pages.
 *
 * loadBeneficiariesPage() drives the #beneficiaries summary page where
 * the user picks a contact and sees everything assigned to them.
 */

// ============================================================
// SHARED HELPER — used by all entity detail pages
// ============================================================

/**
 * Resolve and render the effective beneficiary for an entity.
 * Shows the entity's own beneficiary, or the nearest parent's if unset.
 *
 * @param {string} rowId   — ID of the <div> to populate
 * @param {object} entity  — Firestore doc data (may have beneficiaryContactId)
 * @param {Array}  parents — [{entity, label}, ...] nearest parent first
 */
function _renderBeneficiaryRow(rowId, entity, parents) {
    var row = document.getElementById(rowId);
    if (!row) return;

    var effective = null;
    if (entity.beneficiaryContactId) {
        effective = { id: entity.beneficiaryContactId, inheritedFrom: null };
    } else {
        for (var i = 0; i < (parents || []).length; i++) {
            var p = parents[i];
            if (p.entity && p.entity.beneficiaryContactId) {
                effective = { id: p.entity.beneficiaryContactId, inheritedFrom: p.label };
                break;
            }
        }
    }

    if (!effective) {
        row.classList.add('hidden');
        row.innerHTML = '';
        return;
    }

    row.classList.remove('hidden');
    row.innerHTML = '<span class="bene-label">Goes to:</span> <span class="bene-loading">\u2026</span>';

    userCol('people').doc(effective.id).get()
        .then(function(doc) {
            var name = doc.exists ? (doc.data().name || '?') : '?';
            row.innerHTML =
                '<span class="bene-label">Goes to:</span> ' +
                '<a href="#contact/' + escapeHtml(effective.id) + '" class="bene-name">' + escapeHtml(name) + '</a>' +
                (effective.inheritedFrom
                    ? ' <span class="bene-inherited">(inherited from ' + escapeHtml(effective.inheritedFrom) + ')</span>'
                    : '');
        })
        .catch(function() { row.classList.add('hidden'); });
}

// ============================================================
// BENEFICIARIES SUMMARY PAGE  (#beneficiaries)
// ============================================================

function loadBeneficiariesPage() {
    var resultEl = document.getElementById('beneResults');
    var noSelEl  = document.getElementById('beneNoSelection');
    if (!resultEl) return;

    resultEl.innerHTML = '';
    if (noSelEl) noSelEl.classList.remove('hidden');

    buildContactPicker('beneContactPicker', {
        placeholder: 'Choose a person\u2026',
        onSelect: function(contactId, contactName) {
            if (noSelEl) noSelEl.classList.add('hidden');
            _loadBeneficiaryResults(contactId, contactName);
        }
    });
}

function _loadBeneficiaryResults(contactId, contactName) {
    var resultEl = document.getElementById('beneResults');
    if (!resultEl) return;
    resultEl.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    Promise.all([
        userCol('things').get(),
        userCol('subThings').get(),
        userCol('subThingItems').get(),
        userCol('garageThings').get(),
        userCol('garageSubThings').get(),
        userCol('structureThings').get(),
        userCol('structureSubThings').get(),
        userCol('collections').get(),
        userCol('collectionItems').get()
    ]).then(function(snaps) {
        var things             = _beneDocsToMap(snaps[0]);
        var subThings          = _beneDocsToMap(snaps[1]);
        var subThingItems      = _beneDocsToMap(snaps[2]);
        var garageThings       = _beneDocsToMap(snaps[3]);
        var garageSubThings    = _beneDocsToMap(snaps[4]);
        var structureThings    = _beneDocsToMap(snaps[5]);
        var structureSubThings = _beneDocsToMap(snaps[6]);
        var collections        = _beneDocsToMap(snaps[7]);
        var collectionItems    = _beneDocsToMap(snaps[8]);

        var groups = [
            _beneHouseGroup(things, subThings, subThingItems, contactId),
            _beneGarageGroup(garageThings, garageSubThings, contactId),
            _beneStructureGroup(structureThings, structureSubThings, contactId),
            _beneCollectionsGroup(collections, collectionItems, contactId)
        ].filter(function(g) { return g.items.length > 0; });

        if (!groups.length) {
            resultEl.innerHTML = '<p class="empty-state">Nothing assigned to ' + escapeHtml(contactName) + ' yet.</p>';
            return;
        }

        var html = groups.map(function(group) {
            var itemsHtml = group.items.map(function(item) {
                return '<div class="bene-result-item">' +
                    '<div class="bene-item-main">' +
                    '<a href="' + escapeHtml(item.hash) + '" class="bene-item-name">' + escapeHtml(item.name) + '</a>' +
                    (item.inherited
                        ? '<span class="badge badge-secondary bene-badge">inherited</span>'
                        : '<span class="badge badge-primary bene-badge">direct</span>') +
                    '</div>' +
                    (item.path ? '<div class="bene-item-path">' + escapeHtml(item.path) + '</div>' : '') +
                    '</div>';
            }).join('');
            return '<div class="bene-group">' +
                '<h3 class="bene-group-title">' + escapeHtml(group.title) + ' <span class="bene-group-count">(' + group.items.length + ')</span></h3>' +
                itemsHtml +
                '</div>';
        }).join('');

        resultEl.innerHTML = html;
    }).catch(function(err) {
        console.error('_loadBeneficiaryResults error:', err);
        resultEl.innerHTML = '<p class="empty-state">Error loading data.</p>';
    });
}

function _beneDocsToMap(snap) {
    var map = {};
    snap.forEach(function(doc) { map[doc.id] = Object.assign({ id: doc.id }, doc.data()); });
    return map;
}

function _beneHouseGroup(things, subThings, subThingItems, contactId) {
    var items = [];

    Object.values(things).forEach(function(t) {
        if (t.beneficiaryContactId === contactId) {
            items.push({ name: t.name || 'Thing', path: 'House \u203a Thing', hash: '#thing/' + t.id, inherited: false });
        }
    });

    Object.values(subThings).forEach(function(st) {
        if (st.beneficiaryContactId === contactId) {
            var parent = things[st.thingId];
            items.push({ name: st.name || 'Sub-item', path: 'House \u203a ' + (parent ? parent.name : 'Thing'), hash: '#subthing/' + st.id, inherited: false });
        } else if (!st.beneficiaryContactId) {
            var p = things[st.thingId];
            if (p && p.beneficiaryContactId === contactId) {
                items.push({ name: st.name || 'Sub-item', path: 'House \u203a ' + (p.name || 'Thing'), hash: '#subthing/' + st.id, inherited: true });
            }
        }
    });

    Object.values(subThingItems).forEach(function(item) {
        if (item.beneficiaryContactId === contactId) {
            var pSt = subThings[item.subThingId];
            var pT  = pSt ? things[pSt.thingId] : null;
            items.push({ name: item.name || 'Item', path: 'House \u203a ' + (pT ? pT.name + ' \u203a ' : '') + (pSt ? pSt.name : 'Sub-item'), hash: '#item/' + item.id, inherited: false });
        } else if (!item.beneficiaryContactId) {
            var st = subThings[item.subThingId];
            if (st) {
                if (st.beneficiaryContactId === contactId) {
                    var tName = things[st.thingId] ? things[st.thingId].name : 'Thing';
                    items.push({ name: item.name || 'Item', path: 'House \u203a ' + tName + ' \u203a ' + (st.name || 'Sub-item'), hash: '#item/' + item.id, inherited: true });
                } else if (!st.beneficiaryContactId) {
                    var t = things[st.thingId];
                    if (t && t.beneficiaryContactId === contactId) {
                        items.push({ name: item.name || 'Item', path: 'House \u203a ' + (t.name || 'Thing') + ' \u203a ' + (st.name || 'Sub-item'), hash: '#item/' + item.id, inherited: true });
                    }
                }
            }
        }
    });

    return { title: 'House Things', items: items };
}

function _beneGarageGroup(garageThings, garageSubThings, contactId) {
    var items = [];

    Object.values(garageThings).forEach(function(t) {
        if (t.beneficiaryContactId === contactId) {
            items.push({ name: t.name || 'Thing', path: 'Garage \u203a Thing', hash: '#garagething/' + t.id, inherited: false });
        }
    });

    Object.values(garageSubThings).forEach(function(st) {
        if (st.beneficiaryContactId === contactId) {
            var parent = garageThings[st.thingId];
            items.push({ name: st.name || 'Sub-item', path: 'Garage \u203a ' + (parent ? parent.name : 'Thing'), hash: '#garagesubthing/' + st.id, inherited: false });
        } else if (!st.beneficiaryContactId) {
            var p = garageThings[st.thingId];
            if (p && p.beneficiaryContactId === contactId) {
                items.push({ name: st.name || 'Sub-item', path: 'Garage \u203a ' + (p.name || 'Thing'), hash: '#garagesubthing/' + st.id, inherited: true });
            }
        }
    });

    return { title: 'Garage Things', items: items };
}

function _beneStructureGroup(structureThings, structureSubThings, contactId) {
    var items = [];

    Object.values(structureThings).forEach(function(t) {
        if (t.beneficiaryContactId === contactId) {
            items.push({ name: t.name || 'Thing', path: 'Structures \u203a Thing', hash: '#structurething/' + t.id, inherited: false });
        }
    });

    Object.values(structureSubThings).forEach(function(st) {
        if (st.beneficiaryContactId === contactId) {
            var parent = structureThings[st.thingId];
            items.push({ name: st.name || 'Sub-item', path: 'Structures \u203a ' + (parent ? parent.name : 'Thing'), hash: '#structuresubthing/' + st.id, inherited: false });
        } else if (!st.beneficiaryContactId) {
            var p = structureThings[st.thingId];
            if (p && p.beneficiaryContactId === contactId) {
                items.push({ name: st.name || 'Sub-item', path: 'Structures \u203a ' + (p.name || 'Thing'), hash: '#structuresubthing/' + st.id, inherited: true });
            }
        }
    });

    return { title: 'Structure Things', items: items };
}

function _beneCollectionsGroup(collections, collectionItems, contactId) {
    var items = [];

    Object.values(collections).forEach(function(col) {
        if (col.beneficiaryContactId === contactId) {
            items.push({ name: col.name || 'Collection', path: 'Collections', hash: '#collection/' + col.id, inherited: false });
        }
    });

    Object.values(collectionItems).forEach(function(item) {
        if (item.beneficiaryContactId === contactId) {
            var parent = collections[item.collectionId];
            items.push({ name: item.name || 'Item', path: 'Collections \u203a ' + (parent ? parent.name : 'Collection'), hash: '#collectionitem/' + item.id, inherited: false });
        } else if (!item.beneficiaryContactId) {
            var p = collections[item.collectionId];
            if (p && p.beneficiaryContactId === contactId) {
                items.push({ name: item.name || 'Item', path: (p.name || 'Collection'), hash: '#collectionitem/' + item.id, inherited: true });
            }
        }
    });

    return { title: 'Collections', items: items };
}
