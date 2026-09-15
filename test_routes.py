import sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import osmium

class RelScan(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.counts = {}
        self.members = {}
        self.samples = []

    def relation(self, r):
        tags = {t.k: t.v for t in r.tags} if r.tags else {}
        if tags.get("type") != "route":
            return
        rtype = tags.get("route", "?")
        self.counts[rtype] = self.counts.get(rtype, 0) + 1
        if rtype in ("bus", "train", "tram", "subway", "light_rail", "ferry"):
            n_ways = sum(1 for m in r.members if m.type == "w")
            n_nodes = sum(1 for m in r.members if m.type == "n")
            if len(self.samples) < 6:
                self.samples.append((rtype, tags.get("ref", "-"), tags.get("name", "-")[:25], n_ways, n_nodes))

h = RelScan()
t0 = time.time()
h.apply_file("L:/OpenCode/SimYourCity/pakistan-260719.osm.pbf")
print(f"scan: {time.time()-t0:.1f}s")
for k, v in sorted(h.counts.items(), key=lambda x: -x[1]):
    print(f"  route={k:12s} {v:6d}")
print("samples (type, ref, name, n_ways, n_nodes):")
for s in h.samples:
    print("  ", s)
