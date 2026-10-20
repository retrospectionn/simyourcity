"""Build static site for GitHub Pages deployment.

Renders the Jinja2 template to static HTML in docs/ so GitHub Pages can serve it.
The static build uses Overpass API directly from the browser (no Flask needed),
or a user-picked .osm.pbf parsed in a Web Worker.
"""
import json
import os
import shutil

from jinja2 import Environment, FileSystemLoader

import config

BASE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(BASE, "docs")

env = Environment(loader=FileSystemLoader(os.path.join(BASE, "templates")))
env.globals["url_for"] = lambda endpoint, **kw: "static/" + kw.get("filename", "")
template = env.get_template("index.html")

html = template.render(
    amenities=config.AMENITY_TYPES,
    polygons=config.POLYGON_TYPES,
    transit=config.TRANSIT_TYPES,
    default_center=config.DEFAULT_CENTER,
    default_zoom=config.DEFAULT_ZOOM,
    static_build=True,
)

os.makedirs(DOCS, exist_ok=True)
os.makedirs(os.path.join(DOCS, "static", "js"), exist_ok=True)
os.makedirs(os.path.join(DOCS, "static", "css"), exist_ok=True)

with open(os.path.join(DOCS, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

JS_FILES = ["simyourcity.js", "pbf-worker.js"]  # pbf-worker.js parses imported PBFs in-browser
for name in JS_FILES:
    shutil.copy2(os.path.join(BASE, "static", "js", name), os.path.join(DOCS, "static", "js", name))

with open(os.path.join(DOCS, ".nojekyll"), "w") as f:
    f.write("")

print(f"Static site built in {DOCS}")
print(f"  index.html ({os.path.getsize(os.path.join(DOCS, 'index.html'))} bytes)")
for name in JS_FILES:
    print(f"  static/js/{name} ({os.path.getsize(os.path.join(DOCS, 'static', 'js', name))} bytes)")
