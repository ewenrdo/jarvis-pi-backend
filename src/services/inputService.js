const { exec } = require('child_process');
const Evdev = require('evdev');

function createInputService(handlers = {}) {
    const reader = new Evdev();

    reader.on('device', (device) => {
        console.log(`Périphérique détecté : ${device.name}`);

        device.on('alphanumeric', (data) => {
            if (data.value === 1) {
                if (data.code === 'KEY_HOMEPAGE' && typeof handlers.onHome === 'function') {
                    handlers.onHome();
                }

                if (data.code === 'KEY_POWER' && typeof handlers.onPower === 'function') {
                    handlers.onPower();
                }
            }
        });
    });

    reader.search('/dev/input', 'event.*', (err) => {
        if (err) {
            console.error("Erreur lors de la recherche des périphériques evdev :", err);
        }
    });

    return reader;
}

function setBrightness(level) {
    exec(`brightnessctl set ${level}%`, (err) => {
        if (err) {
            console.error("Impossible de modifier la luminosité");
        }
    });
}

module.exports = {
    createInputService,
    setBrightness,
};