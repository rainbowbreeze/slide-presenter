
# Prompt for Gemini 3: Python Slide Presentation Web App

## Project Overview

You are tasked with creating a simple, file-based slide presentation application using Python. The application will run as a local web server, reading slide content from text and Markdown files, and displaying them in a web browser. The presentation's look and feel will be defined by a JSON template file.

## Core Components

The application consists of three main parts:
1.  **Python Backend:** A Flask-based web server to serve the main page and provide slide data.
2.  **Frontend:** An HTML page with CSS and JavaScript to render and control the presentation.
3.  **Content:** Text or Markdown files in `slides_demo` directory that define the content of each slide.

## Detailed Requirements

### 1. Project Structure

Create the following directory and file structure:

```
/
|-- app.py              # The main Python Flask application
|-- slides_demo/
|   |-- 001_intro.md
|   |-- 002_section.txt
|   |-- ... (other slide files)
|   |-- template.json   # Defines the presentation theme
|-- static/
|   |-- style.css       # Main CSS file
|   |-- script.js       # Main JavaScript file
|-- templates/
    |-- index.html      # The single HTML page for the presentation
```

### 2. Backend (app.py)

-   **Framework:** Use Flask.
-   **Command-line Arguments:** The script should accept a `--slide-dir` argument to specify the directory containing slide files. If not provided, it falls back to the default `slides_demo/` logic.
-   **Endpoints:**
    -   `@app.route('/')`: This should render the `templates/index.html` page.
    -   `@app.route('/api/slides')`: This endpoint is the core of the backend. It should:
        1.  Read the `slides_demo/template.json` file.
        2.  Scan the `slides_demo/` directory for all `.txt` and `.md` files.
        3.  Sort the files alphabetically by name to determine the slide order.
        4.  For each file, parse it to determine the slide type and content.
        5.  Return a single JSON object containing two keys:
            -   `template`: The content of `template.json`.
            -   `slides`: A list of slide objects.

-   **Slide Object JSON Structure:** Each slide object in the `slides` list should have the following structure:
    -   `type`: (string) Can be `section`, `image`, or `content`.
    -   `content`: (string) The main content for the slide.
        -   For `section` slides: The title text.
        -   For `image` slides: The URL or file path of the image.
        -   For `content` slides: The Markdown content (excluding the title line).
    -   `title`: (string, optional) The title of a `content` slide.
    -   `is_remote_image`: (boolean, for `image` slides) `true` if the URL starts with `http://` or `https://`, otherwise `false`.

-   **Slide Parsing Logic:**
    1.  **Section Slide:** If the first line of the file is exactly `SECTION`, the slide `type` is `section`, and the `content` is the second line of the file.
    2.  **Image Slide:** If the first line is a URL (starts with `http://` or `https://`) or a local image file name (e.g., `my_image.jpg`), the slide `type` is `image`. The `content` is the full first line.
    3.  **Content Slide:** If the first line starts with `#`, the slide `type` is `content`. The `title` is the first line (without the leading `# `), and the `content` is the rest of the file's content.
-   **Error Handling:** Log any file reading or parsing errors to the terminal.

### 3. Frontend

#### `templates/index.html`
-   A basic HTML structure with a `<body>` tag. All slide content will be dynamically injected into the body by JavaScript.
-   Link to `static/style.css` and `static/script.js`.
-   Include a `div` for the main slide container and another for the help overlay.

#### `static/style.css`
-   Provide basic styling to reset margins and paddings.
-   The `body`'s background color and text color should be set by JavaScript from the template.
-   Define CSS classes for different slide types:
    -   `.slide-container`: To hold the slide content.
    -   `.section-slide`: For styling section slides (e.g., centered text, large font).
    -   `.content-slide`: For standard content slides.
    -   `.image-slide`: For styling image slides (e.g., making the image fill the screen).
    -   `.footer`: For the slide footer.
    -   `.help-overlay`: A hidden overlay that appears on top of the slide.
-   Ensure that when a new slide is rendered, all previous content and background images are completely removed.

#### `static/script.js`
-   **Initialization:**
    -   On page load, make a `fetch` request to `/api/slides`.
    -   Store the `slides` and `template` data in global variables.
    -   Apply the `bg-color`, `text-color`, and `font-main` from the template to the `body` and/or a main container.
    -   Render the first slide (index 0).

-   **Slide Rendering (`renderSlide(index)` function):**
    -   This function is the core of the frontend logic.
    -   It should completely clear any existing content inside the slide container.
    -   Based on the `type` of the slide at the given `index`, it generates and injects the appropriate HTML into the slide container.
    -   Use a library like `marked.js` or a simple internal function to parse the Markdown for `content` slides.
    -   If the slide is not a `section` slide, render the footer using the details from `template.json`.

-   **Navigation and Event Handling:**
    -   Implement a `currentSlide` variable to track the current slide index.
    -   **Keyboard Events:**
        -   `ArrowRight`, `d`: Go to the next slide.
        -   `ArrowLeft`, `a`: Go to the previous slide.
        -   `g`: Prompt the user for a slide number (`prompt()`) and jump to it. Validate the input.
        -   `r`: Reload the presentation by re-fetching data from `/api/slides` and re-rendering the current slide.
        -   `h`: Show the help overlay.
        -   `Escape`: Hide the help overlay.
    -   **Mouse Events:**
        -   `click`: Go to the next slide.
        -   `contextmenu` (right-click): Prevent the default menu and trigger the "jump to slide" prompt.

-   **Help Screen:**
    -   Create a function to show/hide a `div` that overlays the slide.
    -   This `div` should display a list of all available keyboard and mouse controls.

-   **Error Handling:** Use `console.error()` to log any errors that occur during API fetching or rendering.

### 4. `slides_demo/template.json`

This file defines the visual theme. Provide a default example:

```json
{
  "font-main": "'Helvetica', sans-serif",
  "bg-color": "#FFFFFF",
  "text-color": "#000000",
  "footer-text": "My Presentation",
  "footer-font-size": "14px",
  "footer-text-color": "#888888"
}
```

This comprehensive prompt should provide all the necessary details to generate the specified application.
