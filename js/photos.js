// ============================================================
// Photos.js — Photo upload, compression, and gallery logic
// Photos are stored as Base64 strings in Firestore documents.
// Client-side compression targets ~100-200KB per photo.
// Gallery shows the newest photo first with navigation to browse history.
// Stored in Firestore collection: "photos"
// ============================================================

// ---------- Module State ----------

/**
 * Cache of loaded photos for each viewer type (plant, zone, or weed).
 * Each entry holds an array of photos and the current display index.
 */
var photoViewerState = {
    plant: { photos: [], currentIndex: 0 },
    zone:  { photos: [], currentIndex: 0 },
    weed:  { photos: [], currentIndex: 0 }
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
        photoViewerState[targetType] = { photos: photos, currentIndex: 0 };

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
 * Triggers the file input for photo upload.
 * On mobile: offers camera or file picker.
 * On desktop: opens file picker.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The target's Firestore document ID.
 */
function triggerPhotoUpload(targetType, targetId) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Prefer rear camera on mobile

    input.addEventListener('change', function() {
        if (input.files && input.files[0]) {
            handlePhotoFile(input.files[0], targetType, targetId);
        }
    });

    input.click();
}

/**
 * Processes a selected file: compresses, prompts for caption, and saves to Firestore.
 * @param {File} file - The image file selected by the user.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The target's Firestore document ID.
 */
async function handlePhotoFile(file, targetType, targetId) {
    var containerId = targetType === 'plant' ? 'plantPhotoContainer' : 'zonePhotoContainer';
    var emptyStateId = targetType === 'plant' ? 'plantPhotoEmptyState' : 'zonePhotoEmptyState';
    var container = document.getElementById(containerId);
    var emptyState = document.getElementById(emptyStateId);

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
        var imageData = await compressImage(file);

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

        // Determine current target ID and reload
        var targetId;
        if (targetType === 'plant' && window.currentPlant) {
            targetId = window.currentPlant.id;
        } else if (targetType === 'zone' && window.currentZone) {
            targetId = window.currentZone.id;
        } else if (targetType === 'weed' && window.currentWeed) {
            targetId = window.currentWeed.id;
        }

        if (targetId) {
            reloadPhotosForCurrentTarget(targetType, targetId);
        }

    } catch (error) {
        console.error('Error deleting photo:', error);
        alert('Error deleting photo. Check console for details.');
    }
}

// ---------- Reload Helper ----------

/**
 * Reloads the photo gallery for the current target.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The target's Firestore document ID.
 */
function reloadPhotosForCurrentTarget(targetType, targetId) {
    if (targetType === 'plant') {
        loadPhotos('plant', targetId, 'plantPhotoContainer', 'plantPhotoEmptyState');
    } else if (targetType === 'zone') {
        loadPhotos('zone', targetId, 'zonePhotoContainer', 'zonePhotoEmptyState');
    } else if (targetType === 'weed') {
        loadPhotos('weed', targetId, 'weedPhotoContainer', 'weedPhotoEmptyState');
    }
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    // "Add Photo" button on plant detail page
    document.getElementById('addPlantPhotoBtn').addEventListener('click', function() {
        if (window.currentPlant) {
            triggerPhotoUpload('plant', window.currentPlant.id);
        }
    });

    // "Add Photo" button on zone detail page
    document.getElementById('addZonePhotoBtn').addEventListener('click', function() {
        if (window.currentZone) {
            triggerPhotoUpload('zone', window.currentZone.id);
        }
    });
});
