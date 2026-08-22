const { exec } = require('child_process');
const Evdev = require('evdev');

function createInputService(handlers = {}) {
    const reader = new Evdev();

    reader.on('device', (device) => {
        console.log(`Périphérique détecté : ${device.name}`);

        // Fonction générique pour intercepter toutes les touches
        const handleKeyData = (data) => {
            console.log("Code touche reçu :", data.code, "Valeur :", data.value);
            if (data.value === 1) { // 1 = Appui sur la touche
                if (data.code === 'KEY_HOMEPAGE' && typeof handlers.onHome === 'function') {
                    handlers.onHome();
                }
                if (data.code === 'KEY_POWER' && typeof handlers.onPower === 'function') {
                    handlers.onPower();
                }
                if (data.code === 'KEY_MENU' && typeof handlers.onMenu === 'function') {
                    handlers.onMenu();
                }
            }
        };

        // Écoute à la fois les événements alphanumériques et les touches de fonction/multimédia standard
        device.on('alphanumeric', handleKeyData);
        device.on('key', handleKeyData);
    });

    reader.search('/dev/input', 'event.*', (err) => {
        if (err) {
            console.error("Erreur lors de la recherche des périphériques evdev :", err);
        }
    });

    return reader;
}

module.exports = {
    createInputService
};