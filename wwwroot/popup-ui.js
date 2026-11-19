// Popup-only UI effects: very faint mechanical tick sounds and the live signal scope.
(() => {
    // Overall loudness of the UI ticks (0 = silent). 0.45 peaks around -17 dBFS: quiet, but
    // still audible over music. Every doubling/halving is about +-6 dB.
    const TICK_VOLUME = 0.45;

    let ac = null, noise = null, lastTick = 0;
    const lastValue = new WeakMap();

    function audio() {
        if (!ac) {
            ac = new AudioContext();
            // 20ms of noise with a steep built-in decay: a dry "tk" when band-passed.
            const len = Math.floor(ac.sampleRate * 0.02);
            noise = ac.createBuffer(1, len, ac.sampleRate);
            const d = noise.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
        }
        if (ac.state === 'suspended') ac.resume().catch(() => { });
        return ac;
    }

    function tick(level, freq) {
        if (TICK_VOLUME <= 0) return;
        try {
            const c = audio();
            const src = c.createBufferSource();
            src.buffer = noise;
            const bp = c.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = freq;
            bp.Q.value = 1.6; // wider band = rounder, less clicky
            const g = c.createGain();
            g.gain.value = level * TICK_VOLUME;
            src.connect(bp).connect(g).connect(c.destination);
            src.start();
        } catch { /* audio is a nicety; never break the UI */ }
    }

    // One tick per slider step, rising slightly in pitch with the value. Passing the
    // "home" value (data-home, e.g. 1.0x) gives a deeper detent click.
    document.addEventListener('input', e => {
        const el = e.target;
        if (!(el instanceof HTMLInputElement) || el.type !== 'range') return;
        if (lastValue.get(el) === el.value) return;
        lastValue.set(el, el.value);
        const now = performance.now();
        const home = el.dataset.home !== undefined && Math.abs(el.value - el.dataset.home) < 1e-9;
        if (!home && now - lastTick < 22) return;
        lastTick = now;
        const p = (el.value - el.min) / (el.max - el.min || 1);
        if (home) tick(1.6, 1100);
        else tick(1, 1700 + p * 1300);
    }, true);

    document.addEventListener('pointerdown', e => {
        if (e.target.closest?.('[data-click]')) tick(1.6, 900);
        else try { audio(); } catch { } // wake the audio on the first press so the first slider tick isn't lost
    }, true);

    // Live audio from the tab (see content-script.js onConnect), drawn faintly under the wave.
    let live = null, liveAt = 0, liveStatus = 'silent', port = null;
    function listen() {
        try { port?.disconnect(); } catch { }
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                if (!tab) return;
                try {
                    port = chrome.tabs.connect(tab.id, { name: 'scope' });
                    port.onMessage.addListener(pts => {
                        if (Array.isArray(pts)) { live = pts; liveAt = performance.now(); }
                        else if (pts?.status) liveStatus = pts.status;                    });
                    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; port = null; });
                } catch { }
            });
        } catch { }
    }

    // Signal scope: a drawn waveform that follows the settings with a little inertia.
    // Speed drives how fast it scrolls, volume its height, reverb its blurred echoes,
    // and with pitch not preserved the wave stretches out as the pitch drops.
    function start() {
        const cv = document.querySelector('canvas.scope');
        if (!cv || cv._running) return;
        cv._running = true;
        const g = cv.getContext('2d');
        const cur = { speed: 1, vol: 0, rev: 0, k: 1 }; // vol starts at 0: "power on" swell
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        let phase = 0, last = performance.now();
        const shown = new Float32Array(128);
        let liveAlpha = 0;

        function frame(now) {
            if (!cv.isConnected) { cv._running = false; return; }
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            const W = cv.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1;
            if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
                cv.width = Math.round(W * dpr);
                cv.height = Math.round(H * dpr);
            }

            const ds = cv.dataset;
            const target = {
                speed: parseFloat(ds.speed) || 1,
                vol: parseFloat(ds.vol) || 0,
                rev: parseFloat(ds.rev) || 0,
                k: ds.pitch === '1' ? 1 : (parseFloat(ds.speed) || 1)
            };
            const ease = Math.min(1, dt * 6);
            for (const key in cur) cur[key] += (target[key] - cur[key]) * ease;
            if (!still) phase += dt * 2.6 * cur.speed;

            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.clearRect(0, 0, W, H);

            // graticule
            g.strokeStyle = 'rgba(255,255,255,0.045)';
            g.lineWidth = 1;
            g.beginPath();
            for (let x = 12.5; x < W; x += 18) { g.moveTo(x, 0); g.lineTo(x, H); }
            g.moveTo(0, H / 2 + 0.5);
            g.lineTo(W, H / 2 + 0.5);
            g.stroke();

            // live audio: faint light gray, underneath everything else
            liveAlpha += ((live && now - liveAt < 400 ? 1 : 0) - liveAlpha) * ease;
            if (live && liveAlpha > 0.01) {
                g.strokeStyle = `rgba(205,210,220,${(0.3 * liveAlpha).toFixed(3)})`;
                g.lineWidth = 1;
                g.beginPath();
                for (let i = 0; i < 128; i++) {
                    shown[i] += ((live[i] || 0) * liveAlpha - shown[i]) * 0.5;
                    const x = (W * i) / 127;
                    const y = Math.max(2, Math.min(H - 2, H / 2 - shown[i] * H * 0.9));
                    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
                }
                g.stroke();
            }

            const k = 0.075 * cur.k;
            const amp = H * 0.3 * Math.min(cur.vol, 2) / 1.4;
            const path = ph => {
                g.beginPath();
                for (let x = 0; x <= W; x += 2) {
                    const env = Math.pow(Math.sin((Math.PI * x) / W), 0.7);
                    const y = H / 2 - amp * env * (0.6 * Math.sin(k * x + ph) + 0.27 * Math.sin(2.02 * k * x + 1.4 * ph) + 0.13 * Math.sin(4.1 * k * x - 0.8 * ph));
                    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
                }
            };

            // reverb: delayed, blurred echoes in faint blue
            g.shadowColor = 'rgba(120,176,255,0.8)';
            for (let i = 3; i >= 1; i--) {
                const a = (cur.rev * 0.5) / i;
                if (a < 0.01) continue;
                g.strokeStyle = `rgba(160,200,255,${a.toFixed(3)})`;
                g.lineWidth = 1 + i * 0.6;
                g.shadowBlur = 6 + i * 4;
                path(phase - i * 0.45);
                g.stroke();
            }
            g.shadowColor = 'rgba(120,176,255,0.95)';
            g.shadowBlur = 10;
            g.strokeStyle = 'rgba(255,255,255,0.93)';
            g.lineWidth = 1.4;
            path(phase);
            g.stroke();
            g.shadowBlur = 0;

            // legend: which wave is which (hidden on the welcome page)
            if (ds.legend !== '0') {
                g.font = '600 8.5px "Futura Cyrillic", JakartaSans, sans-serif';
                g.letterSpacing = '1.6px';
                g.textBaseline = 'middle';
                const ly = H - 8;
                let lx = W * 0.14;
                const liveText = liveAlpha > 0.5 ? 'LIVE'
                    : liveStatus === 'blocked' ? 'LIVE · CLICK THE PAGE' : 'LIVE · NO AUDIO';
                g.fillStyle = `rgba(205,210,220,${liveAlpha > 0.5 ? 0.7 : 0.35})`;
                g.fillRect(lx, ly, 8, 1);
                lx += 12;
                g.fillText(liveText, lx, ly);
                lx += g.measureText(liveText).width + 12;
                g.fillStyle = 'rgba(255,255,255,0.85)';
                g.fillRect(lx, ly, 8, 1);
                g.fillText('PREVIEW', lx + 12, ly);
            }

            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    window.scope = { start, listen };
})();
