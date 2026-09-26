# EchoBot launch video

A 27-second, 1920×1080 launch video for EchoBot, built with [HyperFrames](https://hyperframes.heygen.com). It's made from the app's own code: the orb from `src/components/Orb.tsx`, the chat bubbles and input bar from `MessageBubble.tsx` / `InputBar.tsx`, and the palettes from `src/utils/themes.ts`. No screenshots are used.

**Rendered video:** [`renders/echobot-launch.mp4`](renders/echobot-launch.mp4)

| Time | Scene |
|---|---|
| 0 – 4s | Hook: the orb looks around and blinks, then "Meet EchoBot." |
| 4 – 8.5s | Voice: the orb listens with rings and a waveform, over Talk / Type / Listen |
| 8.5 – 14s | Demo: a prompt is typed and sent, and the reply streams in word by word |
| 14 – 18s | Features: voice in and out, image input, branching and export, installable PWA |
| 18 – 21.5s | Themes: Daylight → Midnight → Forest → Sunset → Deep Ocean |
| 21.5 – 24s | Architecture: React → FastAPI → Gemini, and the API key never reaches the browser |
| 24 – 27s | End card: logo, tagline and repo URL |

## Editing and re-rendering

Everything is in `index.html`: one GSAP timeline plus the scene markup. GSAP and the Inter font are kept in `assets/`, so a render doesn't need network access.

```bash
cd launch-video
npx hyperframes preview                      # live preview in Studio
npx hyperframes check                        # lint + layout + contrast
npx hyperframes render --quality high -o renders/echobot-launch.mp4
```

Local rendering needs FFmpeg installed (`npx hyperframes doctor` checks for it).
