# Plain emblem

The desk `AiEmblem` without the raised "AI" letters. The gear, ring, wings and the two screw holes are the stock part, so it mounts exactly like the original (two M2×4 screws).

| File | Center |
| --- | --- |
| `AiEmblem-Plain` | Filled with a flat disc, 1.5 mm below the top of the ring |
| `AiEmblem-Ring` | Left open, so the desk color shows through the ring |

Print flat, same orientation and color as the stock emblem.

Regenerate from the stock STEP with [`3d_models/cad/plain_emblem.py`](3d_models/cad/plain_emblem.py):

```
pip install cadquery
python plain_emblem.py <path to 3d_models/parts/sg90/step> <output folder>
```
