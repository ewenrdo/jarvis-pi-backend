const { PORT, FRONT_PATH, RENAULT_STATS_PATH, KODI_USER, KODI_PASSWORD } = require('./src/config/env');
const { createFrontendService } = require('./src/services/frontendService');
const { createKodiService } = require('./src/services/kodiService');
const { createInputService, setBrightness } = require('./src/services/inputService');
const { createJarvisServer } = require('./src/server/createJarvisServer');
const { createRenaultService } = require('./src/services/renaultService');

const frontendService = createFrontendService(FRONT_PATH);
const kodiService = createKodiService({ KODI_USER, KODI_PASSWORD });
const renaultService = createRenaultService({ statsPiPath: RENAULT_STATS_PATH });

// Nettoyage des instances fantômes de Kodi au démarrage du serveur
kodiService.resetKodiProcess();
renaultService.stop();

renaultService.launch();
frontendService.launch();

createInputService({
    onHome: () => frontendService.focus(),
    onPower: () => kodiService.suspendSystem(),
});

const server = createJarvisServer({
    kodiService,
    renaultService,
});

server.listen(PORT, () => {
    console.log(`Serveur natif Jarvis démarré sur http://localhost:${PORT}`);
    setTimeout(() => {
        frontendService.focus();
    }, 4000);
});

process.on('SIGINT', () => {
    renaultService.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    renaultService.stop();
    process.exit(0);
});