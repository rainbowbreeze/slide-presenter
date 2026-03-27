# SelfHosted Slide Presenter

SelfHosted Slide Presenter is a lightweight, file-based presentation tool that runs in your web browser. It generates a slideshow from a structured JSON file, allowing you to focus on your content using predefined templates.

## Features

-   **Web-Based:** Runs a local Python web server. View your presentation in any modern web browser.
-   **JSON-Based:** Slides are defined in a single `presentation.json` file.
-   **Custom Theming:** Define fonts, colors, and a persistent footer using a `template.json` file. The footer is displayed globally and uses the presentation title as a fallback if not explicitly set.
-   **Slide Templates:** Supports multiple layout templates including section titles, quotes, simple content, double column content, and content with images.
-   **Easy Navigation:** Control your presentation with keyboard shortcuts or your mouse.
-   **Dynamic Reload:** Update your slide files and reload the presentation instantly with a keypress.

## Setup and Installation

1.  **Prerequisites:** Ensure you have Python 3.11+ installed.

2.  **Virtual environment:** Configure the virtual environment
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Dependencies:** The application uses the Flask web framework. Install it using pip:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Directory Structure:** Create the following directories in your project root:
    -   `slides_demo/`: To store your `presentation.json` and `template.json`.
    -   `static/`: To store the `script.js` and `style.css` files.
    -   `templates/`: To store the `index.html` file.

## How to Use

### 1. Create Slides

Inside the `slides_demo/` directory, create a `presentation.json` file. This file contains the metadata and an array of slides.

*Example (`presentation.json`):*
```json
{
  "presentation_metadata": {
    "title": "Urban Eden: The Future of City Farming",
    "version": "1.0"
  },
  "slides": [
    {
      "template": "section_title",
      "data": {
        "title": "The Concrete Jungle Turns Green",
        "fun_sentence": "Because your fire escape deserves better."
      }
    },
    {
      "template": "content_simple",
      "data": {
        "title": "Why Urban Gardening Matters",
        "bullets": [
          "Reduction of urban heat island effect",
          "Zero-mile food production",
          "Mental health and stress reduction"
        ]
      }
    }
  ]
}
```

#### Supported Templates

*Note: All slide templates support an optional `notes` field (string) inside the `data` object, which can contain Markdown text for the speaker notes.*

1.  **`section_title`**: A large centered title.
    *   Data fields: `title`, `fun_sentence` (optional).
2.  **`quote_slide`**: A large centered quote.
    *   Data fields: `quote`, `attribution`.
3.  **`content_simple`**: A title with a single list of bullets.
    *   Data fields: `title`, `bullets` (array of strings).
4.  **`content_double`**: A title with two columns of bullets.
    *   Data fields: `title`, `column_left` (object with `sub_heading`, `bullets`), `column_right` (object with `sub_heading`, `bullets`).
5.  **`content_and_image`**: A title with bullets on one side and an image on the other.
    *   Data fields: `title`, `bullets`, `image_position` (`left` or `right`), `image_uri` (URL or path to a local image in the slides directory).

### 2. Customize Your Theme

Edit the `slides_demo/template.json` file to customize the look and feel of your presentation.

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

### 3. Run the Application

Execute the Python script from your project's root directory:

```bash
python app.py
```

To specify a custom directory for your slides, use the `--slide-dir` argument:

```bash
python app.py --slide-dir=path/to/your/slides
```

Open your web browser and navigate to `http://127.0.0.1:5000` to see your presentation.

## Controls

| Action             | Key                                | Mouse              |
| ------------------ | ---------------------------------- | ------------------ |
| **Next Slide**     | `Right Arrow` / `Down Arrow` /     | Left-Click         |
|                    | `D` / `Space`                      |                    |
| **Previous Slide** | `Left Arrow` / `Up Arrow` / `A`    |                    |
| **Jump to Slide**  | `G`                                | Right-Click        |
| **Speaker Notes**  | `S`                                |                    |
| **Reload Slides**  | `R`                                |                    |
| **Show/Hide Help** | `H` (Show) / `Esc` (Hide)          |                    |

---

All errors during execution will be logged to the terminal where `app.py` is running and to the browser's JavaScript console.

---

## Open Source Libraries

This project utilizes the following open-source libraries:

*   **Flask**: A micro web framework for Python.
    *   *Authors:* Armin Ronacher (creator) and the Flask Community.
    *   *License:* BSD License.
*   **Marked.js**: A markdown parser and compiler written in JavaScript.
    *   *Author:* Troy Goode and contributors.
    *   *License:* MIT License.

We extend our sincere gratitude to the developers and communities behind these fantastic projects for their invaluable contributions to the open-source ecosystem.
