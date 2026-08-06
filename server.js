const http = require('http');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const Evdev = require('evdev');
require('dotenv').config({ override: true });

const PORT = process.env.PORT || 5788;
const FRONT_PATH = resolveFrontPath(process.env.PATH_TO_FRONT);
const reader = new Evdev();

if (FRONT_PATH) {
    console.log("Démarrage du front-end Vite...");
    exec(`npm run dev --prefix ${FRONT_PATH}`, (err) => {
        if (err) {
            console.error("Erreur lors du lancement de Vite :", err);
        }
    });

    setTimeout(() => {
        console.log("Lancement de Chromium en mode kiosque...");
        exec('chromium-browser --kiosk http://localhost:3000 &', (err) => {
            if (err) {
                console.log("Impossible de lancer chromium-browser (déjà ouvert ou non installé ?)");
            }
        });
    }, 2000);
} else {
    console.log("Le chemin vers le front-end n'est pas défini. Veuillez définir la variable d'environnement PATH_TO_FRONT.");
}

function resolveFrontPath(frontPath) {
    if (!frontPath) {
        return null;
    }

    if (frontPath === '~') {
        return os.homedir();
    }

    if (frontPath.startsWith('~/')) {
        return path.join(os.homedir(), frontPath.slice(2));
    }

    return path.isAbsolute(frontPath) ? frontPath : path.resolve(process.cwd(), frontPath);
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/launch') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const { addonid } = JSON.parse(body);

                exec('pgrep kodi', (err, stdout) => {
                    if (err) {
                        exec('kodi &');
                        setTimeout(() => {
                            sendKodiCommand(addonid, res);
                            focusKodi();
                        }, 3000);
                    } else {
                        sendKodiCommand(addonid, res);
                        focusKodi();
                    }
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "Requête JSON invalide" }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Route non trouvée" }));
    }
});

reader.on('device', (device) => {
    console.log(`Périphérique détecté : ${device.name}`);

    device.on('alphanumeric', (data) => {
        if (data.value === 1) {
            if (data.code === 'KEY_HOMEPAGE') {
                focusFrontend();
            }

            if (data.code === 'KEY_POWER') {
                exec('sudo systemctl suspend', (err) => {
                    if (err) {
                        console.log("Erreur lors de la mise en veille (droits sudo requis ?)");
                    }
                });
            }
        }
    });
});

reader.search('/dev/input', 'event.*', function(err, files) {
    if (err) {
        console.error("Erreur lors de la recherche des périphériques evdev :", err);
    }
});

async function sendKodiCommand(addonid, res) {
    try {
        const KODI_USER = process.env.KODI_USER || 'kodi';
        const KODI_PASSWORD = process.env.KODI_PASSWORD || 'kodi';

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

function focusKodi() {
    exec('wmctrl -a Kodi', (err) => {
        if (err) {
            console.log("Impossible de basculer le focus sur Kodi.");
        }
    });
}

function focusFrontend(res) {
    exec('wmctrl -a Chromium', (err) => {
        if (err) {
            exec('chromium-browser --kiosk http://localhost:3000 &');
        }
        
        if (res && !res.headersSent) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: "Focus remis sur le Front-end" }));
        }
    });
}

server.listen(PORT, () => {
    console.log(`Serveur natif Jarvis démarré sur http://localhost:${PORT}`);
    setTimeout(() => {
        focusFrontend();
    }, 4000);
});