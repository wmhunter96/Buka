# Desk plug

Fills the ESP32-C3 / lamp opening in the SG90 `DeskTop`, for builds where the ESP32 lives inside the desk (DevKit builds) and the lamp isn't used.

- Sits flush with the desk surface.
- A 1.2 mm flange on the underside spans the two `LampBase` screw holes. Two **M2×4** screws from below go through the flange and thread into those holes, so it can't push out.
- Fit it before the `DeskTop` goes on the desk. The flange clears the desk's back wall.

Print **top face down** (already oriented that way) for a smooth top, in the desk color. No supports.

Regenerate: `python 3d_models/cad/desk_plug.py <output folder>` (needs `cadquery`).
