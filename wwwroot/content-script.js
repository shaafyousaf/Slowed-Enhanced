
    const ctx = new AudioContext();
    const nodes = new Map();
    var totalcount = 0;

    // Create impulse response for reverb (simple room simulation)
    function createReverbImpulse(duration, decay, bassBoost = 1.5) {
        const sampleRate = ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        // Generate impulse
        for (let i = 0; i < length; i++) {
            left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }

        // Simple low-pass filter to enhance bass
        const alpha = 0.1; // Lower = more bass emphasis
        for (let i = 1; i < length; i++) {
            left[i] = alpha * left[i] + (1 - alpha) * left[i - 1];
            right[i] = alpha * right[i] + (1 - alpha) * right[i - 1];
        }

        // Boost overall amplitude
        for (let i = 0; i < length; i++) {
            left[i] *= bassBoost;
            right[i] *= bassBoost;
        }

        return impulse;
    }

    function granularNode(context) {
        const bufferSize = 4096;
        const node = context.createScriptProcessor(bufferSize, 2, 2);

        let stretchFactor = 1.0;

        node.setStretch = function (factor) {
            stretchFactor = Math.max(0.5, Math.min(factor, 4.0));
        };

        node.getStretch = function () {
            return stretchFactor;
        };

        node.onaudioprocess = function (e) {
            const inputL = e.inputBuffer.getChannelData(0);
            const inputR = e.inputBuffer.getChannelData(1);
            const outputL = e.outputBuffer.getChannelData(0);
            const outputR = e.outputBuffer.getChannelData(1);

            // Original loop
            for (let i = 0; i < bufferSize; i++) {
                outputL[i] = inputL[i];
                outputR[i] = inputR[i];
            }
        };

        return node;
    }


    document.querySelectorAll('video, audio').forEach(el => {
            if (nodes.has(el) || el._audioProcessed) return;
            el._audioProcessed = true;

            const source = ctx.createMediaElementSource(el);

            const granular = granularNode(ctx);
            const convolver = ctx.createConvolver();
            const dry = ctx.createGain();
            const wet = ctx.createGain();

            // Add granular output gain for proper routing
            const granularGain = ctx.createGain();
            granularGain.gain.value = 1.0;

            // THIS IS CRITICAL - set the impulse response buffer
            convolver.buffer = createReverbImpulse(2, 2);

            // Route audio through granular processor
            source.connect(granular);
            granular.connect(granularGain);

            // Connect dry path (from granular output)
            granularGain.connect(dry);
            dry.connect(ctx.destination);

            // Connect wet path (reverb from granular output)
            granularGain.connect(convolver);
            convolver.connect(wet);
            wet.connect(ctx.destination);

            // Initial mix (no reverb)
            dry.gain.value = 1;
            wet.gain.value = 0;

            el.preservesPitch = true;
            el.mozPreservesPitch = true;

            nodes.set(el, { source, granular, granularGain, dry, wet, convolver, element: el });
            totalcount++;
    });

    console.log(`Found ${totalcount} audio/video elements`);

    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
        if (msg.volume !== undefined) {
            nodes.forEach(({ dry, wet }) => {
                const currentTotal = dry.gain.value + wet.gain.value;
                const reverbRatio = currentTotal > 0 ? wet.gain.value / currentTotal : 0;

                dry.gain.value = (1 - reverbRatio) * msg.volume;
                wet.gain.value = reverbRatio * msg.volume;
            });
        }

        if (msg.speed) {
            nodes.forEach(({ element, granular }) => {
                //if (msg.speed < 1.0) {
                //    element.playbackRate = msg.speed;
                //    granular.setStretch(1.0 / msg.speed);
                //} else {
                //    element.playbackRate = msg.speed;
                //    granular.setStretch(1.0);
                //}

                if (msg.speed < 1.0) {
                    // Preserve pitch with granular stretch for slowdown
                    element.playbackRate = msg.speed;
                    granular.setStretch(1.0 / msg.speed);
                } else {
                    // Either not preserving pitch, or speed >= 1.0
                    element.playbackRate = msg.speed;
                    granular.setStretch(1.0);
                }                
            });
        }
        if (msg.preservePitch !== undefined) {
            preservePitch = msg.preservePitch;
            nodes.forEach(({ element, granular }) => {
                const currentSpeed = element.playbackRate;

                // Set the property on the element
                element.preservesPitch = preservePitch;

                // Reapply the speed with new pitch setting
                if (currentSpeed < 1.0) {
                    granular.setStretch(1.0 / currentSpeed);
                } else {
                    granular.setStretch(1.0);
                }
            });
        }

        if (msg.reverb !== undefined) {
            nodes.forEach(({ dry, wet }) => {
                const currentVolume = dry.gain.value + wet.gain.value;
                dry.gain.value = (1 - msg.reverb) * currentVolume;
                wet.gain.value = msg.reverb * currentVolume;
            });
        }
        if (msg.reverboption !== undefined) {
            if (msg.reverboption !== undefined) {
                const reverbSettings = {
                    1: {
                        duration: 1.5,
                        decay: 3,
                        bassBoost: 2.0
                    },
                    2: {
                        duration: 0.5,
                        decay: 2,
                        bassBoost: 1.5
                    },
                    3: {
                        duration: 3.5,
                        decay: 1.5,
                        bassBoost: 3.0
                    }
                };

                const preset = reverbSettings[msg.reverboption];

                if (preset) {
                    nodes.forEach(({ dry, wet, convolver }) => {
                        // Update the impulse response for the new reverb type
                        convolver.buffer = createReverbImpulse(
                            preset.duration,
                            preset.decay,
                            preset.bassBoost
                        );

                        // Don't override wet/dry here - let the reverb slider control that
                        // Just update the convolver buffer
                    });
                }
            }
        }

        reply(true);
        return true;
    });
