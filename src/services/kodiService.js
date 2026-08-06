const { exec } = require('child_process');

function createKodiService(credentials = {}) {
    const KODI_USER = credentials.KODI_USER || 'kodi';
    const KODI_PASSWORD = credentials.KODI_PASSWORD || 'kodi';

    function resetKodiProcess() {
        exec('pkill -9 kodi', () => {
            console.log("Nettoyage initial des processus Kodi effectué.");
        });
    }

    function focus() {
        exec('DISPLAY=:0 wmctrl -a Kodi', (err) => {
            if (err) {
                console.log("Impossible de basculer le focus sur Kodi.");
            }
        });
    }

    function suspendSystem() {
        exec('sudo systemctl suspend', (err) => {
            if (err) {
                console.log("Erreur lors de la mise en veille (droits sudo requis ?)");
            }
        });
    }

    async function sendCommand(addonid, res) {
        try {
            const kodiResponse = await fetch('http://localhost:8080/jsonrpc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(`${KODI_USER}:${KODI_PASSWORD}`).toString('base64')
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "Addons.ExecuteAddon",
                    params: { addonid },
                    id: 1
                })
            });

            const data = await kodiResponse.json();

            if (!res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            }
        } catch (error) {
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "Impossible de contacter le serveur JSON-RPC de Kodi" }));
            }
        }
    }

    function launchIfNeeded(addonid, res) {
        exec('pgrep kodi', (err) => {
            if (err) {
                console.log("Kodi n'est pas en cours d'exécution. Nettoyage et lancement...");
                exec('pkill -9 kodi; DISPLAY=:0 kodi &', () => {
                    setTimeout(() => {
                        sendCommand(addonid, res);
                        focus();
                    }, 3000);
                });
            } else {
                resetKodiProcess();
                setTimeout(() => {
                    sendCommand(addonid, res);
                    focus();
                }, 1000);
            }
        });
    }

    return {
        resetKodiProcess,
        focus,
        suspendSystem,
        sendCommand,
        launchIfNeeded,
    };
}

module.exports = {
    createKodiService,
};