// Save settings to storage
window.saveSettings = async function (volume, speed, reverb, reverboption, preservepitch) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.set({ volume, speed, reverb, reverboption, preservepitch }, () => {
                if (chrome.runtime.lastError) {
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve({ success: true, error: null });
                }
            });
        } catch (e) {
            console.error("Error sending volume message to droid:", e);
            resolve({ success: false, error: toErr(e) });
        };
    });
    
};

window.reload = function () {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        chrome.tabs.reload(tabs[0].id);
    });
}

window.start = function () {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content-script.js"]
        });
    });
}

// Load settings from storage
window.loadSettings = async function () {
    const result = await chrome.storage.local.get(['volume', 'speed', 'reverb', 'reverboption', 'preservepitch']);
    return {
        volume: result.volume ?? 1,
        speed: result.speed ?? 1,
        reverb: result.reverb ?? 0,
        reverboption: result.reverboption ?? 1,
        preservepitch: result.preservepitch ?? true
    };
};

window.setVolume = function (volume) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            try {
                chrome.tabs.sendMessage(tabs[0].id, { volume: volume }, () => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve({ success: true, error: null });
                    }
                });

            } catch (e) {
                console.error("Error sending volume message to droid:", e);
                resolve({ success: false, error: toErr(e) });
            };
        });
    })
    
};

window.setSpeed = function (speed) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {

            try {
                chrome.tabs.sendMessage(tabs[0].id, { speed: speed }, () => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve({ success: true, error: null });
                    }
                });
            } catch (e) {
                console.error("Error sending volume message to droid:", e);
                resolve({ success: false, error: toErr(e) });
            };
        });
    });    
};

window.setPitchPreservation = function (preservepitch) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            try {
                chrome.tabs.sendMessage(tabs[0].id, { preservePitch: preservepitch }, () => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve({ success: true, error: null });
                    }
                });
            } catch (e) {
                console.error("Error sending pitch preservation message:", e);
                resolve({ success: false, error: toErr(e) });
            }
        });
    });
};

window.setReverb = function (reverb) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {

            try {
                chrome.tabs.sendMessage(tabs[0].id, { reverb: reverb }, () => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve({ success: true, error: null });
                    }
                });
            } catch (e) {
                console.error("Error sending volume message to droid:", e);
                resolve({ success: false, error: toErr(e) });
            };
        });

    })
    
};

window.setReverbOption = function (reverboption) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {

            try {
                chrome.tabs.sendMessage(tabs[0].id, { reverboption: reverboption }, () => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve({ success: true, error: null });
                    }
                });
            } catch (e) {
                console.error("Error sending volume message to droid:", e);
                resolve({ success: false, error: toErr(e) });
            };
        });

    })

};


function toErr(e) {
    return typeof e === 'string' ? e : (e?.message ?? String(e));
}
