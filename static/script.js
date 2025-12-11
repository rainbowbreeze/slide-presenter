
document.addEventListener('DOMContentLoaded', () => {
    let slides = [];
    let template = {};
    let currentSlide = 0;

    const slideContainer = document.getElementById('slide-container');
    const footer = document.getElementById('footer');
    const helpOverlay = document.getElementById('help-overlay');

    async function initialize() {
        try {
            const response = await fetch('/api/slides');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            slides = data.slides;
            template = data.template;

            applyTemplate();
            renderSlide(currentSlide);
        } catch (error) {
            console.error("Error initializing presentation:", error);
            slideContainer.innerHTML = `<div class="slide-content"><h1>Error loading presentation</h1><p>${error.message}</p></div>`;
        }
    }

    function applyTemplate() {
        document.body.style.backgroundColor = template['bg-color'];
        document.body.style.color = template['text-color'];
        document.body.style.fontFamily = template['font-main'];
        footer.style.fontSize = template['footer-font-size'];
        footer.style.color = template['footer-text-color'];
        footer.textContent = template['footer-text'];
    }

    function renderSlide(index) {
        if (index < 0 || index >= slides.length) {
            return;
        }
        currentSlide = index;

        const slide = slides[index];
        slideContainer.innerHTML = ''; // Clear previous slide
        slideContainer.style.backgroundImage = 'none'; // Clear previous background image
        footer.style.display = 'block';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'slide-content';

        switch (slide.type) {
            case 'section':
                contentDiv.classList.add('section-slide');
                contentDiv.innerHTML = `<h1>${slide.content}</h1>`;
                footer.style.display = 'none';
                break;
            case 'content':
                contentDiv.classList.add('content-slide');
                let titleHtml = slide.title ? `<h1>${slide.title}</h1>` : '';
                contentDiv.innerHTML = titleHtml + marked.parse(slide.content);
                break;
            case 'image':
                slideContainer.classList.add('image-slide');
                let imageUrl = slide.is_remote_image ? slide.content : `/slides/${slide.content}`;
                slideContainer.style.backgroundImage = `url('${imageUrl}')`;
                footer.style.display = 'none';
                break;
        }
        if (slide.type !== 'image') {
             slideContainer.appendChild(contentDiv);
        }
    }

    function navigate(direction) {
        const newIndex = currentSlide + direction;
        if (newIndex >= 0 && newIndex < slides.length) {
            renderSlide(newIndex);
        }
    }

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

    // Event Listeners
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.key) {
            case 'ArrowRight':
            case 'd':
                navigate(1);
                break;
            case 'ArrowLeft':
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
        // Don't navigate if clicking on a link or inside the help overlay
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
