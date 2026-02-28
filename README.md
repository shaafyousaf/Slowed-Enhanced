# 🎧 Slowed Enhanced

> **The only free, open-source Chrome extension that slows down audio live in your browser — with real pitch preservation.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v1.9.2-blue?logo=googlechrome)](https://chromewebstore.google.com/detail/slowed-enchanced/)
[![Users](https://img.shields.io/badge/Active%20Users-67-brightgreen)](https://chromewebstore.google.com/detail/slowed-enchanced/)
[![Installs](https://img.shields.io/badge/Total%20Installs-722-orange)](https://chromewebstore.google.com/detail/slowed-enchanced/)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)
[![Made by](https://img.shields.io/badge/Made%20by-Shaaf%20Yousaf-purple)](https://shaafyousaf.me)

---

## What Is This?

Slowed Enhanced is a Chrome extension that applies **real-time audio processing** to any video or audio playing in your browser — no downloads, no external apps, no paywalls. Slow down a lecture, adjust the pacing of a dense educational video, or make a fast-talking presenter easier to follow, all without leaving your tab.

Every other solution either requires you to download the file, pay for a subscription, or produces choppy, robotic audio when slowing down. Slowed Enhanced solves this using **granular time-stretching** directly in the browser via the Web Audio API — keeping pitch natural and speech intelligible at any speed.

---

## Features

- **Granular Time-Stretching** — Slow down or speed up audio without the robotic, choppy artifacts of naive resampling. Pitch and vocal clarity stay fully intact.
- **Pitch Shifting** — Independent pitch control, fully decoupled from playback speed.
- **Reverb** — Convolution-based reverb for richer, more spacious audio output.
- **Live & Real-Time** — All processing happens client-side, in-tab, with no audio routing or file downloads required.
- **Works Everywhere** — YouTube lectures, online courses, podcasts, conference talks, any browser media element.
- **Clean UI** — Minimal, unobtrusive popup interface. No bloat.
- **Free & Open Source** — Completely free on the Chrome Web Store. No ads, no paywalls, no telemetry.

---

## Why This Matters (Technically)

Most browser playback rate controls (e.g. `HTMLMediaElement.playbackRate`) change speed by resampling — which also shifts pitch and degrades speech quality. This extension intercepts the audio stream using the **Web Audio API**, routes it through a custom processing graph, and applies **phase vocoder-based time-stretching** to decouple tempo from pitch. The result is smooth, natural-sounding speech at any playback rate — critical for accessibility and comprehension.

This is the **only free Chrome extension** that does this live, in-browser, with pitch preservation, and with its source code publicly available.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension Runtime | Chrome Extensions Manifest V3 |
| Audio Engine | Web Audio API |
| Time-Stretching | Granular synthesis / Phase Vocoder |
| UI | C# + Vanilla JS + HTML/CSS |
| Build | Lightweight, no bundler required |
| Distribution | Chrome Web Store (13MB) |

---

## Installation

### From the Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store listing](https://chromewebstore.google.com/detail/slowed-enchanced/)
2. Click **Add to Chrome**
3. Open any video or audio in your browser and click the extension icon

### Load Unpacked (Developer Mode)
```bash
git clone https://github.com/shaafyousaf/Slowed-Enhanced.git
```
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load Unpacked** and select the cloned repo directory
4. The extension will appear in your toolbar

---

## Usage

1. Play any video or audio in Chrome
2. Click the **Slowed Enhanced** icon in your browser toolbar
3. Adjust the sliders:
   - **Speed** — Slow down or speed up playback (pitch-preserved)
   - **Pitch** — Shift pitch independently of speed
   - **Reverb** — Add depth and spaciousness to audio output

Settings take effect immediately and persist per-tab.

---

## Project Stats

| Metric | Value |
|---|---|
| Total Installs (6 months) | 722 |
| Active Users | 67 |
| Top Market | United States (39%) |
| Also Popular In | UK (14%), Venezuela (13%) |
| Primary OS | Windows (57%), ChromeOS (22%), macOS (18%) |
| Extension Version | 1.9.2 |
| Store Size | 13.08 MB |

---

## Contributing

Contributions are welcome! This is an open-source project and community improvements help make it better for everyone.

**Ways to contribute:**
- Bug reports and feature requests via [GitHub Issues](https://github.com/shaafyousaf/Slowed-Enhanced/issues)
- Pull requests for fixes or new features
- Testing on different sites and reporting compatibility issues
- UX feedback and design suggestions

**To get started:**
```bash
git clone https://github.com/shaafyousaf/Slowed-Enhanced.git
cd Slowed-Enhanced
# Load unpacked in Chrome (see Installation above)
# Make your changes, reload the extension in chrome://extensions/, and test
```

There's no complex build step — edit, reload the extension in `chrome://extensions/`, and test directly. Low barrier to entry for first-time contributors.

---

## Roadmap

- [ ] Firefox / Edge support
- [ ] Per-site saved presets
- [ ] EQ controls
- [ ] Keyboard shortcuts
- [ ] Bass boost slider

Have a feature idea? [Open an issue](https://github.com/shaafyousaf/Slowed-Enhanced/issues) or reach out via [shaafyousaf.com](https://shaafyousaf.com).

---

## Known Issues

This is a solo-developed, actively maintained extension. Some audio sources with non-standard streaming implementations may behave unexpectedly. Bug reports are always appreciated — the best way to report is via [GitHub Issues](https://github.com/shaafyousaf/Slowed-Enhanced/issues) or LinkedIn.

---

## License

MIT © [Shaaf Yousaf](https://shaafyousaf.com)

---

## Author

**Shaaf Yousaf** — [shaafyousaf.com](https://shaafyousaf.com)

Built and maintained by Shaaf Labs. If you find this useful, consider starring the repo or leaving a review on the [Chrome Web Store](https://chromewebstore.google.com/detail/slowed-enchanced/).
