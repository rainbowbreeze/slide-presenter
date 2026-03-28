document.addEventListener('DOMContentLoaded', () => {
    // State variables for the presentation
    let slides = [];
    let template = {};
    let metadata = {};
    let currentSlide = 0;
    let speakerFontSize = 2.5; // Default font size for speaker notes

    // Detect speaker mode
    const urlParams = new URLSearchParams(window.location.search);
    const isSpeakerMode = urlParams.get('mode') === 'speaker';

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
     * Initializes the presentation by fetching slide data and the template from the API.
     * Applies the template and renders the initial slide.
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
            template = data.template;
            metadata = data.metadata;

            // Apply the visual theme and render the current slide
            applyTemplate();
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
     * Applies the visual template settings (colors, fonts) fetched from the backend 
     * to the corresponding DOM elements.
     */
    function applyTemplate() {
        // Only apply background colors if not in speaker mode, or let speaker mode override via CSS
        if (!isSpeakerMode) {
            if (template['bg-color']) document.body.style.backgroundColor = template['bg-color'];
            if (template['text-color']) document.body.style.color = template['text-color'];
        }
        if (template['font-main']) document.body.style.fontFamily = template['font-main'];
        
        // Configure the footer styling based on the template
        if (template['footer-font-size']) footer.style.fontSize = template['footer-font-size'];
        if (template['footer-text-color']) footer.style.color = template['footer-text-color'];
        
        // Fallback to metadata title if footer text is not set
        footer.textContent = template['footer-text'] || (metadata && metadata.title) || '';
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
        slideContainer.style.backgroundImage = 'none';
        slideContainer.classList.remove('image-full-screen-mode');
        
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
            contentDiv.querySelector('.speaker-notes-content').innerHTML = notesHtml;
            
            // Populate Previews
            renderMiniPreview(index, document.getElementById('preview-current'));
            if (index + 1 < slides.length) {
                renderMiniPreview(index + 1, document.getElementById('preview-next'));
            } else {
                document.getElementById('preview-next').innerHTML = '<div class="end-of-presentation-preview">End of Presentation</div>';
            }
            
            setupResizer();
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
        } else if (slide.template === 'section_title') {
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
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
            case 'd':
            case ' ':
                navigate(1);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
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
                    window.open(window.location.pathname + '?mode=speaker', 'SpeakerNotes', 'width=800,height=600');
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
        // Find the top bar if it exists
        const topBar = document.querySelector('.speaker-top-bar');
        
        if (e.target.tagName === 'A' || helpOverlay.contains(e.target) || (topBar && topBar.contains(e.target))) {
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
        } else {
            contentDiv.innerHTML = generated.html;
        }
        
        container.appendChild(contentDiv);
        
        // Apply theme to the mini preview container to simulate full slide
        container.style.backgroundColor = template['bg-color'] || '#fff';
        container.style.color = template['text-color'] || '#000';
        container.style.fontFamily = template['font-main'] || 'sans-serif';
    }

    let isResizing = false;
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
        }
    }
    
    function handleMouseUp() {
        if (!isResizing) return;
        isResizing = false;
        document.body.classList.remove('resizing-active');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    initialize();
});
