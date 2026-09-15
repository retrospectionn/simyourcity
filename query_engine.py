import requests
import time
import random
import math
import logging

import shapely  # noqa: F401 (used by dissolve_circles / transit merge)
import shapely.geometry
import shapely.ops

logger = logging.getLogger(__name__)

def _amenity_rules(amenity_types, amenity_keys):
    """Resolve each amenity key to a list of (tag_key, tag_value) pairs.

    Amenities without an explicit 'tags' entry default to amenity=<key>.
    """
    rules = {}
    for key in amenity_keys:
        cfg = amenity_types.get(key, {})
        pairs = cfg.get("tags")
        rules[key] = pairs or [("amenity", key)]
    return rules

def _match_amenity(rules, tags):
    """Return the first amenity key whose tag pair matches, else None."""
    for key, pairs in rules.items():
        if any(tags.get(k) == v for k, v in pairs):
            return key
    return None

def dissolve_circles(geojson_fc, radius_meters):
    """Dissolve overlapping radius circles into merged polygons.

    Takes a GeoJSON FeatureCollection of points, buffers each by
    radius_meters, and returns a single merged (dissolved) MultiPolygon
    geometry as GeoJSON.  Returns None when there are no features.
    """
    features = geojson_fc.get("features", [])
    if not features:
        return None

    lats = [f["geometry"]["coordinates"][1] for f in features]
    avg_lat = sum(lats) / len(lats)
    cos_lat = math.cos(math.radians(avg_lat)) or 0.0001

    # metres per degree at this latitude
    m_per_deg = 111320.0 * cos_lat
    radius_deg = radius_meters / m_per_deg

    buffers = []
    for f in features:
        lon, lat = f["geometry"]["coordinates"]
        pt = shapely.geometry.Point(lon, lat)
        buffers.append(pt.buffer(radius_deg, resolution=16))

    merged = shapely.ops.unary_union(buffers)
    return shapely.geometry.mapping(merged) if not merged.is_empty else None


class OverpassEngine:
    def __init__(self, config):
        self.url = config.OVERPASS_URL
        self.max_retries = config.MAX_RETRIES
        self.user_agent = config.USER_AGENT
        self.timeout = config.OVERPASS_TIMEOUT
        self.polygon_types = getattr(config, "POLYGON_TYPES", {})
        self.amenity_types = getattr(config, "AMENITY_TYPES", {})
        self.transit_types = getattr(config, "TRANSIT_TYPES", {})

    def _post(self, overpass_query):
        """POST a raw Overpass query with retry/backoff. Returns parsed JSON."""
        headers = {
            "Accept": "application/json, text/plain, */*",
            "User-Agent": self.user_agent,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        }

        for attempt in range(self.max_retries):
            try:
                resp = requests.post(
                    self.url,
                    data=overpass_query.encode("utf-8"),
                    headers=headers,
                    timeout=self.timeout,
                )
                if resp.status_code == 429:
                    wait = min(2 ** attempt * 2 + random.random() * 3, 45)
                    logger.warning(
                        "Rate limited, retry %d/%d in %.1fs",
                        attempt + 1, self.max_retries, wait,
                    )
                    time.sleep(wait)
                    continue

                if resp.status_code in (406, 502, 503, 504):
                    wait = 2 ** attempt + random.random() * 2
                    logger.warning(
                        "HTTP %d, retry %d/%d in %.1fs",
                        resp.status_code, attempt + 1, self.max_retries, wait,
                    )
                    time.sleep(wait)
                    continue

                resp.raise_for_status()
                return resp.json()

            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
                if attempt == self.max_retries - 1:
                    raise
                wait = 2 ** attempt + random.random() * 2
                logger.warning(
                    "%s, retry %d/%d in %.1fs",
                    e.__class__.__name__, attempt + 1, self.max_retries, wait,
                )
                time.sleep(wait)

            except requests.exceptions.RequestException as e:
                if attempt == self.max_retries - 1:
                    raise
                wait = 2 ** attempt + random.random() * 2
                logger.warning(
                    "Request error: %s, retry %d/%d in %.1fs",
                    str(e)[:50], attempt + 1, self.max_retries, wait,
                )
                time.sleep(wait)

        return None

    def query_batch(self, amenities, bbox):
        """Query multiple amenity types in a single Overpass call."""
        bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
        rules = _amenity_rules(self.amenity_types, amenities)
        parts = []
        for pairs in rules.values():
            for k, v in pairs:
                parts.append(f'  node["{k}"="{v}"]({bbox_str});')
        overpass_query = (
            f"[out:json][timeout:90];\n"
            f"(\n{chr(10).join(parts)}\n);\n"
            f"out center;"
        )

        data = self._post(overpass_query)
        return self._group_by_amenity(data.get("elements", []), rules) if data else {}

    def query_polygons(self, polygon_keys, bbox):
        """Query polygon (area) layers: one Overpass call per layer, ways with full geometry."""
        bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
        results = {}

        for key in polygon_keys:
            cfg = self.polygon_types.get(key, {})
            tag_pairs = cfg.get("tags", [])
            if not tag_pairs:
                continue
            parts = "\n".join(
                f'  way["{k}"="{v}"]({bbox_str});'
                for k, v in tag_pairs
            )
            overpass_query = (
                f"[out:json][timeout:90];\n"
                f"(\n{parts}\n);\n"
                f"out geom;"
            )

            data = self._post(overpass_query)
            if not data:
                continue

            features = []
            seen = set()
            for e in data.get("elements", []):
                if e.get("type") != "way" or e.get("id") in seen:
                    continue
                seen.add(e.get("id"))
                geom = e.get("geometry")
                if not geom or len(geom) < 3:
                    continue
                tags = e.get("tags", {})
                coords = [(g["lon"], g["lat"]) for g in geom]
                if not self._ring_intersects(coords, bbox):
                    continue
                features.append(self._polygon_feature(e["id"], coords, tags, key))
                if len(features) >= 1000:
                    break

            if features:
                results[key] = {
                    "type": "FeatureCollection",
                    "features": features,
                }

        return results

    def _ring_intersects(self, coords, bbox):
        minx = min(c[0] for c in coords)
        maxx = max(c[0] for c in coords)
        miny = min(c[1] for c in coords)
        maxy = max(c[1] for c in coords)
        return not (maxx < bbox[1] or minx > bbox[3] or maxy < bbox[0] or miny > bbox[2])

    def _polygon_feature(self, way_id, coords, tags, key):
        return {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [coords]},
            "properties": {"id": way_id, "name": tags.get("name", ""), "kind": key},
        }

    def query_transit(self, transit_types, bbox, include_stops):
        """Query public transport route relations (single Overpass call, full geometry)."""
        bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
        kinds = "|".join(transit_types)
        overpass_query = (
            f"[out:json][timeout:90];\n"
            f'relation["type"="route"]["route"~"^({kinds})$"]({bbox_str});\n'
            f"out geom;"
        )

        data = self._post(overpass_query)
        if not data:
            return {"routes": {}, "stops": {"type": "FeatureCollection", "features": []}}

        routes = {}
        stops = []
        seen = set()
        for e in data.get("elements", []):
            if e.get("type") != "relation" or e.get("id") in seen:
                continue
            seen.add(e.get("id"))
            tags = e.get("tags", {})
            kind = tags.get("route")
            if kind not in transit_types:
                continue
            name = tags.get("name", "")
            ref = tags.get("ref", "")

            parts = []
            for m in e.get("members", []):
                if m.get("type") != "way":
                    continue
                geom = m.get("geometry")
                if not geom or len(geom) < 2:
                    continue
                coords = [(g["lon"], g["lat"]) for g in geom]
                if coords[0] == coords[-1]:
                    coords = coords[:-1]
                line = shapely.geometry.LineString(coords)
                if len(coords) > 40:
                    line = line.simplify(0.00005, preserve_topology=True)
                    if len(line.coords) < 2:
                        line = shapely.geometry.LineString(coords)
                parts.append(line)

            merged = shapely.ops.linemerge(parts) if parts else None
            if merged is None or merged.is_empty:
                continue
            minx, miny, maxx, maxy = merged.bounds
            if maxx - minx > 0.5 or maxy - miny > 0.5:
                merged = merged.simplify(0.0002, preserve_topology=True)
            if merged.geom_type == "MultiLineString":
                lines = [list(g.coords) for g in merged.geoms]
            else:
                lines = [list(merged.coords)]

            route_stops = []
            for m in e.get("members", []):
                if m.get("type") != "node":
                    continue
                g = m.get("geometry")
                if g:
                    lon, lat = g[0]["lon"], g[0]["lat"]
                elif m.get("lat") is not None:
                    lon, lat = m["lon"], m["lat"]
                else:
                    continue
                if not (bbox[0] <= lat <= bbox[2] and bbox[1] <= lon <= bbox[3]):
                    continue
                route_stops.append((lon, lat))

            geometry = (
                {"type": "LineString", "coordinates": lines[0]}
                if len(lines) == 1
                else {"type": "MultiLineString", "coordinates": lines}
            )
            feature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": {"id": e.get("id"), "name": name, "ref": ref, "kind": kind},
            }
            routes.setdefault(kind, {"type": "FeatureCollection", "features": []})
            routes[kind]["features"].append(feature)
            stops.extend(route_stops)

        seen_pts = set()
        stop_features = []
        for lon, lat in stops:
            k = (round(lon, 5), round(lat, 5))
            if k in seen_pts:
                continue
            seen_pts.add(k)
            stop_features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {"name": ""},
            })

        return {
            "routes": routes,
            "stops": {"type": "FeatureCollection", "features": stop_features},
        }

    def _group_by_amenity(self, elements, rules):
        """Group raw OSM elements by amenity key and return GeoJSON per key."""
        groups = {}
        seen = {}
        for e in elements:
            lat = e.get("lat")
            if lat is None:
                center = e.get("center")
                if center:
                    lat = center.get("lat")
                    lon = center.get("lon")
                else:
                    continue
            else:
                lon = e.get("lon")

            tags = e.get("tags", {})
            key_name = _match_amenity(rules, tags)
            if not key_name:
                continue

            dedup_key = (key_name, round(lat, 5), round(lon, 5))
            if dedup_key in seen:
                continue
            seen[dedup_key] = True

            if key_name not in groups:
                groups[key_name] = {"type": "FeatureCollection", "features": []}

            name = tags.get("name", "")
            groups[key_name]["features"].append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {"id": e.get("id"), "name": name, "amenity": key_name},
            })

        return groups


class PbfEngine:
    def __init__(self, config):
        self.pbf_path = config.PBF_PATH
        self.available = config.USE_PBF
        self.polygon_types = getattr(config, "POLYGON_TYPES", {})
        self.amenity_types = getattr(config, "AMENITY_TYPES", {})
        self._poly_cache = None  # {key: [{"id","name","coords","minx","maxx","miny","maxy"}]}
        self._cache_loaded = False
        self._cache_failed = False
        self.transit_types = getattr(config, "TRANSIT_TYPES", {})
        self._transit_cache = None  # list of route records (see _build_transit_cache)
        self._transit_loaded = False
        self._transit_failed = False

    # --- Polygon (area) layers ---

    @property
    def polygon_cache_ready(self):
        return self._poly_cache is not None

    def _polygon_cache_path(self):
        return self.pbf_path + ".polys.pkl"

    def _build_polygon_cache(self):
        """Full-file scan resolving way node locations (once per process / pickle cache)."""
        import os
        import pickle

        cache_path = self._polygon_cache_path()
        try:
            if os.path.isfile(cache_path):
                with open(cache_path, "rb") as f:
                    payload = pickle.load(f)
                st = os.stat(self.pbf_path)
                if (payload.get("pbf_size"), payload.get("pbf_mtime")) == (st.st_size, st.st_mtime):
                    logger.info("Polygon cache loaded from %s", cache_path)
                    self._poly_cache = payload["cache"]
                    self._cache_loaded = True
                    return
        except Exception as e:
            logger.warning("Polygon cache load failed: %s", e)

        import osmium

        rules = {k: v["tags"] for k, v in self.polygon_types.items()}

        class _PolyHandler(osmium.SimpleHandler):
            def __init__(self):
                super().__init__()
                self.cache = {k: [] for k in rules}

            def way(self, w):
                if not w.tags or len(w.nodes) < 3:
                    return
                tags = {t.k: t.v for t in w.tags}
                for key, pairs in rules.items():
                    if any(tags.get(k) == v for k, v in pairs):
                        pts = [
                            (n.location.lon, n.location.lat)
                            for n in w.nodes
                            if n.location.valid()
                        ]
                        if len(pts) >= 3:
                            xs = [p[0] for p in pts]
                            ys = [p[1] for p in pts]
                            self.cache[key].append({
                                "id": w.id,
                                "name": tags.get("name", ""),
                                "coords": pts,
                                "minx": min(xs), "maxx": max(xs),
                                "miny": min(ys), "maxy": max(ys),
                            })
                        return

        logger.info("Scanning PBF file for polygon layers (first run takes a few minutes)...")
        handler = _PolyHandler()
        handler.apply_file(self.pbf_path, locations=True, idx="sparse_file_array")

        cache = self._simplify_cache(handler.cache)
        self._poly_cache = cache

        try:
            with open(cache_path, "wb") as f:
                st = os.stat(self.pbf_path)
                pickle.dump(
                    {"pbf_size": st.st_size, "pbf_mtime": st.st_mtime, "cache": cache},
                    f, protocol=pickle.HIGHEST_PROTOCOL,
                )
            logger.info("Polygon cache saved to %s", cache_path)
        except Exception as e:
            logger.warning("Polygon cache save failed: %s", e)

    def _simplify_cache(self, cache):
        out = {}
        for key, rings in cache.items():
            simple = []
            for r in rings:
                ring = shapely.geometry.LineString(r["coords"])
                if len(r["coords"]) > 40:
                    ring = ring.simplify(0.00005, preserve_topology=False)
                    if len(ring.coords) < 3:
                        ring = shapely.geometry.LineString(r["coords"])
                coords = list(ring.coords)
                xs = [c[0] for c in coords]
                ys = [c[1] for c in coords]
                simple.append({
                    "id": r["id"], "name": r["name"], "coords": coords,
                    "minx": min(xs), "maxx": max(xs),
                    "miny": min(ys), "maxy": max(ys),
                })
            out[key] = simple
        return out

    def query_polygons(self, polygon_keys, bbox):
        if not self.available or not polygon_keys:
            return {}
        if self._poly_cache is None:
            try:
                self._build_polygon_cache()
            except MemoryError:
                logger.error("Not enough memory for PBF polygon scan")
                return {}
            except Exception as e:
                logger.warning("PBF polygon scan failed: %s", e)
                self._cache_failed = True
                return {}

        results = {}
        bbox_t = tuple(bbox)
        for key in polygon_keys:
            features = []
            seen = set()
            for r in self._poly_cache.get(key, []):
                if r["id"] in seen:
                    continue
                if not (r["maxx"] < bbox_t[1] or r["minx"] > bbox_t[3]
                        or r["maxy"] < bbox_t[0] or r["miny"] > bbox_t[2]):
                    seen.add(r["id"])
                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "Polygon", "coordinates": [r["coords"]]},
                        "properties": {"id": r["id"], "name": r["name"], "kind": key},
                    })
            if features:
                results[key] = {"type": "FeatureCollection", "features": features}

        return results

    # --- Public transport (route relation) layers ---

    @property
    def transit_cache_ready(self):
        return self._transit_cache is not None

    def _transit_cache_path(self):
        return self.pbf_path + ".transit.v2.pkl"

    def _build_transit_cache(self):
        """Two-pass full-file scan resolving route relation member geometries."""
        import os
        import pickle

        cache_path = self._transit_cache_path()
        try:
            if os.path.isfile(cache_path):
                with open(cache_path, "rb") as f:
                    payload = pickle.load(f)
                st = os.stat(self.pbf_path)
                if (payload.get("pbf_size"), payload.get("pbf_mtime")) == (st.st_size, st.st_mtime):
                    logger.info("Transit cache loaded from %s", cache_path)
                    self._transit_cache = payload["cache"]
                    self._transit_loaded = True
                    return
        except Exception as e:
            logger.warning("Transit cache load failed: %s", e)

        import osmium

        kinds = set(self.transit_types)

        class _RelHandler(osmium.SimpleHandler):
            def __init__(self):
                super().__init__()
                self.routes = {}
                self.way_ids = set()
                self.node_ids = set()

            def relation(self, r):
                if not r.tags:
                    return
                tags = {t.k: t.v for t in r.tags}
                if tags.get("type") != "route" or tags.get("route") not in kinds:
                    return
                ways, nodes = [], []
                for m in r.members:
                    if m.type == "w":
                        ways.append(m.ref)
                        self.way_ids.add(m.ref)
                    elif m.type == "n":
                        nodes.append(m.ref)
                        self.node_ids.add(m.ref)
                self.routes[r.id] = {
                    "id": r.id,
                    "kind": tags.get("route"),
                    "name": tags.get("name", ""),
                    "ref": tags.get("ref", ""),
                    "ways": ways,
                    "nodes": nodes,
                }

        class _GeoHandler(osmium.SimpleHandler):
            def __init__(self, way_ids, node_ids):
                super().__init__()
                self.way_ids = way_ids
                self.node_ids = node_ids
                self.way_geom = {}
                self.node_loc = {}

            def node(self, n):
                if n.id in self.node_ids and n.location.valid():
                    self.node_loc[n.id] = (n.location.lon, n.location.lat)

            def way(self, w):
                if w.id in self.way_ids and w.nodes:
                    pts = [
                        (n.location.lon, n.location.lat)
                        for n in w.nodes
                        if n.location.valid()
                    ]
                    if len(pts) >= 2:
                        self.way_geom[w.id] = pts

        logger.info(
            "Scanning PBF file for transit routes (first run takes ~2 min)..."
        )
        rel_handler = _RelHandler()
        rel_handler.apply_file(self.pbf_path, locations=False)

        geo_handler = _GeoHandler(rel_handler.way_ids, rel_handler.node_ids)
        geo_handler.apply_file(self.pbf_path, locations=True, idx="sparse_file_array")

        cache = []
        for r in rel_handler.routes.values():
            parts = []
            for wid in r["ways"]:
                pts = geo_handler.way_geom.get(wid)
                if pts:
                    line = shapely.geometry.LineString(pts)
                    if len(pts) > 40:
                        line = line.simplify(0.00005, preserve_topology=True)
                        if len(line.coords) < 2:
                            line = shapely.geometry.LineString(pts)
                    parts.append(line)
            if not parts:
                continue
            merged = (
                shapely.ops.linemerge(parts)
                if len(parts) > 1
                else parts[0]
            )
            if merged is None or merged.is_empty:
                continue
            minx, miny, maxx, maxy = merged.bounds
            if maxx - minx > 0.5 or maxy - miny > 0.5:
                merged = merged.simplify(0.0002, preserve_topology=True)
            if merged.geom_type == "MultiLineString":
                lines = [list(g.coords) for g in merged.geoms]
            else:
                lines = [list(merged.coords)]

            xs, ys = [], []
            for line in lines:
                for c in line:
                    xs.append(c[0])
                    ys.append(c[1])
            if len(xs) < 2:
                continue

            stops = [
                geo_handler.node_loc[nid]
                for nid in r["nodes"]
                if nid in geo_handler.node_loc
            ]
            cache.append({
                "id": r["id"],
                "kind": r["kind"],
                "name": r["name"],
                "ref": r["ref"],
                "lines": lines,
                "stops": stops,
                "minx": min(xs), "maxx": max(xs),
                "miny": min(ys), "maxy": max(ys),
            })

        self._transit_cache = cache

        try:
            with open(cache_path, "wb") as f:
                st = os.stat(self.pbf_path)
                pickle.dump(
                    {"pbf_size": st.st_size, "pbf_mtime": st.st_mtime, "cache": cache},
                    f, protocol=pickle.HIGHEST_PROTOCOL,
                )
            logger.info("Transit cache saved to %s", cache_path)
        except Exception as e:
            logger.warning("Transit cache save failed: %s", e)

    def query_transit(self, transit_types, bbox, include_stops):
        if not self.available or not transit_types:
            return {"routes": {}, "stops": {"type": "FeatureCollection", "features": []}}
        if self._transit_cache is None:
            try:
                self._build_transit_cache()
            except MemoryError:
                logger.error("Not enough memory for PBF transit scan")
                return {"routes": {}, "stops": {"type": "FeatureCollection", "features": []}}
            except Exception as e:
                logger.warning("PBF transit scan failed: %s", e)
                self._transit_failed = True
                return {"routes": {}, "stops": {"type": "FeatureCollection", "features": []}}

        kinds = set(transit_types)
        routes = {}
        stops = []
        bbox_t = tuple(bbox)
        for r in self._transit_cache:
            if r["kind"] not in kinds:
                continue
            if (r["maxx"] < bbox_t[1] or r["minx"] > bbox_t[3]
                    or r["maxy"] < bbox_t[0] or r["miny"] > bbox_t[2]):
                continue

            geometry = (
                {"type": "LineString", "coordinates": r["lines"][0]}
                if len(r["lines"]) == 1
                else {"type": "MultiLineString", "coordinates": r["lines"]}
            )
            routes.setdefault(r["kind"], {"type": "FeatureCollection", "features": []})
            routes[r["kind"]]["features"].append({
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "id": r["id"], "name": r["name"], "ref": r["ref"], "kind": r["kind"],
                },
            })
            if include_stops:
                for lon, lat in r["stops"]:
                    if (bbox_t[0] <= lat <= bbox_t[2] and bbox_t[1] <= lon <= bbox_t[3]):
                        stops.append((lon, lat))

        seen_pts = set()
        stop_features = []
        for lon, lat in stops:
            k = (round(lon, 5), round(lat, 5))
            if k in seen_pts:
                continue
            seen_pts.add(k)
            stop_features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {"name": ""},
            })

        return {
            "routes": routes,
            "stops": {"type": "FeatureCollection", "features": stop_features},
        }

    def query_batch(self, amenities, bbox):
        if not self.available or not amenities:
            return {}

        import osmium
        from osmium.filter import KeyFilter

        rules = _amenity_rules(self.amenity_types, amenities)
        tag_keys = sorted({k for pairs in rules.values() for k, _ in pairs})
        results = {a: [] for a in amenities}
        bbox_t = tuple(bbox)

        kf = KeyFilter(*tag_keys)
        fp = osmium.FileProcessor(self.pbf_path)
        fp.with_filter(kf)

        for obj in fp:
            if not obj.is_node():
                continue
            tags = {t.k: t.v for t in obj.tags} if obj.tags else {}
            amenity = _match_amenity(rules, tags)
            if amenity is None:
                continue

            if obj.is_node():
                lat, lon = obj.location.lat, obj.location.lon
            else:
                continue

            if not (bbox_t[0] <= lat <= bbox_t[2] and bbox_t[1] <= lon <= bbox_t[3]):
                continue

            name = tags.get("name", "")
            results[amenity].append({
                "id": obj.id, "lat": lat, "lon": lon,
                "tags": tags, "name": name,
            })

        return self._to_geojson(results)

    def _to_geojson(self, grouped):
        out = {}
        for amenity, elements in grouped.items():
            features = []
            seen = set()
            for e in elements:
                lat, lon = e["lat"], e["lon"]
                key = (round(lat, 5), round(lon, 5))
                if key in seen:
                    continue
                seen.add(key)
                tags = e.get("tags", {})
                name = tags.get("name", "")
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "id": e.get("id"),
                        "name": name,
                        "amenity": amenity,
                    },
                })
            if features:
                out[amenity] = {"type": "FeatureCollection", "features": features}
        return out


class QueryEngine:
    def __init__(self, config):
        self.overpass = OverpassEngine(config)
        self.pbf = PbfEngine(config)
        self.source = "pbf" if config.USE_PBF else "overpass"

    def query_batch(self, amenities, bbox):
        if not amenities:
            return {}
        if self.source == "pbf":
            try:
                return self.pbf.query_batch(amenities, bbox)
            except Exception as e:
                logger.warning("PBF query failed: %s, falling back", e)
        return self.overpass.query_batch(amenities, bbox)

    def query_polygons(self, polygon_keys, bbox):
        if not polygon_keys:
            return {}
        if self.source == "pbf":
            try:
                result = self.pbf.query_polygons(polygon_keys, bbox)
                if result or self.pbf._cache_failed:
                    return result
            except Exception as e:
                logger.warning("PBF polygon query failed: %s, falling back", e)
        return self.overpass.query_polygons(polygon_keys, bbox)

    def polygon_scan_required(self):
        """True when the next polygon query must run a one-time full PBF scan."""
        return self.source == "pbf" and not self.pbf.polygon_cache_ready

    def query_transit(self, transit_types, bbox, include_stops):
        if not transit_types:
            return {"routes": {}, "stops": {"type": "FeatureCollection", "features": []}}
        if self.source == "pbf":
            try:
                result = self.pbf.query_transit(transit_types, bbox, include_stops)
                if result["routes"] or self.pbf._transit_failed:
                    return result
            except Exception as e:
                logger.warning("PBF transit query failed: %s, falling back", e)
        return self.overpass.query_transit(transit_types, bbox, include_stops)

    def transit_scan_required(self):
        """True when the next transit query must run a one-time full PBF scan."""
        return self.source == "pbf" and not self.pbf.transit_cache_ready
