/* SimYourCity - in-browser OSM PBF extractor (Web Worker)
 *
 * Streams a local .osm.pbf File, keeps only data inside a bbox and returns
 * Overpass-shaped elements (the same shapes the static Overpass path consumes):
 *   node      {type, id, lat, lon, tags}                      amenity matches
 *   way       {type, id, tags, bounds, geometry:[{lat,lon}]}  polygon matches
 *   relation  {type, id, tags, members:[{type, ref, role, geometry, ...}]}
 *
 * Matching mirrors query_engine.py: amenity nodes by AMENITY_TYPES tags
 * (default amenity=<key>), polygon ways (>= 3 nodes) by POLYGON_TYPES tags,
 * route relations whose route=* is a TRANSIT_TYPES key.
 *
 * No dependencies: a minimal protobuf reader plus native DecompressionStream.
 */

class PB {
  constructor(buf, pos = 0, end = buf.length) { this.buf = buf; this.pos = pos; this.end = end; }
  more() { return this.pos < this.end; }
  varint() {
    const b = this.buf;
    let p = this.pos, byte = b[p++], v = byte & 0x7f;
    if (byte >= 0x80) {
      byte = b[p++]; v |= (byte & 0x7f) << 7;
      if (byte >= 0x80) {
        byte = b[p++]; v |= (byte & 0x7f) << 14;
        if (byte >= 0x80) {
          byte = b[p++]; v |= (byte & 0x7f) << 21;
          if (byte >= 0x80) {
            // Past 28 bits: switch to float arithmetic (ids/coords stay < 2^53).
            let mul = 268435456;
            do { byte = b[p++]; v += (byte & 0x7f) * mul; mul *= 128; } while (byte >= 0x80);
          }
        }
      }
    }
    this.pos = p;
    return v;
  }
  svarint() { const n = this.varint(); return n % 2 ? -(n + 1) / 2 : n / 2; }
  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) { const n = this.varint(); this.pos += n; }
    else if (wire === 5) this.pos += 4;
    else throw new Error('Unsupported protobuf wire type ' + wire);
  }
  // Length-delimited field -> [start, end) range in buf.
  range() { const n = this.varint(); const s = this.pos; this.pos += n; return [s, s + n]; }
  sub(r) { return new PB(this.buf, r[0], r[1]); }
}

const EMPTY = [0, 0];
const utf8 = new TextDecoder();

function makeRules(cfg) {
  const amenityRules = Object.entries(cfg.amenities).map(([key, c]) => [key, c.tags || [['amenity', key]]]);
  const polygonRules = Object.entries(cfg.polygons).map(([key, c]) => [key, c.tags || []]);
  const transitKinds = new Set(Object.keys(cfg.transit));
  return { amenityRules, polygonRules, transitKinds };
}

function matches(rules, tags) {
  for (const [, pairs] of rules) {
    for (const [k, v] of pairs) if (tags[k] === v) return true;
  }
  return false;
}

function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Response(stream).arrayBuffer().then(b => new Uint8Array(b));
}

/* Split a raw chunk of the file into blobs: returns {blobs:[{type, data}], used}. */
function splitBlobs(buf, chunkOffset) {
  const blobs = [];
  let p = 0;
  while (p + 4 <= buf.length) {
    const hlen = ((buf[p] << 24) | (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3]) >>> 0;
    if (p + 4 + hlen > buf.length) break;
    const h = new PB(buf, p + 4, p + 4 + hlen);
    let type = '', datasize = 0;
    while (h.more()) {
      const tag = h.varint(), f = tag >>> 3;
      if (f === 1) { const r = h.range(); type = utf8.decode(buf.subarray(r[0], r[1])); }
      else if (f === 3) datasize = h.varint();
      else h.skip(tag & 7);
    }
    const start = p + 4 + hlen;
    if (start + datasize > buf.length) break;
    blobs.push({ type, start: start, end: start + datasize, offset: chunkOffset + start });
    p = start + datasize;
  }
  return { blobs, used: p };
}

function blobData(buf, blob) {
  const r = new PB(buf, blob.start, blob.end);
  while (r.more()) {
    const tag = r.varint(), f = tag >>> 3;
    if (f === 1) { const x = r.range(); return Promise.resolve(buf.slice(x[0], x[1])); }
    if (f === 3) { const x = r.range(); return inflate(buf.subarray(x[0], x[1])); }
    if (f === 2) { r.varint(); continue; }
    if (f >= 4 && f <= 7) throw new Error('PBF uses an unsupported compression (field ' + f + '); re-download from Geofabrik');
    r.skip(tag & 7);
  }
  throw new Error('Empty PBF blob');
}

class Extractor {
  constructor(bbox, cfg) {
    [this.s, this.w, this.n, this.e] = bbox;
    Object.assign(this, makeRules(cfg));
    this.nodeIdx = new Map();   // node id -> index into lats/lons
    this.lats = [];
    this.lons = [];
    this.nodeNames = new Map(); // named bbox nodes, for transit stop labels
    this.wayGeom = new Map();   // way id -> Float64Array [lon,lat,...] (bbox-resolved)
    this.elements = [];
    this.stats = { nodes: 0, ways: 0, relations: 0, bboxNodes: 0, amenityNodes: 0, polygonWays: 0, routeRelations: 0 };
  }

  block(buf) {
    const r = new PB(buf);
    let strings = null, gran = 100, latOff = 0, lonOff = 0;
    const groups = [];
    while (r.more()) {
      const tag = r.varint(), f = tag >>> 3;
      if (f === 1) strings = r.range();
      else if (f === 2) groups.push(r.range());
      else if (f === 17) gran = r.varint();
      else if (f === 19) latOff = r.varint();
      else if (f === 20) lonOff = r.varint();
      else r.skip(tag & 7);
    }
    const offs = [];
    if (strings) {
      const st = r.sub(strings);
      while (st.more()) {
        const tag = st.varint();
        if ((tag >>> 3) === 1) offs.push(st.range()); else st.skip(tag & 7);
      }
    }
    const cache = new Array(offs.length);
    const str = i => {
      let s = cache[i];
      if (s === undefined) { const o = offs[i]; s = cache[i] = utf8.decode(buf.subarray(o[0], o[1])); }
      return s;
    };
    const ctx = { buf, str, gran, latOff, lonOff };
    for (const g of groups) {
      const gr = r.sub(g);
      while (gr.more()) {
        const tag = gr.varint(), f = tag >>> 3;
        if (f === 2) this.dense(ctx, gr.range());
        else if (f === 1) this.node(ctx, gr.range());
        else if (f === 3) this.way(ctx, gr.range());
        else if (f === 4) this.relation(ctx, gr.range());
        else gr.skip(tag & 7);
      }
    }
  }

  keepNode(id, lat, lon, tags) {
    this.stats.bboxNodes++;
    this.nodeIdx.set(id, this.lats.length);
    this.lats.push(lat);
    this.lons.push(lon);
    if (!tags) return;
    if (tags.name) this.nodeNames.set(id, tags.name);
    if (matches(this.amenityRules, tags)) {
      this.stats.amenityNodes++;
      this.elements.push({ type: 'node', id, lat, lon, tags });
    }
  }

  dense({ buf, str, gran, latOff, lonOff }, range) {
    const d = new PB(buf, range[0], range[1]);
    let ids = EMPTY, lats = EMPTY, lons = EMPTY, kv = EMPTY;
    while (d.more()) {
      const tag = d.varint(), f = tag >>> 3;
      if (f === 1) ids = d.range();
      else if (f === 8) lats = d.range();
      else if (f === 9) lons = d.range();
      else if (f === 10) kv = d.range();
      else d.skip(tag & 7);
    }
    const ir = new PB(buf, ids[0], ids[1]), ar = new PB(buf, lats[0], lats[1]),
      or = new PB(buf, lons[0], lons[1]), kr = new PB(buf, kv[0], kv[1]);
    const hasKv = kv[1] > kv[0];
    const { s, w, n, e } = this;
    let id = 0, la = 0, lo = 0, count = 0;
    while (ir.more()) {
      id += ir.svarint(); la += ar.svarint(); lo += or.svarint();
      count++;
      const lat = 1e-9 * (latOff + gran * la), lon = 1e-9 * (lonOff + gran * lo);
      const inside = lat >= s && lat <= n && lon >= w && lon <= e;
      let tags = null;
      if (hasKv) {
        let k = kr.varint();
        while (k !== 0) {
          const v = kr.varint();
          if (inside) (tags || (tags = {}))[str(k)] = str(v);
          k = kr.varint();
        }
      }
      if (inside) this.keepNode(id, lat, lon, tags);
    }
    this.stats.nodes += count;
  }

  tags(ctx, keys, vals) {
    if (keys[1] <= keys[0]) return null;
    const kr = new PB(ctx.buf, keys[0], keys[1]), vr = new PB(ctx.buf, vals[0], vals[1]);
    const tags = {};
    while (kr.more()) tags[ctx.str(kr.varint())] = ctx.str(vr.varint());
    return tags;
  }

  node(ctx, range) {
    const r = new PB(ctx.buf, range[0], range[1]);
    let id = 0, la = 0, lo = 0, keys = EMPTY, vals = EMPTY;
    while (r.more()) {
      const tag = r.varint(), f = tag >>> 3;
      if (f === 1) id = r.svarint();
      else if (f === 2) keys = r.range();
      else if (f === 3) vals = r.range();
      else if (f === 8) la = r.svarint();
      else if (f === 9) lo = r.svarint();
      else r.skip(tag & 7);
    }
    this.stats.nodes++;
    const lat = 1e-9 * (ctx.latOff + ctx.gran * la), lon = 1e-9 * (ctx.lonOff + ctx.gran * lo);
    if (lat >= this.s && lat <= this.n && lon >= this.w && lon <= this.e) {
      this.keepNode(id, lat, lon, this.tags(ctx, keys, vals));
    }
  }

  way(ctx, range) {
    const r = new PB(ctx.buf, range[0], range[1]);
    let id = 0, keys = EMPTY, vals = EMPTY, refs = EMPTY;
    while (r.more()) {
      const tag = r.varint(), f = tag >>> 3;
      if (f === 1) id = r.varint();
      else if (f === 2) keys = r.range();
      else if (f === 3) vals = r.range();
      else if (f === 8) refs = r.range();
      else r.skip(tag & 7);
    }
    this.stats.ways++;
    const rr = new PB(ctx.buf, refs[0], refs[1]);
    const coords = [];
    let ref = 0, total = 0;
    while (rr.more()) {
      ref += rr.svarint();
      total++;
      const i = this.nodeIdx.get(ref);
      if (i !== undefined) coords.push(this.lons[i], this.lats[i]);
    }
    if (coords.length < 4) return; // fewer than 2 resolved nodes: nothing to draw
    this.wayGeom.set(id, Float64Array.from(coords));
    if (total < 3 || coords.length < 6) return;
    const tags = this.tags(ctx, keys, vals);
    if (!tags || !matches(this.polygonRules, tags)) return;
    const geometry = [];
    let minlat = 90, maxlat = -90, minlon = 180, maxlon = -180;
    for (let i = 0; i < coords.length; i += 2) {
      const lon = coords[i], lat = coords[i + 1];
      geometry.push({ lat, lon });
      if (lat < minlat) minlat = lat; if (lat > maxlat) maxlat = lat;
      if (lon < minlon) minlon = lon; if (lon > maxlon) maxlon = lon;
    }
    this.stats.polygonWays++;
    this.elements.push({ type: 'way', id, tags, bounds: { minlat, minlon, maxlat, maxlon }, geometry });
  }

  relation(ctx, range) {
    const r = new PB(ctx.buf, range[0], range[1]);
    let id = 0, keys = EMPTY, vals = EMPTY, roles = EMPTY, memids = EMPTY, types = EMPTY;
    while (r.more()) {
      const tag = r.varint(), f = tag >>> 3;
      if (f === 1) id = r.varint();
      else if (f === 2) keys = r.range();
      else if (f === 3) vals = r.range();
      else if (f === 8) roles = r.range();
      else if (f === 9) memids = r.range();
      else if (f === 10) types = r.range();
      else r.skip(tag & 7);
    }
    this.stats.relations++;
    const tags = this.tags(ctx, keys, vals);
    if (!tags || tags.type !== 'route' || !this.transitKinds.has(tags.route)) return;
    const rr = new PB(ctx.buf, roles[0], roles[1]), mr = new PB(ctx.buf, memids[0], memids[1]),
      tr = new PB(ctx.buf, types[0], types[1]);
    const members = [];
    let ref = 0;
    while (mr.more()) {
      ref += mr.svarint();
      const type = tr.varint(), role = ctx.str(rr.varint());
      if (type === 1) {
        const g = this.wayGeom.get(ref);
        if (!g) continue;
        const geometry = [];
        for (let i = 0; i < g.length; i += 2) geometry.push({ lat: g[i + 1], lon: g[i] });
        members.push({ type: 'way', ref, role, geometry });
      } else if (type === 0) {
        const i = this.nodeIdx.get(ref);
        if (i === undefined) continue;
        const lat = this.lats[i], lon = this.lons[i];
        members.push({ type: 'node', ref, role, lat, lon, geometry: [{ lat, lon }], tags: { name: this.nodeNames.get(ref) || '' } });
      }
    }
    if (!members.length) return;
    this.stats.routeRelations++;
    this.elements.push({ type: 'relation', id, tags, members });
  }
}

const CHUNK = 4 * 1024 * 1024;

/* Stream `file` (Blob/File) and resolve with {bbox, elements, stats}. */
async function extractPbf(file, bbox, cfg, onProgress) {
  const ex = new Extractor(bbox, cfg);
  const total = file.size;
  let offset = 0, carry = new Uint8Array(0);
  while (offset < total || carry.length) {
    const next = offset < total ? new Uint8Array(await file.slice(offset, Math.min(offset + CHUNK, total)).arrayBuffer()) : new Uint8Array(0);
    const chunkStart = offset - carry.length;
    offset += next.length;
    let buf = next;
    if (carry.length) { buf = new Uint8Array(carry.length + next.length); buf.set(carry); buf.set(next, carry.length); }
    const { blobs, used } = splitBlobs(buf, chunkStart);
    if (!blobs.length && offset >= total) {
      if (used < buf.length) throw new Error('Truncated PBF file');
      break;
    }
    // Inflate this chunk's blobs concurrently, then decode them in file order.
    const datas = blobs.map(b => b.type === 'OSMData' ? blobData(buf, b) : null);
    for (let i = 0; i < blobs.length; i++) {
      if (datas[i]) ex.block(await datas[i]);
    }
    carry = buf.slice(used);
    if (onProgress) onProgress(Math.min(offset, total), total, ex.stats);
  }
  return { bbox, elements: ex.elements, stats: ex.stats };
}

if (typeof module !== 'undefined') module.exports = { extractPbf };

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = ev => {
    const { file, bbox, config } = ev.data;
    const t0 = performance.now();
    let lastPost = 0;
    extractPbf(file, bbox, config, (bytes, total, stats) => {
      const now = performance.now();
      if (now - lastPost < 250 && bytes < total) return;
      lastPost = now;
      self.postMessage({ type: 'progress', bytes, total, stats });
    }).then(result => {
      result.seconds = (performance.now() - t0) / 1000;
      self.postMessage({ type: 'done', result });
    }).catch(err => self.postMessage({ type: 'error', message: err.message || String(err) }));
  };
}
