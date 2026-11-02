# Face gallery

Every expression in both animated face sets, rendered from the same generator data the firmware uses (each is a 3-second, 30-frame loop). Pick a set with Config / `POST /settings` `{"eyes_style":"gundam"}` or `"kaomoji"` ([api.md](api.md#kaomoji-and-gundam-eyes)). Faces with no trigger are in the library but not used by any animation yet.

| Face | Gundam | Kaomoji | Shown for |
| --- | --- | --- | --- |
| Idle | <img src="images/faces/gundam/idle.png" width="256" alt="Gundam idle"> | <img src="images/faces/kaomoji/idle.png" width="256" alt="Kaomoji idle"> | idle (`none`), sleep-open |
| Happy | <img src="images/faces/gundam/happy.png" width="256" alt="Gundam happy"> | <img src="images/faces/kaomoji/happy.png" width="256" alt="Kaomoji happy"> | `welcome`, `talking` |
| Laugh | <img src="images/faces/gundam/laugh.png" width="256" alt="Gundam laugh"> | <img src="images/faces/kaomoji/laugh.png" width="256" alt="Kaomoji laugh"> | not used yet |
| Wink | <img src="images/faces/gundam/wink.png" width="256" alt="Gundam wink"> | <img src="images/faces/kaomoji/wink.png" width="256" alt="Kaomoji wink"> | not used yet |
| Curious | <img src="images/faces/gundam/curious.png" width="256" alt="Gundam curious"> | <img src="images/faces/kaomoji/curious.png" width="256" alt="Kaomoji curious"> | `reading`, `attention` |
| Thinking | <img src="images/faces/gundam/thinking.png" width="256" alt="Gundam thinking"> | <img src="images/faces/kaomoji/thinking.png" width="256" alt="Kaomoji thinking"> | `typing`, `thinking` |
| Surprise | <img src="images/faces/gundam/surprise.png" width="256" alt="Gundam surprise"> | <img src="images/faces/kaomoji/surprise.png" width="256" alt="Kaomoji surprise"> | `ring` |
| Smug | <img src="images/faces/gundam/smug.png" width="256" alt="Gundam smug"> | <img src="images/faces/kaomoji/smug.png" width="256" alt="Kaomoji smug"> | not used yet |
| Sleepy | <img src="images/faces/gundam/sleepy.png" width="256" alt="Gundam sleepy"> | <img src="images/faces/kaomoji/sleepy.png" width="256" alt="Kaomoji sleepy"> | `wakeup` |
| Sleep | <img src="images/faces/gundam/sleep.png" width="256" alt="Gundam sleep"> | <img src="images/faces/kaomoji/sleep.png" width="256" alt="Kaomoji sleep"> | `sleep`, sleep-close |
| Sad | <img src="images/faces/gundam/sad.png" width="256" alt="Gundam sad"> | <img src="images/faces/kaomoji/sad.png" width="256" alt="Kaomoji sad"> | `dead` |
| Cry | <img src="images/faces/gundam/cry.png" width="256" alt="Gundam cry"> | <img src="images/faces/kaomoji/cry.png" width="256" alt="Kaomoji cry"> | not used yet |
| Angry | <img src="images/faces/gundam/angry.png" width="256" alt="Gundam angry"> | <img src="images/faces/kaomoji/angry.png" width="256" alt="Kaomoji angry"> | `error` |
| Panic | <img src="images/faces/gundam/panic.png" width="256" alt="Gundam panic"> | <img src="images/faces/kaomoji/panic.png" width="256" alt="Kaomoji panic"> | `abort` |
| Shy | <img src="images/faces/gundam/shy.png" width="256" alt="Gundam shy"> | <img src="images/faces/kaomoji/shy.png" width="256" alt="Kaomoji shy"> | not used yet |
| Love | <img src="images/faces/gundam/love.png" width="256" alt="Gundam love"> | <img src="images/faces/kaomoji/love.png" width="256" alt="Kaomoji love"> | not used yet |

Regenerate after editing `scripts/expressions/designs.js` or `gundam-designs.js`:

```bash
node scripts/expressions/generate.js
node scripts/expressions/render-previews.js
```
