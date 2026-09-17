import os
import json

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
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = 60
MAX_RETRIES = 5
USER_AGENT = "SimYourCity/1.0 (educational; contact@simyourcity.dev)"

# ─── Default view — Islamabad, Pakistan ───────────────────────────────────────
DEFAULT_BBOX = [33.57, 72.82, 33.80, 73.20]
DEFAULT_CENTER = [73.0479, 33.6844]
DEFAULT_ZOOM = 14

# ─── Server config ────────────────────────────────────────────────────────────
HOST = "127.0.0.1"
PORT = 5000
DEBUG = False

# ─── GeoFabrik download catalogue ────────────────────────────────────────────
# continent → { country_name → relative_path }
# Complete catalogue scraped from download.geofabrik.de (Sep 2026)
GEOFABRIK_CATALOG = {
    "Africa": {
        "Algeria": "africa/algeria-latest.osm.pbf",
        "Angola": "africa/angola-latest.osm.pbf",
        "Benin": "africa/benin-latest.osm.pbf",
        "Botswana": "africa/botswana-latest.osm.pbf",
        "Burkina Faso": "africa/burkina-faso-latest.osm.pbf",
        "Burundi": "africa/burundi-latest.osm.pbf",
        "Cameroon": "africa/cameroon-latest.osm.pbf",
        "Canary Islands": "africa/canary-islands-latest.osm.pbf",
        "Cape Verde": "africa/cape-verde-latest.osm.pbf",
        "Central African Republic": "africa/central-african-republic-latest.osm.pbf",
        "Chad": "africa/chad-latest.osm.pbf",
        "Comores": "africa/comores-latest.osm.pbf",
        "Congo (Democratic Republic/Kinshasa)": "africa/congo-democratic-republic-kinshasa-latest.osm.pbf",
        "Congo (Republic/Brazzaville)": "africa/congo-republic-brazzaville-latest.osm.pbf",
        "Djibouti": "africa/djibouti-latest.osm.pbf",
        "Egypt": "africa/egypt-latest.osm.pbf",
        "Equatorial Guinea": "africa/equatorial-guinea-latest.osm.pbf",
        "Eritrea": "africa/eritrea-latest.osm.pbf",
        "Ethiopia": "africa/ethiopia-latest.osm.pbf",
        "Gabon": "africa/gabon-latest.osm.pbf",
        "Ghana": "africa/ghana-latest.osm.pbf",
        "Guinea": "africa/guinea-latest.osm.pbf",
        "Guinea-Bissau": "africa/guinea-bissau-latest.osm.pbf",
        "Ivory Coast": "africa/ivory-coast-latest.osm.pbf",
        "Kenya": "africa/kenya-latest.osm.pbf",
        "Lesotho": "africa/lesotho-latest.osm.pbf",
        "Liberia": "africa/liberia-latest.osm.pbf",
        "Libya": "africa/libya-latest.osm.pbf",
        "Madagascar": "africa/madagascar-latest.osm.pbf",
        "Malawi": "africa/malawi-latest.osm.pbf",
        "Mali": "africa/mali-latest.osm.pbf",
        "Mauritania": "africa/mauritania-latest.osm.pbf",
        "Mauritius": "africa/mauritius-latest.osm.pbf",
        "Morocco": "africa/morocco-latest.osm.pbf",
        "Mozambique": "africa/mozambique-latest.osm.pbf",
        "Namibia": "africa/namibia-latest.osm.pbf",
        "Niger": "africa/niger-latest.osm.pbf",
        "Nigeria": "africa/nigeria-latest.osm.pbf",
        "Rwanda": "africa/rwanda-latest.osm.pbf",
        "Sao Tome and Principe": "africa/sao-tome-and-principe-latest.osm.pbf",
        "Senegal and Gambia": "africa/senegal-and-gambia-latest.osm.pbf",
        "Seychelles": "africa/seychelles-latest.osm.pbf",
        "Sierra Leone": "africa/sierra-leone-latest.osm.pbf",
        "Somalia": "africa/somalia-latest.osm.pbf",
        "South Africa": "africa/south-africa-latest.osm.pbf",
        "South Sudan": "africa/south-sudan-latest.osm.pbf",
        "Sudan": "africa/sudan-latest.osm.pbf",
        "Swaziland": "africa/swaziland-latest.osm.pbf",
        "Tanzania": "africa/tanzania-latest.osm.pbf",
        "Togo": "africa/togo-latest.osm.pbf",
        "Tunisia": "africa/tunisia-latest.osm.pbf",
        "Uganda": "africa/uganda-latest.osm.pbf",
        "Zambia": "africa/zambia-latest.osm.pbf",
        "Zimbabwe": "africa/zimbabwe-latest.osm.pbf",
    },
    "Asia": {
        "Afghanistan": "asia/afghanistan-latest.osm.pbf",
        "Armenia": "asia/armenia-latest.osm.pbf",
        "Azerbaijan": "asia/azerbaijan-latest.osm.pbf",
        "Bangladesh": "asia/bangladesh-latest.osm.pbf",
        "Bhutan": "asia/bhutan-latest.osm.pbf",
        "Cambodia": "asia/cambodia-latest.osm.pbf",
        "China": "asia/china-latest.osm.pbf",
        "East Timor": "asia/east-timor-latest.osm.pbf",
        "GCC States": "asia/gcc-states-latest.osm.pbf",
        "India": "asia/india-latest.osm.pbf",
        "Indonesia (with East Timor)": "asia/indonesia-with-east-timor-latest.osm.pbf",
        "Iran": "asia/iran-latest.osm.pbf",
        "Iraq": "asia/iraq-latest.osm.pbf",
        "Israel and Palestine": "asia/israel-and-palestine-latest.osm.pbf",
        "Japan": "asia/japan-latest.osm.pbf",
        "Jordan": "asia/jordan-latest.osm.pbf",
        "Kazakhstan": "asia/kazakhstan-latest.osm.pbf",
        "Kyrgyzstan": "asia/kyrgyzstan-latest.osm.pbf",
        "Laos": "asia/laos-latest.osm.pbf",
        "Lebanon": "asia/lebanon-latest.osm.pbf",
        "Malaysia, Singapore, and Brunei": "asia/malaysia-singapore-and-brunei-latest.osm.pbf",
        "Maldives": "asia/maldives-latest.osm.pbf",
        "Mongolia": "asia/mongolia-latest.osm.pbf",
        "Myanmar (Burma)": "asia/myanmar-burma-latest.osm.pbf",
        "Nepal": "asia/nepal-latest.osm.pbf",
        "North Korea": "asia/north-korea-latest.osm.pbf",
        "Pakistan": "asia/pakistan-latest.osm.pbf",
        "Philippines": "asia/philippines-latest.osm.pbf",
        "Russian Federation": "asia/russian-federation-latest.osm.pbf",
        "South Korea": "asia/south-korea-latest.osm.pbf",
        "Sri Lanka": "asia/sri-lanka-latest.osm.pbf",
        "Syria": "asia/syria-latest.osm.pbf",
        "Taiwan": "asia/taiwan-latest.osm.pbf",
        "Tajikistan": "asia/tajikistan-latest.osm.pbf",
        "Thailand": "asia/thailand-latest.osm.pbf",
        "Turkmenistan": "asia/turkmenistan-latest.osm.pbf",
        "Uzbekistan": "asia/uzbekistan-latest.osm.pbf",
        "Vietnam": "asia/vietnam-latest.osm.pbf",
        "Yemen": "asia/yemen-latest.osm.pbf",
    },
    "Central America": {
        "Bahamas": "central-america/bahamas-latest.osm.pbf",
        "Belize": "central-america/belize-latest.osm.pbf",
        "Costa Rica": "central-america/costa-rica-latest.osm.pbf",
        "Cuba": "central-america/cuba-latest.osm.pbf",
        "El Salvador": "central-america/el-salvador-latest.osm.pbf",
        "Guatemala": "central-america/guatemala-latest.osm.pbf",
        "Haiti and Dominican Republic": "central-america/haiti-and-dominican-republic-latest.osm.pbf",
        "Honduras": "central-america/honduras-latest.osm.pbf",
        "Jamaica": "central-america/jamaica-latest.osm.pbf",
        "Nicaragua": "central-america/nicaragua-latest.osm.pbf",
        "Panama": "central-america/panama-latest.osm.pbf",
    },
    "Europe": {
        "Albania": "europe/albania-latest.osm.pbf",
        "Andorra": "europe/andorra-latest.osm.pbf",
        "Austria": "europe/austria-latest.osm.pbf",
        "Azores": "europe/azores-latest.osm.pbf",
        "Belarus": "europe/belarus-latest.osm.pbf",
        "Belgium": "europe/belgium-latest.osm.pbf",
        "Bosnia-Herzegovina": "europe/bosnia-herzegovina-latest.osm.pbf",
        "Bulgaria": "europe/bulgaria-latest.osm.pbf",
        "Croatia": "europe/croatia-latest.osm.pbf",
        "Cyprus": "europe/cyprus-latest.osm.pbf",
        "Czech Republic": "europe/czech-republic-latest.osm.pbf",
        "Denmark": "europe/denmark-latest.osm.pbf",
        "Estonia": "europe/estonia-latest.osm.pbf",
        "Faroe Islands": "europe/faroe-islands-latest.osm.pbf",
        "Finland": "europe/finland-latest.osm.pbf",
        "France": "europe/france-latest.osm.pbf",
        "Georgia": "europe/georgia-latest.osm.pbf",
        "Germany": "europe/germany-latest.osm.pbf",
        "Great Britain": "europe/great-britain-latest.osm.pbf",
        "Greece": "europe/greece-latest.osm.pbf",
        "Guernsey and Jersey": "europe/guernsey-and-jersey-latest.osm.pbf",
        "Hungary": "europe/hungary-latest.osm.pbf",
        "Iceland": "europe/iceland-latest.osm.pbf",
        "Ireland and Northern Ireland": "europe/ireland-and-northern-ireland-latest.osm.pbf",
        "Isle of Man": "europe/isle-of-man-latest.osm.pbf",
        "Italy": "europe/italy-latest.osm.pbf",
        "Kosovo": "europe/kosovo-latest.osm.pbf",
        "Latvia": "europe/latvia-latest.osm.pbf",
        "Liechtenstein": "europe/liechtenstein-latest.osm.pbf",
        "Lithuania": "europe/lithuania-latest.osm.pbf",
        "Luxembourg": "europe/luxembourg-latest.osm.pbf",
        "Macedonia": "europe/macedonia-latest.osm.pbf",
        "Malta": "europe/malta-latest.osm.pbf",
        "Moldova": "europe/moldova-latest.osm.pbf",
        "Monaco": "europe/monaco-latest.osm.pbf",
        "Montenegro": "europe/montenegro-latest.osm.pbf",
        "Netherlands": "europe/netherlands-latest.osm.pbf",
        "Norway": "europe/norway-latest.osm.pbf",
        "Poland": "europe/poland-latest.osm.pbf",
        "Portugal": "europe/portugal-latest.osm.pbf",
        "Romania": "europe/romania-latest.osm.pbf",
        "Russian Federation": "europe/russian-federation-latest.osm.pbf",
        "Serbia": "europe/serbia-latest.osm.pbf",
        "Slovakia": "europe/slovakia-latest.osm.pbf",
        "Slovenia": "europe/slovenia-latest.osm.pbf",
        "Spain": "europe/spain-latest.osm.pbf",
        "Sweden": "europe/sweden-latest.osm.pbf",
        "Switzerland": "europe/switzerland-latest.osm.pbf",
        "Turkey": "europe/turkey-latest.osm.pbf",
        "Ukraine (with Crimea)": "europe/ukraine-with-crimea-latest.osm.pbf",
        "United Kingdom": "europe/united-kingdom-latest.osm.pbf",
    },
    "North America": {
        "Canada": "north-america/canada-latest.osm.pbf",
        "Greenland": "north-america/greenland-latest.osm.pbf",
        "Mexico": "north-america/mexico-latest.osm.pbf",
        "United States": "north-america/us-latest.osm.pbf",
    },
    "South America": {
        "Argentina": "south-america/argentina-latest.osm.pbf",
        "Bolivia": "south-america/bolivia-latest.osm.pbf",
        "Brazil": "south-america/brazil-latest.osm.pbf",
        "Chile": "south-america/chile-latest.osm.pbf",
        "Colombia": "south-america/colombia-latest.osm.pbf",
        "Ecuador": "south-america/ecuador-latest.osm.pbf",
        "Guyana": "south-america/guyana-latest.osm.pbf",
        "Paraguay": "south-america/paraguay-latest.osm.pbf",
        "Peru": "south-america/peru-latest.osm.pbf",
        "Suriname": "south-america/suriname-latest.osm.pbf",
        "Uruguay": "south-america/uruguay-latest.osm.pbf",
        "Venezuela": "south-america/venezuela-latest.osm.pbf",
    },
    "Oceania": {
        "Australia": "australia-oceania/australia-latest.osm.pbf",
        "Cook Islands": "australia-oceania/cook-islands-latest.osm.pbf",
        "Fiji": "australia-oceania/fiji-latest.osm.pbf",
        "Kiribati": "australia-oceania/kiribati-latest.osm.pbf",
        "Marshall Islands": "australia-oceania/marshall-islands-latest.osm.pbf",
        "Micronesia": "australia-oceania/micronesia-latest.osm.pbf",
        "Nauru": "australia-oceania/nauru-latest.osm.pbf",
        "New Caledonia": "australia-oceania/new-caledonia-latest.osm.pbf",
        "New Zealand": "australia-oceania/new-zealand-latest.osm.pbf",
        "Niue": "australia-oceania/niue-latest.osm.pbf",
        "Palau": "australia-oceania/palau-latest.osm.pbf",
        "Papua New Guinea": "australia-oceania/papua-new-guinea-latest.osm.pbf",
        "Samoa": "australia-oceania/samoa-latest.osm.pbf",
        "Solomon Islands": "australia-oceania/solomon-islands-latest.osm.pbf",
        "Tonga": "australia-oceania/tonga-latest.osm.pbf",
        "Tuvalu": "australia-oceania/tuvalu-latest.osm.pbf",
        "Vanuatu": "australia-oceania/vanuatu-latest.osm.pbf",
    },
}

GEOFABRIK_BASE = "https://download.geofabrik.de/"


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
