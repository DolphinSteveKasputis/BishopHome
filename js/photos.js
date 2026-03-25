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

    // Action buttons: Edit Caption, Delete
    var actions = document.createElement('div');
    actions.className = 'photo-actions';

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
