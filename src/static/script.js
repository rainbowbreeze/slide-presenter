document.addEventListener('DOMContentLoaded', () => {
    // Detect speaker mode and initial slide from URL
    const urlParams = new URLSearchParams(window.location.search);
    const isSpeakerMode = urlParams.get('mode') === 'speaker';
    const initialSlide = parseInt(urlParams.get('slide'), 10) || 0;

    // State variables for the presentation
    let slides = [];
    let theme = {};
    let metadata = {};
    let currentSlide = initialSlide;
    let speakerFontSize = 2.5; // Default font size for speaker notes
    let isResizing = false; // Flag for resizing state
    let blockClick = false; // Flag to temporarily block navigation clicks

    // Set up synchronization channel
    const syncChannel = new BroadcastChannel('slide-sync');
    syncChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'SLIDE_CHANGE') {
            const newIndex = event.data.index;
            if (newIndex !== currentSlide) {
                renderSlide(newIndex, false); // Pass false to prevent infinite broadcast loop
            }
        }
    };

    // DOM Elements
    const slideContainer = document.getElementById('slide-container');
    const footer = document.getElementById('footer');
    const helpOverlay = document.getElementById('help-overlay');

    if (isSpeakerMode) {
        document.body.classList.add('speaker-mode-active');
        
        // Inject top bar
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
                content.style.fontSize = speakerFontSize + 'em';
            }
        }

        // Timer controls
        let startTime = Date.now();
        setInterval(updateTimer, 1000);
        
        function updateTimer() {
            const now = Date.now();
            const diff = Math.floor((now - startTime) / 1000);
            const h = String(Math.floor(diff / 3600)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
            const s = String(diff % 60).padStart(2, '0');
            document.getElementById('speaker-timer').textContent = `${h}:${m}:${s}`;
        }
        
        document.getElementById('btn-timer-reset').addEventListener('click', () => {
            startTime = Date.now();
            updateTimer();
            // Don't focus the button so spacebar navigation still works
            document.getElementById('btn-timer-reset').blur();
        });
    }

    /**
     * Initializes the presentation by fetching slide data and the theme from the API.
     * Applies the theme and renders the initial slide.
     */
    async function initialize() {
        try {
            // Fetch the presentation data from the backend API
            const response = await fetch('/api/slides');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Parse the JSON response
            const data = await response.json();
            slides = data.slides;
            theme = data.theme;
            metadata = data.metadata;

            // Apply the visual theme and render the current slide
            applyTheme();
            renderSlide(currentSlide);
            
            // Update document title if metadata has a title
            if (metadata && metadata.title) {
                document.title = isSpeakerMode ? `[Notes] ${metadata.title}` : metadata.title;
            }
        } catch (error) {
            console.error("Error initializing presentation:", error);
            // Display a user-friendly error message if loading fails
            slideContainer.innerHTML = `<div class="slide-content"><h1>Error loading presentation</h1><p>${error.message}</p></div>`;
        }
    }

    /**
     * Applies the visual theme settings (colors, fonts) fetched from the backend 
     * to the corresponding DOM elements.
     */
    function applyTheme() {
        // Only apply background colors if not in speaker mode, or let speaker mode override via CSS
        if (!isSpeakerMode) {
            if (theme['bg-color']) document.body.style.backgroundColor = theme['bg-color'];
            if (theme['text-color']) document.body.style.color = theme['text-color'];
        }
        if (theme['font-main']) document.body.style.fontFamily = theme['font-main'];
        
        // Apply general text size if provided
        if (theme['text-font-size']) document.body.style.fontSize = theme['text-font-size'];
        
        // Configure the footer styling based on the theme
        if (theme['footer-font-size']) footer.style.fontSize = theme['footer-font-size'];
        if (theme['footer-text-color']) footer.style.color = theme['footer-text-color'];
        
        // Fallback to metadata title if footer text is not set
        footer.textContent = theme['footer-text'] || (metadata && metadata.title) || '';

        // Inject dynamic styles for elements that need specific theme properties
        let dynamicStyles = document.getElementById('dynamic-theme-styles');
        if (!dynamicStyles) {
            dynamicStyles = document.createElement('style');
            dynamicStyles.id = 'dynamic-theme-styles';
            document.head.appendChild(dynamicStyles);
        }
        
        let styleContent = '';
        if (theme['title-color']) {
            styleContent += `h1, h2, h3 { color: ${theme['title-color']} !important; } `;
        }
        if (theme['title-font-size']) {
            styleContent += `.slide-content h1 { font-size: ${theme['title-font-size']} !important; } `;
        }
        dynamicStyles.textContent = styleContent;
    }

    /**
     * Helper to render an array of bullets.
     */
    function renderBullets(bullets) {
        if (!bullets || bullets.length === 0) return '';
        let html = '<ul>';
        bullets.forEach(bullet => {
            // If marked.js is available, we can parse inline markdown
            let content = typeof marked !== 'undefined' ? marked.parseInline(bullet) : bullet;
            html += `<li>${content}</li>`;
        });
        html += '</ul>';
        return html;
    }

    /**
     * Generates the inner HTML for a specific slide data object based on its template.
     */
    function generateSlideHTML(slide) {
        const data = slide.data || {};
        let html = '';
        let classList = [];
        
        switch (slide.template) {
            case 'section_title':
                classList.push('section-title-slide');
                html = `
                    <h1>${data.title || ''}</h1>
                    ${data.sentence ? `<div class="fun-sentence">${data.sentence}</div>` : ''}
                `;
                break;
                
            case 'quote_slide':
                classList.push('quote-slide');
                html = `
                    <div class="quote-text">${data.quote || ''}</div>
                    ${data.attribution ? `<div class="quote-attribution">${data.attribution}</div>` : ''}
                `;
                break;
                
            case 'content_simple':
                classList.push('content-simple-slide');
                html = `
                    <h1>${data.title || ''}</h1>
                    ${renderBullets(data.bullets)}
                `;
                break;
                
            case 'content_double':
                classList.push('content-double-slide');
                let leftCol = data.column_left || {};
                let rightCol = data.column_right || {};
                html = `
                    <h1>${data.title || ''}</h1>
                    <div class="columns-container">
                        <div class="column">
                            ${leftCol.sub_heading ? `<h2>${leftCol.sub_heading}</h2>` : ''}
                            ${renderBullets(leftCol.bullets)}
                        </div>
                        <div class="column">
                            ${rightCol.sub_heading ? `<h2>${rightCol.sub_heading}</h2>` : ''}
                            ${renderBullets(rightCol.bullets)}
                        </div>
                    </div>
                `;
                break;
                
            case 'content_and_image':
                classList.push('content-and-image-slide');
                let imagePosClass = data.image_position === 'left' ? 'image-left' : '';
                let imageUri = data.image_uri || 'https://picsum.photos/800/800'; 
                let imageUrl = imageUri.startsWith('http://') || imageUri.startsWith('https://') 
                    ? imageUri 
                    : `/slides/${imageUri}`;
                html = `
                    <div class="content-image-container ${imagePosClass}">
                        <div class="text-side">
                            <h1>${data.title || ''}</h1>
                            ${renderBullets(data.bullets)}
                        </div>
                        <div class="image-side" style="background-image: url('${imageUrl}');">
                        </div>
                    </div>
                `;
                break;
                
            case 'title_and_image':
                classList.push('title-and-image-slide');
                let tiUri = data.image_uri || 'https://picsum.photos/800/600'; 
                let tiUrl = tiUri.startsWith('http://') || tiUri.startsWith('https://') 
                    ? tiUri 
                    : `/slides/${tiUri}`;
                html = `
                    <h1>${data.title || ''}</h1>
                    <div class="centered-image-container">
                        <img src="${tiUrl}" alt="${data.title || 'Slide Image'}" />
                    </div>
                `;
                break;
                
            case 'image_full_screen':
                classList.push('image-full-screen-content'); // Just a placeholder class, styling is handled on container usually
                break;
                
            default:
                html = `<h1>Unknown template: ${slide.template}</h1>`;
                break;
        }
        
        return { html, classList, data };
    }

    /**
     * Dynamically scales the mini-previews to fit their containers.
     */
    function resizePreviews() {
        if (!isSpeakerMode) return;
        
        const containers = document.querySelectorAll('.preview-container');
        containers.forEach(container => {
            const previewContent = container.querySelector('.mini-preview-content');
            if (previewContent) {
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;
                
                // Calculate the scale to fit while maintaining 16:9 aspect ratio
                // using 1920x1080 as the reference resolution.
                const scaleX = containerWidth / 1920;
                const scaleY = containerHeight / 1080;
                const scale = Math.min(scaleX, scaleY);
                
                previewContent.style.setProperty('--preview-scale', scale);
            }
        });
    }

    /**
     * Renders a specific slide based on its index in the slides array.
     * @param {number} index - The index of the slide to render.
     * @param {boolean} broadcast - Whether to broadcast this slide change to other windows.
     */
    function renderSlide(index, broadcast = true) {
        // Ensure the requested index is within bounds
        if (index < 0 || index >= slides.length) {
            return;
        }
        
        // Update the current slide state
        currentSlide = index;
        const slide = slides[index];
        const data = slide.data || {};
        
        if (broadcast) {
            syncChannel.postMessage({ type: 'SLIDE_CHANGE', index: currentSlide });
        }

        // Clear previous slide content and background styles
        slideContainer.innerHTML = '';
        slideContainer.classList.remove('image-full-screen-mode');

        // Apply theme's background image if present, except for image_full_screen or speaker mode
        if (theme['background-image'] && slide.template !== 'image_full_screen' && !isSpeakerMode) {
            const bgUri = theme['background-image'];
            const bgUrl = bgUri.startsWith('http://') || bgUri.startsWith('https://') 
                ? bgUri 
                : `/slides/${bgUri}`;
            slideContainer.style.backgroundImage = `url('${bgUrl}')`;
            slideContainer.style.backgroundSize = 'cover';
            slideContainer.style.backgroundPosition = 'center center';
            slideContainer.style.backgroundRepeat = 'no-repeat';
        } else {
            slideContainer.style.backgroundImage = 'none';
        }
        
        // Ensure the footer is displayed by default (will be hidden in speaker mode or on some slide types)
        footer.style.display = 'block';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'slide-content';

        if (isSpeakerMode) {
            footer.style.display = 'none';
            contentDiv.classList.add('speaker-notes-container');
            
            // Layout structure for speaker mode
            contentDiv.innerHTML = `
                <div class="speaker-notes-area">
                    <div class="speaker-meta">Slide ${index + 1} of ${slides.length}</div>
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
            
            // Populate Notes
            let notesContent = data.speaker_notes || '';
            let notesHtml = notesContent 
                ? (typeof marked !== 'undefined' ? marked.parse(notesContent) : notesContent) 
                : '<p><em>No notes for this slide.</em></p>';
            
            const notesContentEl = contentDiv.querySelector('.speaker-notes-content');
            if (notesContentEl) {
                notesContentEl.innerHTML = notesHtml;
            }
            
            // Populate Previews
            renderMiniPreview(index, document.getElementById('preview-current'));
            if (index + 1 < slides.length) {
                renderMiniPreview(index + 1, document.getElementById('preview-next'));
            } else {
                document.getElementById('preview-next').innerHTML = '<div class="end-of-presentation-preview">End of Presentation</div>';
            }
            
            setupResizer();
            // Ensure previews are scaled correctly after they are added to the DOM
            setTimeout(resizePreviews, 0);
            return;
        }

        const generated = generateSlideHTML(slide);
        
        if (slide.template === 'image_full_screen') {
            // Apply background to slideContainer directly
            let fsUri = generated.data.image_uri || 'https://picsum.photos/1920/1080';
            let fsUrl = fsUri.startsWith('http://') || fsUri.startsWith('https://') ? fsUri : `/slides/${fsUri}`;
            slideContainer.classList.add('image-full-screen-mode');
            slideContainer.style.backgroundImage = `url('${fsUrl}')`;
            slideContainer.style.backgroundSize = 'contain';
            slideContainer.style.backgroundPosition = 'center center';
            slideContainer.style.backgroundRepeat = 'no-repeat';
            footer.style.display = 'none';
        }

        contentDiv.classList.add(...generated.classList);
        contentDiv.innerHTML = generated.html;
        slideContainer.appendChild(contentDiv);
    }

    /**
     * Navigates the presentation forwards or backwards by a given offset.
     */
    function navigate(direction) {
        const newIndex = currentSlide + direction;
        if (newIndex >= 0 && newIndex < slides.length) {
            renderSlide(newIndex); // This broadcasts naturally
        }
    }

    /**
     * Prompts the user to jump directly to a specific slide number.
     */
    function jumpToSlide() {
        const slideNumberStr = prompt('Jump to slide number:');
        if (slideNumberStr) {
            const slideNumber = parseInt(slideNumberStr, 10);
            if (!isNaN(slideNumber) && slideNumber > 0 && slideNumber <= slides.length) {
                renderSlide(slideNumber - 1); // This broadcasts naturally
            } else {
                alert('Invalid slide number.');
            }
        }
    }

    // --- Event Listeners ---
    window.addEventListener('resize', resizePreviews);

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
            case 'PageDown':
            case 'd':
            case ' ':
                navigate(1);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'PageUp':
            case 'a':
                navigate(-1);
                break;
            case 'g':
                jumpToSlide();
                break;
            case 'r':
                initialize();
                break;
            case 's':
                if (!isSpeakerMode) {
                    window.open(window.location.pathname + `?mode=speaker&slide=${currentSlide}`, 'SpeakerNotes', 'width=800,height=600');
                }
                break;
            case 'h':
                helpOverlay.classList.remove('hidden');
                break;
            case 'Escape':
                helpOverlay.classList.add('hidden');
                break;
        }
    });

    document.addEventListener('click', (e) => {
        if (blockClick) return; // Prevent navigation if we just finished a resize
        
        // Find speaker-specific elements to ignore
        const topBar = document.querySelector('.speaker-top-bar');
        const resizer = document.querySelector('.speaker-resizer');
        const previewArea = document.querySelector('.speaker-preview-area');
        
        if (e.target.tagName === 'A' || 
            helpOverlay.contains(e.target) || 
            (topBar && topBar.contains(e.target)) ||
            (resizer && resizer.contains(e.target)) ||
            (previewArea && previewArea.contains(e.target))) {
            return;
        }

        // In speaker mode, clicking the body outside specific areas shouldn't necessarily navigate
        // unless it's explicitly intended. Let's restrict it to the notes area for better control.
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
        e.preventDefault();
        jumpToSlide();
    });

    function renderMiniPreview(index, container) {
        if (!container) return;
        const slide = slides[index];
        if (!slide) return;
        
        container.innerHTML = '';
        const generated = generateSlideHTML(slide);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'slide-content mini-preview-content ' + generated.classList.join(' ');
        
        if (slide.template === 'image_full_screen') {
            let fsUri = generated.data.image_uri || 'https://picsum.photos/1920/1080';
            let fsUrl = fsUri.startsWith('http://') || fsUri.startsWith('https://') ? fsUri : `/slides/${fsUri}`;
            contentDiv.style.backgroundImage = `url('${fsUrl}')`;
            contentDiv.style.backgroundSize = 'contain';
            contentDiv.style.backgroundPosition = 'center center';
            contentDiv.style.backgroundRepeat = 'no-repeat';
            
            // Clear container background for full screen image
            container.style.backgroundImage = 'none';
        } else {
            contentDiv.innerHTML = generated.html;

            // Apply theme's background image if present
            if (theme['background-image']) {
                const bgUri = theme['background-image'];
                const bgUrl = bgUri.startsWith('http://') || bgUri.startsWith('https://') 
                    ? bgUri 
                    : `/slides/${bgUri}`;
                container.style.backgroundImage = `url('${bgUrl}')`;
                container.style.backgroundSize = 'cover';
                container.style.backgroundPosition = 'center center';
                container.style.backgroundRepeat = 'no-repeat';
            } else {
                container.style.backgroundImage = 'none';
            }
        }
        
        container.appendChild(contentDiv);
        
        // Apply theme to the mini preview container to simulate full slide
        container.style.backgroundColor = theme['bg-color'] || '#fff';
        container.style.color = theme['text-color'] || '#000';
        container.style.fontFamily = theme['font-main'] || 'sans-serif';
    }

    let startY, startNotesHeight;

    function setupResizer() {
        const resizer = document.querySelector('.speaker-resizer');
        if (!resizer) return;
        
        resizer.addEventListener('mousedown', function(e) {
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
        
        // Min height constraints
        if (newHeight > 50 && newHeight < window.innerHeight - 150) {
            notesArea.style.flex = 'none';
            notesArea.style.height = `${newHeight}px`;
            resizePreviews(); // Recalculate preview scaling during resize
        }
    }

    function handleMouseUp() {
        if (!isResizing) return;
        isResizing = false;
        
        // Set blockClick to true for a short duration to prevent the subsequent 
        // 'click' event from triggering navigation.
        blockClick = true;
        setTimeout(() => { blockClick = false; }, 100);

        document.body.classList.remove('resizing-active');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    initialize();
});
