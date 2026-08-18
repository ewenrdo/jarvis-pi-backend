const http = require('http');

function createJarvisServer({ kodiService, renaultService, notificationService, idfmService, stremioService }) {
    return http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
        } else if (req.method === 'POST' && req.url === '/api/stremio') {
            stremioService.launch();
            req.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: "Stremio lancé" }));
            });
        }else if (req.method === 'POST' && req.url === '/api/stremio/close') {
            stremioService.close(res);
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
        } else if (req.method === 'GET' && req.url === '/api/notifications') {
            const notifications = notificationService.listNotifications();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(notifications));
        } else if (req.method === 'DELETE' && req.url.startsWith('/api/notifications/')) {
            const notificationId = Number(req.url.split('/').pop());
            const updatedNotification = notificationService.markNotificationAsRead(notificationId);

            if (!updatedNotification) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Notification introuvable' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(updatedNotification));
        } else if (req.method === 'GET' && req.url === '/api/idfm/disruptions') {
            idfmService.getDisruptions()
                .then((disruptions) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(disruptions));
                })
                .catch((error) => {
                    console.error('Erreur lors de la récupération des disruptions IDFM :', error);
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Impossible de récupérer les disruptions IDFM' }));
                });
        } else if (req.method === 'GET' && req.url === '/api/idfm/next-departures') {

            const ermontStopId = 'STIF%3AStopPoint%3AQ%3A41085%3A';
            const ermontCLineId = 'STIF%3ALine%3AC01727%3A1%3A';

            idfmService.nextTrainsFromStation(ermontStopId)
                .then((departures) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(departures));
                })
                .catch((error) => {
                    console.error('Erreur lors de la récupération des prochains départs IDFM :', error);
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Impossible de récupérer les prochains départs IDFM' }));
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