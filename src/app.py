import argparse
import os
import json
from typing import Any
from flask import Flask, render_template, jsonify, send_from_directory
from flask.wrappers import Response

app: Flask = Flask(__name__)

# Global variables to store paths to the slides file, theme file, and assets directory.
# These are initialized during application startup based on command-line arguments.
SLIDES_FILE: str = 'slides.json'
THEME_FILE: str = 'theme.json'
ASSETS_DIR: str = 'slides'

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
                                         and 'metadata'. In case of an error, returns a JSON 
                                         error message with a 500 status code.
    """
    slides: list[dict[str, Any]] = []
    theme: dict[str, Any] = {}
    metadata: dict[str, Any] = {}

    try:
        # Load the presentation theme from the configured theme file
        if os.path.exists(THEME_FILE):
            with open(THEME_FILE, 'r') as f:
                theme = json.load(f)

        # Load the presentation data from the configured slides file
        if os.path.exists(SLIDES_FILE):
            with open(SLIDES_FILE, 'r') as f:
                presentation_data = json.load(f)
                
            slides = presentation_data.get('slides', [])
            metadata = presentation_data.get('presentation_metadata', {})
        else:
            print(f"Error: Slides file '{SLIDES_FILE}' not found.")
            return jsonify({"error": f"Slides file '{SLIDES_FILE}' not found."}), 404

    except Exception as e:
        # Handle exceptions gracefully and return a 500 Internal Server Error
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
    
    args: argparse.Namespace = parser.parse_args()

    # Determine the directory to use for assets and as a base for simple filenames
    ASSETS_DIR = args.slides_dir
    
    # Resolve slides and theme files using the resolution logic
    SLIDES_FILE = resolve_path(args.slides, ASSETS_DIR)
    THEME_FILE = resolve_path(args.theme, ASSETS_DIR)

    # Verify that the SLIDES_FILE exists
    if not os.path.isfile(SLIDES_FILE):
        print(f"Error: Slides file '{SLIDES_FILE}' does not exist.")
        exit(1)

    print(f"Starting app with:")
    print(f"  Slides file:   {SLIDES_FILE}")
    print(f"  Theme file:    {THEME_FILE}")
    print(f"  Assets dir:    {ASSETS_DIR}")

    # Start the Flask development server with debug mode enabled
    app.run(debug=True)
