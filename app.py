
import argparse
import os
import json
from flask import Flask, render_template, jsonify, send_from_directory

app = Flask(__name__)

SLIDES_DIR = ''

def parse_slide_file(filename):
    """Parses a slide file and returns a slide dictionary."""
    try:
        with open(os.path.join(SLIDES_DIR, filename), 'r') as f:
            lines = [line.strip() for line in f.readlines()]

        if not lines:
            return None

        first_line = lines[0]

        if first_line == "SECTION":
            return {
                "type": "section",
                "content": lines[1] if len(lines) > 1 else "",
                "title": None,
                "is_remote_image": False,
            }

        if first_line.startswith(('http://', 'https://')) or first_line.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            return {
                "type": "image",
                "content": first_line,
                "title": None,
                "is_remote_image": first_line.startswith(('http://', 'https://')),
            }
        
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
def index():
    """Renders the main presentation page."""
    return render_template('index.html')

@app.route('/api/slides')
def get_slides():
    """API endpoint to get slide and template data."""
    slides = []
    template = {}

    try:
        # Load template
        with open(os.path.join(SLIDES_DIR, 'template.json'), 'r') as f:
            template = json.load(f)

        # Load slides
        files = sorted([f for f in os.listdir(SLIDES_DIR) if f.endswith(('.txt', '.md'))])
        for filename in files:
            slide_data = parse_slide_file(filename)
            if slide_data:
                slides.append(slide_data)

    except Exception as e:
        print(f"Error reading slides or template: {e}")
        return jsonify({"error": str(e)}), 500

    return jsonify({"template": template, "slides": slides})

@app.route('/slides/<path:filename>')
def serve_slide_asset(filename):
    return send_from_directory(SLIDES_DIR, filename)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Run the Slide Presenter Flask app.")
    parser.add_argument('--slidedir', type=str,
                        help='Specify the directory containing slide files (e.g., --slidedir=my_slides)',
                        default=None)
    args = parser.parse_args()

    # Use the provided slidedir, otherwise fall back to existing logic
    if args.slidedir:
        SLIDES_DIR = args.slidedir
    else:
        SLIDES_DIR = 'slides_demo'

    # Verify that the SLIDES_DIR exists
    if not os.path.isdir(SLIDES_DIR):
        print(f"Error: Specified slide directory '{SLIDES_DIR}' does not exist.")
        exit(1)

    app.run(debug=True)
