document.addEventListener('DOMContentLoaded', () => {
    // State variables for the presentation
    let slides = [];
    let template = {};
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

            // Apply the visual theme and render the current slide
            applyTemplate();
            renderSlide(currentSlide);
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
        document.body.style.backgroundColor = template['bg-color'];
        document.body.style.color = template['text-color'];
        document.body.style.fontFamily = template['font-main'];
        
        // Configure the footer styling based on the template
        footer.style.fontSize = template['footer-font-size'];
        footer.style.color = template['footer-text-color'];
        footer.textContent = template['footer-text'];
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
        
        // Clear previous slide content and background styles
        slideContainer.innerHTML = '';
        slideContainer.style.backgroundImage = 'none';
        
        // Ensure the footer is displayed by default; specific slide types may hide it
        footer.style.display = 'block';

        // Create a new container for the content of the current slide
        const contentDiv = document.createElement('div');
        contentDiv.className = 'slide-content';

        // Render content differently based on the slide's designated type
        switch (slide.type) {
            case 'section':
                // Section slides represent major dividers with a centered title
                contentDiv.classList.add('section-slide');
                contentDiv.innerHTML = `<h1>${slide.content}</h1>`;
                footer.style.display = 'none'; // Hide footer on section slides
                break;
                
            case 'content':
                // Content slides render standard text/markdown content
                contentDiv.classList.add('content-slide');
                
                // Prepend the optional slide title if one exists
                let titleHtml = slide.title ? `<h1>${slide.title}</h1>` : '';
                
                // Parse and inject the markdown content
                contentDiv.innerHTML = titleHtml + marked.parse(slide.content);
                break;
                
            case 'image':
                // Image slides display full-screen background images
                slideContainer.classList.add('image-slide');
                
                // Determine whether to use the provided URL or construct a local path
                let imageUrl = slide.is_remote_image ? slide.content : `/slides/${slide.content}`;
                
                // Set the background image on the main container
                slideContainer.style.backgroundImage = `url('${imageUrl}')`;
                footer.style.display = 'none'; // Hide footer on image slides
                break;
        }
        
        // Append the newly created content to the slide container (except for image slides, which use a background)
        if (slide.type !== 'image') {
             slideContainer.appendChild(contentDiv);
        }
    }

    /**
     * Navigates the presentation forwards or backwards by a given offset.
     * @param {number} direction - The offset to move (e.g., 1 for next, -1 for previous).
     */
    function navigate(direction) {
        const newIndex = currentSlide + direction;
        
        // Ensure navigation stays within the bounds of the presentation
        if (newIndex >= 0 && newIndex < slides.length) {
            renderSlide(newIndex);
        }
    }

    /**
     * Prompts the user to jump directly to a specific slide number.
     */
    function jumpToSlide() {
        const slideNumberStr = prompt('Jump to slide number:');
        
        // Validate the user's input before attempting to render the slide
        if (slideNumberStr) {
            const slideNumber = parseInt(slideNumberStr, 10);
            
            if (!isNaN(slideNumber) && slideNumber > 0 && slideNumber <= slides.length) {
                renderSlide(slideNumber - 1); // Adjust 1-based input to 0-based index
            } else {
                alert('Invalid slide number.');
            }
        }
    }

    // --- Event Listeners ---

    // Handle global keyboard navigation and interactions
    document.addEventListener('keydown', (e) => {
        // Prevent key events from triggering while the user is typing into an input or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.key) {
            // Forward navigation keys
            case 'ArrowRight':
            case 'ArrowDown':
            case 'd':
            case ' ':
                navigate(1);
                break;
                
            // Backward navigation keys
            case 'ArrowLeft':
            case 'ArrowUp':
            case 'a':
                navigate(-1);
                break;
                
            // Interaction keys
            case 'g':
                jumpToSlide();
                break;
            case 'r':
                initialize(); // Reload presentation state from server
                break;
            case 'h':
                helpOverlay.classList.remove('hidden'); // Show help screen
                break;
            case 'Escape':
                helpOverlay.classList.add('hidden'); // Hide help screen
                break;
        }
    });

    // Handle standard mouse click to progress the presentation
    document.addEventListener('click', (e) => {
        // Don't navigate if clicking on an interactive element like a link or the help overlay
        if (e.target.tagName === 'A' || helpOverlay.contains(e.target)) {
            return;
        }
        navigate(1);
    });

    // Handle right-click (context menu) to trigger the jump-to-slide prompt
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Prevent the default browser context menu from appearing
        jumpToSlide();
    });

    // Begin the application flow on page load
    initialize();
});
