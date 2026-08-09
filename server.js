const { PORT, FRONT_PATH, RENAULT_STATS_PATH, KODI_USER, KODI_PASSWORD } = require('./src/config/env');
const { createFrontendService } = require('./src/services/frontendService');
const { createKodiService } = require('./src/services/kodiService');
const { createInputService, setBrightness } = require('./src/services/inputService');
const { createJarvisServer } = require('./src/server/createJarvisServer');
const { createRenaultService } = require('./src/services/renaultService');
const { getNotificationService } = require('./src/services/notificationService');

const frontendService = createFrontendService(FRONT_PATH);
const kodiService = createKodiService({ KODI_USER, KODI_PASSWORD });
const renaultService = createRenaultService({ statsPiPath: RENAULT_STATS_PATH });
const notificationService = getNotificationService();

// Nettoyage des instances fantômes de Kodi au démarrage du serveur
kodiService.resetKodiProcess();
renaultService.stop();

renaultService.launch();
frontendService.launch(process.argv.includes('--dev'));

createInputService({
    onHome: () => frontendService.focus(),
    onPower: () => kodiService.suspendSystem(),
});

const server = createJarvisServer({
    kodiService,
    renaultService,
    notificationService,
});

getNotificationService().createNotification({
  title: 'Jarvis est prêt',
  content: 'Votre serveur Jarvis est opérationnel et prêt à l\'emploi. Profitez de votre expérience !',
  datetime: new Date().toISOString(),
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