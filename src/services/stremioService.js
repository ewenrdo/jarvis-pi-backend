const { exec, spawn } = require('child_process');
const os = require('os');
const path = require('path');

function buildChromiumEnv() {
    const env = { ...process.env };
    const userHome = process.env.SUDO_USER ? `/home/${process.env.SUDO_USER}` : os.homedir();

    env.DISPLAY = env.DISPLAY || ':0';
    env.XAUTHORITY = env.XAUTHORITY || `${userHome}/.Xauthority`;

    return env;
}

function createStremioService(frontendService) {
    let stremioProcess = null;

    function launch() {
        const browserCandidates = [process.env.CHROMIUM_BINARY || 'chromium-browser', 'chromium'];
        const url = 'https://web.stremio.com';
        
        console.log("Lancement d'une instance isolée de Stremio (profil persistant)...");
        attemptLaunchStremio(browserCandidates, 0, url);
    }

    function attemptLaunchStremio(browserCandidates, index, url) {
        const browserCommand = browserCandidates[index];
        
        // Dossier persistant dans le home de l'utilisateur pour conserver la session
        const userHome = process.env.SUDO_USER ? `/home/${process.env.SUDO_USER}` : os.homedir();
        const persistentProfileDir = path.join(userHome, '.stremio-chromium-profile');

        stremioProcess = spawn(browserCommand, [
            '--kiosk',
            `--user-data-dir=${persistentProfileDir}`,
            '--force-device-scale-factor=1.5',
            '--overscroll-history-navigation=0',
            '--enable-accelerated-video',
            '--ignore-gpu-blocklist',
            '--enable-gpu-rasterization',
            '--enable-zero-copy',
            '--enable-features=VaapiVideoDecoder',
            '--use-gl=angle',
            url
        ], {
            detached: true,
            stdio: 'ignore',
            env: buildChromiumEnv(),
        });

        stremioProcess.on('error', (error) => {
            if (error.code === 'ENOENT' && index < browserCandidates.length - 1) {
                console.log(`Commande '${browserCommand}' introuvable, tentative avec le candidat suivant...`);
                attemptLaunchStremio(browserCandidates, index + 1, url);
                return;
            }

            console.error("Impossible de lancer Stremio (aucun navigateur compatible trouvé ou déjà ouvert).");
        });

        stremioProcess.unref();
    }

    function close(onClosed) {
        exec('pkill -f ".stremio-chromium-profile"', (err) => {
            if (err) {
                console.log("Aucun processus Stremio actif à fermer.");
            } else {
                console.log("Stremio fermé avec succès.");
            }

            if (frontendService && typeof frontendService.focus === 'function') {
                frontendService.focus();
            }

            if (typeof onClosed === 'function') {
                onClosed();
            }
        });
    }
    function resetStremioProcess() {
        exec('pkill -f ".stremio-chromium-profile"', () => {
            console.log("Nettoyage initial des processus Stremio effectué.");
        });
    }

    return {
        launch,
        close,
        resetStremioProcess,
    };
}

module.exports = {
    createStremioService,
};