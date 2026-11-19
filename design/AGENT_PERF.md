# Bag (3D agent) frame rate

Measured 2026-11-19T18:30:44.266Z in installed Chrome, visible window, 1440×860, production build.
GPU: ANGLE (Intel, Intel(R) HD Graphics 520 (0x00001916) Direct3D11 vs_5_0 ps_5_0, D3D11)

| Quality | FPS cap | Rendered fps | Display refresh | Quality in use |
|---|---|---|---|---|
| high | 30 | 30.0 | 60.1 | high |
| high | 60 | 30.1 | 60.0 | high |
| low | 30 | 30.1 | 60.1 | low |
| low | 60 | 29.9 | 60.0 | low |

Auto mode settled on: **high**.

"Rendered fps" counts frames Bag actually drew. The product runs at the 30 fps cap. The 60 row asks for more than the budget: if High
drops below 30 there and the page's display refresh falls, the GPU is near its limit (that's when auto mode switches to Low).
The 60 row is not a true uncapped benchmark: even Low stays at ~30 there, so frames appear to be limited to every other refresh.
