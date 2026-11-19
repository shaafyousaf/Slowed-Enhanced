// Smooth pitch shifter used for slowed playback with "preserve pitch" on.
//
// Chrome's built-in preservesPitch cuts audio into ~20ms pieces, which sounds choppy at slow
// speeds. Instead, the element plays with plain resampling (smooth, but pitch drops) and this
// processor shifts the pitch back up by 1/speed. It reads long Hann-windowed grains that
// cross-fade into each other (50% overlap-add), and lines each new grain up with the previous
// one by cross-correlation (WSOLA-style) so the joins blend instead of clicking.
class SmoothPitchProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{ name: 'pitch', defaultValue: 1, minValue: 0.25, maxValue: 4, automationRate: 'k-rate' }];
    }

    constructor() {
        super();
        this.size = 1 << 17; // ring buffer, ~2.7s at 48kHz
        this.mask = this.size - 1;
        this.bufL = new Float32Array(this.size);
        this.bufR = new Float32Array(this.size);
        this.written = 0; // absolute number of samples written

        this.grainLen = 2 * Math.round(sampleRate * 0.03); // 60ms grains (Chrome uses ~20ms)
        this.hop = this.grainLen / 2;                        // 50% overlap
        this.search = Math.round(sampleRate * 0.02);         // +-20ms search: covers a full bass cycle
        this.win = new Float32Array(this.grainLen);
        for (let i = 0; i < this.grainLen; i++) {
            // periodic Hann: overlapping windows at 50% hop sum to exactly 1
            this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / this.grainLen);
        }
        this.step = 4; // decimation for the correlation search
        this.ref = new Float32Array(Math.ceil(this.hop / this.step) + 1);

        this.grains = []; // { pos, rate, j }
        this.untilNext = 0;
        this.mix = 0; // 0 = untouched passthrough, 1 = pitch shifted
        this.mixStep = 1 / Math.round(sampleRate * 0.05); // 50ms fade between the two
    }

    read(buf, pos) {
        const i = Math.floor(pos);
        const a = buf[i & this.mask];
        return a + (buf[(i + 1) & this.mask] - a) * (pos - i);
    }

    startGrain(now, p) {
        const G = this.grainLen, H = this.hop, S = this.search, mask = this.mask;
        // Start far enough behind the write head that neither this grain nor the
        // correlation window ever reads samples that haven't arrived yet.
        const lead = Math.max(0, p - 1) * G + H + 2 * S + 256;
        const nominal = now - lead;
        let best = nominal;

        const prev = this.grains.length ? this.grains[this.grains.length - 1] : null;
        if (prev && p >= 1) {
            // Natural continuation of the previous grain over the overlap region (mono).
            const L = Math.min(H, G - prev.j);
            let m = 0;
            for (let k = 0; k < L; k += this.step) {
                const i = Math.floor(prev.pos + prev.rate * (prev.j + k)) & mask;
                this.ref[m++] = this.bufL[i] + this.bufR[i];
            }
            // Pick the start offset whose waveform best matches it.
            let bestScore = -Infinity;
            for (let off = -S; off <= S; off += 2) {
                const s = nominal + off;
                let c = 0, e = 1e-9;
                for (let k = 0, mm = 0; mm < m; k += this.step, mm++) {
                    const i = Math.floor(s + p * k) & mask;
                    const v = this.bufL[i] + this.bufR[i];
                    c += this.ref[mm] * v;
                    e += v * v;
                }
                const score = c / Math.sqrt(e);
                if (score > bestScore) {
                    bestScore = score;
                    best = s;
                }
            }
        }
        this.grains.push({ pos: best, rate: p, j: 0 });
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0] || [];
        const inL = input[0], inR = input[1] || input[0];
        const outL = outputs[0][0], outR = outputs[0][1] || outputs[0][0];
        const n = outL.length;
        const p = parameters.pitch[0];
        const target = Math.abs(p - 1) > 1e-3 ? 1 : 0;
        const base = this.written;

        for (let i = 0; i < n; i++) {
            const k = (base + i) & this.mask;
            this.bufL[k] = inL ? inL[i] : 0;
            this.bufR[k] = inR ? inR[i] : 0;
        }
        this.written += n;

        if (target === 0 && this.mix === 0) {
            // Not shifting: pass audio straight through with zero added latency.
            if (inL) {
                outL.set(inL);
                if (outR !== outL) outR.set(inR);
            }
            this.grains.length = 0;
            this.untilNext = 0;
            return true;
        }

        const win = this.win, G = this.grainLen;
        for (let i = 0; i < n; i++) {
            if (this.untilNext <= 0) {
                this.startGrain(base + i, target ? p : 1);
                this.untilNext = this.hop;
            }
            this.untilNext--;

            let l = 0, r = 0;
            for (let g = 0; g < this.grains.length; g++) {
                const gr = this.grains[g];
                const w = win[gr.j];
                const pos = gr.pos + gr.rate * gr.j;
                l += w * this.read(this.bufL, pos);
                r += w * this.read(this.bufR, pos);
                gr.j++;
            }
            while (this.grains.length && this.grains[0].j >= G) this.grains.shift();

            if (this.mix < target) this.mix = Math.min(1, this.mix + this.mixStep);
            else if (this.mix > target) this.mix = Math.max(0, this.mix - this.mixStep);
            const dryL = inL ? inL[i] : 0, dryR = inR ? inR[i] : 0;
            outL[i] = this.mix * l + (1 - this.mix) * dryL;
            if (outR !== outL) outR[i] = this.mix * r + (1 - this.mix) * dryR;
        }
        return true;
    }
}

registerProcessor('smooth-pitch', SmoothPitchProcessor);
