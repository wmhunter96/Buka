"""AiEmblem without the "AI" letters.

Removes the raised letters from the stock emblem and leaves the gear, ring and
wings untouched. Two variants:
  AiEmblem-Plain  center filled with a flat disc, recessed 1.5 mm below the ring
  AiEmblem-Ring   center left open, so the desk shows through the ring

python plain_emblem.py <path to 3d_models/parts/sg90/step> <output folder>
"""
import sys
from pathlib import Path

import cadquery as cq

STOCK = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")

RING_CENTER = (-0.04, -0.14)  # from the stock STEP's ring faces
RING_INNER_R = 10.0
RING_TOP_Z = 3.0
DISC_TOP_Z = 1.5              # same height as the gear plate

stock = cq.importers.importStep(str(STOCK / "AiEmblem.step"))

center = cq.Workplane("XY").circle(RING_INNER_R).extrude(10).translate((*RING_CENTER, -1))
above_ring = cq.Workplane("XY").box(200, 200, 10, centered=(True, True, False)).translate((0, 0, RING_TOP_Z))
ring = stock.cut(center).cut(above_ring)

disc = cq.Workplane("XY").circle(RING_INNER_R + 0.01).extrude(DISC_TOP_Z).translate((*RING_CENTER, 0))
plain = ring.union(disc)

OUT.mkdir(parents=True, exist_ok=True)
for name, wp in (("AiEmblem-Plain", plain), ("AiEmblem-Ring", ring)):
    cq.exporters.export(wp, str(OUT / f"{name}.step"))
    cq.exporters.export(wp, str(OUT / f"{name}.stl"), tolerance=0.02, angularTolerance=0.1)
    v = wp.val()
    bb = v.BoundingBox()
    print(name, "solids", len(v.Solids()), "vol %.0f" % v.Volume(), "z max %.2f" % bb.zmax)
