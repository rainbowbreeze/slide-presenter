import argparse
import os
import json
from typing import Any
from flask import Flask, render_template, jsonify, send_from_directory
from flask.wrappers import Response

app: Flask = Flask(__name__)

# Global variable to store the path to the directory containing slide files.
# It is initialized to 'slides_demo' and can be overridden during application startup based on command-line arguments.
SLIDES_DIR: str = 'slides_demo'

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
    
    This endpoint reads the 'presentation.json' file from the SLIDES_DIR to get the 
    presentation metadata and slides, and loads the presentation theme from 'template.json'. 
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
        # Load the presentation theme from template.json
        template_path: str = os.path.join(SLIDES_DIR, 'template.json')
        if os.path.exists(template_path):
            with open(template_path, 'r') as f:
                template = json.load(f)

        # Load the presentation data from presentation.json
        presentation_path: str = os.path.join(SLIDES_DIR, 'presentation.json')
        with open(presentation_path, 'r') as f:
            presentation_data = json.load(f)
            
        slides = presentation_data.get('slides', [])
        metadata = presentation_data.get('presentation_metadata', {})

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
