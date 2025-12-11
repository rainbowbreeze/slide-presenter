# Gemini Project Overview: Slide Presenter

This document provides a high-level overview of the Slide Presenter application, its architecture, and guidelines for maintaining project documentation.

## Project Description

Slide Presenter is a lightweight, file-based presentation tool. It runs as a local web server using Python and Flask, rendering presentations in a web browser. Slides are generated from simple text (`.txt`) and Markdown (`.md`) files, allowing for rapid content creation and a focus on the material being presented.

The core features include:
-   A web-based interface for viewing presentations.
-   File-based slide management for easy content creation.
-   Custom theming via a `template.json` file (fonts, colors, etc.).
-   Support for different slide types: section titles, Markdown content, and full-screen images.
-   Keyboard and mouse navigation.
-   Dynamic reloading of slide content.

## Architecture

The application follows a simple client-server model:

### Backend

-   **Framework:** Python with Flask.
-   **`app.py`:** The main application file. It contains two primary routes:
    -   `/`: Serves the main `index.html` file.
    -   `/api/slides`: An API endpoint that:
        1.  Reads and parses slide files (`.md`, `.txt`) from the `slides/` directory.
        2.  Reads a `template.json` for theming information.
        3.  Returns a JSON payload containing the structured slide data and template configuration.
-   **Content Directory:** The `slides/` directory (with `slides_demo/` as a fallback) holds all user-facing content, including slide files and the theme template.

### Frontend

-   **`templates/index.html`:** The single HTML page that acts as the container for the presentation.
-   **`static/style.css`:** Provides the visual styling for the slides, including layout, fonts, and colors defined in the theme.
-   **`static/script.js`:** The client-side logic that:
    1.  Fetches slide and theme data from the `/api/slides` endpoint.
    2.  Dynamically renders the slides based on their type (`section`, `content`, `image`).
    3.  Applies the theme from `template.json`.
    4.  Handles all user interactions, such as keyboard and mouse events for navigation.

## Documentation Maintenance

To ensure the project remains easy to understand, use, and develop, it is crucial to keep all documentation up-to-date.

When making any changes to the codebase, such as adding new features, modifying existing logic, or fixing bugs, the following files **must be updated** to reflect those changes:

1.  **`README.md`**: The primary entry point for users. It should always contain accurate setup instructions and a clear description of all user-facing features.
2.  **`GEMINI.md`**: This file. It provides the high-level architectural overview and should be updated if the architecture changes.
3.  **`gemini-prompt.md`**: The detailed development prompt. It should be kept in sync with the current implementation to serve as a comprehensive technical reference and to facilitate future AI-assisted development.

Maintaining consistency across these documents is essential for project health and collaboration.
