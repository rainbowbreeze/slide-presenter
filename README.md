# Slide Presenter

Slide Presenter is a lightweight, file-based presentation tool that runs in your web browser. It generates a slideshow from simple text or Markdown files, allowing you to focus on your content.

## Features

-   **Web-Based:** Runs a local Python web server. View your presentation in any modern web browser.
-   **File-Based:** Slides are created from simple `.txt` and `.md` files.
-   **Custom Theming:** Define fonts, colors, and a persistent footer using a `template.json` file. The footer is displayed on content slides, but hidden on section and image slides.
-   **Slide Types:** Supports section title slides, content slides with Markdown, and full-screen image slides.
-   **Easy Navigation:** Control your presentation with keyboard shortcuts or your mouse.
-   **Dynamic Reload:** Update your slide files and reload the presentation instantly with a keypress.

## Setup and Installation

1.  **Prerequisites:** Ensure you have Python 3.6+ installed.

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
    -   `slides_demo/`: To store your slide content files and `template.json`.
    -   `static/`: To store the `script.js` and `style.css` files.
    -   `templates/`: To store the `index.html` file.

## How to Use

### 1. Create Slides

Inside the `slides_demo/` directory, create your slide files. The slides will be ordered alphabetically by filename (e.g., `0010_intro.md`, `0020_first_section.txt`, etc.).

#### Section Slide

Create a `.txt` file where the first line is `SECTION`. The second line will be the centered title of the slide.

*Example (`002_section.txt`):*
```
SECTION
This is a Section Title
```

#### Content Slide (Markdown)

Create a `.md` file where the first line starts with `#`. This line becomes the slide title, and the rest of the file is treated as Markdown content.

*Example (`003_content.md`):*
```md
# My First Slide
This is a list of items:
- Item 1
- Item 2
- **Bolded** text.
```

Supported markdown specs (from https://marked.js.org/#specifications):
- Markdown 1.0: https://daringfireball.net/projects/markdown/syntax
- CommonMark 0.31: http://spec.commonmark.org/
- GitHub Flavored Markdown 0.29: https://help.github.com/articles/github-flavored-markdown/


#### Image Slide

Create a `.txt` or `.md` file where the first line is a URL to an image or a path to a local image. Local images should be placed in the `slides_demo/` directory and are served directly from there.

*Example with a remote image:*
```
https://via.placeholder.com/800x600
```

*Example with a local image:*
```
0040_my-diagram.png
```

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

| Action             | Key                         | Mouse              |
| ------------------ | --------------------------- | ------------------ |
| **Next Slide**     | `Right Arrow` / `D`         | Left-Click         |
| **Previous Slide** | `Left Arrow` / `A`          |                    |
| **Jump to Slide**  | `G`                         | Right-Click        |
| **Reload Slides**  | `R`                         |                    |
| **Show/Hide Help** | `H` (Show) / `Esc` (Hide)   |                    |

---

All errors during execution will be logged to the terminal where `app.py` is running and to the browser's JavaScript console.
