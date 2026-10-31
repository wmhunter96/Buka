# 0.96" OLED head

Replacement `Head`, `Hat` and a small `OledCap` for the common **0.96" 128×64 SSD1306 I2C module** (4-pin, about 27.8 × 27.8 mm), instead of the stock Waveshare 0.91" 128×32. SG90 build only.

Firmware: build with `TE_OLED_128X64` (the `esp32-devkit` env has it on). See [docs/hardware/esp32-devkit.md](../../docs/hardware/esp32-devkit.md).

## What changed

Only the front of the head. The stock 0.91" strip is replaced by a taller face box (36.4 wide × 31 tall × 8 deep). Everything behind it is the stock part: servo frame, Hat screw bosses, Neck interface and cable clips.

- The module slides in from the top, glass forward, **header edge up**.
- The back wall has a 14 mm notch at the top for the header plug or soldered wires, so they slide down with the module and stick out behind the face, above the Hat.
- `OledCap` screws on top (2 × M2×8) and its ribs hold the board down, clear of the header.
- `Hat` is the stock Hat with the front centre cut away around the face box.

## Measure your module first

0.96" modules vary by a few tenths of a millimetre. Check yours with calipers against the values at the top of [`3d_models/cad/head_096.py`](3d_models/cad/head_096.py), and regenerate if they differ:

| Value | Default | What it is |
| --- | --- | --- |
| `MODULE_W` | 27.8 | board width |
| `MODULE_H` | 27.8 | board height, header edge to bottom edge |
| `MODULE_T` | 4.6 | glass front to the back of the parts on the PCB (not counting header pins) |
| `ACTIVE_CENTER_FROM_TOP` | 12.0 | header edge to the middle of the lit area |

The window is 25.3 × 15.3 mm, about 2 mm bigger than the lit area all round, so a small error in the last value just shows a bit more black glass.

```
pip install cadquery
python head_096.py <path to 3d_models/parts/sg90/step> <output folder>
```

## Print

- `Head-096OLED`: upright, as stock. The window top is a 25 mm bridge; PLA handles it without supports.
- `Hat-096OLED`: as stock.
- `OledCap-096OLED`: flat, ribs up (already oriented that way).

## Assemble

1. Solder or plug the OLED leads onto the header before seating it.
2. Slide the module down into the face box, glass forward and header up, feeding the plug through the back notch.
3. Fit the Head servo and the `Hat` as in the stock [assembly §1–2](../../docs/3d/assembly.md#1-head--oled-and-servo).
4. Screw `OledCap` on with two M2×8 screws.
5. The OLED cable leaves the back of the face box above the Hat. Run it down the back of the head with the servo lead.

If the face is upside down, use **Rotate 180°** in the setup wizard.
