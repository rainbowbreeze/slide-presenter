# Gemini Project Overview: SelfHosted Slide Presenter

This document provides a high-level overview of the SelfHosted Slide Presenter application, its architecture, and guidelines for maintaining project documentation.

## Project Description

SelfHosted Slide Presenter is a lightweight, file-based presentation tool. It runs as a local web server using Python and Flask, rendering presentations in a web browser. Slides are defined in a single structured JSON file (defaulting to `slides.json`), allowing for rapid content creation using a predefined set of slide templates.

The core features include:
-   A web-based interface for viewing presentations.
-   JSON-based slide management utilizing explicit slide templates.
-   Custom theming via a theme JSON file (defaulting to `theme.json`).
-   Support for 7 different slide templates: section titles, quotes, simple content, double column content, content with images, title and image, and full-screen images.
-   Synchronized Speaker Notes panel with a presentation timer, font size controls, and a resizable current/next slide preview area.
-   Keyboard and mouse navigation.
-   Dynamic reloading of slide content.
-   The presentation footer is displayed automatically based on theme and presentation metadata.

## Architecture

The application follows a simple client-server model:

### Backend

-   **Framework:** Python with Flask.
-   **`app.py`:** The main application file. It contains two primary routes:
    -   `/`: Serves the main `index.html` file.
    -   `/api/slides`: An API endpoint that:
        1.  Reads and parses the configured slides JSON file to extract slide data and metadata.
        2.  Reads the configured theme JSON for theming information.
        3.  Returns a JSON payload containing the structured slide data, metadata, and theme configuration.
    -   `/slides/<path:filename>`: Serves static assets (like local images) from the directory containing the slides file.
-   Command-line Arguments:
    -   `--slides`: Specifies the slides JSON file (default: `slides.json`).
    -   `--theme`: Specifies the theme JSON file (default: `theme.json`).
    -   `--slides-dir`: Specifies a directory to look for default `slides.json` and `theme.json` files (default: `slides`).
-   **Content Directory:** The `slides/` directory is provided as an example containing a `slides.json` and `theme.json`.

### Frontend

-   **`templates/index.html`:** The single HTML page that acts as the container for the presentation.
-   **`static/style.css`:** Provides the visual styling for the slides, including flexbox layouts for the templates, speaker mode specific styles, and resizable panel logic.
-   **`static/script.js`:** The client-side logic that:
    1.  Fetches slide, metadata, and theme data from the `/api/slides` endpoint.
    2.  Dynamically renders the slides based on their defined `template` type.
    3.  Applies the theme from the theme JSON.
    4.  Handles synchronization between the main view and the speaker notes panel via `BroadcastChannel`.
    5.  Implements the resizable preview area logic and the presentation timer.
    6.  Handles all user interactions, such as keyboard and mouse events for navigation.

## Coding Conventions

When modifying or extending the codebase, please adhere to the following conventions:
-   **Python Version:** Use Python 3.11 or higher.
-   **Type Hinting:** Use PEP-484 type hints extensively for all functions, methods, and variables to ensure type safety and readability.
-   **Code Comments:** Write abundant and clear comments throughout the code to explain the intent, logic, and any complex operations.

## Documentation Maintenance

To ensure the project remains easy to understand, use, and develop, it is crucial to keep all documentation up-to-date and maintain a clear separation of concerns between files:

1.  **`GEMINI.md` (The WHAT):** This file. Use it to keep track of the application's architecture, core features, and high-level design. It should be updated whenever architectural decisions or major features change.
2.  **`README.md` (The HOW):** The primary entry point for users. Use it to keep track of how to install, configure, and use the application. It should always contain accurate setup instructions and usage details.
3.  **Synchronization:** Always keep `GEMINI.md` and `README.md` in sync. When adding a feature, update `GEMINI.md` with the architectural details and `README.md` with the usage instructions.
4.  **`gemini-prompt.md`**: The detailed development prompt. It should be kept in sync with the current implementation to serve as a comprehensive technical reference and to facilitate future AI-assisted development.

Maintaining consistency across these documents is essential for project health and collaboration.
