'use strict';

// =================================================================
//  health.js — My Health
//  H1: Allergies, Supplements, Vaccinations, Eye/Glasses
//  H2: Health Visits
// =================================================================

/* ── Severity ordering for allergy sort ───────────────────────── */
var HEALTH_SEVERITY_ORDER = { Severe: 0, Moderate: 1, Mild: 2 };

// -----------------------------------------------------------------
//  HEALTH HUB
// -----------------------------------------------------------------
function loadHealthPage() {
    // Hub is a static grid — nothing dynamic to load.
}

// =================================================================
//  ALLERGIES
// =================================================================

function loadAllergyPage() {
    var list = document.getElementById('allergyList');
    if (!list) return;
    list.innerHTML = '<p class="empty-state">Loading…</p>';

    userCol('allergies').get()
        .then(function(snap) {
            if (snap.empty) {
                list.innerHTML = '<p class="empty-state">No allergies recorded yet. Tap + Add to add one.</p>';
                return;
            }
            // Sort client-side: Severe → Moderate → Mild → Unknown, then A-Z within each
            var docs = snap.docs.map(function(d) {
                return Object.assign({ id: d.id }, d.data());
            });
            docs.sort(function(a, b) {
                var sa = HEALTH_SEVERITY_ORDER[a.severity] !== undefined ? HEALTH_SEVERITY_ORDER[a.severity] : 9;
                var sb = HEALTH_SEVERITY_ORDER[b.severity] !== undefined ? HEALTH_SEVERITY_ORDER[b.severity] : 9;
                if (sa !== sb) return sa - sb;
                return (a.allergen || '').localeCompare(b.allergen || '');
            });
            list.innerHTML = '';
            docs.forEach(function(doc) {
                list.appendChild(buildAllergyCard(doc));
            });
        })
        .catch(function(err) {
            list.innerHTML = '<p class="empty-state">Error loading allergies.</p>';
            console.error('loadAllergyPage:', err);
        });
}

function buildAllergyCard(doc) {
    var severityClass = 'health-badge--severity-' + (doc.severity || 'unknown').toLowerCase();
    var div = document.createElement('div');
    div.className = 'health-card';
    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(doc.allergen || '') + '</div>' +
            '<div class="health-card-meta">' +
                (doc.type     ? '<span class="health-badge">' + escapeHtml(doc.type) + '</span>' : '') +
                (doc.severity ? '<span class="health-badge ' + severityClass + '">' + escapeHtml(doc.severity) + '</span>' : '') +
            '</div>' +
            (doc.reaction ? '<div class="health-card-sub">Reaction: ' + escapeHtml(doc.reaction) + '</div>' : '') +
            (doc.notes    ? '<div class="health-card-sub">' + escapeHtml(doc.notes) + '</div>' : '') +
        '</div>' +
        '<div class="health-card-actions">' +
            '<button class="btn btn-secondary btn-small" onclick="openAllergyModal(\'' + doc.id + '\')">Edit</button>' +
            '<button class="btn btn-danger btn-small" onclick="deleteAllergy(\'' + doc.id + '\')">Delete</button>' +
        '</div>';
    return div;
}

function openAllergyModal(id) {
    var modal = document.getElementById('allergyModal');
    modal.dataset.editId = id || '';
    document.getElementById('allergyModalTitle').textContent = id ? 'Edit Allergy' : 'Add Allergy';

    // Clear all fields
    document.getElementById('allergyAllergen').value  = '';
    document.getElementById('allergyType').value      = '';
    document.getElementById('allergyReaction').value  = '';
    document.getElementById('allergySeverity').value  = '';
    document.getElementById('allergyDate').value      = '';
    document.getElementById('allergyNotes').value     = '';

    if (id) {
        userCol('allergies').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('allergyAllergen').value  = d.allergen        || '';
            document.getElementById('allergyType').value      = d.type            || '';
            document.getElementById('allergyReaction').value  = d.reaction        || '';
            document.getElementById('allergySeverity').value  = d.severity        || '';
            document.getElementById('allergyDate').value      = d.dateDiscovered  || '';
            document.getElementById('allergyNotes').value     = d.notes           || '';
        });
    }
    openModal('allergyModal');
}

function saveAllergy() {
    var allergen = document.getElementById('allergyAllergen').value.trim();
    if (!allergen) { alert('Allergen name is required.'); return; }

    var data = {
        allergen:       allergen,
        type:           document.getElementById('allergyType').value,
        reaction:       document.getElementById('allergyReaction').value.trim(),
        severity:       document.getElementById('allergySeverity').value,
        dateDiscovered: document.getElementById('allergyDate').value || null,
        notes:          document.getElementById('allergyNotes').value.trim()
    };

    var modal  = document.getElementById('allergyModal');
    var editId = modal.dataset.editId;
    var op = editId
        ? userCol('allergies').doc(editId).update(data)
        : userCol('allergies').add(data);

    op.then(function() {
        closeModal('allergyModal');
        loadAllergyPage();
    }).catch(function(err) {
        alert('Error saving allergy: ' + err.message);
    });
}

function deleteAllergy(id) {
    if (!confirm('Delete this allergy record?')) return;
    userCol('allergies').doc(id).delete()
        .then(function() { loadAllergyPage(); })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}

// =================================================================
//  SUPPLEMENTS
// =================================================================

function loadSupplementPage() {
    var activeList   = document.getElementById('supplementActiveList');
    var stoppedList  = document.getElementById('supplementStoppedList');
    var stoppedSect  = document.getElementById('supplementStoppedSection');
    if (!activeList) return;

    activeList.innerHTML = '<p class="empty-state">Loading…</p>';

    userCol('supplements').orderBy('name').get()
        .then(function(snap) {
            var activeDocs = [], stoppedDocs = [];
            snap.docs.forEach(function(d) {
                var rec = Object.assign({ id: d.id }, d.data());
                if (rec.status === 'stopped') {
                    stoppedDocs.push(rec);
                } else {
                    activeDocs.push(rec);
                }
            });

            // Active section
            if (activeDocs.length === 0) {
                activeList.innerHTML = '<p class="empty-state">No current supplements. Tap + Add to add one.</p>';
            } else {
                activeList.innerHTML = '';
                activeDocs.forEach(function(rec) {
                    activeList.appendChild(buildSupplementCard(rec));
                });
            }

            // Stopped section
            if (stoppedDocs.length === 0) {
                stoppedSect.style.display = 'none';
            } else {
                stoppedSect.style.display = '';
                stoppedList.innerHTML = '';
                stoppedDocs.forEach(function(rec) {
                    stoppedList.appendChild(buildSupplementCard(rec));
                });
            }
        })
        .catch(function(err) {
            activeList.innerHTML = '<p class="empty-state">Error loading supplements.</p>';
            console.error('loadSupplementPage:', err);
        });
}

function buildSupplementCard(doc) {
    var isStopped = doc.status === 'stopped';
    var div = document.createElement('div');
    div.className = 'health-card' + (isStopped ? ' health-card--dim' : '');

    var dosage = doc.dosage ? ' — ' + escapeHtml(doc.dosage) : '';
    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(doc.name || '') + dosage + '</div>' +
            '<div class="health-card-meta">' +
                (doc.brand ? '<span class="health-badge">' + escapeHtml(doc.brand) + '</span>' : '') +
            '</div>' +
            (doc.reason    ? '<div class="health-card-sub">' + escapeHtml(doc.reason) + '</div>' : '') +
            (doc.frequency ? '<div class="health-card-sub">Frequency: ' + escapeHtml(doc.frequency) + '</div>' : '') +
            (isStopped && doc.endDate ? '<div class="health-card-sub">Stopped: ' + escapeHtml(doc.endDate) + '</div>' : '') +
        '</div>' +
        '<div class="health-card-actions">' +
            '<button class="btn btn-secondary btn-small" onclick="openSupplementModal(\'' + doc.id + '\')">Edit</button>' +
            (!isStopped ? '<button class="btn btn-secondary btn-small" onclick="stopSupplement(\'' + doc.id + '\')">Stop</button>' : '') +
            '<button class="btn btn-danger btn-small" onclick="deleteSupplement(\'' + doc.id + '\')">Delete</button>' +
        '</div>';
    return div;
}

function openSupplementModal(id) {
    var modal = document.getElementById('supplementModal');
    modal.dataset.editId = id || '';
    document.getElementById('supplementModalTitle').textContent = id ? 'Edit Supplement' : 'Add Supplement';

    // Clear all fields
    ['supplementName','supplementDosage','supplementBrand','supplementReason',
     'supplementFrequency','supplementStartDate','supplementNotes'].forEach(function(f) {
        document.getElementById(f).value = '';
    });

    if (id) {
        userCol('supplements').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('supplementName').value      = d.name      || '';
            document.getElementById('supplementDosage').value    = d.dosage    || '';
            document.getElementById('supplementBrand').value     = d.brand     || '';
            document.getElementById('supplementReason').value    = d.reason    || '';
            document.getElementById('supplementFrequency').value = d.frequency || '';
            document.getElementById('supplementStartDate').value = d.startDate || '';
            document.getElementById('supplementNotes').value     = d.notes     || '';
        });
    }
    openModal('supplementModal');
}

function saveSupplement() {
    var name = document.getElementById('supplementName').value.trim();
    if (!name) { alert('Supplement name is required.'); return; }

    var data = {
        name:      name,
        dosage:    document.getElementById('supplementDosage').value.trim(),
        brand:     document.getElementById('supplementBrand').value.trim(),
        reason:    document.getElementById('supplementReason').value.trim(),
        frequency: document.getElementById('supplementFrequency').value.trim(),
        startDate: document.getElementById('supplementStartDate').value || null,
        notes:     document.getElementById('supplementNotes').value.trim()
    };

    var modal  = document.getElementById('supplementModal');
    var editId = modal.dataset.editId;
    var op;
    if (editId) {
        op = userCol('supplements').doc(editId).update(data);
    } else {
        data.status    = 'active';
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        op = userCol('supplements').add(data);
    }

    op.then(function() {
        closeModal('supplementModal');
        loadSupplementPage();
    }).catch(function(err) {
        alert('Error saving supplement: ' + err.message);
    });
}

function stopSupplement(id) {
    var endDate = prompt('When did you stop? (YYYY-MM-DD, or leave blank):');
    if (endDate === null) return;  // user hit Cancel
    userCol('supplements').doc(id).update({
        status:  'stopped',
        endDate: endDate.trim() || null
    }).then(function() {
        loadSupplementPage();
    }).catch(function(err) {
        alert('Error: ' + err.message);
    });
}

function deleteSupplement(id) {
    if (!confirm('Delete this supplement record?')) return;
    userCol('supplements').doc(id).delete()
        .then(function() { loadSupplementPage(); })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}

// =================================================================
//  VACCINATIONS
// =================================================================

function loadVaccinationPage() {
    var list = document.getElementById('vaccinationList');
    if (!list) return;
    list.innerHTML = '<p class="empty-state">Loading…</p>';

    userCol('vaccinations').orderBy('date', 'desc').get()
        .then(function(snap) {
            if (snap.empty) {
                list.innerHTML = '<p class="empty-state">No vaccinations recorded yet. Tap + Add to add one.</p>';
                return;
            }
            list.innerHTML = '';
            snap.docs.forEach(function(d) {
                list.appendChild(buildVaccinationCard(Object.assign({ id: d.id }, d.data())));
            });
        })
        .catch(function(err) {
            list.innerHTML = '<p class="empty-state">Error loading vaccinations.</p>';
            console.error('loadVaccinationPage:', err);
        });
}

function buildVaccinationCard(doc) {
    var dateLabel = (doc.dateApproximate ? '~' : '') + (doc.date || 'Date unknown');
    var div = document.createElement('div');
    div.className = 'health-card';
    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(doc.name || '') + '</div>' +
            '<div class="health-card-meta">' +
                '<span class="health-badge">' + escapeHtml(dateLabel) + '</span>' +
                (doc.nextDueDate ? '<span class="health-badge health-badge--due">Next: ' + escapeHtml(doc.nextDueDate) + '</span>' : '') +
            '</div>' +
            (doc.provider ? '<div class="health-card-sub">Provider: ' + escapeHtml(doc.provider) + '</div>' : '') +
            (doc.lotNumber ? '<div class="health-card-sub">Lot: ' + escapeHtml(doc.lotNumber) + '</div>' : '') +
            (doc.notes    ? '<div class="health-card-sub">' + escapeHtml(doc.notes) + '</div>' : '') +
        '</div>' +
        '<div class="health-card-actions">' +
            '<button class="btn btn-secondary btn-small" onclick="openVaccinationModal(\'' + doc.id + '\')">Edit</button>' +
            '<button class="btn btn-danger btn-small" onclick="deleteVaccination(\'' + doc.id + '\')">Delete</button>' +
        '</div>';
    return div;
}

function openVaccinationModal(id) {
    var modal = document.getElementById('vaccinationModal');
    modal.dataset.editId = id || '';
    document.getElementById('vaccinationModalTitle').textContent = id ? 'Edit Vaccination' : 'Add Vaccination';

    ['vaccinationName','vaccinationDate','vaccinationProvider',
     'vaccinationLot','vaccinationNextDue','vaccinationNotes'].forEach(function(f) {
        document.getElementById(f).value = '';
    });
    document.getElementById('vaccinationApprox').checked = false;

    if (id) {
        userCol('vaccinations').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('vaccinationName').value    = d.name        || '';
            document.getElementById('vaccinationDate').value    = d.date        || '';
            document.getElementById('vaccinationApprox').checked = !!d.dateApproximate;
            document.getElementById('vaccinationProvider').value = d.provider   || '';
            document.getElementById('vaccinationLot').value     = d.lotNumber   || '';
            document.getElementById('vaccinationNextDue').value = d.nextDueDate || '';
            document.getElementById('vaccinationNotes').value   = d.notes       || '';
        });
    }
    openModal('vaccinationModal');
}

function saveVaccination() {
    var name = document.getElementById('vaccinationName').value.trim();
    if (!name) { alert('Vaccine name is required.'); return; }

    var data = {
        name:           name,
        date:           document.getElementById('vaccinationDate').value || null,
        dateApproximate: document.getElementById('vaccinationApprox').checked,
        provider:       document.getElementById('vaccinationProvider').value.trim(),
        lotNumber:      document.getElementById('vaccinationLot').value.trim(),
        nextDueDate:    document.getElementById('vaccinationNextDue').value || null,
        notes:          document.getElementById('vaccinationNotes').value.trim()
    };

    var modal  = document.getElementById('vaccinationModal');
    var editId = modal.dataset.editId;
    var op;
    if (editId) {
        op = userCol('vaccinations').doc(editId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        op = userCol('vaccinations').add(data);
    }

    op.then(function() {
        closeModal('vaccinationModal');
        loadVaccinationPage();
    }).catch(function(err) {
        alert('Error saving vaccination: ' + err.message);
    });
}

function deleteVaccination(id) {
    if (!confirm('Delete this vaccination record?')) return;
    userCol('vaccinations').doc(id).delete()
        .then(function() { loadVaccinationPage(); })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}

// =================================================================
//  EYE / GLASSES PRESCRIPTIONS
// =================================================================

function loadEyePage() {
    var distanceList = document.getElementById('eyeDistanceList');
    var readingList  = document.getElementById('eyeReadingList');
    if (!distanceList || !readingList) return;

    distanceList.innerHTML = '<p class="empty-state">Loading…</p>';
    readingList.innerHTML  = '';

    userCol('eyePrescriptions').orderBy('date', 'desc').get()
        .then(function(snap) {
            var distanceDocs = [], readingDocs = [];
            snap.docs.forEach(function(d) {
                var rec = Object.assign({ id: d.id }, d.data());
                if (rec.type === 'Reading') {
                    readingDocs.push(rec);
                } else {
                    distanceDocs.push(rec);
                }
            });

            // Distance section
            if (distanceDocs.length === 0) {
                distanceList.innerHTML = '<p class="empty-state">No distance prescriptions recorded.</p>';
            } else {
                distanceList.innerHTML = '';
                distanceDocs.forEach(function(rec) {
                    distanceList.appendChild(buildEyeCard(rec));
                });
            }

            // Reading section
            if (readingDocs.length === 0) {
                readingList.innerHTML = '<p class="empty-state">No reading prescriptions recorded.</p>';
            } else {
                readingList.innerHTML = '';
                readingDocs.forEach(function(rec) {
                    readingList.appendChild(buildEyeCard(rec));
                });
            }
        })
        .catch(function(err) {
            distanceList.innerHTML = '<p class="empty-state">Error loading prescriptions.</p>';
            console.error('loadEyePage:', err);
        });
}

/* Format one eye's Rx fields into a readable string. */
function formatEyeRx(eye) {
    if (!eye) return '—';
    var parts = [];
    if (eye.sphere)   parts.push('SPH ' + eye.sphere);
    if (eye.cylinder) parts.push('CYL ' + eye.cylinder);
    if (eye.axis)     parts.push('Axis ' + eye.axis);
    if (eye.add)      parts.push('Add '  + eye.add);
    return parts.length ? parts.join(', ') : '—';
}

function buildEyeCard(doc) {
    var div = document.createElement('div');
    div.className = 'health-card';
    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(doc.date || '—') + '</div>' +
            '<div class="health-eye-rx">' +
                '<div><strong>OD (right):</strong> ' + escapeHtml(formatEyeRx(doc.rightEye)) + '</div>' +
                '<div><strong>OS (left):</strong> '  + escapeHtml(formatEyeRx(doc.leftEye))  + '</div>' +
            '</div>' +
            (doc.pd       ? '<div class="health-card-sub">PD: ' + escapeHtml(doc.pd) + '</div>' : '') +
            (doc.provider ? '<div class="health-card-sub">Provider: ' + escapeHtml(doc.provider) + '</div>' : '') +
            (doc.notes    ? '<div class="health-card-sub">' + escapeHtml(doc.notes) + '</div>' : '') +
        '</div>' +
        '<div class="health-card-actions">' +
            '<button class="btn btn-secondary btn-small" onclick="openEyeModal(\'' + doc.id + '\')">Edit</button>' +
            '<button class="btn btn-danger btn-small" onclick="deleteEye(\'' + doc.id + '\')">Delete</button>' +
        '</div>';
    return div;
}

function openEyeModal(id) {
    var modal = document.getElementById('eyeModal');
    modal.dataset.editId = id || '';
    document.getElementById('eyeModalTitle').textContent = id ? 'Edit Prescription' : 'Add Prescription';

    ['eyeDate','eyeRightSphere','eyeRightCylinder','eyeRightAxis','eyeRightAdd',
     'eyeLeftSphere','eyeLeftCylinder','eyeLeftAxis','eyeLeftAdd',
     'eyePD','eyeProvider','eyeNotes'].forEach(function(f) {
        document.getElementById(f).value = '';
    });
    document.getElementById('eyeType').value = 'Distance';

    if (id) {
        userCol('eyePrescriptions').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            var r = d.rightEye || {};
            var l = d.leftEye  || {};
            document.getElementById('eyeDate').value            = d.date        || '';
            document.getElementById('eyeType').value            = d.type        || 'Distance';
            document.getElementById('eyeRightSphere').value     = r.sphere      || '';
            document.getElementById('eyeRightCylinder').value   = r.cylinder    || '';
            document.getElementById('eyeRightAxis').value       = r.axis        || '';
            document.getElementById('eyeRightAdd').value        = r.add         || '';
            document.getElementById('eyeLeftSphere').value      = l.sphere      || '';
            document.getElementById('eyeLeftCylinder').value    = l.cylinder    || '';
            document.getElementById('eyeLeftAxis').value        = l.axis        || '';
            document.getElementById('eyeLeftAdd').value         = l.add         || '';
            document.getElementById('eyePD').value              = d.pd          || '';
            document.getElementById('eyeProvider').value        = d.provider    || '';
            document.getElementById('eyeNotes').value           = d.notes       || '';
        });
    }
    openModal('eyeModal');
}

function saveEye() {
    var date = document.getElementById('eyeDate').value;
    if (!date) { alert('Date is required.'); return; }

    var data = {
        date:     date,
        type:     document.getElementById('eyeType').value,
        rightEye: {
            sphere:   document.getElementById('eyeRightSphere').value.trim()   || null,
            cylinder: document.getElementById('eyeRightCylinder').value.trim() || null,
            axis:     document.getElementById('eyeRightAxis').value.trim()     || null,
            add:      document.getElementById('eyeRightAdd').value.trim()      || null
        },
        leftEye: {
            sphere:   document.getElementById('eyeLeftSphere').value.trim()    || null,
            cylinder: document.getElementById('eyeLeftCylinder').value.trim()  || null,
            axis:     document.getElementById('eyeLeftAxis').value.trim()      || null,
            add:      document.getElementById('eyeLeftAdd').value.trim()       || null
        },
        pd:       document.getElementById('eyePD').value.trim(),
        provider: document.getElementById('eyeProvider').value.trim(),
        notes:    document.getElementById('eyeNotes').value.trim()
    };

    var modal  = document.getElementById('eyeModal');
    var editId = modal.dataset.editId;
    var op;
    if (editId) {
        op = userCol('eyePrescriptions').doc(editId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        op = userCol('eyePrescriptions').add(data);
    }

    op.then(function() {
        closeModal('eyeModal');
        loadEyePage();
    }).catch(function(err) {
        alert('Error saving prescription: ' + err.message);
    });
}

function deleteEye(id) {
    if (!confirm('Delete this prescription record?')) return;
    userCol('eyePrescriptions').doc(id).delete()
        .then(function() { loadEyePage(); })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}

// =================================================================
//  HEALTH VISITS (H2)
// =================================================================

/** Cached visit list for client-side filter re-render. */
var _healthVisitCache = [];

function loadHealthVisitsPage() {
    var list = document.getElementById('visitList');
    if (!list) return;
    list.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    userCol('healthVisits').orderBy('date', 'desc').get()
        .then(function(snap) {
            _healthVisitCache = snap.docs.map(function(d) {
                return Object.assign({ id: d.id }, d.data());
            });
            var filter = document.getElementById('visitTypeFilter');
            renderVisitList(_healthVisitCache, filter ? filter.value : '');
        })
        .catch(function(err) {
            list.innerHTML = '<p class="empty-state">Error loading visits.</p>';
            console.error('loadHealthVisitsPage:', err);
        });
}

function renderVisitList(visits, typeFilter) {
    var list = document.getElementById('visitList');
    if (!list) return;

    var filtered = typeFilter
        ? visits.filter(function(v) { return v.providerType === typeFilter; })
        : visits;

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-state">' +
            (typeFilter ? 'No visits with this provider type.' : 'No visits recorded yet. Tap + Add Visit.') +
            '</p>';
        return;
    }

    list.innerHTML = '';
    var lastYear = null;
    filtered.forEach(function(visit) {
        var year = (visit.date || '').substring(0, 4) || 'Unknown';
        if (year !== lastYear) {
            var yearDiv = document.createElement('div');
            yearDiv.className = 'health-year-label';
            yearDiv.textContent = year;
            list.appendChild(yearDiv);
            lastYear = year;
        }
        list.appendChild(buildVisitCard(visit));
    });
}

function buildVisitCard(visit) {
    var div = document.createElement('div');
    div.className = 'health-card health-card--clickable';
    div.onclick = function() { location.hash = '#health-visit/' + visit.id; };

    var badge = visit.providerType
        ? '<span class="health-badge">' + escapeHtml(visit.providerType) + '</span>'
        : '';
    var sub = visit.reason
        ? escapeHtml(visit.reason)
        : '<em style="color:#aaa">No reason noted</em>';

    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(visit.date || '\u2014') + ' \u2014 ' + escapeHtml(visit.provider || 'Unknown provider') + '</div>' +
            '<div class="health-card-meta">' + badge + '</div>' +
            '<div class="health-card-sub">' + sub + '</div>' +
        '</div>' +
        '<div class="health-card-arrow">\u203a</div>';
    return div;
}

// ── Detail page ───────────────────────────────────────────────────

function loadHealthVisitDetail(id) {
    var titleEl = document.getElementById('visitDetailTitle');
    if (titleEl) titleEl.textContent = 'Loading\u2026';

    userCol('healthVisits').doc(id).get()
        .then(function(snap) {
            if (!snap.exists) {
                alert('Visit not found.');
                location.hash = '#health-visits';
                return;
            }
            window.currentHealthVisit = Object.assign({ id: snap.id }, snap.data());
            renderVisitDetail(window.currentHealthVisit);
        })
        .catch(function(err) {
            console.error('loadHealthVisitDetail:', err);
        });
}

function renderVisitDetail(visit) {
    document.getElementById('visitDetailTitle').textContent =
        (visit.date || '\u2014') + ' \u2014 ' + (visit.provider || 'Unknown');

    document.getElementById('visitDetailProvider').textContent = visit.provider     || '\u2014';
    document.getElementById('visitDetailType').textContent     = visit.providerType || '\u2014';
    document.getElementById('visitDetailReason').textContent   = visit.reason       || '\u2014';
    document.getElementById('visitDetailWhatDone').textContent = visit.whatWasDone  || '\u2014';
    document.getElementById('visitDetailOutcome').textContent  = visit.outcome      || '\u2014';
    document.getElementById('visitDetailCost').textContent     = visit.cost ? '$' + visit.cost : '\u2014';
    document.getElementById('visitDetailNotes').textContent    = visit.notes        || '\u2014';

    // Linked concern (hidden when not set)
    var concernSection = document.getElementById('visitDetailConcernSection');
    var concernEl      = document.getElementById('visitDetailConcern');
    if (visit.concernId) {
        concernSection.style.display = '';
        concernEl.textContent = 'Loading\u2026';
        userCol('concerns').doc(visit.concernId).get().then(function(snap) {
            concernEl.textContent = snap.exists ? (snap.data().title || visit.concernId) : 'Unknown concern';
        }).catch(function() { concernEl.textContent = visit.concernId; });
    } else {
        concernSection.style.display = 'none';
    }

    // Photos
    loadPhotos('healthVisit', visit.id, 'visitPhotoContainer', 'visitPhotoEmptyState');

    // Linked records (will be empty until H3/H4 collections are populated)
    loadVisitLinkedMeds(visit.id);
    loadVisitLinkedConditions(visit.id);
    loadVisitLinkedBloodWork(visit.id);
}

function loadVisitLinkedMeds(visitId) {
    var el = document.getElementById('visitMedsContainer');
    if (!el) return;
    el.innerHTML = '';
    userCol('medications').where('prescribedAtVisitId', '==', visitId).get()
        .then(function(snap) {
            if (snap.empty) { el.innerHTML = '<p class="empty-state">None recorded.</p>'; return; }
            snap.docs.forEach(function(d) {
                var m = d.data();
                var row = document.createElement('div');
                row.className = 'health-linked-item';
                row.textContent = (m.name || '\u2014') + (m.dosage ? ' \u2014 ' + m.dosage : '');
                el.appendChild(row);
            });
        }).catch(function() { el.innerHTML = '<p class="empty-state">\u2014</p>'; });
}

function loadVisitLinkedConditions(visitId) {
    var el = document.getElementById('visitConditionsContainer');
    if (!el) return;
    el.innerHTML = '';
    userCol('conditions').where('diagnosedAtVisitId', '==', visitId).get()
        .then(function(snap) {
            if (snap.empty) { el.innerHTML = '<p class="empty-state">None recorded.</p>'; return; }
            snap.docs.forEach(function(d) {
                var row = document.createElement('div');
                row.className = 'health-linked-item';
                row.textContent = d.data().name || '\u2014';
                el.appendChild(row);
            });
        }).catch(function() { el.innerHTML = '<p class="empty-state">\u2014</p>'; });
}

function loadVisitLinkedBloodWork(visitId) {
    var el = document.getElementById('visitBloodWorkContainer');
    if (!el) return;
    el.innerHTML = '';
    userCol('bloodWorkRecords').where('orderedAtVisitId', '==', visitId).get()
        .then(function(snap) {
            if (snap.empty) { el.innerHTML = '<p class="empty-state">None recorded.</p>'; return; }
            snap.docs.forEach(function(d) {
                var bw = d.data();
                var row = document.createElement('div');
                row.className = 'health-linked-item';
                row.textContent = (bw.date || '\u2014') + (bw.lab ? ' \u2014 ' + bw.lab : '');
                el.appendChild(row);
            });
        }).catch(function() { el.innerHTML = '<p class="empty-state">\u2014</p>'; });
}

// ── Add / Edit modal ──────────────────────────────────────────────

function openVisitModal(id) {
    var modal = document.getElementById('visitModal');
    modal.dataset.editId = id || '';
    modal.dataset.concernRestore = '';
    document.getElementById('visitModalTitle').textContent = id ? 'Edit Visit' : 'Add Visit';

    ['visitDate','visitProvider','visitReason','visitWhatDone',
     'visitOutcome','visitCost','visitNotes'].forEach(function(f) {
        document.getElementById(f).value = '';
    });
    document.getElementById('visitProviderType').value = '';

    // Populate concern dropdown (empty until H3 builds the concerns collection)
    var select = document.getElementById('visitConcernId');
    select.innerHTML = '<option value="">\u2014 No concern linked \u2014</option>';
    userCol('concerns').orderBy('title').get().then(function(snap) {
        snap.docs.forEach(function(d) {
            var opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.data().title || d.id;
            select.appendChild(opt);
        });
        if (modal.dataset.concernRestore) {
            select.value = modal.dataset.concernRestore;
        }
    }).catch(function() {});

    if (id) {
        userCol('healthVisits').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('visitDate').value         = d.date         || '';
            document.getElementById('visitProvider').value     = d.provider     || '';
            document.getElementById('visitProviderType').value = d.providerType || '';
            document.getElementById('visitReason').value       = d.reason       || '';
            document.getElementById('visitWhatDone').value     = d.whatWasDone  || '';
            document.getElementById('visitOutcome').value      = d.outcome      || '';
            document.getElementById('visitCost').value         = d.cost         || '';
            document.getElementById('visitNotes').value        = d.notes        || '';
            modal.dataset.concernRestore = d.concernId || '';
            select.value = d.concernId || '';
        });
    }
    openModal('visitModal');
}

function saveVisit() {
    var date = document.getElementById('visitDate').value;
    if (!date) { alert('Date is required.'); return; }

    var data = {
        date:         date,
        provider:     document.getElementById('visitProvider').value.trim(),
        providerType: document.getElementById('visitProviderType').value,
        concernId:    document.getElementById('visitConcernId').value || null,
        reason:       document.getElementById('visitReason').value.trim(),
        whatWasDone:  document.getElementById('visitWhatDone').value.trim(),
        outcome:      document.getElementById('visitOutcome').value.trim(),
        cost:         document.getElementById('visitCost').value.trim(),
        notes:        document.getElementById('visitNotes').value.trim()
    };

    var modal  = document.getElementById('visitModal');
    var editId = modal.dataset.editId;
    var p;
    if (editId) {
        p = userCol('healthVisits').doc(editId).update(data).then(function() { return editId; });
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        p = userCol('healthVisits').add(data).then(function(ref) { return ref.id; });
    }

    p.then(function(id) {
        closeModal('visitModal');
        location.hash = '#health-visit/' + id;
    }).catch(function(err) {
        alert('Error saving visit: ' + err.message);
    });
}

function editCurrentVisit() {
    if (window.currentHealthVisit) openVisitModal(window.currentHealthVisit.id);
}

function deleteCurrentVisit() {
    if (!window.currentHealthVisit) return;
    if (!confirm('Delete this visit record? Photos will not be deleted.')) return;
    userCol('healthVisits').doc(window.currentHealthVisit.id).delete()
        .then(function() { location.hash = '#health-visits'; })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}
