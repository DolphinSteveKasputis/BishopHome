// ============================================================
// chat.js — AI Chat feature
// Sends a single question (with optional attached images) to a
// configured LLM provider and displays the response.
// No conversation history is maintained.
// ============================================================

// LLM provider endpoints and default models
var LLM_PROVIDERS = {
    openai: {
        endpoint : 'https://api.openai.com/v1/chat/completions',
        model    : 'gpt-4o-mini',
        name     : 'ChatGPT (OpenAI)'
    },
    grok: {
        endpoint : 'https://api.x.ai/v1/chat/completions',
        model    : 'grok-3',
        name     : 'Grok (xAI)'
    }
};

// Attached images for the current question (array of base64 data URLs).
// Cleared each time the chat page loads or after a message is sent.
var chatAttachedImages = [];

// Maximum images allowed per message
var CHAT_MAX_IMAGES = 4;

/**
 * Load the chat page. Checks whether an LLM is configured and shows
 * either the chat interface or a "go to Settings" prompt.
 * Called by app.js when routing to #chat.
 */
async function loadChatPage() {
    var config = await chatLoadConfig();

    if (!config) {
        document.getElementById('chatNoConfig').classList.remove('hidden');
        document.getElementById('chatInterface').classList.add('hidden');
    } else {
        document.getElementById('chatNoConfig').classList.add('hidden');
        document.getElementById('chatInterface').classList.remove('hidden');

        // Show which provider and model is active
        var provider = LLM_PROVIDERS[config.provider];
        document.getElementById('chatProviderLabel').textContent =
            provider ? (provider.name + ' — ' + provider.model) : config.provider;

        // Clear any previous state
        document.getElementById('chatQuestion').value = '';
        document.getElementById('chatResponseArea').classList.add('hidden');
        document.getElementById('chatResponse').innerHTML = '';
        document.getElementById('chatStatus').textContent = '';
        document.getElementById('chatSendBtn').disabled = false;
        chatAttachedImages = [];
        chatUpdateImagePreview();
    }
}

/**
 * Read the LLM config from Firestore (settings doc 'llm').
 * Returns { provider, apiKey } or null if not configured.
 */
async function chatLoadConfig() {
    try {
        var doc = await userCol('settings').doc('llm').get();
        if (doc.exists) {
            var d = doc.data();
            if (d.provider && d.apiKey) return { provider: d.provider, apiKey: d.apiKey };
        }
    } catch (e) {
        console.error('Error loading LLM config:', e);
    }
    return null;
}

/**
 * Send the typed question (and any attached images) to the configured LLM
 * and display the response.
 */
async function sendChatMessage() {
    var question = document.getElementById('chatQuestion').value.trim();

    // Require at least a question or an image
    if (!question && chatAttachedImages.length === 0) return;

    var sendBtn      = document.getElementById('chatSendBtn');
    var statusEl     = document.getElementById('chatStatus');
    var responseArea = document.getElementById('chatResponseArea');
    var responseEl   = document.getElementById('chatResponse');

    sendBtn.disabled     = true;
    statusEl.textContent = 'Sending\u2026';
    responseArea.classList.add('hidden');
    responseEl.innerHTML = '';

    var config = await chatLoadConfig();
    if (!config) {
        statusEl.textContent = 'No LLM configured. Go to Settings.';
        sendBtn.disabled = false;
        return;
    }

    var llm = LLM_PROVIDERS[config.provider];
    if (!llm) {
        statusEl.textContent = 'Unknown provider: ' + config.provider;
        sendBtn.disabled = false;
        return;
    }

    try {
        // Build content — plain string for text-only, array when images are attached
        var content;
        if (chatAttachedImages.length === 0) {
            content = question;
        } else {
            content = [];
            if (question) {
                content.push({ type: 'text', text: question });
            }
            chatAttachedImages.forEach(function(dataUrl) {
                content.push({ type: 'image_url', image_url: { url: dataUrl } });
            });
        }

        var responseText = await chatCallOpenAICompat(llm, config.apiKey, content);

        // Render markdown so bold, headers, bullet lists, code blocks, etc. display properly
        responseEl.innerHTML = marked.parse(responseText);
        responseArea.classList.remove('hidden');
        statusEl.textContent = '';

        // Clear attached images after a successful send
        chatAttachedImages = [];
        chatUpdateImagePreview();
    } catch (err) {
        console.error('Chat error:', err);
        statusEl.textContent = 'Error: ' + err.message;
    }

    sendBtn.disabled = false;
}

/**
 * Call an OpenAI-compatible API (OpenAI or xAI/Grok).
 * content can be a plain string (text only) or an array (text + images).
 */
async function chatCallOpenAICompat(llm, apiKey, content) {
    var res = await fetch(llm.endpoint, {
        method  : 'POST',
        headers : {
            'Content-Type'  : 'application/json',
            'Authorization' : 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model    : llm.model,
            messages : [{ role: 'user', content: content }]
        })
    });
    if (!res.ok) {
        var errData = await res.json().catch(function() { return {}; });
        throw new Error((errData.error && errData.error.message) || 'HTTP ' + res.status);
    }
    var data = await res.json();
    return data.choices[0].message.content;
}

/**
 * Handle file selection. Compresses each selected image (reusing
 * compressImage from photos.js) and adds it to chatAttachedImages.
 * Silently caps at CHAT_MAX_IMAGES total.
 */
async function chatAttachImages(files) {
    var statusEl  = document.getElementById('chatStatus');
    var remaining = CHAT_MAX_IMAGES - chatAttachedImages.length;

    if (remaining <= 0) {
        statusEl.textContent = 'Max ' + CHAT_MAX_IMAGES + ' images per message.';
        return;
    }

    var toProcess = Array.from(files).slice(0, remaining);
    statusEl.textContent = 'Processing image' + (toProcess.length > 1 ? 's' : '') + '\u2026';

    for (var i = 0; i < toProcess.length; i++) {
        try {
            var dataUrl = await compressImage(toProcess[i]);
            chatAttachedImages.push(dataUrl);
        } catch (e) {
            console.error('Image compress error:', e);
        }
    }

    statusEl.textContent = '';
    chatUpdateImagePreview();

    // Reset the file input so the same file can be selected again if needed
    document.getElementById('chatImageInput').value = '';
}

/**
 * Remove one attached image by its index in chatAttachedImages.
 */
function chatRemoveImage(index) {
    chatAttachedImages.splice(index, 1);
    chatUpdateImagePreview();
}

/**
 * Rebuild the thumbnail strip from the current chatAttachedImages array.
 */
function chatUpdateImagePreview() {
    var preview = document.getElementById('chatImagePreview');
    preview.innerHTML = '';

    if (chatAttachedImages.length === 0) {
        preview.classList.add('hidden');
        return;
    }

    preview.classList.remove('hidden');

    chatAttachedImages.forEach(function(dataUrl, index) {
        var wrap = document.createElement('div');
        wrap.className = 'chat-thumb-wrap';

        var img = document.createElement('img');
        img.src       = dataUrl;
        img.className = 'chat-thumb';
        img.alt       = 'Attached image ' + (index + 1);

        var removeBtn = document.createElement('button');
        removeBtn.type      = 'button';
        removeBtn.className = 'chat-thumb-remove';
        removeBtn.textContent = '\u00D7';  // ×
        removeBtn.title = 'Remove image';
        removeBtn.setAttribute('data-index', index);
        removeBtn.addEventListener('click', function() {
            chatRemoveImage(parseInt(this.getAttribute('data-index')));
        });

        wrap.appendChild(img);
        wrap.appendChild(removeBtn);
        preview.appendChild(wrap);
    });
}

// ---------- Wire-up ----------

document.getElementById('chatSendBtn').addEventListener('click', sendChatMessage);

// Attach button opens the hidden file picker
document.getElementById('chatAttachBtn').addEventListener('click', function() {
    document.getElementById('chatImageInput').click();
});

// File picker selection triggers compression + preview
document.getElementById('chatImageInput').addEventListener('change', function() {
    if (this.files && this.files.length > 0) {
        chatAttachImages(this.files);
    }
});

// Ctrl+Enter (or Cmd+Enter on Mac) sends the message without inserting a newline
document.getElementById('chatQuestion').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendChatMessage();
    }
});
