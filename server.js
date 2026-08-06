const { PORT, FRONT_PATH, KODI_USER, KODI_PASSWORD } = require('./src/config/env');
const { createFrontendService } = require('./src/services/frontendService');
const { createKodiService } = require('./src/services/kodiService');
const { createInputService, setBrightness } = require('./src/services/inputService');
const { createJarvisServer } = require('./src/server/createJarvisServer');

const frontendService = createFrontendService(FRONT_PATH);
const kodiService = createKodiService({ KODI_USER, KODI_PASSWORD });

// Nettoyage des instances fantômes de Kodi au démarrage du serveur
kodiService.resetKodiProcess();

frontendService.launch();

createInputService({
    onHome: () => frontendService.focus(),
    onPower: () => kodiService.suspendSystem(),
});

const server = createJarvisServer({
    kodiService,
});

server.listen(PORT, () => {
    console.log(`Serveur natif Jarvis démarré sur http://localhost:${PORT}`);
    setTimeout(() => {
        frontendService.focus();
    }, 4000);
});