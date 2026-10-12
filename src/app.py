import argparse
import json
import os
import sys
from typing import Any
from flask import Flask, render_template, jsonify, send_from_directory
from flask.wrappers import Response

app: Flask = Flask(__name__)

# Base project directory (parent of src/) used to anchor default paths
PROJECT_ROOT: str = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# Global variables to store paths to the slides file, theme file, and assets directory.
# Initialized to project-root defaults so running via `flask run` or `python src/app.py` works consistently.
ASSETS_DIR: str = os.path.join(PROJECT_ROOT, 'slides')
SLIDES_FILE: str = os.path.join(ASSETS_DIR, 'slides.json')
THEME_FILE: str = os.path.join(ASSETS_DIR, 'theme.json')


def load_json_file(file_path: str, label: str) -> dict[str, Any]:
    """
    Reads and parses a JSON file using UTF-8 encoding.

    Args:
        file_path (str): Absolute path to the JSON file.
        label (str): Human-readable label for error messages (e.g., 'Theme file', 'Slides file').

    Returns:
        dict[str, Any]: Parsed JSON object.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the file contains invalid JSON syntax or is not a JSON object.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"{label} '{file_path}' not found.")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data: Any = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Invalid JSON in {label.lower()} '{os.path.basename(file_path)}' "
            f"(line {e.lineno}, column {e.colno}): {e.msg}"
        ) from e

    if not isinstance(data, dict):
        raise ValueError(f"{label} '{os.path.basename(file_path)}' must contain a top-level JSON object.")

    return data


@app.route('/')
def index() -> str:
    """
    Renders the main presentation HTML page.
    
    This route serves the base HTML skeleton (index.html), which will subsequently 
    fetch the actual slide data via the API and render it dynamically on the client side.
    
    Returns:
        str: The rendered HTML content of the index page.
    """
    return render_template('index.html')


@app.route('/api/slides')
def get_slides() -> Response | tuple[Response, int]:
    """
    API endpoint to retrieve all presentation slides and the visual theme.
    
    This endpoint reads the configured slides JSON file to get the presentation 
    metadata and slides, and loads the configured theme JSON. 
    The combined data is returned as a JSON payload to be processed by the frontend.
    
    Returns:
        Response | tuple[Response, int]: A JSON response containing the 'theme', 'slides', 
                                         and 'metadata'. Returns 404 if a required file is
                                         missing, or 500 if a file cannot be parsed or read.
    """
    try:
        theme: dict[str, Any] = load_json_file(THEME_FILE, "Theme file")
        presentation_data: dict[str, Any] = load_json_file(SLIDES_FILE, "Slides file")

        slides: list[dict[str, Any]] = presentation_data.get('slides', [])
        metadata: dict[str, Any] = presentation_data.get('presentation_metadata', {})

    except FileNotFoundError as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        print(f"Error parsing JSON: {e}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        # Handle unexpected I/O or runtime exceptions gracefully
        print(f"Error reading slides or theme: {e}")
        return jsonify({"error": str(e)}), 500

    # Return the aggregated slide data, metadata, and theme configuration
    return jsonify({"theme": theme, "slides": slides, "metadata": metadata})


@app.route('/slides/<path:filename>')
def serve_slide_asset(filename: str) -> Response:
    """
    Serves static assets (such as local images) associated with the presentation slides.
    
    This route acts as a static file server for the configured ASSETS_DIR, allowing 
    the frontend to request and display local images referenced within the slides.
    
    Args:
        filename (str): The requested file path relative to the ASSETS_DIR.
        
    Returns:
        Response: The static file served from the directory.
    """
    return send_from_directory(ASSETS_DIR, filename)


def resolve_path(provided_path: str, assets_dir: str) -> str:
    """
    Resolves a file path based on whether it is a simple filename or a full path.
    
    If the provided_path is just a filename (no directory components), it is 
    looked for under the assets_dir. Otherwise, it is treated as an absolute 
    or relative path as-is.
    
    Args:
        provided_path (str): The path or filename provided by the user.
        assets_dir (str): The directory to look into for simple filenames.
        
    Returns:
        str: The resolved path.
    """
    if os.path.dirname(provided_path) == '':
        return os.path.join(assets_dir, provided_path)
    return provided_path


def export_presentation_to_pdf(output_path: str) -> None:
    """
    Starts the Flask server on an ephemeral local port, renders the presentation
    in headless Chromium via Playwright, waits for the print view and all slide/theme
    assets to load and decode, and exports a 16:9 widescreen PDF to output_path.

    Args:
        output_path (str): Target file path for the generated PDF.

    Raises:
        RuntimeError: If Playwright fails to render or export the presentation.
    """
    from threading import Thread
    from werkzeug.serving import make_server
    from playwright.sync_api import sync_playwright

    resolved_output: str = os.path.abspath(output_path)
    parent_dir: str = os.path.dirname(resolved_output)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)

    # Bind to port 0 so the OS assigns an available ephemeral localhost port
    server = make_server('127.0.0.1', 0, app)
    port: int = int(server.server_port)
    server_thread: Thread = Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    try:
        url: str = f"http://127.0.0.1:{port}/"
        print(f"Rendering slides from {url} to PDF...")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1920, "height": 1080})
            page.goto(url, wait_until="networkidle")

            # Wait for #print-container to be populated with .print-slide items by preparePrintView()
            page.wait_for_selector("#print-container .print-slide", state="attached", timeout=30000)

            # Ensure web fonts, <img> elements, and CSS background-image assets in #print-container are decoded
            page.evaluate("""async () => {
                if (document.fonts && document.fonts.ready) {
                    await document.fonts.ready;
                }

                const preloadUrl = (url) => new Promise((resolve) => {
                    if (!url) return resolve();
                    const img = new Image();
                    img.onload = () => {
                        if (typeof img.decode === 'function') {
                            img.decode().catch(() => {}).finally(resolve);
                        } else {
                            resolve();
                        }
                    };
                    img.onerror = () => resolve();
                    img.src = url;
                });

                const imgs = Array.from(document.querySelectorAll('#print-container img'));
                const imgPromises = imgs.map((img) => {
                    if (img.complete && img.naturalWidth > 0) {
                        return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
                    }
                    return new Promise((resolve) => {
                        img.addEventListener('load', () => {
                            if (typeof img.decode === 'function') {
                                img.decode().catch(() => {}).finally(resolve);
                            } else {
                                resolve();
                            }
                        }, { once: true });
                        img.addEventListener('error', () => resolve(), { once: true });
                    });
                });

                const bgUrls = new Set();
                document.querySelectorAll('#print-container .print-slide, #print-container .image-side').forEach((el) => {
                    const bg = window.getComputedStyle(el).backgroundImage;
                    if (bg && bg !== 'none') {
                        const match = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
                        if (match && match[1]) {
                            bgUrls.add(match[1]);
                        }
                    }
                });

                await Promise.all([...imgPromises, ...Array.from(bgUrls).map(preloadUrl)]);
            }""")

            # Generate the 16:9 widescreen PDF respecting @media print and @page rules
            page.pdf(
                path=resolved_output,
                print_background=True,
                prefer_css_page_size=True,
            )
            browser.close()
        print(f"Successfully exported PDF to: {resolved_output}")
    finally:
        server.shutdown()


if __name__ == '__main__':
    # Initialize the argument parser for command-line options
    parser: argparse.ArgumentParser = argparse.ArgumentParser(description="Run the SelfHosted Slide Presenter app.")
    
    # Add an argument to specify the slides JSON file
    parser.add_argument('--slides', type=str,
                        help='Specify the slides JSON file (default: slides.json)',
                        default='slides.json')
    
    # Add an argument to specify the theme JSON file
    parser.add_argument('--theme', type=str,
                        help='Specify the theme JSON file (default: theme.json)',
                        default='theme.json')
    
    # Add an argument to specify a directory containing slides and theme files
    parser.add_argument('--slides-dir', type=str,
                        help='Specify a directory to look for default slides and theme files (default: slides)',
                        default='slides')

    # Add an argument to export the presentation directly to a PDF file and exit
    parser.add_argument('--export-pdf', type=str, default=None, metavar='OUTPUT_PDF',
                        help='Export the presentation as a 16:9 widescreen PDF to the specified file path and exit')
    
    args: argparse.Namespace = parser.parse_args()

    # Determine the directory to use for assets and as a base for simple filenames
    ASSETS_DIR = os.path.abspath(args.slides_dir)
    
    # Resolve slides and theme files using the resolution logic
    SLIDES_FILE = os.path.abspath(resolve_path(args.slides, ASSETS_DIR))
    THEME_FILE = os.path.abspath(resolve_path(args.theme, ASSETS_DIR))

    # Verify that the ASSETS_DIR actually exists
    if not os.path.isdir(ASSETS_DIR):
        print(f"Error: Specified assets directory '{ASSETS_DIR}' does not exist.")
        sys.exit(1)

    # Verify that the SLIDES_FILE exists
    if not os.path.isfile(SLIDES_FILE):
        print(f"Error: Slides file '{SLIDES_FILE}' does not exist.")
        sys.exit(1)
        
    # Verify that the THEME_FILE exists
    if not os.path.isfile(THEME_FILE):
        print(f"Error: Theme file '{THEME_FILE}' does not exist.")
        sys.exit(1)

    print("Starting app with:")
    print(f"  Slides file:   {SLIDES_FILE}")
    print(f"  Theme file:    {THEME_FILE}")
    print(f"  Assets dir:    {ASSETS_DIR}")

    # If --export-pdf is specified, render the presentation headlessly to PDF and exit
    if args.export_pdf:
        try:
            export_presentation_to_pdf(args.export_pdf)
            sys.exit(0)
        except Exception as e:
            print(f"Error exporting presentation to PDF: {e}")
            sys.exit(1)

    # Start the Flask development server with debug mode enabled
    app.run(debug=True)

