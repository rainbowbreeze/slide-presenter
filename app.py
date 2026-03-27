import argparse
import os
import json
from typing import Any
from flask import Flask, render_template, jsonify, send_from_directory
from flask.wrappers import Response

app: Flask = Flask(__name__)

# Global variable to store the path to the directory containing slide files.
# It is initialized as an empty string and populated during application startup based on command-line arguments.
SLIDES_DIR: str = ''

def parse_slide_file(filename: str) -> dict[str, Any] | None:
    """
    Parses a slide file and returns a structured dictionary representing the slide content.
    
    This function reads a slide file line by line, determining its type based on the first line.
    Supported slide types include 'section' (section dividers), 'image' (local or remote images), 
    and 'content' (standard text/markdown slides).
    
    Args:
        filename (str): The name of the file to parse, located within the SLIDES_DIR.
        
    Returns:
        dict[str, Any] | None: A dictionary containing the parsed slide data (type, content, title, is_remote_image)
                               if parsing is successful. Returns None if the file is empty or cannot be parsed.
    """
    try:
        # Open and read the slide file from the configured SLIDES_DIR
        with open(os.path.join(SLIDES_DIR, filename), 'r') as f:
            lines: list[str] = [line.strip() for line in f.readlines()]

        # Return None if the file is completely empty
        if not lines:
            return None

        # The first line dictates the slide type and structure
        first_line: str = lines[0]

        # Handle 'section' slide type
        if first_line == "SECTION":
            return {
                "type": "section",
                "content": lines[1] if len(lines) > 1 else "",
                "title": None,
                "is_remote_image": False,
            }

        # Handle 'image' slide type (remote URLs or local image files)
        if first_line.startswith(('http://', 'https://')) or first_line.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            return {
                "type": "image",
                "content": first_line,
                "title": None,
                "is_remote_image": first_line.startswith(('http://', 'https://')),
            }
        
        # Handle standard 'content' slide type (starts with a markdown heading '#')
        if first_line.startswith('#'):
            return {
                "type": "content",
                "content": "\n".join(lines[1:]),
                "title": first_line.lstrip('# ').strip(),
                "is_remote_image": False,
            }

    except Exception as e:
        print(f"Error parsing file {filename}: {e}")
    
    return None

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
    API endpoint to retrieve all presentation slides and the theme template.
    
    This endpoint scans the SLIDES_DIR for slide files, parses them in sorted order, 
    and loads the presentation theme from 'template.json'. The combined data is returned 
    as a JSON payload to be processed by the frontend.
    
    Returns:
        Response | tuple[Response, int]: A JSON response containing the 'template' and a list of 'slides'.
                                         In case of an error, returns a JSON error message with a 500 status code.
    """
    slides: list[dict[str, Any]] = []
    template: dict[str, Any] = {}

    try:
        # Load the presentation theme from template.json
        template_path: str = os.path.join(SLIDES_DIR, 'template.json')
        with open(template_path, 'r') as f:
            template = json.load(f)

        # Retrieve and sort all valid slide files (.txt and .md) from the SLIDES_DIR
        files: list[str] = sorted([f for f in os.listdir(SLIDES_DIR) if f.endswith(('.txt', '.md'))])
        
        # Parse each slide file and append valid slide data to the slides list
        for filename in files:
            slide_data: dict[str, Any] | None = parse_slide_file(filename)
            if slide_data:
                slides.append(slide_data)

    except Exception as e:
        # Handle exceptions gracefully and return a 500 Internal Server Error
        print(f"Error reading slides or template: {e}")
        return jsonify({"error": str(e)}), 500

    # Return the aggregated slide data and template configuration
    return jsonify({"template": template, "slides": slides})

@app.route('/slides/<path:filename>')
def serve_slide_asset(filename: str) -> Response:
    """
    Serves static assets (such as local images) associated with the presentation slides.
    
    This route acts as a static file server for the configured SLIDES_DIR, allowing 
    the frontend to request and display local images referenced within the slides.
    
    Args:
        filename (str): The requested file path relative to the SLIDES_DIR.
        
    Returns:
        Response: The static file served from the directory.
    """
    return send_from_directory(SLIDES_DIR, filename)

if __name__ == '__main__':
    # Initialize the argument parser for command-line options
    parser: argparse.ArgumentParser = argparse.ArgumentParser(description="Run the SelfHosted Slide Presenter app.")
    
    # Add an argument to override the default slide directory
    parser.add_argument('--slide-dir', type=str,
                        help='Specify the directory containing slide files (e.g., --slide-dir=my_slides)',
                        default=None)
    args: argparse.Namespace = parser.parse_args()

    # Determine the directory to use based on the provided arguments or default to 'slides_demo'
    if args.slide_dir:
        SLIDES_DIR = args.slide_dir
    else:
        SLIDES_DIR = 'slides_demo'

    # Validate that the determined SLIDES_DIR actually exists on the filesystem
    if not os.path.isdir(SLIDES_DIR):
        print(f"Error: Specified slide directory '{SLIDES_DIR}' does not exist.")
        exit(1)

    # Start the Flask development server with debug mode enabled
    app.run(debug=True)