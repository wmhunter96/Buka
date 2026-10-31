"""Tiny Engineer Head/Hat remix for a 0.96" 128x64 SSD1306 I2C OLED module.

Takes the stock SG90 Head.step and Hat.step and replaces the front OLED strip
with a taller face box. The module slides in from the top, header edge up, and
a small cap screws on top to hold it. Everything behind the old OLED pocket
(servo frame, Hat screw bosses, Neck interface, cable clips) is the stock part.

Head/Hat coordinates match the stock STEP files: Head z=0 is the bottom, +x is
the front (face), the Hat sits on the Head at z=14.6 shifted by x+8.2.

Measure your OLED with calipers and adjust the MODULE_* values before printing.
"""
import sys
from pathlib import Path

import cadquery as cq

STOCK = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")

# ---- OLED module (measure yours) -------------------------------------------
MODULE_W = 27.8          # board width, mm (left-right as you look at it)
MODULE_H = 27.8          # board height incl. header edge, mm (common: 27.3-28.0)
MODULE_T = 4.6           # thickness from glass front to the back of the PCB parts, mm
ACTIVE_CENTER_FROM_TOP = 12.0  # header edge to the middle of the lit area, mm
ACTIVE_W, ACTIVE_H = 21.74, 10.86  # 128x64 lit area of a 0.96" panel

# ---- fit -------------------------------------------------------------------
CLEAR = 0.3              # clearance per side around the board
WINDOW_MARGIN_W = 1.8    # window wider than the lit area, per side
WINDOW_MARGIN_H = 2.2    # taller than the lit area, per side (absorbs offset error)

# ---- face box --------------------------------------------------------------
FRONT_X = 21.95          # stock front face
FRONT_WALL = 1.6
BACK_X = 14.0            # back of the face box (stock OLED pocket back was x=15)
FLOOR_Z = 2.0            # stock floor top; module rests on it
SIDE_WALL = 4.0          # holds the cap screws
TOP_Z = FLOOR_Z + MODULE_H + 1.2

HAT_Z = 14.6             # Hat bottom on the Head
HAT_DX = 8.2             # Hat x offset (Head x = Hat x + 8.2)
HAT_GAP = 0.25           # clearance between face box and trimmed Hat

pocket_w = MODULE_W + 2 * CLEAR
box_w = pocket_w + 2 * SIDE_WALL
pocket_front_x = FRONT_X - FRONT_WALL
pocket_back_x = pocket_front_x - (MODULE_T + 0.4)
assert pocket_back_x - BACK_X >= 1.0, "back wall too thin, raise BACK_X depth or thin the module"

screw_x = (BACK_X + FRONT_X) / 2
screw_y = pocket_w / 2 + SIDE_WALL / 2
connector_w = 14.0       # notch in the back wall for the header plug / soldered wires
connector_z0 = FLOOR_Z + MODULE_H - 7.0


def box(x0, x1, y0, y1, z0, z1):
    return cq.Workplane("XY").box(x1 - x0, y1 - y0, z1 - z0, centered=False).translate((x0, y0, z0))


def load(name):
    return cq.importers.importStep(str(STOCK / f"{name}.step"))


# ---------------------------------------------------------------- Head
head = load("Head")
head = head.cut(box(BACK_X, FRONT_X + 1, -box_w / 2, box_w / 2, -1, 15.6))

face = box(BACK_X, FRONT_X, -box_w / 2, box_w / 2, 0, TOP_Z)
face = face.edges("|Y and >Z and >X").fillet(1.0)
# module pocket, open at the top
face = face.cut(box(pocket_back_x, pocket_front_x, -pocket_w / 2, pocket_w / 2, FLOOR_Z, TOP_Z + 1))
# window over the lit area
win_cz = FLOOR_Z + MODULE_H - ACTIVE_CENTER_FROM_TOP
win_w = ACTIVE_W + 2 * WINDOW_MARGIN_W
win_h = ACTIVE_H + 2 * WINDOW_MARGIN_H
face = face.cut(box(pocket_front_x - 0.5, FRONT_X + 1, -win_w / 2, win_w / 2, win_cz - win_h / 2, win_cz + win_h / 2))
# back-wall notch for the header plug, open at the top so it slides in
face = face.cut(box(BACK_X - 1, pocket_back_x + 0.01, -connector_w / 2, connector_w / 2, connector_z0, TOP_Z + 1))
# cap screw pilots (M2 thread-forming)
for sy in (-screw_y, screw_y):
    face = face.cut(cq.Workplane("XY").circle(0.85).extrude(8).translate((screw_x, sy, TOP_Z - 8)))

head = head.union(face)

# ---------------------------------------------------------------- Hat
hat = load("Hat")
hat = hat.cut(box(BACK_X - HAT_GAP - HAT_DX, FRONT_X + 1 - HAT_DX, -box_w / 2 - HAT_GAP, box_w / 2 + HAT_GAP, -1, 6))

# ---------------------------------------------------------------- Cap
CAP_T = 2.0
cap = box(BACK_X, FRONT_X, -box_w / 2, box_w / 2, 0, CAP_T)
cap = cap.edges("|Y and >Z and >X").fillet(1.0)
cap = cap.cut(box(BACK_X - 1, pocket_back_x + 0.01, -connector_w / 2, connector_w / 2, -1, CAP_T + 1))
for sy in (-screw_y, screw_y):
    cap = cap.cut(cq.Workplane("XY").circle(1.2).extrude(CAP_T + 2).translate((screw_x, sy, -1)))
# ribs under the cap press the board down, clear of the header in the middle
gap_to_board = TOP_Z - (FLOOR_Z + MODULE_H)
rib_h = max(gap_to_board - 0.2, 0.4)
for y0, y1 in ((-pocket_w / 2 + 1.0, -connector_w / 2 - 0.5), (connector_w / 2 + 0.5, pocket_w / 2 - 1.0)):
    cap = cap.union(box(pocket_back_x + 0.3, pocket_front_x - 0.3, y0, y1, -rib_h, 0))
cap_assembled = cap.translate((0, 0, TOP_Z))
cap_print = cap.rotate((0, 0, 0), (1, 0, 0), 180).translate((0, 0, CAP_T))  # ribs up

OUT.mkdir(parents=True, exist_ok=True)
for name, wp in (("Head-096OLED", head), ("Hat-096OLED", hat), ("OledCap-096OLED", cap_print)):
    cq.exporters.export(wp, str(OUT / f"{name}.step"))
    cq.exporters.export(wp, str(OUT / f"{name}.stl"), tolerance=0.02, angularTolerance=0.1)
cq.exporters.export(cap_assembled, str(OUT / "_cap_assembled.step"))

print(f"face box {FRONT_X - BACK_X:.2f} deep x {box_w:.2f} wide x {TOP_Z:.2f} tall")
print(f"pocket {pocket_front_x - pocket_back_x:.2f} deep x {pocket_w:.2f} wide, back wall {pocket_back_x - BACK_X:.2f}")
print(f"window {win_w:.2f} x {win_h:.2f} centred z={win_cz:.2f}; screws at x={screw_x:.2f} y=+-{screw_y:.2f}")
print("volumes", {n: round(w.val().Volume()) for n, w in (("head", head), ("hat", hat), ("cap", cap))})
print("solids", {n: len(w.val().Solids()) for n, w in (("head", head), ("hat", hat), ("cap", cap))})
