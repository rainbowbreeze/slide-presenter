document.addEventListener('DOMContentLoaded', () => {
    // Detect speaker mode and initial slide from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const isSpeakerMode = urlParams.get('mode') === 'speaker';
    const initialSlide = parseInt(urlParams.get('slide'), 10) || 0;

    // State variables for the presentation
    let slides = [];
    let theme = {};
    let metadata = {};
    let currentSlide = initialSlide;
    let speakerFontSize = 2.5; // Default font size (em) for speaker notes
    let speakerNotesHeight = null; // Persisted custom height (px) for speaker notes area after resizing
    let isResizing = false; // Flag for active drag-resizing state
    let blockClick = false; // Flag to temporarily block navigation clicks right after resizing

    // Set up cross-window synchronization channel
    const syncChannel = new BroadcastChannel('slide-sync');
    syncChannel.onmessage = (event) => {
        if (!event.data) return;
        if (event.data.type === 'SLIDE_CHANGE') {
            const newIndex = event.data.index;
            if (newIndex !== currentSlide) {
                renderSlide(newIndex, false); // Pass false to prevent infinite broadcast loop
            }
        } else if (event.data.type === 'RELOAD') {
            initialize(false); // Reload slide and theme data without re-broadcasting
        }
    };

    // DOM Elements
    const slideContainer = document.getElementById('slide-container');
    const printContainer = document.getElementById('print-container');
    const footer = document.getElementById('footer');
    const helpOverlay = document.getElementById('help-overlay');

    if (isSpeakerMode) {
        document.body.classList.add('speaker-mode-active');

        // Inject speaker mode top bar with font size and timer controls
        const topBar = document.createElement('div');
        topBar.className = 'speaker-top-bar';
        topBar.innerHTML = `
            <div class="font-controls">
                <button id="btn-font-decrease">A-</button>
                <button id="btn-font-increase">A+</button>
            </div>
            <div class="timer-controls">
                <span id="speaker-timer" class="speaker-timer">00:00:00</span>
                <button id="btn-timer-reset">Reset</button>
            </div>
        `;
        document.body.insertBefore(topBar, slideContainer);

        // Font size controls
        document.getElementById('btn-font-increase').addEventListener('click', () => {
            speakerFontSize += 0.2;
            updateSpeakerFontSize();
        });
        document.getElementById('btn-font-decrease').addEventListener('click', () => {
            speakerFontSize = Math.max(1, speakerFontSize - 0.2);
            updateSpeakerFontSize();
        });

        function updateSpeakerFontSize() {
            const content = document.querySelector('.speaker-notes-content');
            if (content) {
                content.style.fontSize = `${speakerFontSize}em`;
            }
        }

        // Presentation timer controls
        let startTime = Date.now();
        setInterval(updateTimer, 1000);

        function updateTimer() {
            const now = Date.now();
            const diff = Math.floor((now - startTime) / 1000);
            const h = String(Math.floor(diff / 3600)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
            const s = String(diff % 60).padStart(2, '0');
            const timerEl = document.getElementById('speaker-timer');
            if (timerEl) {
                timerEl.textContent = `${h}:${m}:${s}`;
            }
        }

        const resetBtn = document.getElementById('btn-timer-reset');
        resetBtn.addEventListener('click', () => {
            startTime = Date.now();
            updateTimer();
            // Blur the button so spacebar navigation continues to work as expected
            resetBtn.blur();
        });
    }

    /**
     * Escapes special HTML characters in a raw string for safe rendering in HTML text and attributes.
     * @param {string} str - Raw string to escape.
     * @returns {string} HTML-escaped string.
     */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Resolves an image or asset URI to a full URL or the local `/slides/` static route.
     * @param {string} uri - The raw URI from the slide or theme JSON.
     * @param {string} fallback - Fallback URL if uri is empty.
     * @returns {string} The resolved URL string.
     */
    function resolveAssetUrl(uri, fallback = '') {
        const targetUri = uri || fallback;
        if (!targetUri) return '';
        if (targetUri.startsWith('http://') || targetUri.startsWith('https://') || targetUri.startsWith('/slides/')) {
            return targetUri;
        }
        return `/slides/${targetUri.replace(/^\/+/, '')}`;
    }

    /**
     * Safely formats a URL string for use inside a CSS `url("...")` property.
     * @param {string} url - The URL to wrap.
     * @returns {string} CSS `url("...")` value.
     */
    function toCssUrl(url) {
        const safeUrl = String(url).replace(/(["\\])/g, '\\$1');
        return `url("${safeUrl}")`;
    }

    /**
     * Ensures all anchor tags in a rendered HTML fragment open in a new tab safely.
     * @param {string} html - Rendered HTML string.
     * @returns {string} HTML string with `target="_blank" rel="noopener noreferrer"` on links.
     */
    function addExternalLinkAttrs(html) {
        return html.replace(/<a\s+(?![^>]*\btarget=)/gi, '<a target="_blank" rel="noopener noreferrer" ');
    }

    /**
     * Parses inline Markdown if marked.js is loaded; falls back to escaped HTML.
     * All links are configured to open in a new tab.
     * @param {string} text - Raw text that may contain inline Markdown.
     * @returns {string} HTML string with inline Markdown rendered.
     */
    function parseInlineMarkdown(text) {
        if (!text) return '';
        const raw = String(text);
        if (typeof marked !== 'undefined') {
            return addExternalLinkAttrs(marked.parseInline(raw));
        }
        return escapeHtml(raw);
    }

    /**
     * Parses block-level Markdown if marked.js is loaded; falls back to escaped HTML.
     * All links are configured to open in a new tab.
     * @param {string} text - Raw text that may contain block Markdown.
     * @returns {string} HTML string with block Markdown rendered.
     */
    function parseBlockMarkdown(text) {
        if (!text) return '';
        const raw = String(text);
        if (typeof marked !== 'undefined') {
            return addExternalLinkAttrs(marked.parse(raw));
        }
        return `<p>${escapeHtml(raw)}</p>`;
    }

    /**
     * Helper to render an optional introductory sentence above bullet points.
     * @param {string} sentence - The sentence text to render.
     * @returns {string} HTML string for the sentence element, or empty string.
     */
    function renderSentence(sentence) {
        if (!sentence) return '';
        return `<div class="sentence">${parseInlineMarkdown(sentence)}</div>`;
    }

    /**
     * Helper to render an array of bullet strings into an HTML unordered list.
     * @param {string[]} bullets - Array of bullet strings.
     * @returns {string} HTML string for the bullet list, or empty string.
     */
    function renderBullets(bullets) {
        if (!bullets || bullets.length === 0) return '';
        const itemsHtml = bullets
            .map(bullet => `<li>${parseInlineMarkdown(bullet)}</li>`)
            .join('');
        return `<ul>${itemsHtml}</ul>`;
    }

    /**
     * Helper to render a syntax-highlighted code block using Highlight.js when available.
     * Supports `code` provided either as a multiline string or an array of line strings.
     * @param {string|string[]} code - The code snippet to render.
     * @param {string} [language] - Optional language identifier (e.g. 'python', 'javascript').
     * @returns {string} HTML string for the code block container.
     */
    function renderCodeBlock(code, language) {
        if (!code || (Array.isArray(code) && code.length === 0)) return '';
        const rawCode = Array.isArray(code) ? code.join('\n') : String(code);
        let highlighted = '';
        let langClass = language ? `language-${escapeHtml(language)}` : '';

        if (typeof hljs !== 'undefined') {
            try {
                if (language && hljs.getLanguage(language)) {
                    highlighted = hljs.highlight(rawCode, { language }).value;
                } else {
                    const autoResult = hljs.highlightAuto(rawCode);
                    highlighted = autoResult.value;
                    if (!langClass && autoResult.language) {
                        langClass = `language-${escapeHtml(autoResult.language)}`;
                    }
                }
            } catch (e) {
                console.warn('Highlight.js failed to highlight code block:', e);
                highlighted = escapeHtml(rawCode);
            }
        } else {
            highlighted = escapeHtml(rawCode);
        }

        return `
            <div class="code-container">
                <pre><code class="hljs ${langClass}">${highlighted}</code></pre>
            </div>
        `;
    }

    /**
     * Initializes or reloads the presentation by fetching slide data and the theme from the API.
     * Applies the theme and renders the current slide (clamped to valid bounds).
     * @param {boolean} [broadcastReload=false] - Whether to notify other synchronized windows to reload as well.
     */
    async function initialize(broadcastReload = false) {
        if (broadcastReload) {
            syncChannel.postMessage({ type: 'RELOAD' });
        }

        try {
            const response = await fetch('/api/slides');
            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                const errMsg = (errData && errData.error) || `HTTP error! status: ${response.status}`;
                throw new Error(errMsg);
            }

            const data = await response.json();
            slides = data.slides || [];
            theme = data.theme || {};
            metadata = data.metadata || {};

            applyTheme();

            if (slides.length > 0) {
                // Clamp currentSlide to valid bounds in case the deck was shortened or URL param is out of range
                const validIndex = Math.min(Math.max(0, currentSlide), slides.length - 1);
                renderSlide(validIndex, false);
                // Populate the print view in the background so images start preloading and native Cmd/Ctrl+P works
                preparePrintView();
            } else {
                slideContainer.innerHTML = '<div class="slide-content"><h1>No slides found</h1></div>';
            }

            if (metadata && metadata.title) {
                document.title = isSpeakerMode ? `[Notes] ${metadata.title}` : metadata.title;
            }
        } catch (error) {
            console.error('Error initializing presentation:', error);
            slideContainer.innerHTML = `<div class="slide-content"><h1>Error loading presentation</h1><p>${escapeHtml(error.message)}</p></div>`;
        }
    }

    /**
     * Applies visual theme settings (colors, fonts, sizes) as CSS Custom Properties on :root
     * and updates the footer text.
     */
    function applyTheme() {
        const rootStyle = document.documentElement.style;

        const themeMappings = {
            '--theme-bg-color': theme['bg-color'],
            '--theme-text-color': theme['text-color'],
            '--theme-link-color': theme['link-color'],
            '--theme-font-main': theme['font-main'],
            '--theme-text-font-size': theme['text-font-size'],
            '--theme-title-color': theme['title-color'],
            '--theme-title-font-size': theme['title-font-size'],
            '--theme-footer-font-size': theme['footer-font-size'],
            '--theme-footer-text-color': theme['footer-text-color']
        };

        Object.entries(themeMappings).forEach(([cssVar, value]) => {
            if (value) {
                rootStyle.setProperty(cssVar, value);
            } else {
                rootStyle.removeProperty(cssVar);
            }
        });

        // Fallback to metadata title if footer text is not explicitly set in the theme
        footer.textContent = theme['footer-text'] || (metadata && metadata.title) || '';
    }

    /**
     * Applies the appropriate background image (full-screen slide image or theme background)
     * to a target slide container element.
     * @param {HTMLElement} targetEl - The container element (#slide-container, .print-slide, or .preview-container).
     * @param {Object} slide - The slide object being rendered.
     */
    function applySlideBackground(targetEl, slide) {
        if (!targetEl || !slide) return;
        const data = slide.data || {};

        if (slide.template === 'image_full_screen') {
            const fsUrl = resolveAssetUrl(data.image_uri, 'https://picsum.photos/1920/1080');
            targetEl.classList.add('image-full-screen-mode');
            targetEl.style.backgroundImage = toCssUrl(fsUrl);
            targetEl.style.backgroundSize = 'contain';
            targetEl.style.backgroundPosition = 'center center';
            targetEl.style.backgroundRepeat = 'no-repeat';
        } else if (theme['background-image']) {
            const bgUrl = resolveAssetUrl(theme['background-image']);
            targetEl.classList.remove('image-full-screen-mode');
            targetEl.style.backgroundImage = toCssUrl(bgUrl);
            targetEl.style.backgroundSize = 'cover';
            targetEl.style.backgroundPosition = 'center center';
            targetEl.style.backgroundRepeat = 'no-repeat';
        } else {
            targetEl.classList.remove('image-full-screen-mode');
            targetEl.style.backgroundImage = 'none';
        }
    }

    /**
     * Generates the inner HTML and CSS class list for a specific slide object based on its template.
     * @param {Object} slide - The slide object containing `template` and `data`.
     * @returns {{ html: string, classList: string[], data: Object }}
     */
    function generateSlideHTML(slide) {
        const data = slide.data || {};
        let html = '';
        const classList = [];

        switch (slide.template) {
            case 'section_title':
                classList.push('section-title-slide');
                html = `
                    <h1>${parseInlineMarkdown(data.title)}</h1>
                    ${data.sentence ? `<div class="fun-sentence">${parseInlineMarkdown(data.sentence)}</div>` : ''}
                `;
                break;

            case 'quote_slide':
                classList.push('quote-slide');
                html = `
                    <div class="quote-text">${parseInlineMarkdown(data.quote)}</div>
                    ${data.attribution ? `<div class="quote-attribution">${parseInlineMarkdown(data.attribution)}</div>` : ''}
                `;
                break;

            case 'content_simple':
                classList.push('content-simple-slide');
                html = `
                    <h1>${parseInlineMarkdown(data.title)}</h1>
                    ${renderSentence(data.sentence)}
                    ${renderBullets(data.bullets)}
                `;
                break;

            case 'content_double': {
                classList.push('content-double-slide');
                const leftCol = data.column_left || {};
                const rightCol = data.column_right || {};
                html = `
                    <h1>${parseInlineMarkdown(data.title)}</h1>
                    <div class="columns-container">
                        <div class="column">
                            ${leftCol.sub_heading ? `<h2>${parseInlineMarkdown(leftCol.sub_heading)}</h2>` : ''}
                            ${renderSentence(leftCol.sentence)}
                            ${renderBullets(leftCol.bullets)}
                        </div>
                        <div class="column">
                            ${rightCol.sub_heading ? `<h2>${parseInlineMarkdown(rightCol.sub_heading)}</h2>` : ''}
                            ${renderSentence(rightCol.sentence)}
                            ${renderBullets(rightCol.bullets)}
                        </div>
                    </div>
                `;
                break;
            }

            case 'content_and_image': {
                classList.push('content-and-image-slide');
                const imagePosClass = data.image_position === 'left' ? 'image-left' : '';
                const imageUrl = resolveAssetUrl(data.image_uri, 'https://picsum.photos/800/800');
                const safeCssUrl = escapeHtml(toCssUrl(imageUrl));
                html = `
                    <div class="content-image-container ${imagePosClass}">
                        <div class="text-side">
                            <h1>${parseInlineMarkdown(data.title)}</h1>
                            ${renderSentence(data.sentence)}
                            ${renderBullets(data.bullets)}
                        </div>
                        <div class="image-side" style="background-image: ${safeCssUrl};">
                        </div>
                    </div>
                `;
                break;
            }

            case 'title_and_image': {
                classList.push('title-and-image-slide');
                const tiUrl = resolveAssetUrl(data.image_uri, 'https://picsum.photos/800/600');
                html = `
                    <h1>${parseInlineMarkdown(data.title)}</h1>
                    <div class="centered-image-container">
                        <img src="${escapeHtml(tiUrl)}" alt="${escapeHtml(data.title || 'Slide Image')}" />
                    </div>
                `;
                break;
            }

            case 'title_and_code':
                classList.push('title-and-code-slide');
                html = `
                    <h1>${parseInlineMarkdown(data.title)}</h1>
                    ${renderSentence(data.sentence)}
                    ${renderCodeBlock(data.code, data.language)}
                `;
                break;

            case 'image_full_screen':
                classList.push('image-full-screen-content');
                break;

            default:
                html = `<h1>Unknown template: ${escapeHtml(slide.template)}</h1>`;
                break;
        }

        return { html, classList, data };
    }

    /**
     * Dynamically scales the speaker mode mini-previews to fit their containers
     * while preserving a 16:9 (1920x1080) reference aspect ratio, and keeps any custom
     * notes area height clamped within the current window height.
     */
    function resizePreviews() {
        if (!isSpeakerMode) return;

        if (speakerNotesHeight !== null) {
            const notesArea = document.querySelector('.speaker-notes-area');
            if (notesArea) {
                const maxAllowed = Math.max(50, window.innerHeight - 150);
                speakerNotesHeight = Math.min(Math.max(50, speakerNotesHeight), maxAllowed);
                notesArea.style.flex = 'none';
                notesArea.style.height = `${speakerNotesHeight}px`;
            }
        }

        const containers = document.querySelectorAll('.preview-container');
        containers.forEach(container => {
            const previewContent = container.querySelector('.mini-preview-content');
            if (previewContent) {
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;

                const scaleX = containerWidth / 1920;
                const scaleY = containerHeight / 1080;
                const scale = Math.min(scaleX, scaleY);

                previewContent.style.setProperty('--preview-scale', scale);
            }
        });
    }

    /**
     * Updates the `?slide=` URL query parameter without reloading the page so refreshes preserve position.
     * @param {number} index - The current 0-based slide index.
     */
    function syncUrlSlideParam(index) {
        const url = new URL(window.location.href);
        url.searchParams.set('slide', index);
        window.history.replaceState(null, '', url.toString());
    }

    /**
     * Ensures the speaker mode DOM skeleton is constructed once inside `#slide-container`
     * so navigating between slides only updates the dynamic sub-elements.
     */
    function ensureSpeakerLayout() {
        if (slideContainer.querySelector('.speaker-notes-container')) {
            return;
        }

        slideContainer.innerHTML = '';
        slideContainer.classList.remove('image-full-screen-mode');
        slideContainer.style.backgroundImage = 'none';
        footer.style.display = 'none';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'slide-content speaker-notes-container';

        const notesHeightStyle = speakerNotesHeight !== null
            ? `flex: none; height: ${speakerNotesHeight}px;`
            : '';

        contentDiv.innerHTML = `
            <div class="speaker-notes-area" style="${notesHeightStyle}">
                <div class="speaker-meta"></div>
                <div class="speaker-notes-content" style="font-size: ${speakerFontSize}em"></div>
            </div>
            <div class="speaker-resizer"></div>
            <div class="speaker-preview-area">
                <div class="preview-box">
                    <div class="preview-label">Current</div>
                    <div class="preview-container" id="preview-current"></div>
                </div>
                <div class="preview-box">
                    <div class="preview-label">Next</div>
                    <div class="preview-container" id="preview-next"></div>
                </div>
            </div>
        `;
        slideContainer.appendChild(contentDiv);
        setupResizer();
    }

    /**
     * Renders a specific slide based on its index in the slides array.
     * @param {number} index - The index of the slide to render.
     * @param {boolean} broadcast - Whether to broadcast this slide change to other synchronized windows.
     */
    function renderSlide(index, broadcast = true) {
        if (index < 0 || index >= slides.length) {
            return;
        }

        currentSlide = index;
        const slide = slides[index];
        const data = slide.data || {};

        syncUrlSlideParam(currentSlide);

        if (broadcast) {
            syncChannel.postMessage({ type: 'SLIDE_CHANGE', index: currentSlide });
        }

        if (isSpeakerMode) {
            ensureSpeakerLayout();

            const metaEl = slideContainer.querySelector('.speaker-meta');
            if (metaEl) {
                metaEl.textContent = `Slide ${index + 1} of ${slides.length}`;
            }

            // Populate speaker notes
            const notesContent = data.speaker_notes || '';
            const notesHtml = notesContent
                ? parseBlockMarkdown(notesContent)
                : '<p><em>No notes for this slide.</em></p>';

            const notesContentEl = slideContainer.querySelector('.speaker-notes-content');
            if (notesContentEl) {
                notesContentEl.style.fontSize = `${speakerFontSize}em`;
                notesContentEl.innerHTML = notesHtml;
            }

            // Populate current and next slide mini-previews
            const currentPreviewEl = document.getElementById('preview-current');
            const nextPreviewEl = document.getElementById('preview-next');
            renderMiniPreview(index, currentPreviewEl);
            if (index + 1 < slides.length) {
                renderMiniPreview(index + 1, nextPreviewEl);
            } else if (nextPreviewEl) {
                nextPreviewEl.classList.remove('image-full-screen-mode');
                nextPreviewEl.style.backgroundImage = 'none';
                nextPreviewEl.innerHTML = '<div class="end-of-presentation-preview">End of Presentation</div>';
            }

            setTimeout(resizePreviews, 0);
            return;
        }

        // Clear previous slide content in normal presentation mode
        slideContainer.innerHTML = '';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'slide-content';

        // Normal presentation mode
        applySlideBackground(slideContainer, slide);
        footer.style.display = slide.template === 'image_full_screen' ? 'none' : 'block';

        const generated = generateSlideHTML(slide);
        contentDiv.classList.add(...generated.classList);
        contentDiv.innerHTML = generated.html;
        slideContainer.appendChild(contentDiv);
    }

    /**
     * Preloads and decodes a single image URL so it is ready in the browser cache for printing.
     * @param {string} url - The resolved image URL to preload.
     * @returns {Promise<void>}
     */
    function preloadImageUrl(url) {
        if (!url) return Promise.resolve();
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                if (typeof img.decode === 'function') {
                    img.decode().catch(() => {}).finally(resolve);
                } else {
                    resolve();
                }
            };
            img.onerror = () => resolve();
            img.src = url;
        });
    }

    /**
     * Renders all slides into the print container and preloads all slide/theme images
     * so they are fully decoded before the browser generates the print preview or PDF.
     * @returns {Promise<void>}
     */
    async function preparePrintView() {
        if (!printContainer) return;

        printContainer.innerHTML = '';
        const imageUrlsToPreload = new Set();

        if (theme['background-image']) {
            imageUrlsToPreload.add(resolveAssetUrl(theme['background-image']));
        }

        slides.forEach((slide) => {
            const slideDiv = document.createElement('div');
            slideDiv.className = 'print-slide';

            applySlideBackground(slideDiv, slide);

            const data = slide.data || {};
            if (slide.template === 'image_full_screen') {
                imageUrlsToPreload.add(resolveAssetUrl(data.image_uri, 'https://picsum.photos/1920/1080'));
            } else if (slide.template === 'content_and_image') {
                imageUrlsToPreload.add(resolveAssetUrl(data.image_uri, 'https://picsum.photos/800/800'));
            } else if (slide.template === 'title_and_image') {
                imageUrlsToPreload.add(resolveAssetUrl(data.image_uri, 'https://picsum.photos/800/600'));
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'slide-content';

            const generated = generateSlideHTML(slide);
            contentDiv.classList.add(...generated.classList);
            contentDiv.innerHTML = generated.html;
            slideDiv.appendChild(contentDiv);

            // Add footer to each printed slide except full-screen images
            if (slide.template !== 'image_full_screen') {
                const slideFooter = document.createElement('div');
                slideFooter.className = 'print-footer';
                slideFooter.textContent = footer.textContent;
                slideDiv.appendChild(slideFooter);
            }

            printContainer.appendChild(slideDiv);
        });

        // Wait for all <img> elements in #print-container and all background-image URLs to load and decode
        const domImgPromises = Array.from(printContainer.querySelectorAll('img')).map((img) => {
            if (img.complete && img.naturalWidth > 0) {
                return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
            }
            return new Promise((resolve) => {
                img.addEventListener('load', () => {
                    if (typeof img.decode === 'function') {
                        img.decode().catch(() => {}).finally(resolve);
                    } else {
                        resolve();
                    }
                }, { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
            });
        });

        const bgPreloadPromises = Array.from(imageUrlsToPreload).map(preloadImageUrl);
        await Promise.all([...domImgPromises, ...bgPreloadPromises]);
    }

    /**
     * Navigates the presentation forwards or backwards by a given offset.
     * @param {number} direction - Slide offset (+1 for next, -1 for previous).
     */
    function navigate(direction) {
        const newIndex = currentSlide + direction;
        if (newIndex >= 0 && newIndex < slides.length) {
            renderSlide(newIndex);
        }
    }

    /**
     * Prompts the user to jump directly to a specific 1-based slide number.
     */
    function jumpToSlide() {
        const slideNumberStr = prompt('Jump to slide number:');
        if (slideNumberStr) {
            const slideNumber = parseInt(slideNumberStr, 10);
            if (!isNaN(slideNumber) && slideNumber > 0 && slideNumber <= slides.length) {
                renderSlide(slideNumber - 1);
            } else {
                alert('Invalid slide number.');
            }
        }
    }

    // --- Event Listeners ---
    window.addEventListener('resize', resizePreviews);

    // Ensure print container is populated if the user prints via native browser menu / Cmd+P
    window.addEventListener('beforeprint', () => {
        if (printContainer && printContainer.children.length === 0 && slides.length > 0) {
            preparePrintView();
        }
    });

    // Close help overlay when clicking its dark backdrop outside the help content box
    helpOverlay.addEventListener('click', (e) => {
        if (e.target === helpOverlay) {
            helpOverlay.classList.add('hidden');
        }
    });

    document.addEventListener('keydown', async (e) => {
        // Ignore shortcuts when modifier keys are held (e.g., Cmd/Ctrl+R, Cmd/Ctrl+P, Cmd/Ctrl+A)
        if (e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }

        if (
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable
        ) {
            return;
        }

        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const isHelpOpen = !helpOverlay.classList.contains('hidden');

        // When the help overlay is visible, block background navigation and only allow closing it
        if (isHelpOpen) {
            if (key === 'Escape' || key === 'h') {
                e.preventDefault();
                helpOverlay.classList.add('hidden');
            }
            return;
        }

        switch (key) {
            case 'ArrowRight':
            case 'ArrowDown':
            case 'PageDown':
            case 'd':
            case ' ':
                e.preventDefault();
                navigate(1);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'PageUp':
            case 'a':
                e.preventDefault();
                navigate(-1);
                break;
            case 'g':
                jumpToSlide();
                break;
            case 'r':
                initialize(true);
                break;
            case 's':
                if (!isSpeakerMode) {
                    window.open(`${window.location.pathname}?mode=speaker&slide=${currentSlide}`, 'SpeakerNotes', 'width=800,height=600');
                }
                break;
            case 'h':
                helpOverlay.classList.toggle('hidden');
                break;
            case 'p':
                await preparePrintView();
                window.print();
                break;
            case 'Escape':
                helpOverlay.classList.add('hidden');
                break;
        }
    });

    document.addEventListener('click', (e) => {
        if (blockClick) return; // Prevent accidental navigation immediately after resizing
        if (!helpOverlay.classList.contains('hidden')) return; // Block background clicks while help is open

        // Do not advance slides if the user just finished selecting text (e.g. copying code or notes)
        const selection = window.getSelection ? window.getSelection() : null;
        if (selection && selection.toString().trim().length > 0) {
            return;
        }

        const topBar = document.querySelector('.speaker-top-bar');
        const resizer = document.querySelector('.speaker-resizer');
        const previewArea = document.querySelector('.speaker-preview-area');

        if (
            e.target.closest('a') ||
            helpOverlay.contains(e.target) ||
            (topBar && topBar.contains(e.target)) ||
            (resizer && resizer.contains(e.target)) ||
            (previewArea && previewArea.contains(e.target))
        ) {
            return;
        }

        // In speaker mode, restrict click-to-advance to the notes area
        if (isSpeakerMode) {
            const notesArea = document.querySelector('.speaker-notes-area');
            if (notesArea && notesArea.contains(e.target)) {
                navigate(1);
            }
            return;
        }

        navigate(1);
    });

    document.addEventListener('contextmenu', (e) => {
        if (!helpOverlay.classList.contains('hidden')) return;
        e.preventDefault();
        jumpToSlide();
    });

    /**
     * Renders a scaled-down preview of a slide into a speaker mode preview container.
     * @param {number} index - Slide index to preview.
     * @param {HTMLElement} container - Target `.preview-container` element.
     */
    function renderMiniPreview(index, container) {
        if (!container) return;
        const slide = slides[index];
        if (!slide) return;

        container.innerHTML = '';
        applySlideBackground(container, slide);

        const generated = generateSlideHTML(slide);
        const contentDiv = document.createElement('div');
        contentDiv.className = `slide-content mini-preview-content ${generated.classList.join(' ')}`;

        if (slide.template !== 'image_full_screen') {
            contentDiv.innerHTML = generated.html;
        }

        container.appendChild(contentDiv);
    }

    let startY;
    let startNotesHeight;

    /**
     * Attaches drag-to-resize behavior to the speaker mode divider.
     */
    function setupResizer() {
        const resizer = document.querySelector('.speaker-resizer');
        if (!resizer) return;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            const notesArea = document.querySelector('.speaker-notes-area');
            startNotesHeight = notesArea.getBoundingClientRect().height;
            document.body.classList.add('resizing-active');

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    }

    function handleMouseMove(e) {
        if (!isResizing) return;
        const notesArea = document.querySelector('.speaker-notes-area');
        const previewArea = document.querySelector('.speaker-preview-area');
        if (!notesArea || !previewArea) return;

        const dy = e.clientY - startY;
        const newHeight = startNotesHeight + dy;

        // Enforce minimum height constraints for both notes and preview areas
        if (newHeight > 50 && newHeight < window.innerHeight - 150) {
            speakerNotesHeight = newHeight;
            notesArea.style.flex = 'none';
            notesArea.style.height = `${newHeight}px`;
            resizePreviews();
        }
    }

    function handleMouseUp() {
        if (!isResizing) return;
        isResizing = false;

        // Block navigation clicks briefly after releasing the resizer
        blockClick = true;
        setTimeout(() => {
            blockClick = false;
        }, 100);

        document.body.classList.remove('resizing-active');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    initialize();
});
