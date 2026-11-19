// Injected into the active tab by the popup (audio.js -> window.start) every time it opens.
// Wrapped in an IIFE with a guard so re-injection rescans the page instead of throwing
// "Identifier 'ctx' has already been declared" and leaving new media unhandled.
(() => {
    const prev = window.__slowedEnhanced;
    if (prev && prev.alive()) {
        prev.scan();
        return;
    }
    // A previous copy whose extension context died (extension auto-updated/reloaded):
    // take over its audio graphs, since a media element can only ever be routed once.
    const inherited = prev ? prev.retire() : null;

    const runtime = chrome.runtime;
    const state = inherited?.state ?? { volume: 1, speed: 1, reverb: 0, reverbOption: 1, preservePitch: true };
    const graphs = inherited?.graphs ?? new Map(); // media element -> { dry, wet, convolver }
    let ctx = inherited?.ctx ?? null;
    let workletReady = inherited?.workletReady ?? null;
    const failed = new WeakSet();
    const pending = new WeakSet();
    const lastRateFix = new WeakMap();
    const impulses = {};

    const REVERB_PRESETS = {
        1: { duration: 1.5, decay: 3, bassBoost: 2.0 },  // cove
        2: { duration: 0.5, decay: 2, bassBoost: 1.5 },  // studio
        3: { duration: 3.5, decay: 1.5, bassBoost: 3.0 } // stadium
    };

    function getCtx() {
        if (!ctx) {
            ctx = new AudioContext();
            // Autoplay policy can leave the context suspended, which silences every routed
            // element. Resume it on any interaction or playback.
            const resume = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => { }); };
            ['pointerdown', 'keydown', 'play'].forEach(t => document.addEventListener(t, resume, true));
        }
        if (!workletReady) {
            // Smooth pitch shifter for slowed playback; if it can't load we fall back to Chrome's.
            workletReady = ctx.audioWorklet.addModule(runtime.getURL('stretch-worklet.js'))
                .then(() => true, e => { console.warn('[Slowed Enhanced] smooth pitch unavailable:', describe(e)); return false; });
        }
        return ctx;
    }

    // Simple room simulation impulse, cached per preset (generating it is expensive).
    function getImpulse(option) {
        if (impulses[option]) return impulses[option];
        const { duration, decay, bassBoost } = REVERB_PRESETS[option] ?? REVERB_PRESETS[1];
        const c = getCtx();
        const length = Math.floor(c.sampleRate * duration);
        const impulse = c.createBuffer(2, length, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            const alpha = 0.1; // simple low-pass for a warmer tail
            for (let i = 1; i < length; i++) data[i] = alpha * data[i] + (1 - alpha) * data[i - 1];
            for (let i = 0; i < length; i++) data[i] *= bassBoost;
        }
        return (impulses[option] = impulse);
    }

    // Web Audio is only needed for volume/reverb and smooth slowed pitch. Plain speed changes
    // are native element properties, so untouched audio never leaves the browser's pipeline.
    const smoothSlowdown = () => state.preservePitch && state.speed < 1;
    const needsGraph = () => state.volume !== 1 || state.reverb > 0 || smoothSlowdown();

    // Routing cross-origin media without CORS makes Web Audio output silence, so skip those.
    function canRoute(el) {
        if (el.srcObject || el.crossOrigin) return true;
        const src = el.currentSrc || el.src;
        if (!src) return false; // nothing loaded yet; retried on 'play'/'loadedmetadata'
        try {
            const u = new URL(src, location.href);
            return u.protocol === 'blob:' || u.protocol === 'data:' || u.origin === location.origin;
        } catch {
            return false;
        }
    }

    async function attach(el) {
        if (graphs.has(el) || failed.has(el) || pending.has(el) || !canRoute(el)) return;
        pending.add(el);
        try {
            const c = getCtx();
            // Never route into a suspended context, or the element goes silent. If resuming
            // needs a user gesture this waits until the page gets one.
            if (c.state !== 'running') await c.resume().catch(() => { });
            if (c.state !== 'running' || graphs.has(el)) return;
            const hasWorklet = await workletReady;
            if (graphs.has(el)) return;

            // Build everything that can fail *before* capturing the element: once
            // createMediaElementSource succeeds, the element is silent until it's connected.
            let stretch = null;
            if (hasWorklet) {
                try {
                    stretch = new AudioWorkletNode(c, 'smooth-pitch', { outputChannelCount: [2] });
                } catch (e) {
                    console.warn("[Slowed Enhanced] smooth pitch unavailable, using Chrome's:", describe(e));
                }
            }
            const dry = c.createGain();
            const wet = c.createGain();
            const convolver = c.createConvolver();
            convolver.buffer = getImpulse(state.reverbOption);

            let source;
            try {
                source = c.createMediaElementSource(el);
            } catch (e) {
                // e.g. element already captured by the page or an older copy of this extension
                failed.add(el);
                console.warn('[Slowed Enhanced] could not route media element:', describe(e));
                return;
            }
            try {
                const head = stretch ? source.connect(stretch) : source;
                head.connect(dry).connect(c.destination);
                head.connect(convolver).connect(wet).connect(c.destination);
                const g = { dry, wet, convolver, stretch };
                graphs.set(el, g);
                setGains(g, true);
                applyPlayback(el, false);
            } catch (e) {
                // Never leave a captured element silent: fall back to a straight connection.
                try { source.disconnect(); } catch { }
                source.connect(c.destination);
                failed.add(el);
                console.warn('[Slowed Enhanced] routing failed, playing unprocessed:', describe(e));
            }
        } finally {
            pending.delete(el);
        }
    }

    // DOMExceptions print as "[object DOMException]" on the extensions page; spell them out.
    const describe = e => (e && e.name ? `${e.name}: ${e.message}` : String(e));

    function setGains(g, immediate) {
        const dry = (1 - state.reverb) * state.volume;
        const wet = state.reverb * state.volume;
        if (immediate) {
            g.dry.gain.value = dry;
            g.wet.gain.value = wet;
            return;
        }
        // Short ramp instead of a hard jump: avoids clicks/zipper noise while dragging sliders.
        const t = ctx.currentTime;
        g.dry.gain.setTargetAtTime(dry, t, 0.015);
        g.wet.gain.setTargetAtTime(wet, t, 0.015);
    }

    function setSpeed(el) {
        el.defaultPlaybackRate = state.speed; // survives src changes (load() resets playbackRate to this)
        el.playbackRate = state.speed;
    }

    // Speed + pitch for one element. When it's routed through our smooth pitch shifter and we're
    // slowing down, Chrome only resamples (smooth) and the worklet restores the pitch.
    function applyPlayback(el, explicitSpeed) {
        if (explicitSpeed || state.speed !== 1) setSpeed(el);
        const stretch = graphs.get(el)?.stretch;
        const ours = !!stretch && smoothSlowdown();
        el.preservesPitch = ours ? false : state.preservePitch;
        if (stretch) stretch.parameters.get('pitch').value = ours ? 1 / state.speed : 1;
    }

    function allMedia() {
        const set = new Set(document.querySelectorAll('video, audio'));
        graphs.forEach((_, el) => set.add(el));
        return set;
    }

    function applyAll(explicitSpeed) {
        const wantGraph = needsGraph();
        allMedia().forEach(el => {
            applyPlayback(el, explicitSpeed);
            if (wantGraph) attach(el);
        });
        graphs.forEach(g => setGains(g, false));
    }

    // Media events don't bubble, but capture on document still sees every in-page element,
    // including ones added later (SPA navigation, next track, new video).
    function onMediaEvent(e) {
        const el = e.target;
        if (!(el instanceof HTMLMediaElement)) return;
        if (e.type === 'ratechange') {
            // Sites like YouTube reset the rate when switching videos; put ours back (throttled
            // so we never ping-pong with a page that keeps resetting it).
            if (state.speed !== 1 && Math.abs(el.playbackRate - state.speed) > 1e-3) {
                const now = performance.now();
                if (now - (lastRateFix.get(el) ?? 0) > 250) {
                    lastRateFix.set(el, now);
                    el.playbackRate = state.speed;
                }
            }
            return;
        }
        applyPlayback(el, false);
        if (needsGraph()) attach(el);
    }

    function onMessage(msg, sender, reply) {
        if (msg.volume !== undefined) state.volume = msg.volume;
        if (msg.reverb !== undefined) state.reverb = msg.reverb;
        if (msg.speed !== undefined) state.speed = msg.speed;
        if (msg.preservePitch !== undefined) state.preservePitch = msg.preservePitch;
        if (msg.reverboption !== undefined && REVERB_PRESETS[msg.reverboption] && msg.reverboption !== state.reverbOption) {
            state.reverbOption = msg.reverboption;
            graphs.forEach(g => {
                try { g.convolver.buffer = getImpulse(state.reverbOption); } catch (e) { console.warn(e); }
            });
        }
        applyAll(msg.speed !== undefined);
        reply({ ok: true, media: allMedia().size, routed: graphs.size });
    }

    // ---- live waveform for the popup's scope (runs only while the popup is open) ----
    // Read-only taps: routed elements are tapped after their volume/reverb gains; untouched
    // elements via captureStream(), which copies the audio without rerouting playback.
    const taps = new Map(); // media element -> { kind, nodes, track }
    const untappable = new WeakSet();
    let analyser = null;

    function untap(el) {
        const t = taps.get(el);
        if (!t) return;
        t.nodes.forEach(n => { try { n.disconnect(analyser); } catch { } });
        if (t.track) t.track.stop();
        taps.delete(el);
    }

    function tapAll() {
        const c = getCtx();
        if (!analyser) {
            analyser = c.createAnalyser();
            analyser.fftSize = 2048;
        }
        allMedia().forEach(el => {
            const t = taps.get(el);
            const g = graphs.get(el);
            if (g) {
                if (t?.kind === 'graph') return;
                untap(el);
                g.dry.connect(analyser);
                g.wet.connect(analyser);
                taps.set(el, { kind: 'graph', nodes: [g.dry, g.wet] });
                return;
            }
            if (t && t.track.readyState === 'live') return; // still valid
            untap(el);
            if (el.paused || untappable.has(el)) return;
            try {
                const track = el.captureStream().getAudioTracks()[0];
                if (!track) return; // no audio yet; retried next second
                const node = c.createMediaStreamSource(new MediaStream([track]));
                node.connect(analyser);
                taps.set(el, { kind: 'stream', nodes: [node], track });
            } catch {
                untappable.add(el); // e.g. cross-origin or DRM-protected media
            }
        });
    }

    function onConnect(port) {
        if (port.name !== 'scope') return;
        const c = getCtx();
        if (c.state === 'suspended') c.resume().catch(() => { });
        const buf = new Float32Array(2048);
        let n = 0;
        const timer = setInterval(() => {
            if (n++ % 30 === 0) tapAll(); // pick up new/changed media about once a second
            if (!taps.size || c.state !== 'running') {
                // Tell the popup why there's no live wave (about twice a second).
                if (n % 15 === 1) {
                    try { port.postMessage({ status: c.state !== 'running' ? 'blocked' : 'silent' }); } catch { clearInterval(timer); }
                }
                return;
            }
            analyser.getFloatTimeDomainData(buf);
            // trigger on a rising zero crossing so the wave holds still like an oscilloscope
            let start = 0;
            for (let i = 1; i < 1024; i++) if (buf[i - 1] < 0 && buf[i] >= 0) { start = i; break; }
            const pts = new Array(128);
            for (let k = 0; k < 128; k++) {
                let s = 0;
                for (let j = 0; j < 8; j++) s += buf[start + k * 8 + j];
                pts[k] = Math.round((s / 8) * 1000) / 1000;
            }
            try { port.postMessage(pts); } catch { clearInterval(timer); }
        }, 33);
        port.onDisconnect.addListener(() => {
            clearInterval(timer);
            [...taps.keys()].forEach(untap);
        });
    }

    const EVENTS = ['play', 'loadedmetadata', 'ratechange'];
    EVENTS.forEach(t => document.addEventListener(t, onMediaEvent, true));
    runtime.onMessage.addListener(onMessage);
    runtime.onConnect.addListener(onConnect);

    window.__slowedEnhanced = {
        alive() {
            try { return !!runtime.id; } catch { return false; }
        },
        scan() { applyAll(false); },
        retire() {
            EVENTS.forEach(t => document.removeEventListener(t, onMediaEvent, true));
            try { runtime.onMessage.removeListener(onMessage); } catch { }
            try { runtime.onConnect.removeListener(onConnect); } catch { }
            [...taps.keys()].forEach(untap);
            return { state, graphs, ctx, workletReady };
        }
    };

    applyAll(false);
})();
