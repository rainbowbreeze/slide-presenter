document.addEventListener('DOMContentLoaded', () => {
    // State variables for the presentation
    let slides = [];
    let template = {};
    let metadata = {};
    let currentSlide = 0;

    // DOM Elements
    const slideContainer = document.getElementById('slide-container');
    const footer = document.getElementById('footer');
    const helpOverlay = document.getElementById('help-overlay');

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
                document.title = metadata.title;
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
        if (template['bg-color']) document.body.style.backgroundColor = template['bg-color'];
        if (template['text-color']) document.body.style.color = template['text-color'];
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
     * Renders a specific slide based on its index in the slides array.
     * @param {number} index - The index of the slide to render.
     */
    function renderSlide(index) {
        // Ensure the requested index is within bounds
        if (index < 0 || index >= slides.length) {
            return;
        }
        
        // Update the current slide state
        currentSlide = index;
        const slide = slides[index];
        const data = slide.data || {};
        
        // Clear previous slide content and background styles
        slideContainer.innerHTML = '';
        slideContainer.style.backgroundImage = 'none';
        
        // Ensure the footer is displayed by default
        footer.style.display = 'block';

        // Create a new container for the content of the current slide
        const contentDiv = document.createElement('div');
        contentDiv.className = 'slide-content';

        // Render content differently based on the slide's designated template
        switch (slide.template) {
            case 'section_title':
                contentDiv.classList.add('section-title-slide');
                contentDiv.innerHTML = `
                    <h1>${data.title || ''}</h1>
                    ${data.fun_sentence ? `<div class="fun-sentence">${data.fun_sentence}</div>` : ''}
                `;
                footer.style.display = 'none'; // Usually hide footer on section slides
                break;
                
            case 'quote_slide':
                contentDiv.classList.add('quote-slide');
                contentDiv.innerHTML = `
                    <div class="quote-text">${data.quote || ''}</div>
                    ${data.attribution ? `<div class="quote-attribution">${data.attribution}</div>` : ''}
                `;
                break;
                
            case 'content_simple':
                contentDiv.classList.add('content-simple-slide');
                contentDiv.innerHTML = `
                    <h1>${data.title || ''}</h1>
                    ${renderBullets(data.bullets)}
                `;
                break;
                
            case 'content_double':
                contentDiv.classList.add('content-double-slide');
                let leftCol = data.column_left || {};
                let rightCol = data.column_right || {};
                contentDiv.innerHTML = `
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
                contentDiv.classList.add('content-and-image-slide');
                
                // Check image position, default to right
                let imagePosClass = data.image_position === 'left' ? 'image-left' : '';
                
                let imageUri = data.image_uri || 'https://picsum.photos/800/800'; 
                let imageUrl = imageUri.startsWith('http://') || imageUri.startsWith('https://') 
                    ? imageUri 
                    : `/slides/${imageUri}`;
                
                contentDiv.innerHTML = `
                    <h1>${data.title || ''}</h1>
                    <div class="content-image-container ${imagePosClass}">
                        <div class="text-side">
                            ${renderBullets(data.bullets)}
                        </div>
                        <div class="image-side" style="background-image: url('${imageUrl}');">
                            <!-- Image represented via background -->
                        </div>
                    </div>
                `;
                break;
                
            default:
                contentDiv.innerHTML = `<h1>Unknown template: ${slide.template}</h1>`;
                break;
        }
        
        slideContainer.appendChild(contentDiv);
    }

    /**
     * Navigates the presentation forwards or backwards by a given offset.
     */
    function navigate(direction) {
        const newIndex = currentSlide + direction;
        if (newIndex >= 0 && newIndex < slides.length) {
            renderSlide(newIndex);
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
                renderSlide(slideNumber - 1);
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
            case 'h':
                helpOverlay.classList.remove('hidden');
                break;
            case 'Escape':
                helpOverlay.classList.add('hidden');
                break;
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || helpOverlay.contains(e.target)) {
            return;
        }
        navigate(1);
    });

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        jumpToSlide();
    });

    initialize();
});
