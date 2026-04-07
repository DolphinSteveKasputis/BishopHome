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
                var bw  = d.data();
                var row = document.createElement('div');
                row.className = 'health-linked-item health-linked-item--clickable';
                row.onclick   = function() { location.hash = '#health-bloodwork/' + d.id; };
                var markerCount = (bw.markers && bw.markers.length) ? ' (' + bw.markers.length + ' markers)' : '';
                row.textContent = (bw.date || '\u2014') + (bw.lab ? ' \u2014 ' + bw.lab : '') + markerCount;
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
        document.getElementById('visitModal').classList.remove('open');
        history.replaceState(null, '', '#health-visit/' + id);
        handleRoute();
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

// =================================================================
//  MEDICATIONS (H3)
// =================================================================

function loadMedicationsPage() {
    var activeList  = document.getElementById('medicationActiveList');
    var histList    = document.getElementById('medicationHistList');
    var histSection = document.getElementById('medicationHistSection');
    if (!activeList) return;
    activeList.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    userCol('medications').orderBy('name').get()
        .then(function(snap) {
            var active = [], hist = [];
            snap.docs.forEach(function(d) {
                var rec = Object.assign({ id: d.id }, d.data());
                if (rec.status === 'completed') hist.push(rec); else active.push(rec);
            });

            if (active.length === 0) {
                activeList.innerHTML = '<p class="empty-state">No current medications. Tap + Add to add one.</p>';
            } else {
                activeList.innerHTML = '';
                active.forEach(function(rec) { activeList.appendChild(buildMedCard(rec)); });
            }

            if (hist.length === 0) {
                histSection.style.display = 'none';
            } else {
                histSection.style.display = '';
                histList.innerHTML = '';
                hist.forEach(function(rec) { histList.appendChild(buildMedCard(rec)); });
            }
        })
        .catch(function(err) {
            activeList.innerHTML = '<p class="empty-state">Error loading medications.</p>';
            console.error('loadMedicationsPage:', err);
        });
}

function buildMedCard(doc) {
    var isCompleted = doc.status === 'completed';
    var div = document.createElement('div');
    div.className = 'health-card' + (isCompleted ? ' health-card--dim' : '');
    var dosage = doc.dosage ? ' \u2014 ' + escapeHtml(doc.dosage) : '';
    var typeBadge = doc.type ? '<span class="health-badge">' + escapeHtml(doc.type) + '</span>' : '';
    var dates = isCompleted
        ? '<div class="health-card-sub">' + escapeHtml(doc.startDate || '') + ' \u2192 ' + escapeHtml(doc.endDate || '') + '</div>'
        : (doc.startDate ? '<div class="health-card-sub">Since ' + escapeHtml(doc.startDate) + '</div>' : '');

    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(doc.name || '') + dosage + '</div>' +
            '<div class="health-card-meta">' + typeBadge + '</div>' +
            (doc.purpose ? '<div class="health-card-sub">' + escapeHtml(doc.purpose) + '</div>' : '') +
            dates +
        '</div>' +
        '<div class="health-card-actions">' +
            '<button class="btn btn-secondary btn-small" onclick="openMedModal(\'' + doc.id + '\')">Edit</button>' +
            '<button class="btn btn-secondary btn-small" onclick="openMedPhotoModal(\'' + doc.id + '\')">Photos</button>' +
            (!isCompleted ? '<button class="btn btn-secondary btn-small" onclick="markMedDone(\'' + doc.id + '\')">Done</button>' : '') +
            '<button class="btn btn-danger btn-small" onclick="deleteMed(\'' + doc.id + '\')">Delete</button>' +
        '</div>';
    return div;
}

/* Populate the "Prescribed at Visit" dropdown used in medication and condition modals. */
function populateVisitDropdown(selectId, selectedVisitId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">\u2014 Not linked to a visit \u2014</option>';
    userCol('healthVisits').orderBy('date', 'desc').limit(60).get()
        .then(function(snap) {
            snap.docs.forEach(function(d) {
                var v = d.data();
                var opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = (v.date || '?') + (v.provider ? ' \u2014 ' + v.provider : '');
                sel.appendChild(opt);
            });
            if (selectedVisitId) sel.value = selectedVisitId;
        }).catch(function() {});
}

// ── Medication Photos ────────────────────────────────────────────────────────

/**
 * Opens the photo viewer modal for a specific medication.
 * Uses a fixed container (medPhotoContainer) shared across all medications —
 * the current medication ID is stored in window._medPhotoModalId.
 */
function openMedPhotoModal(id) {
    window._medPhotoModalId = id;
    loadPhotos('medication', id, 'medPhotoContainer', 'medPhotoEmptyState');
    openModal('medPhotoModal');
}

// ── Scan Rx Label (LLM Vision) ───────────────────────────────────────────────

/**
 * Triggers the appropriate image source for scanning a prescription label.
 * mode: 'camera'  — opens device camera (mobile)
 *       'gallery' — opens file/photo picker
 *       'paste'   — reads image from clipboard
 */
async function _medScanRx(mode) {
    if (mode === 'paste') {
        if (!navigator.clipboard || !navigator.clipboard.read) {
            alert('Clipboard paste is not supported in this browser. Try Camera or Gallery instead.');
            return;
        }
        try {
            var items = await navigator.clipboard.read();
            var imageBlob = null;
            for (var i = 0; i < items.length; i++) {
                var imageType = items[i].types.find(function(t) { return t.startsWith('image/'); });
                if (imageType) { imageBlob = await items[i].getType(imageType); break; }
            }
            if (!imageBlob) {
                alert('No image on the clipboard.\n\nRight-click an image and choose "Copy image", then click Paste.');
                return;
            }
            var ext  = imageBlob.type === 'image/png' ? '.png' : '.jpg';
            var file = new File([imageBlob], 'pasted-rx' + ext, { type: imageBlob.type });
            await _medProcessRxFile(file);
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                alert('Clipboard access was denied. Click "Allow" when the browser asks, then try again.');
            } else {
                alert('Could not read clipboard: ' + err.message);
            }
        }
        return;
    }

    // Camera or Gallery — use a temporary file input
    var input = document.getElementById('medRxScanInput');
    input.value = '';
    if (mode === 'camera') {
        input.setAttribute('capture', 'environment');
    } else {
        input.removeAttribute('capture');
    }
    input.click();
}

/**
 * Called when the user selects a file via the hidden file input.
 */
async function _medHandleRxScan(input) {
    if (!input.files || !input.files[0]) return;
    await _medProcessRxFile(input.files[0]);
}

/**
 * Compresses an image file, sends it to the LLM for prescription data
 * extraction, and auto-populates the medication form fields.
 * Also stores the compressed image so saveMed() can attach it as a photo.
 */
async function _medProcessRxFile(file) {
    var statusEl = document.getElementById('medScanStatus');

    statusEl.textContent = 'Compressing image…';
    var base64DataUrl;
    try {
        base64DataUrl = await compressImage(file);
    } catch (e) {
        statusEl.textContent = 'Error compressing image.';
        console.error('_medProcessRxFile compress:', e);
        return;
    }

    // Store so saveMed() can attach it as a photo after saving
    document.getElementById('medicationModal').dataset.pendingRxPhoto = base64DataUrl;

    statusEl.textContent = 'Reading label with AI…';
    var parsed;
    try {
        parsed = await _medCallLLMVision(base64DataUrl);
    } catch (e) {
        statusEl.textContent = 'AI error: ' + e.message;
        console.error('_medProcessRxFile LLM:', e);
        return;
    }

    // Populate form fields — only overwrite if the LLM returned a value
    if (parsed.name)          document.getElementById('medName').value         = parsed.name;
    if (parsed.dosage)        document.getElementById('medDosage').value       = parsed.dosage;
    if (parsed.prescribedBy)  document.getElementById('medPrescribedBy').value = parsed.prescribedBy;
    if (parsed.startDate)     document.getElementById('medStartDate').value    = parsed.startDate;
    if (parsed.type)          document.getElementById('medType').value         = parsed.type;
    if (parsed.notes)         document.getElementById('medNotes').value        = parsed.notes;

    statusEl.textContent = '✓ Fields filled — review and save.';
}

/**
 * Calls the configured LLM with a vision prompt to extract prescription data
 * from a Base64 image.  Returns a plain object with the extracted fields.
 *
 * Extracted fields: name, dosage, prescribedBy, startDate, type, notes.
 */
async function _medCallLLMVision(base64DataUrl) {
    var doc = await userCol('settings').doc('llm').get();
    if (!doc.exists) throw new Error('LLM not configured. Go to Settings → QuickLog to add your API key.');

    var cfg      = doc.data();
    var provider = cfg.provider || 'openai';
    var apiKey   = cfg.apiKey   || '';
    var model    = cfg.model    || '';

    var ENDPOINTS = {
        openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
        grok:   { url: 'https://api.x.ai/v1/chat/completions',       model: 'grok-2-vision-1212' }
    };
    var ep = ENDPOINTS[provider] || ENDPOINTS.openai;

    var systemPrompt =
        'You are a prescription label reader. Extract medication information from the image ' +
        'and return ONLY a valid JSON object with these fields:\n' +
        '  name        – drug name and strength (e.g. "Albendazole 200 MG")\n' +
        '  dosage      – dosage instructions including qty and days supply (e.g. "200mg, 4 tablets, 2-day supply")\n' +
        '  prescribedBy – prescriber name only (e.g. "Nathan Szakal")\n' +
        '  startDate   – fill date as YYYY-MM-DD (e.g. "2026-04-07")\n' +
        '  type        – one of: "Ongoing", "Short-term", "As-needed" — infer from days supply\n' +
        '  notes       – one compact line: Rx#, NDC, qty, refills, insurance savings if shown\n' +
        'Return ONLY the JSON object, no markdown, no explanation.';

    var res = await fetch(ep.url, {
        method : 'POST',
        headers: {
            'Content-Type' : 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: model || ep.model,
            max_completion_tokens: 400,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text',      text: systemPrompt },
                    { type: 'image_url', image_url: { url: base64DataUrl, detail: 'high' } }
                ]
            }]
        })
    });

    if (!res.ok) {
        var errBody = await res.text();
        throw new Error('LLM error ' + res.status + ': ' + errBody.slice(0, 200));
    }
    var json    = await res.json();
    var content = json.choices[0].message.content.trim();

    // Strip markdown code fences if the model added them
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    try {
        return JSON.parse(content);
    } catch (e) {
        throw new Error('Could not parse LLM response: ' + content.slice(0, 100));
    }
}

function openMedModal(id) {
    var modal = document.getElementById('medicationModal');
    modal.dataset.editId = id || '';
    document.getElementById('medicationModalTitle').textContent = id ? 'Edit Medication' : 'Add Medication';

    ['medName','medDosage','medPurpose','medPrescribedBy','medStartDate','medEndDate','medNotes'].forEach(function(f) {
        document.getElementById(f).value = '';
    });
    document.getElementById('medType').value   = '';
    document.getElementById('medStatus').value = 'active';
    document.getElementById('medScanStatus').textContent = '';
    document.getElementById('medicationModal').dataset.pendingRxPhoto = '';

    var visitId = '';
    if (id) {
        userCol('medications').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('medName').value         = d.name         || '';
            document.getElementById('medDosage').value       = d.dosage       || '';
            document.getElementById('medType').value         = d.type         || '';
            document.getElementById('medPurpose').value      = d.purpose      || '';
            document.getElementById('medPrescribedBy').value = d.prescribedBy || '';
            document.getElementById('medStartDate').value    = d.startDate    || '';
            document.getElementById('medEndDate').value      = d.endDate      || '';
            document.getElementById('medStatus').value       = d.status       || 'active';
            document.getElementById('medNotes').value        = d.notes        || '';
            visitId = d.prescribedAtVisitId || '';
            populateVisitDropdown('medVisitId', visitId);
        });
    } else {
        populateVisitDropdown('medVisitId', '');
    }
    openModal('medicationModal');
}

function saveMed() {
    var name = document.getElementById('medName').value.trim();
    if (!name) { alert('Medication name is required.'); return; }

    var data = {
        name:                name,
        dosage:              document.getElementById('medDosage').value.trim(),
        type:                document.getElementById('medType').value,
        purpose:             document.getElementById('medPurpose').value.trim(),
        prescribedBy:        document.getElementById('medPrescribedBy').value.trim(),
        prescribedAtVisitId: document.getElementById('medVisitId').value || null,
        startDate:           document.getElementById('medStartDate').value || null,
        endDate:             document.getElementById('medEndDate').value || null,
        status:              document.getElementById('medStatus').value || 'active',
        notes:               document.getElementById('medNotes').value.trim()
    };

    var modal  = document.getElementById('medicationModal');
    var editId = modal.dataset.editId;
    var op;
    if (editId) {
        op = userCol('medications').doc(editId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        op = userCol('medications').add(data);
    }
    op.then(function(ref) {
        var savedId   = ref ? ref.id : editId;  // ref is set on add, undefined on update
        var rxPhoto   = document.getElementById('medicationModal').dataset.pendingRxPhoto || '';
        var afterClose = function() { loadMedicationsPage(); };

        if (rxPhoto && savedId) {
            // Attach the scanned Rx receipt image as a photo on this medication
            userCol('photos').add({
                targetType : 'medication',
                targetId   : savedId,
                imageData  : rxPhoto,
                caption    : 'Rx receipt',
                createdAt  : firebase.firestore.FieldValue.serverTimestamp()
            }).catch(function(e) { console.error('Failed to save Rx photo:', e); });
        }

        closeModal('medicationModal');
        afterClose();
    }).catch(function(err) { alert('Error saving: ' + err.message); });
}

function markMedDone(id) {
    var endDate = prompt('End date (YYYY-MM-DD, or leave blank for today):');
    if (endDate === null) return;
    var today = new Date().toISOString().slice(0, 10);
    userCol('medications').doc(id).update({
        status:  'completed',
        endDate: endDate.trim() || today
    }).then(function() { loadMedicationsPage(); })
      .catch(function(err) { alert('Error: ' + err.message); });
}

function deleteMed(id) {
    if (!confirm('Delete this medication record?')) return;
    userCol('medications').doc(id).delete()
        .then(function() { loadMedicationsPage(); })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}

// =================================================================
//  CONDITIONS (H3)
// =================================================================

function loadConditionsPage() {
    var activeList  = document.getElementById('conditionActiveList');
    var resolvedList    = document.getElementById('conditionResolvedList');
    var resolvedSection = document.getElementById('conditionResolvedSection');
    if (!activeList) return;
    activeList.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    userCol('conditions').get()
        .then(function(snap) {
            var active = [], resolved = [];
            snap.docs.forEach(function(d) {
                var rec = Object.assign({ id: d.id }, d.data());
                if (rec.status === 'resolved') resolved.push(rec); else active.push(rec);
            });
            // Sort each group alphabetically
            active.sort(function(a,b)   { return (a.name||'').localeCompare(b.name||''); });
            resolved.sort(function(a,b) { return (a.name||'').localeCompare(b.name||''); });

            if (active.length === 0) {
                activeList.innerHTML = '<p class="empty-state">No conditions recorded. Tap + Add to add one.</p>';
            } else {
                activeList.innerHTML = '';
                active.forEach(function(rec) { activeList.appendChild(buildConditionCard(rec)); });
            }

            if (resolved.length === 0) {
                resolvedSection.style.display = 'none';
            } else {
                resolvedSection.style.display = '';
                resolvedList.innerHTML = '';
                resolved.forEach(function(rec) { resolvedList.appendChild(buildConditionCard(rec)); });
            }
        })
        .catch(function(err) {
            activeList.innerHTML = '<p class="empty-state">Error loading conditions.</p>';
            console.error('loadConditionsPage:', err);
        });
}

function buildConditionCard(doc) {
    var isResolved = doc.status === 'resolved';
    var statusClass = 'health-badge--status-' + (doc.status || 'active');
    var div = document.createElement('div');
    div.className = 'health-card' + (isResolved ? ' health-card--dim' : '');
    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(doc.name || '') + '</div>' +
            '<div class="health-card-meta">' +
                (doc.category ? '<span class="health-badge">' + escapeHtml(doc.category) + '</span>' : '') +
                (doc.status   ? '<span class="health-badge ' + statusClass + '">' + escapeHtml(doc.status) + '</span>' : '') +
            '</div>' +
            (doc.diagnosedDate     ? '<div class="health-card-sub">Diagnosed: ' + escapeHtml(doc.diagnosedDate) + '</div>' : '') +
            (doc.managementNotes   ? '<div class="health-card-sub">' + escapeHtml(doc.managementNotes) + '</div>' : '') +
        '</div>' +
        '<div class="health-card-actions">' +
            '<button class="btn btn-secondary btn-small" onclick="openConditionModal(\'' + doc.id + '\')">Edit</button>' +
            '<button class="btn btn-danger btn-small" onclick="deleteCondition(\'' + doc.id + '\')">Delete</button>' +
        '</div>';
    return div;
}

function openConditionModal(id) {
    var modal = document.getElementById('conditionModal');
    modal.dataset.editId = id || '';
    document.getElementById('conditionModalTitle').textContent = id ? 'Edit Condition' : 'Add Condition';

    ['conditionName','conditionDiagnosedDate','conditionDiagnosedBy','conditionManagementNotes','conditionNotes'].forEach(function(f) {
        document.getElementById(f).value = '';
    });
    document.getElementById('conditionCategory').value = '';
    document.getElementById('conditionStatus').value   = 'active';

    if (id) {
        userCol('conditions').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('conditionName').value             = d.name             || '';
            document.getElementById('conditionCategory').value         = d.category         || '';
            document.getElementById('conditionStatus').value           = d.status           || 'active';
            document.getElementById('conditionDiagnosedDate').value    = d.diagnosedDate    || '';
            document.getElementById('conditionDiagnosedBy').value      = d.diagnosedBy      || '';
            document.getElementById('conditionManagementNotes').value  = d.managementNotes  || '';
            document.getElementById('conditionNotes').value            = d.notes            || '';
            populateVisitDropdown('conditionVisitId', d.diagnosedAtVisitId || '');
        });
    } else {
        populateVisitDropdown('conditionVisitId', '');
    }
    openModal('conditionModal');
}

function saveCondition() {
    var name = document.getElementById('conditionName').value.trim();
    if (!name) { alert('Condition name is required.'); return; }

    var data = {
        name:               name,
        category:           document.getElementById('conditionCategory').value,
        status:             document.getElementById('conditionStatus').value || 'active',
        diagnosedDate:      document.getElementById('conditionDiagnosedDate').value || null,
        diagnosedBy:        document.getElementById('conditionDiagnosedBy').value.trim(),
        diagnosedAtVisitId: document.getElementById('conditionVisitId').value || null,
        managementNotes:    document.getElementById('conditionManagementNotes').value.trim(),
        notes:              document.getElementById('conditionNotes').value.trim()
    };

    var modal  = document.getElementById('conditionModal');
    var editId = modal.dataset.editId;
    var op;
    if (editId) {
        op = userCol('conditions').doc(editId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        op = userCol('conditions').add(data);
    }
    op.then(function() {
        closeModal('conditionModal');
        loadConditionsPage();
    }).catch(function(err) { alert('Error saving: ' + err.message); });
}

function deleteCondition(id) {
    if (!confirm('Delete this condition record?')) return;
    userCol('conditions').doc(id).delete()
        .then(function() { loadConditionsPage(); })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}

// =================================================================
//  CONCERNS (H3)
// =================================================================

function loadConcernsPage() {
    var openList       = document.getElementById('concernOpenList');
    var resolvedList   = document.getElementById('concernResolvedList');
    var resolvedSection = document.getElementById('concernResolvedSection');
    if (!openList) return;
    openList.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    userCol('concerns').get()
        .then(function(snap) {
            var open = [], resolved = [];
            snap.docs.forEach(function(d) {
                var rec = Object.assign({ id: d.id }, d.data());
                if (rec.status === 'resolved') resolved.push(rec); else open.push(rec);
            });
            // Newest first within each group (by startDate desc)
            open.sort(function(a,b)     { return (b.startDate||'').localeCompare(a.startDate||''); });
            resolved.sort(function(a,b) { return (b.resolvedDate||b.startDate||'').localeCompare(a.resolvedDate||a.startDate||''); });

            if (open.length === 0) {
                openList.innerHTML = '<p class="empty-state">No open concerns. Tap + Add to log one.</p>';
            } else {
                openList.innerHTML = '';
                open.forEach(function(rec) { openList.appendChild(buildConcernCard(rec)); });
            }

            if (resolved.length === 0) {
                resolvedSection.style.display = 'none';
            } else {
                resolvedSection.style.display = '';
                resolvedList.innerHTML = '';
                resolved.forEach(function(rec) { resolvedList.appendChild(buildConcernCard(rec)); });
            }
        })
        .catch(function(err) {
            openList.innerHTML = '<p class="empty-state">Error loading concerns.</p>';
            console.error('loadConcernsPage:', err);
        });
}

function buildConcernCard(concern) {
    var div = document.createElement('div');
    div.className = 'health-card health-card--clickable';
    div.onclick = function() { location.hash = '#health-concern/' + concern.id; };
    var statusBadge = concern.status === 'resolved'
        ? '<span class="health-badge health-badge--resolved">Resolved</span>'
        : '<span class="health-badge health-badge--open">Open</span>';
    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(concern.title || '') + '</div>' +
            '<div class="health-card-meta">' +
                statusBadge +
                (concern.bodyArea ? '<span class="health-badge">' + escapeHtml(concern.bodyArea) + '</span>' : '') +
            '</div>' +
            (concern.startDate ? '<div class="health-card-sub">Since ' + escapeHtml(concern.startDate) + '</div>' : '') +
        '</div>' +
        '<div class="health-card-arrow">\u203a</div>';
    return div;
}

// ── Concern detail page ───────────────────────────────────────────

function loadConcernDetail(id) {
    var titleEl = document.getElementById('concernDetailTitle');
    if (titleEl) titleEl.textContent = 'Loading\u2026';

    userCol('concerns').doc(id).get()
        .then(function(snap) {
            if (!snap.exists) {
                alert('Concern not found.');
                location.hash = '#health-concerns';
                return;
            }
            window.currentHealthConcern = Object.assign({ id: snap.id }, snap.data());
            renderConcernDetail(window.currentHealthConcern);
        })
        .catch(function(err) { console.error('loadConcernDetail:', err); });
}

function renderConcernDetail(concern) {
    document.getElementById('concernDetailTitle').textContent = concern.title || 'Concern';

    var statusEl = document.getElementById('concernDetailStatus');
    statusEl.textContent  = concern.status === 'resolved' ? 'Resolved' : 'Open';
    statusEl.className    = 'health-badge ' + (concern.status === 'resolved' ? 'health-badge--resolved' : 'health-badge--open');

    document.getElementById('concernDetailBodyArea').textContent  = concern.bodyArea  || '';
    document.getElementById('concernDetailStartDate').textContent = concern.startDate ? 'Since ' + concern.startDate : '';
    document.getElementById('concernDetailSummary').textContent   = concern.summary   || '\u2014';

    // Resolved date row
    var resolvedRow = document.getElementById('concernDetailResolvedRow');
    if (concern.status === 'resolved' && concern.resolvedDate) {
        resolvedRow.style.display = '';
        document.getElementById('concernDetailResolvedDate').textContent = 'Resolved: ' + concern.resolvedDate;
    } else {
        resolvedRow.style.display = 'none';
    }

    // Toggle resolve/reopen button label
    var resolveBtn = document.getElementById('concernResolveBtn');
    resolveBtn.textContent = concern.status === 'resolved' ? 'Reopen' : 'Mark Resolved';

    // Load journal updates, linked visits, photos
    loadConcernUpdates(concern.id);
    loadConcernLinkedVisits(concern.id);
    loadPhotos('concern', concern.id, 'concernPhotoContainer', 'concernPhotoEmptyState');
}

function loadConcernUpdates(concernId) {
    var container = document.getElementById('concernUpdatesList');
    if (!container) return;
    container.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    userCol('concernUpdates').where('concernId', '==', concernId).get()
        .then(function(snap) {
            var updates = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            updates.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

            if (updates.length === 0) {
                container.innerHTML = '<p class="empty-state">No journal entries yet.</p>';
                return;
            }
            container.innerHTML = '';
            updates.forEach(function(u) {
                var div = document.createElement('div');
                div.className = 'health-card';
                div.innerHTML =
                    '<div class="health-card-main">' +
                        '<div class="health-card-title">' + escapeHtml(u.date || '') + '</div>' +
                        (u.painScale ? '<div class="health-card-meta"><span class="health-badge">Pain: ' + escapeHtml(String(u.painScale)) + '/10</span></div>' : '') +
                        '<div class="health-card-sub">' + escapeHtml(u.note || '') + '</div>' +
                    '</div>' +
                    '<div class="health-card-actions">' +
                        '<button class="btn btn-danger btn-small" onclick="deleteConcernUpdate(\'' + u.id + '\', \'' + concernId + '\')">Delete</button>' +
                    '</div>';
                container.appendChild(div);
            });
        })
        .catch(function(err) {
            container.innerHTML = '<p class="empty-state">Error loading updates.</p>';
            console.error(err);
        });
}

function loadConcernLinkedVisits(concernId) {
    var container = document.getElementById('concernLinkedVisits');
    if (!container) return;
    container.innerHTML = '';

    userCol('healthVisits').where('concernId', '==', concernId).get()
        .then(function(snap) {
            if (snap.empty) { container.innerHTML = '<p class="empty-state">No visits linked to this concern.</p>'; return; }
            var visits = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            visits.sort(function(a,b) { return (b.date||'').localeCompare(a.date||''); });
            visits.forEach(function(v) {
                var div = document.createElement('div');
                div.className = 'health-linked-item health-linked-item--clickable';
                div.onclick = function() { location.hash = '#health-visit/' + v.id; };
                div.textContent = (v.date || '\u2014') + (v.provider ? ' \u2014 ' + v.provider : '') + (v.outcome ? ' | ' + v.outcome : '');
                container.appendChild(div);
            });
        })
        .catch(function() { container.innerHTML = '<p class="empty-state">\u2014</p>'; });
}

function openConcernModal(id) {
    var modal = document.getElementById('concernModal');
    modal.dataset.editId = id || '';
    document.getElementById('concernModalTitle').textContent = id ? 'Edit Concern' : 'Add Concern';

    ['concernTitle','concernBodyArea','concernStartDate','concernSummary'].forEach(function(f) {
        document.getElementById(f).value = '';
    });
    document.getElementById('concernStatus').value = 'open';

    if (id) {
        userCol('concerns').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('concernTitle').value     = d.title     || '';
            document.getElementById('concernBodyArea').value  = d.bodyArea  || '';
            document.getElementById('concernStartDate').value = d.startDate || '';
            document.getElementById('concernSummary').value   = d.summary   || '';
            document.getElementById('concernStatus').value    = d.status    || 'open';
        });
    }
    openModal('concernModal');
}

function saveConcern() {
    var title = document.getElementById('concernTitle').value.trim();
    if (!title) { alert('Title is required.'); return; }

    var data = {
        title:     title,
        bodyArea:  document.getElementById('concernBodyArea').value.trim(),
        startDate: document.getElementById('concernStartDate').value || null,
        summary:   document.getElementById('concernSummary').value.trim(),
        status:    document.getElementById('concernStatus').value || 'open'
    };
    if (data.status === 'resolved' && !data.resolvedDate) {
        data.resolvedDate = new Date().toISOString().slice(0, 10);
    }

    var modal  = document.getElementById('concernModal');
    var editId = modal.dataset.editId;
    var op;
    if (editId) {
        op = userCol('concerns').doc(editId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        op = userCol('concerns').add(data);
    }
    op.then(function(ref) {
        document.getElementById('concernModal').classList.remove('open');
        var id = editId || (ref && ref.id);
        var dest = id ? '#health-concern/' + id : '#health-concerns';
        history.replaceState(null, '', dest);
        handleRoute();
    }).catch(function(err) { alert('Error saving: ' + err.message); });
}

function toggleConcernResolved() {
    var concern = window.currentHealthConcern;
    if (!concern) return;
    var isOpen = concern.status !== 'resolved';
    var update = isOpen
        ? { status: 'resolved', resolvedDate: new Date().toISOString().slice(0, 10) }
        : { status: 'open',     resolvedDate: null };
    userCol('concerns').doc(concern.id).update(update)
        .then(function() { loadConcernDetail(concern.id); })
        .catch(function(err) { alert('Error: ' + err.message); });
}

function editCurrentConcern() {
    if (window.currentHealthConcern) openConcernModal(window.currentHealthConcern.id);
}

function deleteCurrentConcern() {
    if (!window.currentHealthConcern) return;
    if (!confirm('Delete this concern and all its journal entries? Photos will not be deleted.')) return;
    var id = window.currentHealthConcern.id;
    // Delete all journal entries for this concern first
    userCol('concernUpdates').where('concernId', '==', id).get()
        .then(function(snap) {
            var batch = db.batch();
            snap.docs.forEach(function(d) { batch.delete(d.ref); });
            return batch.commit();
        })
        .then(function() { return userCol('concerns').doc(id).delete(); })
        .then(function() { location.hash = '#health-concerns'; })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}

// ── Concern journal updates ───────────────────────────────────────

function openConcernUpdateModal() {
    var today = new Date().toISOString().slice(0, 10);
    document.getElementById('concernUpdateDate').value      = today;
    document.getElementById('concernUpdateNote').value      = '';
    document.getElementById('concernUpdatePain').value      = '';
    openModal('concernUpdateModal');
}

function saveConcernUpdate() {
    var concern = window.currentHealthConcern;
    if (!concern) return;
    var note = document.getElementById('concernUpdateNote').value.trim();
    if (!note) { alert('Note is required.'); return; }

    var painRaw = document.getElementById('concernUpdatePain').value.trim();
    var pain    = painRaw ? parseInt(painRaw, 10) : null;
    if (pain !== null && (isNaN(pain) || pain < 1 || pain > 10)) {
        alert('Pain scale must be 1\u201310 or left blank.'); return;
    }

    var data = {
        concernId:  concern.id,
        date:       document.getElementById('concernUpdateDate').value || new Date().toISOString().slice(0, 10),
        note:       note,
        painScale:  pain,
        createdAt:  firebase.firestore.FieldValue.serverTimestamp()
    };

    userCol('concernUpdates').add(data)
        .then(function() {
            closeModal('concernUpdateModal');
            loadConcernUpdates(concern.id);
        })
        .catch(function(err) { alert('Error saving: ' + err.message); });
}

function deleteConcernUpdate(updateId, concernId) {
    if (!confirm('Delete this journal entry?')) return;
    userCol('concernUpdates').doc(updateId).delete()
        .then(function() { loadConcernUpdates(concernId); })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}

// =================================================================
//  BLOOD WORK (H4)
// =================================================================

/* ── Cached record list (used by both list page and trend picker) ─ */
var _bwAllRecords = [];

// ── List page ────────────────────────────────────────────────────

function loadBloodWorkPage() {
    var list = document.getElementById('bloodWorkList');
    if (!list) return;
    list.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    userCol('bloodWorkRecords').get()
        .then(function(snap) {
            _bwAllRecords = snap.docs.map(function(d) {
                return Object.assign({ id: d.id }, d.data());
            });
            _bwAllRecords.sort(function(a, b) {
                return (b.date || '').localeCompare(a.date || '');
            });

            if (_bwAllRecords.length === 0) {
                list.innerHTML = '<p class="empty-state">No blood work records yet. Tap + Add to add one.</p>';
                return;
            }
            list.innerHTML = '';
            _bwAllRecords.forEach(function(bw) { list.appendChild(buildBloodWorkCard(bw)); });
        })
        .catch(function(err) {
            list.innerHTML = '<p class="empty-state">Error loading records.</p>';
            console.error('loadBloodWorkPage:', err);
        });
}

function buildBloodWorkCard(bw) {
    var div = document.createElement('div');
    div.className = 'health-card health-card--clickable';
    div.onclick = function() { location.hash = '#health-bloodwork/' + bw.id; };

    var markerCount  = (bw.markers && bw.markers.length) ? bw.markers.length + ' markers' : 'No markers';
    var flaggedCount = (bw.markers || []).filter(function(m) { return m.flagged; }).length;
    var flaggedBadge = flaggedCount > 0
        ? '<span class="health-badge health-badge--severity-severe">' + flaggedCount + ' flagged</span>'
        : '';

    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(bw.date || '\u2014') + '</div>' +
            '<div class="health-card-meta">' +
                (bw.lab ? '<span class="health-badge">' + escapeHtml(bw.lab) + '</span>' : '') +
                flaggedBadge +
            '</div>' +
            '<div class="health-card-sub">' + escapeHtml(markerCount) + (bw.orderedBy ? ' \u2014 ' + escapeHtml(bw.orderedBy) : '') + '</div>' +
        '</div>' +
        '<div class="health-card-arrow">\u203a</div>';
    return div;
}

// ── Detail page ──────────────────────────────────────────────────

function loadBloodWorkDetail(id) {
    var titleEl = document.getElementById('bwDetailTitle');
    if (titleEl) titleEl.textContent = 'Loading\u2026';

    userCol('bloodWorkRecords').doc(id).get()
        .then(function(snap) {
            if (!snap.exists) {
                alert('Record not found.');
                location.hash = '#health-bloodwork';
                return;
            }
            window.currentBloodWork = Object.assign({ id: snap.id }, snap.data());
            renderBloodWorkDetail(window.currentBloodWork);
        })
        .catch(function(err) { console.error('loadBloodWorkDetail:', err); });
}

function renderBloodWorkDetail(bw) {
    document.getElementById('bwDetailTitle').textContent      = bw.date || 'Blood Work';
    document.getElementById('bwDetailDate').textContent       = bw.date      || '\u2014';
    document.getElementById('bwDetailLab').textContent        = bw.lab       || '\u2014';
    document.getElementById('bwDetailOrderedBy').textContent  = bw.orderedBy || '\u2014';
    document.getElementById('bwDetailNotes').textContent      = bw.notes     || '\u2014';

    // Linked visit
    var visitRow = document.getElementById('bwDetailVisitRow');
    var visitEl  = document.getElementById('bwDetailVisit');
    if (bw.orderedAtVisitId) {
        visitRow.style.display = '';
        userCol('healthVisits').doc(bw.orderedAtVisitId).get()
            .then(function(snap) {
                if (snap.exists) {
                    var v = snap.data();
                    var label = escapeHtml((v.date || '') + (v.provider ? ' \u2014 ' + v.provider : ''));
                    visitEl.innerHTML = '<span class="health-linked-item health-linked-item--clickable" ' +
                        'onclick="location.hash=\'#health-visit/' + bw.orderedAtVisitId + '\'">' +
                        label + '</span>';
                } else {
                    visitEl.textContent = '\u2014';
                }
            }).catch(function() { visitEl.textContent = '\u2014'; });
    } else {
        visitRow.style.display = 'none';
    }

    _bwRenderMarkerTable(bw.markers || [], 'bwDetailMarkersContainer');
}

function _bwRenderMarkerTable(markers, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    if (markers.length === 0) {
        container.innerHTML = '<p class="empty-state">No markers recorded.</p>';
        return;
    }

    var html = '<div class="bw-table-wrap"><table class="bw-marker-table">' +
        '<thead><tr>' +
            '<th>Marker</th><th>Value</th><th>Unit</th><th>Reference Range</th><th></th>' +
        '</tr></thead><tbody>';

    markers.forEach(function(m) {
        var rowClass = m.flagged ? ' class="bw-marker-flagged"' : '';
        html += '<tr' + rowClass + '>' +
            '<td>' + escapeHtml(m.name || '') + '</td>' +
            '<td><strong>' + escapeHtml(m.value || '') + '</strong></td>' +
            '<td>' + escapeHtml(m.unit || '') + '</td>' +
            '<td>' + escapeHtml(m.referenceRange || '') + '</td>' +
            '<td>' + (m.flagged ? '<span class="bw-flag-icon">\u26a0\ufe0f</span>' : '') + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ── Add/Edit modal ───────────────────────────────────────────────

function openBloodWorkModal(id) {
    var modal = document.getElementById('bloodWorkModal');
    modal.dataset.editId = id || '';
    document.getElementById('bwModalTitle').textContent = id ? 'Edit Blood Work' : 'Add Blood Work';

    ['bwLab', 'bwOrderedBy', 'bwNotes'].forEach(function(f) {
        document.getElementById(f).value = '';
    });
    document.getElementById('bwDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('bwModalMarkersBody').innerHTML = '';

    if (id) {
        userCol('bloodWorkRecords').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('bwDate').value      = d.date      || '';
            document.getElementById('bwLab').value       = d.lab       || '';
            document.getElementById('bwOrderedBy').value = d.orderedBy || '';
            document.getElementById('bwNotes').value     = d.notes     || '';
            populateVisitDropdown('bwVisitId', d.orderedAtVisitId || '');
            (d.markers || []).forEach(function(m) { _bwAddMarkerRow(m); });
        });
    } else {
        populateVisitDropdown('bwVisitId', '');
    }
    openModal('bloodWorkModal');
}

function saveBloodWork() {
    var date = document.getElementById('bwDate').value;
    if (!date) { alert('Date is required.'); return; }

    var data = {
        date:             date,
        lab:              document.getElementById('bwLab').value.trim(),
        orderedBy:        document.getElementById('bwOrderedBy').value.trim(),
        orderedAtVisitId: document.getElementById('bwVisitId').value || null,
        notes:            document.getElementById('bwNotes').value.trim(),
        markers:          _bwCollectMarkers()
    };

    var modal  = document.getElementById('bloodWorkModal');
    var editId = modal.dataset.editId;
    var op;
    if (editId) {
        op = userCol('bloodWorkRecords').doc(editId).update(data).then(function() { return editId; });
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        op = userCol('bloodWorkRecords').add(data).then(function(ref) { return ref.id; });
    }
    op.then(function(id) {
        // Use replaceState to swap the modal history entry for the detail URL,
        // then call handleRoute() directly.  A plain location.hash assignment
        // would push a new entry; history.back() inside closeModal would then
        // pop that new entry instead of the modal's, sending us back to the list.
        document.getElementById('bloodWorkModal').classList.remove('open');
        history.replaceState(null, '', '#health-bloodwork/' + id);
        handleRoute();
    }).catch(function(err) { alert('Error saving: ' + err.message); });
}

function editCurrentBloodWork() {
    if (window.currentBloodWork) openBloodWorkModal(window.currentBloodWork.id);
}

function deleteCurrentBloodWork() {
    if (!window.currentBloodWork) return;
    if (!confirm('Delete this blood work record?')) return;
    userCol('bloodWorkRecords').doc(window.currentBloodWork.id).delete()
        .then(function() { location.hash = '#health-bloodwork'; })
        .catch(function(err) { alert('Error deleting: ' + err.message); });
}

// ── Marker row management ─────────────────────────────────────────

function _bwAddMarkerRow(marker) {
    marker = marker || {};
    var tbody = document.getElementById('bwModalMarkersBody');
    var tr = document.createElement('tr');
    tr.className = 'bw-marker-row';
    tr.innerHTML =
        '<td><input type="text" class="bw-input bw-input-name"  value="' + escapeHtml(marker.name           || '') + '" placeholder="e.g. LDL"></td>' +
        '<td><input type="text" class="bw-input bw-input-value" value="' + escapeHtml(marker.value          || '') + '" placeholder="112"></td>' +
        '<td><input type="text" class="bw-input bw-input-unit"  value="' + escapeHtml(marker.unit           || '') + '" placeholder="mg/dL"></td>' +
        '<td><input type="text" class="bw-input bw-input-range" value="' + escapeHtml(marker.referenceRange || '') + '" placeholder="&lt;100"></td>' +
        '<td class="bw-flag-cell"><label><input type="checkbox" class="bw-input-flag"' + (marker.flagged ? ' checked' : '') + '> Flag</label></td>' +
        '<td><button type="button" class="btn btn-danger btn-small" onclick="_bwRemoveMarkerRow(this)">&times;</button></td>';
    tbody.appendChild(tr);
}

function _bwRemoveMarkerRow(btn) {
    var tr = btn.closest('tr');
    if (tr) tr.remove();
}

function _bwCollectMarkers() {
    var rows = document.querySelectorAll('#bwModalMarkersBody .bw-marker-row');
    var markers = [];
    rows.forEach(function(tr) {
        var name = tr.querySelector('.bw-input-name').value.trim();
        if (!name) return;
        markers.push({
            name:           name,
            value:          tr.querySelector('.bw-input-value').value.trim(),
            unit:           tr.querySelector('.bw-input-unit').value.trim(),
            referenceRange: tr.querySelector('.bw-input-range').value.trim(),
            flagged:        tr.querySelector('.bw-input-flag').checked
        });
    });
    return markers;
}

// ── LLM import ───────────────────────────────────────────────────

function openImportModal() {
    document.getElementById('bwImportText').value    = '';
    document.getElementById('bwImportStatus').innerHTML = '';
    document.getElementById('bwImportBtn').disabled  = false;
    openModal('bloodWorkImportModal');
}

async function parseLabReport() {
    var text = document.getElementById('bwImportText').value.trim();
    if (!text) { alert('Please paste some lab report text first.'); return; }

    var statusEl = document.getElementById('bwImportStatus');
    var btn      = document.getElementById('bwImportBtn');
    statusEl.textContent = 'Parsing with AI\u2026';
    btn.disabled = true;

    var systemPrompt =
        'You are a medical lab report parser. Extract all lab test markers from the text provided.\n' +
        'Return ONLY valid JSON in this exact format \u2014 no explanations, no markdown, no code fences:\n' +
        '{"markers":[{"name":"LDL","value":"112","unit":"mg/dL","referenceRange":"<100","flagged":true}]}\n' +
        'Rules:\n' +
        '- name: the test name as shown in the report\n' +
        '- value: the numeric result as a string\n' +
        '- unit: unit of measure (e.g., mg/dL, %, g/dL) \u2014 empty string if not shown\n' +
        '- referenceRange: the normal/reference range as shown (e.g., "<100", "3.5-5.0") \u2014 empty string if not shown\n' +
        '- flagged: true if marked High (H), Low (L), *, or otherwise out of range; false otherwise\n' +
        '- Include every marker that has a numeric value\n' +
        '- Do not include markers with no value';

    try {
        var raw = await _bwCallLLM(systemPrompt, text);
        // Strip markdown code fences if the model adds them anyway
        var cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
        var parsed  = JSON.parse(cleaned);
        if (!parsed.markers || !Array.isArray(parsed.markers)) throw new Error('Unexpected response format');
        _bwApplyImportedMarkers(parsed.markers);
        closeModal('bloodWorkImportModal');
    } catch(err) {
        statusEl.textContent = 'Parse failed: ' + err.message + '. Edit markers manually or try again.';
        btn.disabled = false;
    }
}

async function _bwCallLLM(systemPrompt, userText) {
    var doc = await userCol('settings').doc('llm').get();
    if (!doc.exists) throw new Error('LLM not configured. Go to Settings \u2192 QuickLog to add your API key.');

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
            model   : model || ep.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userText      }
            ]
        })
    });

    if (!res.ok) {
        var errBody = await res.text();
        throw new Error('LLM error ' + res.status + ': ' + errBody.slice(0, 200));
    }
    var json = await res.json();
    return json.choices[0].message.content;
}

function _bwApplyImportedMarkers(markers) {
    document.getElementById('bwModalMarkersBody').innerHTML = '';
    markers.forEach(function(m) { _bwAddMarkerRow(m); });
}

// ── Trend view ───────────────────────────────────────────────────

function openTrendModal() {
    var sel      = document.getElementById('bwTrendSelect');
    var tableDiv = document.getElementById('bwTrendTable');
    sel.innerHTML = '<option value="">\u2014 Select a marker \u2014</option>';
    tableDiv.innerHTML = '';

    // Collect all unique marker names from cached list
    var seen = {};
    _bwAllRecords.forEach(function(bw) {
        (bw.markers || []).forEach(function(m) {
            if (m.name) seen[m.name] = true;
        });
    });
    var names = Object.keys(seen).sort();
    if (names.length === 0) {
        tableDiv.innerHTML = '<p class="empty-state">No markers recorded yet.</p>';
    }
    names.forEach(function(name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    });

    openModal('bloodWorkTrendModal');
}

function renderTrendTable(markerName) {
    var tableDiv = document.getElementById('bwTrendTable');
    if (!markerName) { tableDiv.innerHTML = ''; return; }

    var rows = [];
    _bwAllRecords.forEach(function(bw) {
        (bw.markers || []).forEach(function(m) {
            if (m.name === markerName) {
                rows.push({ date: bw.date, value: m.value, unit: m.unit, ref: m.referenceRange, flagged: m.flagged });
            }
        });
    });
    rows.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

    if (rows.length === 0) {
        tableDiv.innerHTML = '<p class="empty-state">No data for this marker.</p>';
        return;
    }

    var html = '<div class="bw-table-wrap"><table class="bw-marker-table">' +
        '<thead><tr><th>Date</th><th>Value</th><th>Unit</th><th>Reference Range</th><th></th></tr></thead><tbody>';

    rows.forEach(function(r) {
        var rowClass = r.flagged ? ' class="bw-marker-flagged"' : '';
        html += '<tr' + rowClass + '>' +
            '<td>' + escapeHtml(r.date || '') + '</td>' +
            '<td><strong>' + escapeHtml(r.value || '') + '</strong></td>' +
            '<td>' + escapeHtml(r.unit || '') + '</td>' +
            '<td>' + escapeHtml(r.ref || '') + '</td>' +
            '<td>' + (r.flagged ? '<span class="bw-flag-icon">\u26a0\ufe0f</span>' : '') + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableDiv.innerHTML = html;
}

// =================================================================
//  VITALS (H5)
// =================================================================

var VITAL_UNITS = {
    'Blood Pressure': 'mmHg',
    'Heart Rate':     'bpm',
    'O2 Sat':         '%',
    'Blood Glucose':  'mg/dL',
    'Temperature':    '\u00b0F',
    'Other':          ''
};

// ── List page ────────────────────────────────────────────────────

function loadVitalsPage(filterType) {
    var sel  = document.getElementById('vitalTypeFilter');
    var list = document.getElementById('vitalsList');
    if (!list) return;
    // Sync filter select to the value passed in (e.g. on first load)
    if (filterType !== undefined && sel) sel.value = filterType || '';
    var activeFilter = sel ? sel.value : (filterType || '');
    list.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    userCol('vitals').get()
        .then(function(snap) {
            var all = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            all.sort(function(a, b) {
                return ((b.date || '') + ' ' + (b.time || '')).localeCompare((a.date || '') + ' ' + (a.time || ''));
            });
            window._vitalsAllRecords = all;

            var filtered = activeFilter ? all.filter(function(v) { return v.type === activeFilter; }) : all;

            if (filtered.length === 0) {
                list.innerHTML = '<p class="empty-state">' +
                    (activeFilter ? 'No ' + escapeHtml(activeFilter) + ' readings recorded.' : 'No vitals recorded yet. Tap + Add to add one.') +
                    '</p>';
                return;
            }
            list.innerHTML = '';
            filtered.forEach(function(v) { list.appendChild(buildVitalCard(v)); });
        })
        .catch(function(err) {
            list.innerHTML = '<p class="empty-state">Error loading vitals.</p>';
            console.error('loadVitalsPage:', err);
        });
}

function buildVitalCard(v) {
    var div = document.createElement('div');
    div.className = 'health-card';
    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(_vitalDisplayValue(v)) + '</div>' +
            '<div class="health-card-meta"><span class="health-badge">' + escapeHtml(v.type || '') + '</span></div>' +
            '<div class="health-card-sub">' + escapeHtml(v.date || '') + (v.time ? ' \u2014 ' + escapeHtml(v.time) : '') + '</div>' +
            (v.notes ? '<div class="health-card-sub">' + escapeHtml(v.notes) + '</div>' : '') +
        '</div>' +
        '<div class="health-card-actions">' +
            '<button class="btn btn-secondary btn-small" onclick="openVitalModal(\'' + v.id + '\')">Edit</button>' +
            '<button class="btn btn-danger btn-small" onclick="deleteVital(\'' + v.id + '\')">Delete</button>' +
        '</div>';
    return div;
}

function _vitalDisplayValue(v) {
    if (v.type === 'Blood Pressure') return (v.value1 || '?') + '/' + (v.value2 || '?') + ' mmHg';
    var val  = v.value1 || '?';
    var unit = v.unit   || '';
    if (unit === '%')       return val + '%';
    if (unit === '\u00b0F') return val + '\u00b0F';
    return val + (unit ? ' ' + unit : '');
}

// ── Add/Edit modal ───────────────────────────────────────────────

function openVitalModal(id) {
    var modal = document.getElementById('vitalModal');
    modal.dataset.editId = id || '';
    document.getElementById('vitalModalTitle').textContent = id ? 'Edit Vital' : 'Add Vital';

    document.getElementById('vitalDate').value   = new Date().toISOString().slice(0, 10);
    document.getElementById('vitalTime').value   = '';
    document.getElementById('vitalType').value   = '';
    document.getElementById('vitalValue1').value = '';
    document.getElementById('vitalValue2').value = '';
    document.getElementById('vitalUnit').value   = '';
    document.getElementById('vitalNotes').value  = '';
    _vitalToggleValue2(false);

    if (id) {
        userCol('vitals').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('vitalDate').value   = d.date    || '';
            document.getElementById('vitalTime').value   = d.time    || '';
            document.getElementById('vitalType').value   = d.type    || '';
            document.getElementById('vitalValue1').value = d.value1  || '';
            document.getElementById('vitalValue2').value = d.value2  || '';
            document.getElementById('vitalUnit').value   = d.unit    || '';
            document.getElementById('vitalNotes').value  = d.notes   || '';
            _vitalToggleValue2(d.type === 'Blood Pressure');
        });
    }
    openModal('vitalModal');
}

function _vitalOnTypeChange() {
    var type = document.getElementById('vitalType').value;
    document.getElementById('vitalUnit').value = VITAL_UNITS[type] !== undefined ? VITAL_UNITS[type] : '';
    _vitalToggleValue2(type === 'Blood Pressure');
}

function _vitalToggleValue2(show) {
    var row = document.getElementById('vitalValue2Row');
    if (row) row.style.display = show ? '' : 'none';
}

function saveVital() {
    var date = document.getElementById('vitalDate').value;
    var type = document.getElementById('vitalType').value;
    if (!date) { alert('Date is required.'); return; }
    if (!type) { alert('Type is required.'); return; }

    var data = {
        date:   date,
        time:   document.getElementById('vitalTime').value.trim()   || null,
        type:   type,
        value1: document.getElementById('vitalValue1').value.trim(),
        value2: type === 'Blood Pressure' ? document.getElementById('vitalValue2').value.trim() : null,
        unit:   document.getElementById('vitalUnit').value          || (VITAL_UNITS[type] || ''),
        notes:  document.getElementById('vitalNotes').value.trim()
    };

    var modal  = document.getElementById('vitalModal');
    var editId = modal.dataset.editId;
    var op;
    if (editId) {
        op = userCol('vitals').doc(editId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        op = userCol('vitals').add(data);
    }
    op.then(function() {
        closeModal('vitalModal');
        loadVitalsPage();
    }).catch(function(err) { alert('Error saving: ' + err.message); });
}

function deleteVital(id) {
    if (!confirm('Delete this vital reading?')) return;
    userCol('vitals').doc(id).delete()
        .then(function() { loadVitalsPage(); })
        .catch(function(err) { alert('Error: ' + err.message); });
}

// ── Trend view ───────────────────────────────────────────────────

function openVitalTrendModal() {
    var sel      = document.getElementById('vitalTrendSelect');
    var tableDiv = document.getElementById('vitalTrendTable');
    sel.innerHTML = '<option value="">\u2014 Select a type \u2014</option>';
    tableDiv.innerHTML = '';

    var all  = window._vitalsAllRecords || [];
    var seen = {};
    all.forEach(function(v) { if (v.type) seen[v.type] = true; });
    ['Blood Pressure','Heart Rate','O2 Sat','Blood Glucose','Temperature','Other'].forEach(function(t) {
        if (!seen[t]) return;
        var opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        sel.appendChild(opt);
    });
    if (Object.keys(seen).length === 0) {
        tableDiv.innerHTML = '<p class="empty-state">No vitals recorded yet.</p>';
    }
    openModal('vitalTrendModal');
}

function renderVitalTrend(type) {
    var tableDiv = document.getElementById('vitalTrendTable');
    if (!type) { tableDiv.innerHTML = ''; return; }

    var all  = window._vitalsAllRecords || [];
    var rows = all.filter(function(v) { return v.type === type; });
    rows.sort(function(a, b) {
        return ((b.date || '') + ' ' + (b.time || '')).localeCompare((a.date || '') + ' ' + (a.time || ''));
    });
    if (rows.length === 0) { tableDiv.innerHTML = '<p class="empty-state">No data for this type.</p>'; return; }

    var isBP = type === 'Blood Pressure';
    var html = '<div class="bw-table-wrap"><table class="bw-marker-table"><thead><tr>' +
        '<th>Date</th><th>Time</th>' +
        (isBP ? '<th>Systolic</th><th>Diastolic</th>' : '<th>Value</th>') +
        '<th>Unit</th><th>Notes</th></tr></thead><tbody>';

    rows.forEach(function(r) {
        html += '<tr>' +
            '<td>' + escapeHtml(r.date  || '') + '</td>' +
            '<td>' + escapeHtml(r.time  || '') + '</td>' +
            (isBP
                ? '<td><strong>' + escapeHtml(r.value1 || '') + '</strong></td><td><strong>' + escapeHtml(r.value2 || '') + '</strong></td>'
                : '<td><strong>' + escapeHtml(r.value1 || '') + '</strong></td>') +
            '<td>' + escapeHtml(r.unit  || '') + '</td>' +
            '<td>' + escapeHtml(r.notes || '') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    tableDiv.innerHTML = html;
}

// =================================================================
//  INSURANCE (H5)
// =================================================================

function loadInsurancePage() {
    var list = document.getElementById('insuranceList');
    if (!list) return;
    list.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    userCol('insurancePolicies').get()
        .then(function(snap) {
            if (snap.empty) {
                list.innerHTML = '<p class="empty-state">No insurance policies recorded. Tap + Add to add one.</p>';
                return;
            }
            var policies = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            policies.sort(function(a, b) {
                var sa = a.status === 'inactive' ? 1 : 0;
                var sb = b.status === 'inactive' ? 1 : 0;
                if (sa !== sb) return sa - sb;
                if ((a.type || '') !== (b.type || '')) return (a.type || '').localeCompare(b.type || '');
                return (a.carrier || '').localeCompare(b.carrier || '');
            });

            list.innerHTML = '';
            var currentType = null;
            policies.forEach(function(p) {
                if (p.type !== currentType) {
                    currentType = p.type;
                    var hdr = document.createElement('div');
                    hdr.className = 'health-year-label';
                    hdr.textContent = currentType || 'Other';
                    list.appendChild(hdr);
                }
                list.appendChild(buildInsuranceCard(p));
            });
        })
        .catch(function(err) {
            list.innerHTML = '<p class="empty-state">Error loading insurance.</p>';
            console.error('loadInsurancePage:', err);
        });
}

function buildInsuranceCard(p) {
    var div = document.createElement('div');
    div.className = 'health-card health-card--clickable' + (p.status === 'inactive' ? ' health-card--dim' : '');
    div.onclick = function() { location.hash = '#health-insurance/' + p.id; };
    div.innerHTML =
        '<div class="health-card-main">' +
            '<div class="health-card-title">' + escapeHtml(p.carrier || '\u2014') + '</div>' +
            '<div class="health-card-meta">' +
                (p.planName ? '<span class="health-badge">' + escapeHtml(p.planName) + '</span>' : '') +
                (p.status === 'inactive' ? '<span class="health-badge health-badge--resolved">Inactive</span>' : '') +
            '</div>' +
            (p.memberId ? '<div class="health-card-sub">Member ID: ' + escapeHtml(p.memberId) + '</div>' : '') +
        '</div>' +
        '<div class="health-card-arrow">\u203a</div>';
    return div;
}

// ── Detail page ──────────────────────────────────────────────────

function loadInsuranceDetailPage(id) {
    var titleEl = document.getElementById('insuranceDetailTitle');
    if (titleEl) titleEl.textContent = 'Loading\u2026';
    userCol('insurancePolicies').doc(id).get()
        .then(function(snap) {
            if (!snap.exists) { alert('Policy not found.'); location.hash = '#health-insurance'; return; }
            window.currentInsurance = Object.assign({ id: snap.id }, snap.data());
            renderInsuranceDetail(window.currentInsurance);
        })
        .catch(function(err) { console.error('loadInsuranceDetailPage:', err); });
}

function renderInsuranceDetail(p) {
    document.getElementById('insuranceDetailTitle').textContent = p.carrier || 'Insurance Policy';

    var pairs = [
        ['insuranceDetailType',    p.type                  || '\u2014'],
        ['insuranceDetailCarrier', p.carrier               || '\u2014'],
        ['insuranceDetailPlan',    p.planName              || '\u2014'],
        ['insuranceDetailMember',  p.memberId              || '\u2014'],
        ['insuranceDetailGroup',   p.groupNumber           || '\u2014'],
        ['insuranceDetailPolicy',  p.policyNumber          || '\u2014'],
        ['insuranceDetailStart',   p.startDate             || '\u2014'],
        ['insuranceDetailEnd',     p.endDate               || 'Ongoing'],
        ['insuranceDetailPremium', p.premiumAmount ? '$' + p.premiumAmount + '/mo' : '\u2014'],
        ['insuranceDetailDeduct',  p.deductible    ? '$' + p.deductible            : '\u2014'],
        ['insuranceDetailOOP',     p.outOfPocketMax ? '$' + p.outOfPocketMax       : '\u2014'],
        ['insuranceDetailBenef',   p.beneficiaries         || '\u2014'],
        ['insuranceDetailPhone',   p.customerServicePhone  || '\u2014'],
        ['insuranceDetailNotes',   p.notes                 || '\u2014']
    ];
    pairs.forEach(function(pair) {
        var el = document.getElementById(pair[0]);
        if (el) el.textContent = pair[1];
    });

    var websiteEl = document.getElementById('insuranceDetailWebsite');
    if (websiteEl) {
        if (p.website) {
            websiteEl.innerHTML = '<a href="' + escapeHtml(p.website) + '" target="_blank" rel="noopener">' + escapeHtml(p.website) + '</a>';
        } else {
            websiteEl.textContent = '\u2014';
        }
    }

    var statusEl = document.getElementById('insuranceDetailStatus');
    if (statusEl) {
        statusEl.textContent = p.status === 'inactive' ? 'Inactive' : 'Active';
        statusEl.className   = 'health-badge ' + (p.status === 'inactive' ? 'health-badge--resolved' : 'health-badge--open');
    }
    var toggleBtn = document.getElementById('insuranceToggleBtn');
    if (toggleBtn) toggleBtn.textContent = p.status === 'inactive' ? 'Reactivate' : 'Deactivate';

    loadPhotos('insurancePolicy', p.id, 'insurancePhotoContainer', 'insurancePhotoEmptyState');
}

function editCurrentInsurance() {
    if (window.currentInsurance) openInsuranceModal(window.currentInsurance.id);
}

function toggleInsuranceStatus() {
    if (!window.currentInsurance) return;
    var label     = window.currentInsurance.status === 'inactive' ? 'reactivate' : 'deactivate';
    if (!confirm('Are you sure you want to ' + label + ' this policy?')) return;
    var newStatus = window.currentInsurance.status === 'inactive' ? 'active' : 'inactive';
    userCol('insurancePolicies').doc(window.currentInsurance.id).update({ status: newStatus })
        .then(function() { loadInsuranceDetailPage(window.currentInsurance.id); })
        .catch(function(err) { alert('Error: ' + err.message); });
}

// ── Add/Edit modal ───────────────────────────────────────────────

function openInsuranceModal(id) {
    var modal = document.getElementById('insuranceModal');
    modal.dataset.editId = id || '';
    document.getElementById('insuranceModalTitle').textContent = id ? 'Edit Policy' : 'Add Policy';

    ['insuranceCarrier','insurancePlanName','insuranceMemberId','insuranceGroupNumber',
     'insurancePolicyNumber','insuranceStartDate','insuranceEndDate','insurancePremium',
     'insuranceDeductible','insuranceOOPMax','insuranceBeneficiaries',
     'insurancePhone','insuranceWebsite','insuranceNotes'].forEach(function(fid) {
        var el = document.getElementById(fid);
        if (el) el.value = '';
    });
    document.getElementById('insuranceType').value   = '';
    document.getElementById('insuranceStatus').value = 'active';

    if (id) {
        userCol('insurancePolicies').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('insuranceType').value            = d.type                 || '';
            document.getElementById('insuranceCarrier').value         = d.carrier              || '';
            document.getElementById('insurancePlanName').value        = d.planName             || '';
            document.getElementById('insuranceMemberId').value        = d.memberId             || '';
            document.getElementById('insuranceGroupNumber').value     = d.groupNumber          || '';
            document.getElementById('insurancePolicyNumber').value    = d.policyNumber         || '';
            document.getElementById('insuranceStartDate').value       = d.startDate            || '';
            document.getElementById('insuranceEndDate').value         = d.endDate              || '';
            document.getElementById('insurancePremium').value         = d.premiumAmount        || '';
            document.getElementById('insuranceDeductible').value      = d.deductible           || '';
            document.getElementById('insuranceOOPMax').value          = d.outOfPocketMax       || '';
            document.getElementById('insuranceBeneficiaries').value   = d.beneficiaries        || '';
            document.getElementById('insurancePhone').value           = d.customerServicePhone || '';
            document.getElementById('insuranceWebsite').value         = d.website              || '';
            document.getElementById('insuranceNotes').value           = d.notes                || '';
            document.getElementById('insuranceStatus').value          = d.status               || 'active';
        });
    }
    openModal('insuranceModal');
}

function saveInsurance() {
    var carrier = document.getElementById('insuranceCarrier').value.trim();
    if (!carrier) { alert('Carrier name is required.'); return; }

    var data = {
        type:                 document.getElementById('insuranceType').value,
        carrier:              carrier,
        planName:             document.getElementById('insurancePlanName').value.trim(),
        memberId:             document.getElementById('insuranceMemberId').value.trim(),
        groupNumber:          document.getElementById('insuranceGroupNumber').value.trim(),
        policyNumber:         document.getElementById('insurancePolicyNumber').value.trim(),
        startDate:            document.getElementById('insuranceStartDate').value  || null,
        endDate:              document.getElementById('insuranceEndDate').value    || null,
        premiumAmount:        document.getElementById('insurancePremium').value.trim(),
        deductible:           document.getElementById('insuranceDeductible').value.trim(),
        outOfPocketMax:       document.getElementById('insuranceOOPMax').value.trim(),
        beneficiaries:        document.getElementById('insuranceBeneficiaries').value.trim(),
        customerServicePhone: document.getElementById('insurancePhone').value.trim(),
        website:              document.getElementById('insuranceWebsite').value.trim(),
        notes:                document.getElementById('insuranceNotes').value.trim(),
        status:               document.getElementById('insuranceStatus').value || 'active'
    };

    var editId = document.getElementById('insuranceModal').dataset.editId;
    var op;
    if (editId) {
        op = userCol('insurancePolicies').doc(editId).update(data).then(function() { return editId; });
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        op = userCol('insurancePolicies').add(data).then(function(ref) { return ref.id; });
    }
    op.then(function(id) {
        document.getElementById('insuranceModal').classList.remove('open');
        history.replaceState(null, '', '#health-insurance/' + id);
        handleRoute();
    }).catch(function(err) { alert('Error saving: ' + err.message); });
}

// =================================================================
//  EMERGENCY INFO (H5)
// =================================================================

function loadEmergencyPage() {
    var container = document.getElementById('emergencyInfoContainer');
    if (!container) return;
    container.innerHTML = '<p class="empty-state">Loading\u2026</p>';

    userCol('emergencyInfo').doc('main').get()
        .then(function(snap) {
            renderEmergencyInfo(snap.exists ? snap.data() : {});
        })
        .catch(function(err) {
            container.innerHTML = '<p class="empty-state">Error loading emergency info.</p>';
            console.error('loadEmergencyPage:', err);
        });
}

function renderEmergencyInfo(info) {
    Promise.all([
        userCol('conditions').get(),
        (info.criticalMedicationIds || []).length
            ? Promise.all((info.criticalMedicationIds).map(function(id) { return userCol('medications').doc(id).get(); }))
            : Promise.resolve([])
    ]).then(function(results) {
        var activeConds = results[0].docs
            .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
            .filter(function(c) { return c.status !== 'resolved'; })
            .sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
        var critMeds = results[1]
            .filter(function(s) { return s.exists; })
            .map(function(s) { return Object.assign({ id: s.id }, s.data()); });
        _renderEmergencyCard(info, activeConds, critMeds);
    }).catch(function() { _renderEmergencyCard(info, [], []); });
}

function _renderEmergencyCard(info, conditions, medications) {
    var container = document.getElementById('emergencyInfoContainer');
    if (!container) return;

    var condsHtml = conditions.length
        ? conditions.map(function(c) {
            return '<div class="health-linked-item">' + escapeHtml(c.name || '') +
                (c.managementNotes ? ' \u2014 ' + escapeHtml(c.managementNotes) : '') + '</div>';
          }).join('')
        : '<p class="empty-state">No active or managed conditions.</p>';

    var medsHtml = medications.length
        ? medications.map(function(m) {
            return '<div class="health-linked-item">' + escapeHtml(m.name || '') +
                (m.dosage ? ' \u2014 ' + escapeHtml(m.dosage) : '') + '</div>';
          }).join('')
        : '<p class="empty-state">None selected.</p>';

    var contactsHtml = (info.emergencyContacts || []).length
        ? (info.emergencyContacts || []).map(function(c) {
            return '<div class="health-linked-item">' +
                escapeHtml(c.name || '') +
                (c.relationship ? ' \u2014 ' + escapeHtml(c.relationship) : '') +
                (c.phone ? ' \u2014 ' + escapeHtml(c.phone) : '') + '</div>';
          }).join('')
        : '<p class="empty-state">None entered.</p>';

    container.innerHTML =
        '<div class="emergency-grid">' +
            '<div class="emergency-field"><span class="health-detail-label">Blood Type</span>' +
                '<span class="health-detail-value">' + escapeHtml(info.bloodType || '\u2014') + '</span></div>' +
            '<div class="emergency-field"><span class="health-detail-label">Organ Donor</span>' +
                '<span class="health-detail-value">' + escapeHtml(info.organDonor || '\u2014') + '</span></div>' +
        '</div>' +
        '<div class="section-heading">Primary Care Doctor</div>' +
        '<div class="health-detail-card">' + escapeHtml(info.primaryCareDoctor || '\u2014') + '</div>' +
        '<div class="section-heading">Emergency Contacts</div>' + contactsHtml +
        '<div class="section-heading">Known Conditions <span class="health-badge">auto-pulled</span></div>' + condsHtml +
        '<div class="section-heading">Critical Medications</div>' + medsHtml +
        '<div class="section-heading">Critical Allergies</div>' +
        '<div class="health-detail-card">' + escapeHtml(info.criticalAllergies || '\u2014') + '</div>' +
        '<div class="section-heading">Additional Notes</div>' +
        '<div class="health-detail-card">' + escapeHtml(info.notes || '\u2014') + '</div>';
}

// ── Edit modal ───────────────────────────────────────────────────

async function openEmergencyModal() {
    ['emergencyBloodType','emergencyDoctor','emergencyAllergies','emergencyNotes'].forEach(function(fid) {
        document.getElementById(fid).value = '';
    });
    document.getElementById('emergencyOrganDonor').value  = '';
    document.getElementById('emergencyContactsList').innerHTML = '';
    document.getElementById('emergencyMedChecklist').innerHTML = '<p class="empty-state">Loading\u2026</p>';

    var snap = await userCol('emergencyInfo').doc('main').get().catch(function() { return { exists: false }; });
    var info = snap.exists ? snap.data() : {};

    document.getElementById('emergencyBloodType').value  = info.bloodType         || '';
    document.getElementById('emergencyOrganDonor').value = info.organDonor        || '';
    document.getElementById('emergencyDoctor').value     = info.primaryCareDoctor || '';
    document.getElementById('emergencyAllergies').value  = info.criticalAllergies || '';
    document.getElementById('emergencyNotes').value      = info.notes             || '';
    (info.emergencyContacts || []).forEach(function(c) { _emergencyAddContactRow(c); });

    var savedIds = info.criticalMedicationIds || [];
    userCol('medications').get()
        .then(function(medSnap) {
            var active = medSnap.docs
                .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
                .filter(function(m) { return m.status !== 'completed'; })
                .sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });

            var cl = document.getElementById('emergencyMedChecklist');
            if (active.length === 0) {
                cl.innerHTML = '<p class="empty-state">No active medications.</p>';
                return;
            }
            cl.innerHTML = '';
            active.forEach(function(m) {
                var label = document.createElement('label');
                label.className = 'emergency-med-item';
                var cb = document.createElement('input');
                cb.type    = 'checkbox';
                cb.value   = m.id;
                cb.checked = savedIds.indexOf(m.id) !== -1;
                label.appendChild(cb);
                label.appendChild(document.createTextNode(
                    ' ' + (m.name || '') + (m.dosage ? ' \u2014 ' + m.dosage : '')
                ));
                cl.appendChild(label);
            });
        })
        .catch(function() {
            document.getElementById('emergencyMedChecklist').innerHTML =
                '<p class="empty-state">Could not load medications.</p>';
        });

    openModal('emergencyModal');
}

function _emergencyAddContactRow(contact) {
    contact = contact || {};
    var list = document.getElementById('emergencyContactsList');
    var div  = document.createElement('div');
    div.className = 'emergency-contact-row';
    div.innerHTML =
        '<input type="text" class="em-input em-name"  placeholder="Name"         value="' + escapeHtml(contact.name         || '') + '">' +
        '<input type="text" class="em-input em-rel"   placeholder="Relationship" value="' + escapeHtml(contact.relationship || '') + '">' +
        '<input type="text" class="em-input em-phone" placeholder="Phone"        value="' + escapeHtml(contact.phone        || '') + '">' +
        '<button type="button" class="btn btn-danger btn-small" onclick="_emergencyRemoveContactRow(this)">&times;</button>';
    list.appendChild(div);
}

function _emergencyRemoveContactRow(btn) {
    var row = btn.closest('.emergency-contact-row');
    if (row) row.remove();
}

function saveEmergencyInfo() {
    var critMedIds = [];
    document.querySelectorAll('#emergencyMedChecklist input[type="checkbox"]:checked')
        .forEach(function(cb) { critMedIds.push(cb.value); });

    var contacts = [];
    document.querySelectorAll('#emergencyContactsList .emergency-contact-row').forEach(function(row) {
        var name = row.querySelector('.em-name').value.trim();
        if (!name) return;
        contacts.push({
            name:         name,
            relationship: row.querySelector('.em-rel').value.trim(),
            phone:        row.querySelector('.em-phone').value.trim()
        });
    });

    var data = {
        bloodType:             document.getElementById('emergencyBloodType').value.trim(),
        organDonor:            document.getElementById('emergencyOrganDonor').value,
        primaryCareDoctor:     document.getElementById('emergencyDoctor').value.trim(),
        criticalAllergies:     document.getElementById('emergencyAllergies').value.trim(),
        notes:                 document.getElementById('emergencyNotes').value.trim(),
        emergencyContacts:     contacts,
        criticalMedicationIds: critMedIds,
        updatedAt:             firebase.firestore.FieldValue.serverTimestamp()
    };

    userCol('emergencyInfo').doc('main').set(data, { merge: true })
        .then(function() {
            closeModal('emergencyModal');
            loadEmergencyPage();
        })
        .catch(function(err) { alert('Error saving: ' + err.message); });
}


// ════════════════════════════════════════════════════════════════
// H6 — APPOINTMENTS
// Firestore collection: healthAppointments
// Fields: date, time, provider, type, notes, status, linkedVisitId
// ════════════════════════════════════════════════════════════════

/** Maps appointment type dropdown value to providerType for the Visit form. */
var APPT_TYPE_TO_PROVIDER_TYPE = {
    'Physical':        'Primary Care',
    'Follow-up':       'Primary Care',
    'Dental Cleaning': 'Dentist',
    'Specialist':      'Specialist',
    'Lab Work':        'Primary Care',
    'Eye Exam':        'Optometrist',
    'Other':           'Other'
};

/** Cache of appointments for the list page (used by convert modal). */
var _apptAllRecords = [];

// ── List page ────────────────────────────────────────────────────

function loadAppointmentsPage() {
    var container = document.getElementById('appointmentsList');
    container.innerHTML = '<p class="empty-state">Loading...</p>';

    userCol('healthAppointments').orderBy('date', 'asc').get().then(function(snap) {
        _apptAllRecords = snap.docs.map(function(d) {
            return Object.assign({ id: d.id }, d.data());
        });

        if (_apptAllRecords.length === 0) {
            container.innerHTML = '<p class="empty-state">No appointments yet. Tap + Add to schedule one.</p>';
            return;
        }

        var today    = new Date().toISOString().slice(0, 10);
        var upcoming = _apptAllRecords.filter(function(a) { return a.status !== 'completed' && a.status !== 'cancelled' && a.date >= today; });
        var overdue  = _apptAllRecords.filter(function(a) { return a.status !== 'completed' && a.status !== 'cancelled' && a.date < today; });
        var past     = _apptAllRecords.filter(function(a) { return a.status === 'completed' || a.status === 'cancelled'; });

        var html = '';

        if (overdue.length > 0) {
            html += '<div class="section-heading" style="color:#dc2626;">\u26a0\ufe0f Overdue</div>';
            overdue.forEach(function(a) { html += buildAppointmentCard(a, true); });
        }
        if (upcoming.length > 0) {
            html += '<div class="section-heading">Upcoming</div>';
            upcoming.forEach(function(a) { html += buildAppointmentCard(a, false); });
        }
        if (upcoming.length === 0 && overdue.length === 0) {
            html = '<p class="empty-state">No upcoming appointments.</p>' + html;
        }
        if (past.length > 0) {
            html += '<div class="section-heading">Past Appointments</div>';
            past.slice(0, 30).forEach(function(a) { html += buildAppointmentCard(a, false); });
        }

        container.innerHTML = html;
    }).catch(function(err) {
        container.innerHTML = '<p class="empty-state">Error loading: ' + escapeHtml(err.message) + '</p>';
    });
}

function buildAppointmentCard(a, isOverdue) {
    var statusClass = a.status === 'completed' ? 'appt-badge--completed'
                    : a.status === 'cancelled' ? 'appt-badge--cancelled'
                    : isOverdue                ? 'appt-badge--overdue'
                    :                            'appt-badge--scheduled';
    var statusLabel = a.status === 'completed' ? 'Completed'
                    : a.status === 'cancelled' ? 'Cancelled'
                    : isOverdue                ? 'Overdue'
                    :                            'Scheduled';

    var dateStr = a.date ? _apptFormatDate(a.date) : '—';
    if (a.time) dateStr += ' at ' + _apptFormatTime(a.time);

    var actionsHtml = '';
    actionsHtml += '<button class="btn btn-secondary btn-small" onclick="openApptModal(\'' + a.id + '\')">Edit</button>';
    if (a.status !== 'completed' && a.status !== 'cancelled') {
        actionsHtml += '<button class="btn btn-primary btn-small" onclick="openConvertToVisitModal(\'' + a.id + '\')">\u2713 Mark Done</button>';
        actionsHtml += '<button class="btn btn-secondary btn-small" onclick="cancelAppointment(\'' + a.id + '\')">Cancel</button>';
    }
    if (a.status === 'completed' && a.linkedVisitId) {
        actionsHtml += '<a href="#health-visit/' + a.linkedVisitId + '" class="btn btn-secondary btn-small">View Visit</a>';
    }
    actionsHtml += '<button class="btn btn-danger btn-small" onclick="deleteAppointment(\'' + a.id + '\')">Delete</button>';

    return '<div class="health-card">' +
        '<div class="health-card-header">' +
            '<div>' +
                '<div class="health-card-title">' + escapeHtml(a.provider || 'No provider') + '</div>' +
                '<div class="health-card-meta">' + escapeHtml(a.type || 'Appointment') + ' &bull; ' + dateStr + '</div>' +
            '</div>' +
            '<span class="appt-badge ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        (a.notes ? '<div class="health-card-notes">' + escapeHtml(a.notes) + '</div>' : '') +
        '<div class="health-card-actions">' + actionsHtml + '</div>' +
    '</div>';
}

function _apptFormatDate(iso) {
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    var d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function _apptFormatTime(t) {
    if (!t) return '';
    var p = t.split(':');
    var h = parseInt(p[0]), m = p[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    return h12 + ':' + m + ' ' + ampm;
}

// ── Add / Edit modal ─────────────────────────────────────────────

function openApptModal(id) {
    var modal = document.getElementById('apptModal');
    modal.dataset.editId = id || '';
    document.getElementById('apptModalTitle').textContent = id ? 'Edit Appointment' : 'Add Appointment';

    ['apptDate','apptTime','apptProvider','apptNotes'].forEach(function(f) {
        document.getElementById(f).value = '';
    });
    document.getElementById('apptType').value   = '';
    document.getElementById('apptStatus').value = 'scheduled';

    if (id) {
        userCol('healthAppointments').doc(id).get().then(function(snap) {
            if (!snap.exists) return;
            var d = snap.data();
            document.getElementById('apptDate').value     = d.date     || '';
            document.getElementById('apptTime').value     = d.time     || '';
            document.getElementById('apptProvider').value = d.provider || '';
            document.getElementById('apptType').value     = d.type     || '';
            document.getElementById('apptStatus').value   = d.status   || 'scheduled';
            document.getElementById('apptNotes').value    = d.notes    || '';
        });
    }
    openModal('apptModal');
}

function saveAppointment() {
    var date = document.getElementById('apptDate').value;
    if (!date) { alert('Date is required.'); return; }

    var data = {
        date:     date,
        time:     document.getElementById('apptTime').value.trim(),
        provider: document.getElementById('apptProvider').value.trim(),
        type:     document.getElementById('apptType').value,
        status:   document.getElementById('apptStatus').value || 'scheduled',
        notes:    document.getElementById('apptNotes').value.trim()
    };

    var modal  = document.getElementById('apptModal');
    var editId = modal.dataset.editId;
    var p;
    if (editId) {
        p = userCol('healthAppointments').doc(editId).update(data);
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        p = userCol('healthAppointments').add(data);
    }

    p.then(function() {
        document.getElementById('apptModal').classList.remove('open');
        history.replaceState(null, '', '#health-appointments');
        handleRoute();
    }).catch(function(err) { alert('Error saving: ' + err.message); });
}

function deleteAppointment(id) {
    if (!confirm('Delete this appointment?')) return;
    userCol('healthAppointments').doc(id).delete().then(function() {
        loadAppointmentsPage();
    }).catch(function(err) { alert('Error: ' + err.message); });
}

function cancelAppointment(id) {
    if (!confirm('Mark this appointment as cancelled?')) return;
    userCol('healthAppointments').doc(id).update({ status: 'cancelled' }).then(function() {
        loadAppointmentsPage();
    }).catch(function(err) { alert('Error: ' + err.message); });
}

// ── Appointment to Visit conversion ──────────────────────────────

/**
 * Opens a conversion form pre-filled from the appointment.
 * User reviews/edits the visit details, then saves — creating the visit
 * and marking the appointment completed with linkedVisitId set.
 */
function openConvertToVisitModal(apptId) {
    var appt = _apptAllRecords.find(function(a) { return a.id === apptId; });
    if (!appt) return;

    var modal = document.getElementById('apptConvertModal');
    modal.dataset.apptId = apptId;

    document.getElementById('acvDate').value         = appt.date || '';
    document.getElementById('acvTime').value         = appt.time || '';
    document.getElementById('acvProvider').value     = appt.provider || '';
    document.getElementById('acvProviderType').value = APPT_TYPE_TO_PROVIDER_TYPE[appt.type] || '';
    // Pre-visit prep notes intentionally do NOT carry over to the visit record
    document.getElementById('acvReason').value    = '';
    document.getElementById('acvWhatDone').value  = '';
    document.getElementById('acvOutcome').value   = '';
    document.getElementById('acvCost').value      = '';
    document.getElementById('acvNotes').value     = '';

    // Populate concern dropdown
    var select = document.getElementById('acvConcernId');
    select.innerHTML = '<option value="">\u2014 No concern linked \u2014</option>';
    userCol('concerns').orderBy('title').get().then(function(snap) {
        snap.docs.forEach(function(d) {
            var opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.data().title || d.id;
            select.appendChild(opt);
        });
    }).catch(function() {});

    openModal('apptConvertModal');
}

function saveConvertedVisit() {
    var date = document.getElementById('acvDate').value;
    if (!date) { alert('Date is required.'); return; }

    var visitData = {
        date:         date,
        provider:     document.getElementById('acvProvider').value.trim(),
        providerType: document.getElementById('acvProviderType').value,
        concernId:    document.getElementById('acvConcernId').value || null,
        reason:       document.getElementById('acvReason').value.trim(),
        whatWasDone:  document.getElementById('acvWhatDone').value.trim(),
        outcome:      document.getElementById('acvOutcome').value.trim(),
        cost:         document.getElementById('acvCost').value.trim(),
        notes:        document.getElementById('acvNotes').value.trim(),
        createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    };

    var apptId = document.getElementById('apptConvertModal').dataset.apptId;

    userCol('healthVisits').add(visitData).then(function(ref) {
        // Mark appointment completed and link back to the new visit
        return userCol('healthAppointments').doc(apptId).update({
            status:        'completed',
            linkedVisitId: ref.id
        }).then(function() { return ref.id; });
    }).then(function(visitId) {
        document.getElementById('apptConvertModal').classList.remove('open');
        history.replaceState(null, '', '#health-visit/' + visitId);
        handleRoute();
    }).catch(function(err) { alert('Error saving visit: ' + err.message); });
}
