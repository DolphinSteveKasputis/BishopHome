// ============================================================
// Photos.js — Photo upload, compression, and gallery logic
// Photos are stored as Base64 strings in Firestore documents.
// Client-side compression targets ~100-200KB per photo.
// Gallery shows the newest photo first with navigation to browse history.
// Stored in Firestore collection: "photos"
// ============================================================

// ---------- Module State ----------

/**
 * Cache of loaded photos per targetType. Entries are created on demand.
 */
var photoViewerState = {};

// ---------- Crop Preview State ----------
// These vars track the Promise callbacks and Cropper.js instance
// for the crop-preview modal shown before any photo is saved.

var _cropResolve      = null;  // resolve() of the pending showCropPreview Promise
var _cropReject       = null;  // reject()  of the pending showCropPreview Promise
var _cropperInstance  = null;  // Active Cropper.js instance (or null)
var _cropOriginalFile = null;  // The raw File/Blob passed into showCropPreview

/**
 * Entity types that support a profile thumbnail (set from the photo viewer).
 * The "Use as Profile" button only appears in the viewer for these types.
 */
var PROFILE_PHOTO_TYPES = ['plant', 'weed', 'person', 'vehicle', 'thing'];

/**
 * Maps targetType → Firestore collection name for writing profilePhotoData.
 */
var PROFILE_COLLECTION_MAP = {
    plant:   'plants',
    weed:    'weeds',
    person:  'people',
    vehicle: 'vehicles',
    thing:   'things',
};

/**
 * Maps every targetType to its photo container and empty-state element IDs.
 * Used by handlePhotoFile, reloadPhotosForCurrentTarget, and handleDeletePhoto.
 */
var PHOTO_CONTAINERS = {
    plant:              ['plantPhotoContainer',          'plantPhotoEmptyState'],
    zone:               ['zonePhotoContainer',           'zonePhotoEmptyState'],
    weed:               ['weedPhotoContainer',           'weedPhotoEmptyState'],
    vehicle:            ['vehiclePhotoContainer',        'vehiclePhotoEmptyState'],
    panel:              ['panelPhotoContainer',          'panelPhotoEmptyState'],
    floor:              ['floorPhotoContainer',          'floorPhotoEmptyState'],
    room:               ['roomPhotoContainer',           'roomPhotoEmptyState'],
    thing:              ['thingPhotoContainer',          'thingPhotoEmptyState'],
    subthing:           ['stPhotoContainer',             'stPhotoEmptyState'],
    garageroom:         ['garageRoomPhotosSection',      'garageRoomPhotosEmpty'],
    garagething:        ['garageThingPhotosSection',     'garageThingPhotosEmpty'],
    garagesubthing:     ['garageSubThingPhotosSection',  'garageSubThingPhotosEmpty'],
    structure:          ['structurePhotosSection',       'structurePhotosEmpty'],
    structurething:     ['structureThingPhotosSection',  'structureThingPhotosEmpty'],
    structuresubthing:  ['structureSubThingPhotosSection','structureSubThingPhotosEmpty'],
    collectionitem:     ['collectionItemPhotoContainer',  'collectionItemPhotoEmpty'],
    person:             ['personPhotoContainer',          'personPhotoEmptyState'],
    healthVisit:        ['visitPhotoContainer',           'visitPhotoEmptyState'],
    concern:            ['concernPhotoContainer',          'concernPhotoEmptyState'],
    insurancePolicy:    ['insurancePhotoContainer',        'insurancePhotoEmptyState'],
    note:               ['notePhotoContainer',              'notePhotoEmptyState'],
    item:               ['siPhotoContainer',               'siPhotoEmptyState'],
};

// ---------- Load & Display Photos ----------

/**
 * Loads all photos for a given target and displays the newest one.
 * Older photos are accessible via Previous/Next navigation.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The Firestore document ID of the plant or zone.
 * @param {string} containerId - The ID of the container element for the photo viewer.
 * @param {string} emptyStateId - The ID of the empty-state message element.
 */
async function loadPhotos(targetType, targetId, containerId, emptyStateId) {
    var container = document.getElementById(containerId);
    var emptyState = document.getElementById(emptyStateId);

    try {
        var snapshot = await userCol('photos')
            .where('targetType', '==', targetType)
            .where('targetId', '==', targetId)
            .get();

        container.innerHTML = '';

        if (snapshot.empty) {
            emptyState.textContent = 'No photos yet.';
            emptyState.style.display = 'block';
            photoViewerState[targetType] = { photos: [], currentIndex: 0 };
            container.innerHTML = '';
            return;
        }

        emptyState.style.display = 'none';

        // Collect and sort by takenAt, newest first
        var photos = [];
        snapshot.forEach(function(doc) {
            photos.push({ id: doc.id, ...doc.data() });
        });
        photos.sort(function(a, b) {
            return (b.takenAt || '').localeCompare(a.takenAt || '');
        });

        // Store in state — start at index 0 (newest photo)
        photoViewerState[targetType] = photoViewerState[targetType] || { photos: [], currentIndex: 0 };
        photoViewerState[targetType].photos = photos;
        photoViewerState[targetType].currentIndex = 0;

        // Build the photo viewer
        renderPhotoViewer(targetType, containerId);

    } catch (error) {
        console.error('Error loading photos:', error);
        emptyState.textContent = 'Error loading photos.';
        emptyState.style.display = 'block';
    }
}

// ---------- Render the Photo Viewer ----------

/**
 * Renders the photo viewer UI showing the current photo with navigation.
 * Shows: image, date/time stamp, counter (e.g., "2 of 5"), caption, and action buttons.
 * Navigation: "Newer" goes toward index 0, "Older" goes toward the end.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} containerId - The ID of the container element.
 */
function renderPhotoViewer(targetType, containerId) {
    var container = document.getElementById(containerId);
    var state = photoViewerState[targetType];
    var photos = state.photos;
    var index = state.currentIndex;

    if (photos.length === 0) {
        container.innerHTML = '';
        return;
    }

    var photo = photos[index];
    container.innerHTML = '';

    // Photo viewer wrapper
    var viewer = document.createElement('div');
    viewer.className = 'photo-viewer';

    // Image
    var img = document.createElement('img');
    img.className = 'photo-viewer-image';
    img.src = photo.imageData;
    img.alt = photo.caption || 'Photo';
    viewer.appendChild(img);

    // Standalone date stamp below the image (more visible than inside the nav bar)
    var rawDate = photo.takenAt || (photo.createdAt && photo.createdAt.toDate ? photo.createdAt.toDate().toISOString() : null);
    if (rawDate) {
        var stampEl = document.createElement('div');
        stampEl.className = 'photo-taken-date';
        stampEl.textContent = formatDateTime(rawDate);
        viewer.appendChild(stampEl);
    }

    // Navigation bar: [< Newer]  [counter]  [Older >]
    var navBar = document.createElement('div');
    navBar.className = 'photo-nav-bar';

    // "Newer" button (toward index 0)
    var newerBtn = document.createElement('button');
    newerBtn.className = 'btn btn-small btn-secondary photo-nav-btn';
    newerBtn.textContent = '\u2039 Newer';
    newerBtn.disabled = (index === 0);
    newerBtn.addEventListener('click', function() {
        navigatePhoto(targetType, containerId, -1);
    });
    navBar.appendChild(newerBtn);

    // Center info: counter only (date is now shown as a standalone stamp above)
    var centerInfo = document.createElement('div');
    centerInfo.className = 'photo-nav-info';

    var counter = document.createElement('div');
    counter.className = 'photo-counter';
    counter.textContent = (index + 1) + ' of ' + photos.length;
    centerInfo.appendChild(counter);

    navBar.appendChild(centerInfo);

    // "Older" button (toward higher indexes)
    var olderBtn = document.createElement('button');
    olderBtn.className = 'btn btn-small btn-secondary photo-nav-btn';
    olderBtn.textContent = 'Older \u203A';
    olderBtn.disabled = (index === photos.length - 1);
    olderBtn.addEventListener('click', function() {
        navigatePhoto(targetType, containerId, 1);
    });
    navBar.appendChild(olderBtn);

    viewer.appendChild(navBar);

    // Caption (if any)
    if (photo.caption) {
        var caption = document.createElement('div');
        caption.className = 'photo-caption';
        caption.textContent = photo.caption;
        viewer.appendChild(caption);
    }

    // Action buttons: Use as Profile (if supported), Crop, Edit Caption, Delete
    var actions = document.createElement('div');
    actions.className = 'photo-actions';

    // "Use as Profile" — only for entity types that have profile thumbnails
    if (PROFILE_PHOTO_TYPES.indexOf(targetType) !== -1) {
        var profileBtn = document.createElement('button');
        profileBtn.className = 'btn btn-small btn-secondary';
        profileBtn.textContent = '⭐ Use as Profile';
        profileBtn.addEventListener('click', async function() {
            var btn = this;
            btn.disabled = true;
            btn.textContent = 'Saving...';
            var thumbData = await setProfilePhoto(photo, targetType);
            if (thumbData) {
                btn.textContent = '✓ Set!';
                // Live-update person detail avatar without a page reload
                if (targetType === 'person' && window.currentPerson &&
                        window.currentPerson.id === photo.targetId) {
                    window.currentPerson.profilePhotoData = thumbData;
                    var avatarEl = document.getElementById('personDetailAvatar');
                    if (avatarEl && typeof _buildAvatarHtml === 'function') {
                        avatarEl.innerHTML = _buildAvatarHtml(window.currentPerson, 'person-detail-avatar');
                    }
                }
                setTimeout(function() {
                    btn.textContent = '⭐ Use as Profile';
                    btn.disabled = false;
                }, 2000);
            } else {
                btn.textContent = '⭐ Use as Profile';
                btn.disabled = false;
            }
        });
        actions.appendChild(profileBtn);
    }

    var cropBtn = document.createElement('button');
    cropBtn.className = 'btn btn-small btn-secondary';
    cropBtn.textContent = '✂ Crop';
    cropBtn.addEventListener('click', function() {
        cropExistingPhoto(photo, targetType, containerId);
    });
    actions.appendChild(cropBtn);

    var editCaptionBtn = document.createElement('button');
    editCaptionBtn.className = 'btn btn-small btn-secondary';
    editCaptionBtn.textContent = photo.caption ? 'Edit Caption' : 'Add Caption';
    editCaptionBtn.addEventListener('click', function() {
        editPhotoCaption(photo.id, targetType, containerId);
    });
    actions.appendChild(editCaptionBtn);

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-small btn-danger';
    deleteBtn.textContent = 'Delete Photo';
    deleteBtn.addEventListener('click', function() {
        handleDeletePhoto(photo.id, targetType);
    });
    actions.appendChild(deleteBtn);

    viewer.appendChild(actions);
    container.appendChild(viewer);
}

// ---------- Navigate Between Photos ----------

/**
 * Moves the photo viewer to the next or previous photo.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} containerId - The container element ID.
 * @param {number} direction - -1 for newer, +1 for older.
 */
function navigatePhoto(targetType, containerId, direction) {
    var state = photoViewerState[targetType];
    var newIndex = state.currentIndex + direction;

    if (newIndex >= 0 && newIndex < state.photos.length) {
        state.currentIndex = newIndex;
        renderPhotoViewer(targetType, containerId);
    }
}

// ---------- Upload Photo ----------

/**
 * Opens the rear camera directly for photo capture.
 * @param {string} targetType
 * @param {string} targetId
 */
function triggerCameraUpload(targetType, targetId) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Forces camera on mobile
    input.addEventListener('change', function() {
        if (input.files && input.files[0]) handlePhotoFile(input.files[0], targetType, targetId);
    });
    input.click();
}

/**
 * Opens the device gallery/file picker (no camera forced).
 * @param {string} targetType
 * @param {string} targetId
 */
function triggerGalleryUpload(targetType, targetId) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // No capture attribute — lets user pick from gallery or files
    input.addEventListener('change', function() {
        if (input.files && input.files[0]) handlePhotoFile(input.files[0], targetType, targetId);
    });
    input.click();
}

/**
 * Reads an image from the system clipboard and uploads it to the given entity.
 * Requires HTTPS and user permission (Chrome will prompt once).
 * Called when the user clicks a "📋 Paste" button on any photo section.
 *
 * @param {string} targetType
 * @param {string} targetId
 */
async function triggerPasteUpload(targetType, targetId) {
    // navigator.clipboard.read() requires HTTPS and clipboard-read permission.
    if (!navigator.clipboard || !navigator.clipboard.read) {
        alert('Clipboard paste is not supported in this browser. Try Gallery instead.');
        return;
    }
    try {
        var items = await navigator.clipboard.read();
        var imageBlob = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            // Look for any image/* MIME type on the clipboard item
            var imageType = item.types.find(function(t) { return t.startsWith('image/'); });
            if (imageType) {
                imageBlob = await item.getType(imageType);
                break;
            }
        }

        if (!imageBlob) {
            alert('No image on the clipboard.\n\nIn Chrome: right-click an image and choose "Copy image", then click Paste here.');
            return;
        }

        // Wrap the Blob in a File so handlePhotoFile() receives a proper File object
        var ext  = imageBlob.type === 'image/png' ? '.png' : '.jpg';
        var file = new File([imageBlob], 'pasted-image' + ext, { type: imageBlob.type });
        handlePhotoFile(file, targetType, targetId);

    } catch (err) {
        if (err.name === 'NotAllowedError') {
            alert('Clipboard access was denied.\n\nClick "Allow" when the browser asks for clipboard permission, then try again.');
        } else {
            console.error('Paste upload error:', err);
            alert('Could not read clipboard. Try the Gallery button instead.');
        }
    }
}

// ---------- Event Delegation: Paste Photo Buttons ----------
//
// All "📋 Paste" buttons in index.html use class="paste-photo-btn" and
// data-entity="<targetType>" (e.g. data-entity="zone").
// One listener here covers every entity type without per-file wiring.
//
// Entity state lookup — maps targetType → current entity object.
// House-context vars (currentFloor, etc.) are exposed on window by house.js.
// People-context vars are exposed on window by people.js.

function _getPasteEntity(type) {
    var entityMap = {
        zone:              window.currentZone,
        plant:             window.currentPlant,
        weed:              window.currentWeed,
        vehicle:           window.currentVehicle,
        panel:             window.currentPanel,
        floor:             window.currentFloor,
        room:              window.currentRoom,
        thing:             window.currentThing,
        subthing:          window.currentSubThing,
        garageroom:        window.currentGarageRoom,
        garagething:       window.currentGarageThing,
        garagesubthing:    window.currentGarageSubThing,
        structure:         window.currentStructure,
        structurething:    window.currentStructureThing,
        structuresubthing: window.currentStructureSubThing,
        collectionitem:    window.currentCollectionItem,
        person:            window.currentPerson,
        item:              window.currentItem,
    };
    return entityMap[type] || null;
}

document.addEventListener('click', function(e) {
    var btn = e.target.closest('.paste-photo-btn');
    if (!btn) return;
    var entityType = btn.dataset.entity;
    if (!entityType) return;
    var entity = _getPasteEntity(entityType);
    if (entity && entity.id) {
        triggerPasteUpload(entityType, entity.id);
    }
});

// ---------- Crop Preview ----------

/**
 * Shows a modal preview of a captured photo. The user can either:
 *   - "Use Photo" — accept as-is (resolves with the original File/Blob)
 *   - "Crop" — launch Cropper.js, then "Apply Crop" (resolves with a cropped Blob)
 *   - "Cancel" — reject with 'cancelled'
 *
 * @param {File|Blob} file
 * @returns {Promise<File|Blob>} Resolves with the final image to save.
 */
function showCropPreview(file) {
    return new Promise(function(resolve, reject) {
        _cropResolve      = resolve;
        _cropReject       = reject;
        _cropOriginalFile = file;

        // Destroy any lingering Cropper instance from a previous call
        if (_cropperInstance) {
            _cropperInstance.destroy();
            _cropperInstance = null;
        }

        var reader = new FileReader();
        reader.onload = function(e) {
            // Rebuild the container so Cropper.js doesn't trip over stale DOM wrappers
            var container = document.getElementById('cropPreviewContainer');
            container.innerHTML = '<img id="cropPreviewImage" style="max-width:100%;display:block;margin:0 auto;">';
            document.getElementById('cropPreviewImage').src = e.target.result;

            // Show the preview buttons, hide the apply-crop buttons
            document.getElementById('cropPreviewButtons').style.display = '';
            document.getElementById('cropApplyButtons').style.display  = 'none';

            openModal('cropPreviewModal');
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Processes a selected file: compresses, prompts for caption, and saves to Firestore.
 * Works for all targetTypes via the PHOTO_CONTAINERS map.
 * @param {File} file - The image file selected by the user.
 * @param {string} targetType
 * @param {string} targetId
 */
async function handlePhotoFile(file, targetType, targetId) {
    // Show crop preview — user can optionally crop before saving.
    var processedFile;
    try {
        processedFile = await showCropPreview(file);
    } catch (e) {
        return; // User cancelled
    }

    var ids = PHOTO_CONTAINERS[targetType] || ['plantPhotoContainer', 'plantPhotoEmptyState'];
    var containerId  = ids[0];
    var emptyStateId = ids[1];
    var container  = document.getElementById(containerId);
    var emptyState = document.getElementById(emptyStateId);
    if (!container || !emptyState) {
        console.error('Photo container not found for targetType:', targetType);
        return;
    }

    // Show loading indicator
    var loadingMsg = document.createElement('p');
    loadingMsg.className = 'empty-state';
    loadingMsg.textContent = 'Compressing and uploading photo...';
    loadingMsg.style.display = 'block';

    // Hide empty state and show loading
    emptyState.style.display = 'none';
    container.innerHTML = '';
    container.appendChild(loadingMsg);

    try {
        // Compress the image (client-side resize + JPEG compression)
        var imageData = await compressImage(processedFile);

        // Prompt for an optional caption
        var caption = prompt('Add a caption (optional):') || '';

        // Save to Firestore
        await userCol('photos').add({
            targetType: targetType,
            targetId: targetId,
            imageData: imageData,
            caption: caption.trim(),
            takenAt: new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('Photo saved for', targetType, targetId);

        // Reload the photo gallery
        loadPhotos(targetType, targetId, containerId, emptyStateId);

    } catch (error) {
        console.error('Error uploading photo:', error);
        alert('Error uploading photo. Check console for details.');
        // Remove loading message and restore empty state
        container.innerHTML = '';
        emptyState.textContent = 'Error uploading photo.';
        emptyState.style.display = 'block';
    }
}

// ---------- Client-side Image Compression ----------

/**
 * Compresses an image file using Canvas.
 * Resizes to max 1200px on the longest side, then JPEG-compresses
 * starting at quality 0.7, reducing until target size is reached.
 * Target: ~100-200KB (base64 ~130-270KB characters).
 * @param {File} file - The image file to compress.
 * @returns {Promise<string>} The base64-encoded JPEG data URL.
 */
function compressImage(file) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();

        reader.onload = function(e) {
            var img = new Image();

            img.onload = function() {
                // Determine target dimensions (max 1200px on longest side)
                var maxDimension = 1200;
                var width = img.width;
                var height = img.height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round(height * (maxDimension / width));
                        width = maxDimension;
                    } else {
                        width = Math.round(width * (maxDimension / height));
                        height = maxDimension;
                    }
                }

                // Draw to canvas and compress as JPEG
                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Start with quality 0.7, reduce if still too large
                // 200KB of binary = ~270KB of base64 characters
                var quality = 0.7;
                var dataUrl = canvas.toDataURL('image/jpeg', quality);

                while (dataUrl.length > 270000 && quality > 0.3) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                var sizeKB = Math.round(dataUrl.length / 1024);
                console.log('Photo compressed: ' + sizeKB + 'KB base64, quality: ' + quality.toFixed(1) +
                    ', dimensions: ' + width + 'x' + height);

                resolve(dataUrl);
            };

            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

// ---------- Edit Photo Caption ----------

/**
 * Prompts the user to edit a photo's caption.
 * Updates Firestore and re-renders the viewer without a full reload.
 * @param {string} photoId - The photo's Firestore document ID.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} containerId - The container element ID for re-rendering.
 */
async function editPhotoCaption(photoId, targetType, containerId) {
    var state = photoViewerState[targetType];
    var photo = state.photos[state.currentIndex];

    var newCaption = prompt('Edit caption:', photo.caption || '');
    if (newCaption === null) return; // User cancelled

    try {
        await userCol('photos').doc(photoId).update({
            caption: newCaption.trim()
        });

        console.log('Photo caption updated');

        // Update local state and re-render (avoids full Firestore reload)
        photo.caption = newCaption.trim();
        renderPhotoViewer(targetType, containerId);

    } catch (error) {
        console.error('Error updating caption:', error);
        alert('Error updating caption. Check console for details.');
    }
}

// ---------- Profile Thumbnail ----------

/**
 * Compress a data URL to a small thumbnail (max 300px, JPEG 0.80).
 * Stored as profilePhotoData on the entity document.
 * @param {string} dataUrl - Existing base64 data URL from the photos collection.
 * @returns {Promise<string>} Compressed thumbnail data URL.
 */
function _compressToThumb(dataUrl) {
    return new Promise(function(resolve, reject) {
        var img = new Image();
        img.onload = function() {
            var MAX = 300;
            var w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else        { w = Math.round(w * MAX / h); h = MAX; }
            }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.80));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

/**
 * Save a gallery photo as the profile thumbnail for its entity.
 * Compresses to thumbnail size and writes profilePhotoData to the entity doc.
 * Returns the compressed data URL on success, null on failure.
 *
 * @param {Object} photo      - Photo object from photoViewerState (has .imageData, .targetId)
 * @param {string} targetType - e.g. 'plant', 'weed', 'person', 'vehicle', 'thing'
 * @returns {Promise<string|null>}
 */
async function setProfilePhoto(photo, targetType) {
    var collection = PROFILE_COLLECTION_MAP[targetType];
    if (!collection) return null;
    try {
        var thumbData = await _compressToThumb(photo.imageData);
        await userCol(collection).doc(photo.targetId).update({ profilePhotoData: thumbData });
        return thumbData;
    } catch (err) {
        console.error('setProfilePhoto error:', err);
        alert('Error setting profile photo.');
        return null;
    }
}

// ---------- Crop Existing Photo ----------

/**
 * Opens the crop modal for a photo that is already saved in Firestore.
 * Converts the stored base64 data URL → Blob, feeds it into the existing
 * showCropPreview() flow, then compresses and saves the result back.
 * Works for every targetType since renderPhotoViewer is the shared renderer.
 *
 * @param {Object} photo        - The photo object from photoViewerState
 * @param {string} targetType
 * @param {string} containerId
 */
async function cropExistingPhoto(photo, targetType, containerId) {
    // Convert the stored data URL back to a Blob so showCropPreview can use it
    var blob;
    try {
        var resp = await fetch(photo.imageData);
        blob = await resp.blob();
    } catch (err) {
        console.error('cropExistingPhoto — failed to load image data:', err);
        alert('Could not load photo for cropping.');
        return;
    }

    // Open the existing crop modal; user can crop or cancel
    var croppedBlob;
    try {
        croppedBlob = await showCropPreview(blob);
    } catch (e) {
        return; // User cancelled — nothing to do
    }

    try {
        // Compress the cropped result and write back to the same Firestore doc
        var newImageData = await compressImage(croppedBlob);
        await userCol('photos').doc(photo.id).update({ imageData: newImageData });

        // Update the in-memory cache so the viewer re-renders immediately
        photo.imageData = newImageData;
        renderPhotoViewer(targetType, containerId);

    } catch (err) {
        console.error('cropExistingPhoto — save error:', err);
        alert('Error saving cropped photo.');
    }
}

// ---------- Delete Photo ----------

/**
 * Deletes a photo after confirmation.
 * Reloads the photo gallery after deletion.
 * @param {string} photoId - The photo's Firestore document ID.
 * @param {string} targetType - "plant" or "zone"
 */
async function handleDeletePhoto(photoId, targetType) {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
        await userCol('photos').doc(photoId).delete();
        console.log('Photo deleted:', photoId);

        // Determine current target ID from global state and reload
        var currentMap = {
            plant:              window.currentPlant,
            zone:               window.currentZone,
            weed:               window.currentWeed,
            vehicle:            window.currentVehicle,
            panel:              window.currentPanel,
            floor:              window.currentFloor,
            room:               window.currentRoom,
            thing:              window.currentThing,
            subthing:           window.currentSubThing,
            garageroom:         window.currentGarageRoom,
            garagething:        window.currentGarageThing,
            garagesubthing:     window.currentGarageSubThing,
            structure:          window.currentStructure,
            structurething:     window.currentStructureThing,
            structuresubthing:  window.currentStructureSubThing,
            collectionitem:     window.currentCollectionItem,
            note:               window.currentNote,
            item:               window.currentItem,
        };
        var current = currentMap[targetType];
        if (current && current.id) {
            reloadPhotosForCurrentTarget(targetType, current.id);
        }

    } catch (error) {
        console.error('Error deleting photo:', error);
        alert('Error deleting photo. Check console for details.');
    }
}

// ---------- Reload Helper ----------

/**
 * Reloads the photo gallery for any targetType using the PHOTO_CONTAINERS map.
 * @param {string} targetType
 * @param {string} targetId
 */
function reloadPhotosForCurrentTarget(targetType, targetId) {
    var ids = PHOTO_CONTAINERS[targetType];
    if (ids) {
        loadPhotos(targetType, targetId, ids[0], ids[1]);
    }
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    document.getElementById('addPlantCameraBtn').addEventListener('click', function() {
        if (window.currentPlant) triggerCameraUpload('plant', window.currentPlant.id);
    });
    document.getElementById('addPlantGalleryBtn').addEventListener('click', function() {
        if (window.currentPlant) triggerGalleryUpload('plant', window.currentPlant.id);
    });

    document.getElementById('addZoneCameraBtn').addEventListener('click', function() {
        if (window.currentZone) triggerCameraUpload('zone', window.currentZone.id);
    });
    document.getElementById('addZoneGalleryBtn').addEventListener('click', function() {
        if (window.currentZone) triggerGalleryUpload('zone', window.currentZone.id);
    });

    document.getElementById('addVisitCameraBtn').addEventListener('click', function() {
        if (window.currentHealthVisit) triggerCameraUpload('healthVisit', window.currentHealthVisit.id);
    });
    document.getElementById('addVisitGalleryBtn').addEventListener('click', function() {
        if (window.currentHealthVisit) triggerGalleryUpload('healthVisit', window.currentHealthVisit.id);
    });

    document.getElementById('addConcernCameraBtn').addEventListener('click', function() {
        if (window.currentHealthConcern) triggerCameraUpload('concern', window.currentHealthConcern.id);
    });
    document.getElementById('addConcernGalleryBtn').addEventListener('click', function() {
        if (window.currentHealthConcern) triggerGalleryUpload('concern', window.currentHealthConcern.id);
    });

    document.getElementById('addInsuranceCameraBtn').addEventListener('click', function() {
        if (window.currentInsurance) triggerCameraUpload('insurancePolicy', window.currentInsurance.id);
    });
    document.getElementById('addInsuranceGalleryBtn').addEventListener('click', function() {
        if (window.currentInsurance) triggerGalleryUpload('insurancePolicy', window.currentInsurance.id);
    });

    // ---- Crop Preview Modal Buttons ----

    // Cancel: dismiss modal, reject the pending Promise
    document.getElementById('cropCancelBtn').addEventListener('click', function() {
        if (_cropperInstance) { _cropperInstance.destroy(); _cropperInstance = null; }
        closeModal('cropPreviewModal');
        if (_cropReject) { _cropReject('cancelled'); }
        _cropReject = null; _cropResolve = null;
    });

    // Use Photo: accept image as-is, resolve with original file
    document.getElementById('cropUseBtn').addEventListener('click', function() {
        if (_cropperInstance) { _cropperInstance.destroy(); _cropperInstance = null; }
        closeModal('cropPreviewModal');
        var resolve = _cropResolve;
        _cropResolve = null; _cropReject = null;
        if (resolve) resolve(_cropOriginalFile);
    });

    // Start Crop: launch Cropper.js on the preview image
    document.getElementById('cropStartBtn').addEventListener('click', function() {
        var img = document.getElementById('cropPreviewImage');
        _cropperInstance = new Cropper(img, {
            viewMode:      1,
            movable:       true,
            zoomable:      true,
            scalable:      false,
            autoCropArea:  0.9,
        });
        document.getElementById('cropPreviewButtons').style.display = 'none';
        document.getElementById('cropApplyButtons').style.display  = '';
    });

    // Back: destroy Cropper, return to plain preview of original file
    document.getElementById('cropBackBtn').addEventListener('click', function() {
        if (_cropperInstance) { _cropperInstance.destroy(); _cropperInstance = null; }

        // Re-render the original image (Cropper wraps the img element in extra DOM)
        var container = document.getElementById('cropPreviewContainer');
        container.innerHTML = '<img id="cropPreviewImage" style="max-width:100%;display:block;margin:0 auto;">';
        var img = document.getElementById('cropPreviewImage');
        var reader = new FileReader();
        reader.onload = function(e) { img.src = e.target.result; };
        reader.readAsDataURL(_cropOriginalFile);

        document.getElementById('cropPreviewButtons').style.display = '';
        document.getElementById('cropApplyButtons').style.display  = 'none';
    });

    // Apply Crop: export cropped canvas as a Blob and resolve the Promise
    document.getElementById('cropApplyBtn').addEventListener('click', function() {
        if (!_cropperInstance) return;
        _cropperInstance.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200 })
            .toBlob(function(blob) {
                _cropperInstance.destroy();
                _cropperInstance = null;
                closeModal('cropPreviewModal');
                var resolve = _cropResolve;
                _cropResolve = null; _cropReject = null;
                if (resolve) resolve(blob);
            }, 'image/jpeg', 0.92);
    });
});

// ============================================================
// SHARED PHOTO STAGING + CROP SYSTEM
// Used by all LLM "from picture" flows (weeds, plants, things, etc.)
// Each flow calls openLlmPhotoStaging(title, callback).
// The user takes up to 4 photos, each goes through a crop step,
// then presses "Send to AI" which fires the callback with
// an array of already-compressed base64 data URL strings.
// ============================================================

var _stagingQueue    = [];    // Array of base64 data URLs (already compressed)
var _stagingCallback = null;  // function(images[]) called when user taps Send
var STAGING_MAX      = 4;

var _stagingCropperInstance = null;  // Active Cropper.js instance for staging crop modal
var _stagingCropResolve     = null;  // Resolve fn for the pending _showStagingCropModal Promise

/**
 * Opens the photo staging modal and immediately triggers the camera for the first photo.
 * @param {string}   title  - Title shown in the staging modal (e.g. "Add Weed Photos")
 * @param {function} onSend - Callback receiving array of base64 compressed image strings
 */
function openLlmPhotoStaging(title, onSend) {
    _stagingQueue    = [];
    _stagingCallback = onSend;
    document.getElementById('photoStagingTitle').textContent = title || 'Add Photos';
    _updateStagingGrid();
    openModal('photoStagingModal');
    // Trigger camera immediately for first photo
    var camInput = document.getElementById('stagingCameraInput');
    camInput.value = '';
    window._filePickerOpen = true;   // block popstate from closing modal when camera returns
    camInput.click();
}

/**
 * Called when the staging camera input fires (user took or selected a photo).
 * Compresses the raw file, then shows the staging crop modal before adding to queue.
 * @param {File} file - The image file captured
 */
async function _stagingHandleCamera(file) {
    if (!file) return;
    try {
        // Compress first to keep things manageable in crop modal
        var compressed = await compressImage(file);
        // Show staging crop modal — user can crop or use as-is
        var finalImage = await _showStagingCropModal(compressed);
        if (finalImage === null) return; // user cancelled crop
        _stagingQueue.push(finalImage);
        _updateStagingGrid();
    } catch (e) {
        console.error('Staging camera error:', e);
    }
}

/**
 * Shows the staging crop modal for one image.
 * Returns a Promise that resolves with the final base64 string, or null if cancelled.
 * @param {string} imageDataUrl - Compressed base64 data URL
 * @returns {Promise<string|null>}
 */
function _showStagingCropModal(imageDataUrl) {
    return new Promise(function(resolve) {
        _stagingCropResolve = resolve;
        var img = document.getElementById('stagingCropImage');
        img.src = imageDataUrl;

        // Destroy any existing Cropper instance before creating a new one
        if (_stagingCropperInstance) {
            try { _stagingCropperInstance.destroy(); } catch (e) {}
            _stagingCropperInstance = null;
        }

        openModal('stagingCropModal');

        // Init Cropper after a short delay to let the modal render
        setTimeout(function() {
            try {
                _stagingCropperInstance = new Cropper(img, {
                    viewMode:     1,
                    autoCropArea: 0.85,
                    responsive:   true,
                    movable:      true,
                    zoomable:     true
                });
            } catch (e) {
                console.error('Staging Cropper init failed:', e);
            }
        }, 150);
    });
}

/** Apply the current crop selection and resolve with the cropped JPEG data URL. */
function _stagingCropApply() {
    if (!_stagingCropperInstance || !_stagingCropResolve) return;
    try {
        var canvas = _stagingCropperInstance.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200 });
        var result = canvas.toDataURL('image/jpeg', 0.85);
        _stagingCropCleanup();
        _stagingCropResolve(result);
    } catch (e) {
        console.error('Staging crop apply error:', e);
        _stagingCropSkip();
    }
}

/** Use the image as-is (no crop) — resolves with the original data URL. */
function _stagingCropSkip() {
    if (!_stagingCropResolve) return;
    var src = document.getElementById('stagingCropImage').src;
    _stagingCropCleanup();
    _stagingCropResolve(src);
}

/** Cancel — discard this photo and resolve with null. */
function _stagingCropCancel() {
    if (!_stagingCropResolve) return;
    _stagingCropCleanup();
    _stagingCropResolve(null);
}

/** Destroy the Cropper instance and close the staging crop modal. */
function _stagingCropCleanup() {
    if (_stagingCropperInstance) {
        try { _stagingCropperInstance.destroy(); } catch (e) {}
        _stagingCropperInstance = null;
    }
    closeModal('stagingCropModal');
}

/**
 * Rebuilds the staging grid UI to reflect the current _stagingQueue.
 * Updates the thumbnail list, count label, and button states.
 */
function _updateStagingGrid() {
    var grid     = document.getElementById('photoStagingGrid');
    var addBtn   = document.getElementById('photoStagingAddBtn');
    var sendBtn  = document.getElementById('photoStagingSendBtn');
    var countEl  = document.getElementById('photoStagingCount');

    grid.innerHTML = '';

    _stagingQueue.forEach(function(imgData, i) {
        var wrap  = document.createElement('div');
        wrap.className = 'staging-thumb-wrap';

        var imgEl = document.createElement('img');
        imgEl.src       = imgData;
        imgEl.className = 'staging-thumb';

        // Remove-photo button (×)
        var rmBtn = document.createElement('button');
        rmBtn.className = 'staging-thumb-remove';
        rmBtn.innerHTML = '&times;';
        rmBtn.title     = 'Remove';
        rmBtn.onclick   = (function(idx) {
            return function(e) {
                e.stopPropagation();
                _stagingQueue.splice(idx, 1);
                _updateStagingGrid();
            };
        })(i);

        wrap.appendChild(imgEl);
        wrap.appendChild(rmBtn);
        grid.appendChild(wrap);
    });

    addBtn.style.display = _stagingQueue.length >= STAGING_MAX ? 'none' : '';
    sendBtn.disabled     = _stagingQueue.length === 0;
    countEl.textContent  = _stagingQueue.length + ' / ' + STAGING_MAX + ' photos';
}

// Wire up staging + crop buttons once the DOM is ready
document.addEventListener('DOMContentLoaded', function() {

    // Staging camera input — fires after user takes/selects a photo
    document.getElementById('stagingCameraInput').addEventListener('change', function() {
        window._filePickerOpen = false;  // camera returned
        if (this.files && this.files[0]) {
            _stagingHandleCamera(this.files[0]);
        }
        this.value = '';
    });

    // "Add Another" button — re-triggers the camera
    document.getElementById('photoStagingAddBtn').addEventListener('click', function() {
        var camInput = document.getElementById('stagingCameraInput');
        camInput.value = '';
        window._filePickerOpen = true;   // camera opening — block popstate close
        camInput.click();
    });

    // "Send to AI" button — fires callback with all staged images and closes modal
    document.getElementById('photoStagingSendBtn').addEventListener('click', function() {
        if (_stagingQueue.length === 0 || !_stagingCallback) return;
        var images   = _stagingQueue.slice();
        var callback = _stagingCallback;
        _stagingQueue    = [];
        _stagingCallback = null;
        closeModal('photoStagingModal');
        callback(images);
    });

    // "Cancel" button on staging modal — discards all staged photos
    document.getElementById('photoStagingCancelBtn').addEventListener('click', function() {
        _stagingQueue    = [];
        _stagingCallback = null;
        closeModal('photoStagingModal');
    });

    // Staging crop modal buttons
    document.getElementById('stagingCropApplyBtn').addEventListener('click', _stagingCropApply);
    document.getElementById('stagingCropSkipBtn').addEventListener('click',  _stagingCropSkip);
    document.getElementById('stagingCropCancelBtn').addEventListener('click', _stagingCropCancel);
});
