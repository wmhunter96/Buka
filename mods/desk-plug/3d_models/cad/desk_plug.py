"""Plug for the ESP32/lamp opening in the SG90 DeskTop.

Fills the rectangular opening flush with the desk surface. A thin flange on
the underside spans the two LampBase screw holes; two M2x4 screws from below
go through the flange and thread into those holes, clamping the plug.

Coordinates match the stock DeskTop.step (hole x -13.10..12.40,
y 46.20..65.70, with a 1 mm tab on the +x side; plate 3.5 mm thick there).

python desk_plug.py <output folder>
"""
import sys
from pathlib import Path

import cadquery as cq

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")

X0, X1, Y0, Y1 = -13.10, 12.40, 46.20, 65.70
TAB_X1, TAB_Y0, TAB_Y1 = 13.40, 50.45, 61.45
PLATE_T = 3.5
SCREWS = [(-14.35, 55.95), (16.25, 55.95)]

CLEAR = 0.15        # per side in the opening
FLANGE_T = 1.2
FLANGE_MARGIN = 3.0  # past the opening edge
SCREW_CLEAR_R = 1.2  # M2 clearance


def box(x0, x1, y0, y1, z0, z1):
    return cq.Workplane("XY").box(x1 - x0, y1 - y0, z1 - z0, centered=False).translate((x0, y0, z0))


# z = 0 is the desk top's underside; plug body fills 0..PLATE_T
body = box(X0 + CLEAR, X1 - CLEAR, Y0 + CLEAR, Y1 - CLEAR, 0, PLATE_T)
body = body.union(box(X1 - 0.5, TAB_X1 - CLEAR, TAB_Y0 + CLEAR, TAB_Y1 - CLEAR, 0, PLATE_T))

fx0 = min(X0, SCREWS[0][0] - 3.0) - FLANGE_MARGIN + 3.0
fx1 = max(TAB_X1, SCREWS[1][0] + 3.0)
flange = box(fx0, fx1, Y0 - FLANGE_MARGIN, Y1 + FLANGE_MARGIN, -FLANGE_T, 0)
flange = flange.edges("|Z").fillet(1.5)
for sx, sy in SCREWS:
    flange = flange.cut(cq.Workplane("XY").circle(SCREW_CLEAR_R).extrude(5).translate((sx, sy, -3)))

plug = body.union(flange)
# small chamfer on the top edge so it drops in easily
plug = plug.faces(">Z").edges().chamfer(0.3)

printable = plug.rotate((0, 0, 0), (1, 0, 0), 180).translate((0, 0, PLATE_T))  # top face down
OUT.mkdir(parents=True, exist_ok=True)
cq.exporters.export(printable, str(OUT / "DeskPlug.step"))
cq.exporters.export(printable, str(OUT / "DeskPlug.stl"), tolerance=0.02, angularTolerance=0.1)
cq.exporters.export(plug, str(OUT / "_DeskPlug_assembled.step"))
bb = plug.val().BoundingBox()
print("plug %.1f x %.1f x %.1f mm, vol %.0f" % (bb.xlen, bb.ylen, bb.zlen, plug.val().Volume()))
