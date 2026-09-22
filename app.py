import os
import json
import time
import uuid
import shutil
import logging
import threading
import requests as http_requests
from flask import Flask, render_template, Response, request, jsonify

import config
from config import (
    AMENITY_TYPES, POLYGON_TYPES, TRANSIT_TYPES, DEFAULT_BBOX, DEFAULT_CENTER,
    DEFAULT_ZOOM, HOST, PORT, DEBUG, PBF_DIR, GEOFABRIK_CATALOG, GEOFABRIK_BASE,
)
from query_engine import QueryEngine, dissolve_circles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
engine = QueryEngine(config)

_download_tasks = {}


def _refresh_engine():
    """Re-create the PbfEngine after the active file changes."""
    engine.pbf = __import__("query_engine", fromlist=["PbfEngine"]).PbfEngine(config)
    engine.source = "pbf" if config.USE_PBF else "overpass"


# ─── Pages ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template(
        "index.html",
        amenities=AMENITY_TYPES,
        polygons=POLYGON_TYPES,
        transit=TRANSIT_TYPES,
        default_center=DEFAULT_CENTER,
        default_zoom=DEFAULT_ZOOM,
        use_pbf=config.USE_PBF,
        pbf_path=config.PBF_PATH,
    )


# ─── PBF file management ─────────────────────────────────────────────────────

@app.route("/api/pbf/status")
def pbf_status():
    files = sorted(f for f in os.listdir(PBF_DIR) if f.endswith(".osm.pbf"))
    return jsonify({
        "active": os.path.basename(config.PBF_PATH) if config.USE_PBF else None,
        "active_path": config.PBF_PATH if config.USE_PBF else None,
        "use_pbf": config.USE_PBF,
        "pbf_dir": PBF_DIR,
        "files": [{"name": f, "size_mb": round(os.path.getsize(os.path.join(PBF_DIR, f)) / 1_048_576, 1)} for f in files],
    })


@app.route("/api/pbf/select", methods=["POST"])
def pbf_select():
    data = request.get_json(force=True)
    filename = data.get("filename", "")
    path = os.path.join(PBF_DIR, filename)
    if not filename or not os.path.isfile(path):
        return jsonify({"error": "File not found"}), 404

    config.PBF_PATH = path
    config.USE_PBF = True
    config._save_state({"active_pbf": path})
    _refresh_engine()
    logger.info("Switched active PBF → %s", filename)
    return jsonify({"ok": True, "active": filename})


@app.route("/api/pbf/import", methods=["POST"])
def pbf_import():
    data = request.get_json(force=True)
    src = os.path.abspath(data.get("path", "").strip())
    if not src or not os.path.isfile(src):
        return jsonify({"error": "Source file not found"}), 404
    if not src.lower().endswith(".osm.pbf"):
        return jsonify({"error": "File must have a .osm.pbf extension"}), 400

    dest = os.path.join(PBF_DIR, os.path.basename(src))
    if os.path.abspath(src) != os.path.abspath(dest):
        shutil.copy2(src, dest)

    config.PBF_PATH = dest
    config.USE_PBF = True
    config._save_state({"active_pbf": dest})
    _refresh_engine()
    logger.info("Imported PBF → %s", os.path.basename(dest))
    return jsonify({"ok": True, "active": os.path.basename(dest)})


@app.route("/api/pbf/delete", methods=["POST"])
def pbf_delete():
    data = request.get_json(force=True)
    filename = data.get("filename", "")
    if not filename or os.sep in filename or "/" in filename or filename.startswith(".."):
        return jsonify({"error": "Invalid filename"}), 400
    path = os.path.join(PBF_DIR, filename)
    if not os.path.isfile(path):
        return jsonify({"error": "File not found"}), 404

    if os.path.abspath(path) == os.path.abspath(config.PBF_PATH):
        config.PBF_PATH = ""
        config.USE_PBF = False
        config._save_state({"active_pbf": ""})
        _refresh_engine()

    os.remove(path)
    for suffix in (".polys.json", ".transit.v2.json"):
        cache = path + suffix
        if os.path.isfile(cache):
            os.remove(cache)
    logger.info("Deleted PBF → %s", filename)
    return jsonify({"ok": True})


@app.route("/api/pbf/geofabrik")
def pbf_geofabrik():
    return jsonify({"catalog": GEOFABRIK_CATALOG, "base": GEOFABRIK_BASE})


@app.route("/api/pbf/download", methods=["POST"])
def pbf_download():
    data = request.get_json(force=True)
    url = data.get("url", "")
    if not url:
        return jsonify({"error": "No URL"}), 400
    if not url.startswith(GEOFABRIK_BASE):
        return jsonify({"error": "URL must be from download.geofabrik.de"}), 403

    filename = url.rsplit("/", 1)[-1]
    dest = os.path.join(PBF_DIR, filename)
    task_id = uuid.uuid4().hex[:8]

    _download_tasks[task_id] = {
        "status": "downloading", "filename": filename,
        "progress": 0, "bytes": 0, "total": 0,
        "start_time": time.time(),
    }

    def _run():
        try:
            resp = http_requests.get(url, stream=True, timeout=30)
            resp.raise_for_status()
            total = int(resp.headers.get("Content-Length", 0))
            _download_tasks[task_id]["total"] = total
            written = 0
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(1 << 20):
                    f.write(chunk)
                    written += len(chunk)
                    _download_tasks[task_id]["bytes"] = written
                    _download_tasks[task_id]["progress"] = int(written * 100 / total) if total else 0
            _download_tasks[task_id]["status"] = "done"
            _download_tasks[task_id]["progress"] = 100
            _download_tasks[task_id]["bytes"] = written
            _download_tasks[task_id]["total"] = written
            logger.info("Downloaded %s (%d MB)", filename, written >> 20)
        except Exception as exc:
            _download_tasks[task_id]["status"] = "error"
            _download_tasks[task_id]["error"] = str(exc)[:200]
            if os.path.isfile(dest):
                os.remove(dest)

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({"ok": True, "task_id": task_id, "filename": filename})


@app.route("/api/pbf/download/<task_id>")
def pbf_download_status(task_id):
    task = _download_tasks.get(task_id)
    if not task:
        return jsonify({"error": "Unknown task"}), 404
    elapsed = time.time() - task.get("start_time", time.time())
    return jsonify({**task, "elapsed": round(elapsed, 1)})


# ─── Reset ───────────────────────────────────────────────────────────────────

@app.route("/api/reset", methods=["POST"])
def api_reset():
    return jsonify({"ok": True, "center": DEFAULT_CENTER, "zoom": DEFAULT_ZOOM})


# ─── Query endpoints (unchanged logic) ───────────────────────────────────────

@app.route("/api/query", methods=["POST"])
def query():
    data = request.get_json(force=True)
    amenities = data.get("amenities", [])
    polygons = data.get("polygons", [])
    bbox = data.get("bbox", DEFAULT_BBOX)
    radius = data.get("radius", {})
    do_dissolve = data.get("dissolve", False)
    source_label = "Local PBF" if config.USE_PBF else "Overpass API"

    def generate():
        def emit(event_type, **kwargs):
            yield f"event: {event_type}\ndata: {json.dumps(kwargs)}\n\n"

        yield from emit("log", level="info", message=f"SimYourCity Engine starting | Source: {source_label}")
        yield from emit("log", level="info", message=f"Bounding box: {bbox[0]:.4f},{bbox[1]:.4f} to {bbox[2]:.4f},{bbox[3]:.4f}")
        yield from emit("config", amenities=amenities, bbox=bbox, polygons=polygons)
        yield from emit("progress", percent=5, message="Initializing...")

        total = len(amenities)
        poly_total = len(polygons)
        if total == 0 and poly_total == 0:
            yield from emit("log", level="warn", message="No amenities or polygon layers selected.")
            yield from emit("progress", percent=100, message="Nothing to do.")
            yield from emit("done", message="Complete.")
            return

        if total:
            labels = ", ".join(AMENITY_TYPES.get(a, {}).get("label", a) for a in amenities)
            yield from emit("log", level="info", message=f"Querying {total} point type(s): {labels}")
        if poly_total:
            plabels = ", ".join(POLYGON_TYPES.get(p, {}).get("label", p) for p in polygons)
            yield from emit("log", level="info", message=f"Querying {poly_total} polygon layer(s): {plabels}")
        yield from emit("progress", percent=15, message=f"Sending query ({total} point + {poly_total} polygon type(s))...")
        yield from emit("query", amenities=amenities, bbox=bbox, batch=True, polygons=polygons)

        counts = {}
        poly_counts = {}
        failed = []
        start_total = time.time()

        if total:
            try:
                grouped = engine.query_batch(amenities, bbox)
                n_found = len(grouped)
                for i, (amenity, fc) in enumerate(grouped.items()):
                    cfg = AMENITY_TYPES.get(amenity, {})
                    label = cfg.get("label", amenity)
                    rad = radius.get(amenity, cfg.get("radius", 500))
                    count = len(fc["features"])
                    counts[amenity] = count
                    pct = 15 + int((i / max(n_found, 1)) * 60)
                    yield from emit("progress", percent=pct, message=f"Processing {label}...")
                    yield from emit("log", level="success", message=f"Found {count} {label}")
                    if count > 0:
                        ev = {"amenity": amenity, "geojson": fc, "color": cfg.get("color", "#666"), "radius": rad, "dissolved": None}
                        if do_dissolve:
                            merged = dissolve_circles(fc, rad)
                            if merged:
                                ev["dissolved"] = merged
                        yield from emit("result", **ev)
                for a in amenities:
                    if a not in grouped:
                        counts[a] = 0
                        failed.append(a)
            except Exception as e:
                yield from emit("log", level="error", message=f"Query failed: {str(e)[:100]}")
                for a in amenities:
                    counts[a] = 0
                    failed.append(a)

        if poly_total:
            if engine.polygon_scan_required():
                yield from emit("log", level="warn", message="First polygon query: scanning local PBF for area features (one-time, ~2 min). Subsequent runs are instant.")
            try:
                poly_grouped = engine.query_polygons(polygons, bbox)
                for i, (key, fc) in enumerate(poly_grouped.items()):
                    cfg = POLYGON_TYPES.get(key, {})
                    label = cfg.get("label", key)
                    count = len(fc["features"])
                    poly_counts[key] = count
                    pct = 75 if total else 15
                    pct += int((i / max(len(poly_grouped), 1)) * 15)
                    yield from emit("progress", percent=pct, message=f"Processing {label}...")
                    yield from emit("log", level="success", message=f"Found {count} {label}")
                    yield from emit("polygon_result", key=key, geojson=fc, color=cfg.get("color", "#666"), label=label, count=count)
                for p in polygons:
                    if p not in poly_grouped:
                        poly_counts[p] = 0
                        failed.append(p)
            except Exception as e:
                yield from emit("log", level="error", message=f"Polygon query failed: {str(e)[:100]}")
                for p in polygons:
                    poly_counts[p] = 0
                    failed.append(p)

        elapsed = time.time() - start_total
        yield from emit("progress", percent=95, message="Finalizing...")
        yield from emit("log", level="info", message=f"Summary: {sum(counts.values())} POIs + {sum(poly_counts.values())} polygon areas in {elapsed:.1f}s")
        if failed:
            yield from emit("log", level="warn", message=f"No results for: {', '.join(failed)}")
        yield from emit("progress", percent=100, message="Done!")
        yield from emit("done", message="Query complete", counts=counts, total=sum(counts.values()), poly_counts=poly_counts, poly_total=sum(poly_counts.values()))

    return Response(generate(), mimetype="text/event-stream")


@app.route("/api/transit", methods=["POST"])
def transit():
    data = request.get_json(force=True)
    types = data.get("types", [])
    bbox = data.get("bbox", DEFAULT_BBOX)
    include_stops = data.get("stops", True)
    source_label = "Local PBF" if config.USE_PBF else "Overpass API"

    def generate():
        def emit(event_type, **kwargs):
            yield f"event: {event_type}\ndata: {json.dumps(kwargs)}\n\n"

        yield from emit("log", level="info", message=f"Transit engine starting | Source: {source_label}")
        yield from emit("log", level="info", message=f"Bounding box: {bbox[0]:.4f},{bbox[1]:.4f} to {bbox[2]:.4f},{bbox[3]:.4f}")
        yield from emit("progress", percent=5, message="Initializing transit query...")

        if not types:
            yield from emit("log", level="warn", message="No transit route types selected.")
            yield from emit("progress", percent=100, message="Nothing to do.")
            yield from emit("transit_done", message="Complete.", counts={}, total=0)
            return

        labels = ", ".join(TRANSIT_TYPES.get(t, {}).get("label", t) for t in types)
        yield from emit("log", level="info", message=f"Querying transit type(s): {labels}")
        if engine.transit_scan_required():
            yield from emit("log", level="warn", message="First transit query: scanning local PBF for route relations (one-time, ~2 min). Subsequent runs are instant.")
        yield from emit("progress", percent=15, message=f"Sending transit query ({len(types)} route type(s))...")
        yield from emit("query", transit=types, bbox=bbox, stops=include_stops)

        counts = {}
        try:
            start = time.time()
            result = engine.query_transit(types, bbox, include_stops)
            routes = result.get("routes", {})
            stop_fc = result.get("stops", {"type": "FeatureCollection", "features": []})
            elapsed = time.time() - start

            for i, t in enumerate(types):
                fc = routes.get(t)
                count = len(fc["features"]) if fc else 0
                counts[t] = count
                pct = 15 + int((i / max(len(types), 1)) * 60)
                yield from emit("progress", percent=pct, message=f"Processing {TRANSIT_TYPES.get(t, {}).get('label', t)}...")
                if count:
                    yield from emit("log", level="success", message=f"Found {count} {TRANSIT_TYPES.get(t, {}).get('label', t)}")
                    yield from emit("transit_routes", type=t, geojson=fc, color=TRANSIT_TYPES.get(t, {}).get("color", "#666"), label=TRANSIT_TYPES.get(t, {}).get("label", t), count=count)
                else:
                    yield from emit("log", level="info", message=f"No {TRANSIT_TYPES.get(t, {}).get('label', t)} in this area")

            stops_count = len(stop_fc["features"])
            if include_stops and stops_count:
                yield from emit("log", level="success", message=f"Found {stops_count} transit stops")
                yield from emit("transit_stops", geojson=stop_fc, count=stops_count)

            yield from emit("progress", percent=100, message=f"Transit query complete in {elapsed:.1f}s")
            yield from emit("log", level="info", message=f"Summary: {sum(counts.values())} routes + {stops_count if include_stops else 0} stops in {elapsed:.1f}s")
            yield from emit("transit_done", message="Transit query complete", counts=counts, total=sum(counts.values()), stops=stops_count if include_stops else 0)
        except Exception as e:
            yield from emit("log", level="error", message=f"Transit query failed: {str(e)[:100]}")
            yield from emit("progress", percent=100, message="Failed.")
            yield from emit("transit_done", message="Transit query failed", counts=counts, total=0)

    return Response(generate(), mimetype="text/event-stream")


@app.route("/api/amenities")
def get_amenities():
    return Response(json.dumps(AMENITY_TYPES), mimetype="application/json")


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("SimYourCity Engine")
    logger.info(f"Data source: {'Local PBF file' if config.USE_PBF else 'Overpass API'}")
    if config.USE_PBF:
        logger.info(f"PBF: {config.PBF_PATH}")
    logger.info(f"Default area: Islamabad, Pakistan")
    logger.info(f"Open: http://{HOST}:{PORT}")
    logger.info("=" * 50)
    app.run(host=HOST, port=PORT, debug=DEBUG, threaded=True)
