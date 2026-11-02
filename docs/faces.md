# Face gallery

Every kaomoji face, rendered from the same generator data the firmware uses (each is a 3-second, 30-frame loop). Turn them on with Config / `POST /settings` `{"eyes_style":"kaomoji"}` ([api.md](api.md#kaomoji-eyes)). Faces with no trigger are in the library but not used by any animation yet.

| Face | Preview | Shown for |
| --- | --- | --- |
| Idle | <img src="images/faces/kaomoji/idle.png" width="384" alt="Kaomoji idle"> | idle (`none`), sleep-open |
| Happy | <img src="images/faces/kaomoji/happy.png" width="384" alt="Kaomoji happy"> | `welcome`, `talking` |
| Laugh | <img src="images/faces/kaomoji/laugh.png" width="384" alt="Kaomoji laugh"> | not used yet |
| Wink | <img src="images/faces/kaomoji/wink.png" width="384" alt="Kaomoji wink"> | `print_start` |
| Curious | <img src="images/faces/kaomoji/curious.png" width="384" alt="Kaomoji curious"> | `reading`, `attention` |
| Thinking | <img src="images/faces/kaomoji/thinking.png" width="384" alt="Kaomoji thinking"> | `typing`, `thinking` |
| Surprise | <img src="images/faces/kaomoji/surprise.png" width="384" alt="Kaomoji surprise"> | `ring` |
| Smug | <img src="images/faces/kaomoji/smug.png" width="384" alt="Kaomoji smug"> | not used yet |
| Sleepy | <img src="images/faces/kaomoji/sleepy.png" width="384" alt="Kaomoji sleepy"> | `wakeup` |
| Sleep | <img src="images/faces/kaomoji/sleep.png" width="384" alt="Kaomoji sleep"> | `sleep`, sleep-close |
| Sad | <img src="images/faces/kaomoji/sad.png" width="384" alt="Kaomoji sad"> | `dead` |
| Cry | <img src="images/faces/kaomoji/cry.png" width="384" alt="Kaomoji cry"> | not used yet |
| Angry | <img src="images/faces/kaomoji/angry.png" width="384" alt="Kaomoji angry"> | `error` |
| Panic | <img src="images/faces/kaomoji/panic.png" width="384" alt="Kaomoji panic"> | `abort` |
| Shy | <img src="images/faces/kaomoji/shy.png" width="384" alt="Kaomoji shy"> | not used yet |
| Love | <img src="images/faces/kaomoji/love.png" width="384" alt="Kaomoji love"> | not used yet |

Regenerate after editing `scripts/expressions/designs.js`:

```bash
node scripts/expressions/generate.js
node scripts/expressions/render-previews.js
```
