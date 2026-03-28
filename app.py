import argparse
import os
import json
from typing import Any
from flask import Flask, render_template, jsonify, send_from_directory
from flask.wrappers import Response

app: Flask = Flask(__name__)

# Global variables to store paths to the slides file, template file, and assets directory.
# These are initialized during application startup based on command-line arguments.
SLIDES_FILE: str = 'slides.json'
TEMPLATE_FILE: str = 'template.json'
ASSETS_DIR: str = 'slides_demo'

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
    
    This endpoint reads the configured slides JSON file to get the presentation 
    metadata and slides, and loads the configured theme template JSON. 
    The combined data is returned as a JSON payload to be processed by the frontend.
    
    Returns:
        Response | tuple[Response, int]: A JSON response containing the 'template', 'slides', 
                                         and 'metadata'. In case of an error, returns a JSON 
                                         error message with a 500 status code.
    """
    slides: list[dict[str, Any]] = []
    template: dict[str, Any] = {}
    metadata: dict[str, Any] = {}

    try:
        # Load the presentation theme from the configured template file
        if os.path.exists(TEMPLATE_FILE):
            with open(TEMPLATE_FILE, 'r') as f:
                template = json.load(f)

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
        print(f"Error reading slides or template: {e}")
        return jsonify({"error": str(e)}), 500

    # Return the aggregated slide data, metadata, and template configuration
    return jsonify({"template": template, "slides": slides, "metadata": metadata})

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

if __name__ == '__main__':
    # Initialize the argument parser for command-line options
    parser: argparse.ArgumentParser = argparse.ArgumentParser(description="Run the SelfHosted Slide Presenter app.")
    
    # Add an argument to specify the slides JSON file
    parser.add_argument('--slides', type=str,
                        help='Specify the slides JSON file (default: slides.json)',
                        default='slides.json')
    
    # Add an argument to specify the template JSON file
    parser.add_argument('--template', type=str,
                        help='Specify the template JSON file (default: template.json)',
                        default='template.json')
    
    # Add an argument to specify a directory containing default slides and template files
    parser.add_argument('--slides-dir', type=str,
                        help='Specify a directory to look for default slides.json and template.json files',
                        default=None)
    
    args: argparse.Namespace = parser.parse_args()

    # Determine the paths to use
    if args.slides_dir:
        # If slides-dir is specified, resolve default names within that directory
        # unless full paths were provided for slides and template.
        # For simplicity, if slides_dir is set, we assume slides and template are relative to it.
        SLIDES_FILE = os.path.join(args.slides_dir, args.slides)
        TEMPLATE_FILE = os.path.join(args.slides_dir, args.template)
        ASSETS_DIR = args.slides_dir
    else:
        SLIDES_FILE = args.slides
        TEMPLATE_FILE = args.template
        # Determine ASSETS_DIR based on SLIDES_FILE location
        ASSETS_DIR = os.path.dirname(os.path.abspath(SLIDES_FILE)) or '.'

    # Verify that the SLIDES_FILE exists
    if not os.path.isfile(SLIDES_FILE):
        print(f"Error: Slides file '{SLIDES_FILE}' does not exist.")
        exit(1)

    print(f"Starting app with:")
    print(f"  Slides file:   {SLIDES_FILE}")
    print(f"  Template file: {TEMPLATE_FILE}")
    print(f"  Assets dir:    {ASSETS_DIR}")

    # Start the Flask development server with debug mode enabled
    app.run(debug=True)
