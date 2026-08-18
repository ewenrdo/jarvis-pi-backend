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
        
        console.log("Lancement d'une instance isolée de Stremio (Chromium Kiosque avec zoom 150%)...");
        
        // Dossier de profil temporaire unique pour forcer un processus complètement indépendant de Jarvis
        const tempProfileDir = path.join(os.tmpdir(), 'stremio-chromium-profile');

        stremioProcess = spawn(browserCandidates[0], [
            '--kiosk',
            `--user-data-dir=${tempProfileDir}`,
            '--force-device-scale-factor=1.5',
            '--overscroll-history-navigation=0',
            '--enable-accelerated-video',
            '--ignore-gpu-blocklist',
            '--enable-gpu-rasterization',
            '--enable-zero-copy',
            url
        ], {
            detached: true,
            stdio: 'ignore',
            env: buildChromiumEnv(),
        });

        stremioProcess.on('error', (err) => {
            console.error("Erreur lors du lancement de Stremio :", err);
        });

        stremioProcess.unref();
    }

    function close(res) {
        // Tue spécifiquement les instances de Chromium qui utilisent le profil Stremio
        exec('pkill -f "stremio-chromium-profile"', (err) => {
            if (err) {
                console.log("Aucun processus Stremio actif à fermer.");
            } else {
                console.log("Stremio fermé avec succès.");
            }

            // Remet le focus sur l'interface principale Jarvis[cite: 2]
            if (frontendService && typeof frontendService.focus === 'function') {
                frontendService.focus();
            }

            if (res && !res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: "Stremio fermé, retour à Jarvis" }));
            }
        });
    }

    function resetStremioProcess() {
        exec('pkill -f "stremio-chromium-profile"', () => {
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