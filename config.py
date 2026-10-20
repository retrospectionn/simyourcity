import os
import json
import logging
import requests

# ─── Project paths ───────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PBF_DIR = os.path.join(BASE_DIR, "pbf_files")
STATE_FILE = os.path.join(BASE_DIR, "simyourcity_state.json")

os.makedirs(PBF_DIR, exist_ok=True)


def _load_state():
    try:
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


_state = _load_state()

# ─── PBF file management ─────────────────────────────────────────────────────
# PBF_PATH is the currently active file; refreshed on every request via /api/pbf/status.
PBF_PATH = _state.get("active_pbf", "")
USE_PBF = os.path.isfile(PBF_PATH) if PBF_PATH else False

# ─── Overpass API ─────────────────────────────────────────────────────────────
# Off during the mapathon; re-enable here and in static/js/simyourcity.js afterwards.
OVERPASS_ENABLED = False
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = 60
MAX_RETRIES = 5
USER_AGENT = "SimYourCity/1.0 (educational; open-source project)"

# ─── Default view — COMSATS University, Islamabad ────────────────────────────
DEFAULT_BBOX = [33.635, 73.135, 33.665, 73.175]
DEFAULT_CENTER = [73.1549, 33.6498]
DEFAULT_ZOOM = 15

# ─── Server config ────────────────────────────────────────────────────────────
HOST = "127.0.0.1"
PORT = 5000
DEBUG = False

# ─── GeoFabrik download catalogue ────────────────────────────────────────────
# continent → { region_name → relative_path }, loaded lazily from GeoFabrik's
# own machine-readable index (no hardcoded list).
GEOFABRIK_BASE = "https://download.geofabrik.de/"
INDEX_URL = GEOFABRIK_BASE + "index-v1-nogeom.json"
INDEX_CACHE_FILE = os.path.join(BASE_DIR, "geofabrik_index.json")

logger = logging.getLogger(__name__)
_geofabrik_catalog = None


def _group_catalog(payload):
    """Pure: {continent: {region: relative_path}} from an index payload."""
    props = {f["properties"]["id"]: f["properties"] for f in payload.get("features", [])}
    catalog = {}
    for p in props.values():
        pbf = (p.get("urls") or {}).get("pbf", "")
        if not pbf.startswith(GEOFABRIK_BASE):
            continue
        top, seen = p, set()
        while top.get("parent") in props and top["parent"] not in seen:
            seen.add(top["parent"])
            top = props[top["parent"]]
        if top is p or top.get("parent"):
            continue  # planet/root entry, or a region whose continent is missing
        catalog.setdefault(top["name"], {})[p["name"]] = pbf[len(GEOFABRIK_BASE):]
    return catalog


def load_geofabrik_catalog():
    """Memoized catalogue; never raises so the app can start offline."""
    global _geofabrik_catalog
    if _geofabrik_catalog is not None:
        return _geofabrik_catalog
    try:
        resp = requests.get(INDEX_URL, timeout=30)
        resp.raise_for_status()
        payload = resp.json()
        try:
            with open(INDEX_CACHE_FILE, "w") as f:
                json.dump(payload, f)
        except Exception:
            pass
    except Exception as exc:
        logger.warning("GeoFabrik index fetch failed (%s); trying cache", exc)
        try:
            with open(INDEX_CACHE_FILE) as f:
                payload = json.load(f)
        except Exception as exc2:
            logger.warning("GeoFabrik cache unusable (%s); empty catalogue", exc2)
            return {}
    _geofabrik_catalog = _group_catalog(payload)
    return _geofabrik_catalog


# ─── Amenities list ──────────────────────────────────────────────────────────
AMENITY_TYPES = {
    "fuel": {"color": "#FF6B35", "icon": "fuel", "radius": 300, "label": "Fuel Stations"},
    "police": {"color": "#004E89", "icon": "police", "radius": 500, "label": "Police Stations"},
    "fire_station": {"color": "#E63946", "icon": "fire", "radius": 500, "label": "Fire Departments"},
    "hospital": {"color": "#D62828", "icon": "hospital", "radius": 1000, "label": "Hospitals"},
    "school": {"color": "#2A9D8F", "icon": "school", "radius": 800, "label": "Schools"},
    "graveyard": {"color": "#6B705C", "icon": "graveyard", "radius": 200, "label": "Graveyards"},
    "bank": {"color": "#F4A261", "icon": "bank", "radius": 500, "label": "Banks"},
    "post_office": {"color": "#264653", "icon": "post", "radius": 500, "label": "Post Offices"},
    "library": {"color": "#1D3557", "icon": "library", "radius": 800, "label": "Libraries"},
    "townhall": {"color": "#457B9D", "icon": "townhall", "radius": 500, "label": "Town Halls"},
    "pharmacy": {"color": "#2EC4B6", "icon": "pharmacy", "radius": 500, "label": "Pharmacies"},
    "place_of_worship": {"color": "#9B5DE5", "icon": "worship", "radius": 500, "label": "Places of Worship"},
    "restaurant": {"color": "#F15BB5", "icon": "restaurant", "radius": 300, "label": "Restaurants"},
    "cafe": {"color": "#FEE440", "icon": "cafe", "radius": 300, "label": "Cafes"},
    "parking": {"color": "#00BBF9", "icon": "parking", "radius": 200, "label": "Parking"},
    "bus_stop": {
        "color": "#FFB300", "icon": "bus_stop", "radius": 120, "label": "Bus Stops",
        "tags": [("highway", "bus_stop")],
    },
    "bench": {"color": "#A1887F", "icon": "bench", "radius": 100, "label": "Benches"},
    "atm": {"color": "#B0BEC5", "icon": "atm", "radius": 200, "label": "ATMs"},
    "post_box": {"color": "#795548", "icon": "post_box", "radius": 150, "label": "Post Boxes"},
    "recycling": {"color": "#63A66A", "icon": "recycling", "radius": 200, "label": "Recycling"},
    "toilets": {"color": "#90A4AE", "icon": "toilets", "radius": 150, "label": "Public Toilets"},
    "drinking_water": {"color": "#26C6DA", "icon": "water", "radius": 100, "label": "Drinking Water"},
    "taxi": {"color": "#FDD835", "icon": "taxi", "radius": 200, "label": "Taxi Stands"},
    "charging_station": {"color": "#00E676", "icon": "charging", "radius": 200, "label": "Charging Stations"},
    "car_wash": {"color": "#5C6BC0", "icon": "car_wash", "radius": 300, "label": "Car Washes"},
}

# ─── Public transport (route relation) layers ────────────────────────────────
TRANSIT_TYPES = {
    "bus": {"color": "#4FC3F7", "label": "Bus Routes"},
    "trolleybus": {"color": "#FFD54F", "label": "Trolleybus Routes"},
    "tram": {"color": "#E040FB", "label": "Tram Routes"},
    "subway": {"color": "#E53935", "label": "Metro / Subway"},
    "light_rail": {"color": "#00BCD4", "label": "Light Rail"},
    "train": {"color": "#FF9800", "label": "Train Routes"},
    "ferry": {"color": "#4CAF50", "label": "Ferry Routes"},
}

# ─── Polygon (area) layers ───────────────────────────────────────────────────
POLYGON_TYPES = {
    "construction": {
        "color": "#FF9800", "label": "Construction Areas",
        "tags": [("landuse", "construction")],
    },
    "university": {
        "color": "#9C27B0", "label": "University Grounds",
        "tags": [("amenity", "university"), ("amenity", "college"), ("landuse", "education")],
    },
    "school": {
        "color": "#2A9D8F", "label": "School Grounds",
        "tags": [("amenity", "school"), ("amenity", "kindergarten")],
    },
    "hospital": {
        "color": "#D62828", "label": "Hospital Grounds",
        "tags": [("amenity", "hospital")],
    },
    "green_space": {
        "color": "#4CAF50", "label": "Green Spaces",
        "tags": [
            ("natural", "wood"), ("landuse", "forest"), ("landuse", "grass"),
            ("natural", "grassland"), ("natural", "scrub"), ("landuse", "shrub"),
            ("landuse", "meadow"), ("leisure", "park"), ("leisure", "garden"),
            ("landuse", "recreation_ground"),
        ],
    },
}
