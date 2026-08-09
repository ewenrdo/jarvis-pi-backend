const http = require('http');

function createJarvisServer({ kodiService, renaultService }) {
    return http.createServer((req, res) => {
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
                    console.log(`Requête reçue pour lancer l'addon Kodi : ${addonid}`);
                    kodiService.launchIfNeeded(addonid, res);
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Requête JSON invalide" }));
                }
            });
        } else if (req.method === 'GET' && req.url === '/api/renault/stats') {
            renaultService.getStats()
                .then((data) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data));
                })
                .catch((error) => {
                    console.error('Erreur lors de la récupération des stats Renault :', error);
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Impossible de récupérer les stats Renault' }));
                });
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "Route non trouvée" }));
        }
    });
}

module.exports = {
    createJarvisServer,
};