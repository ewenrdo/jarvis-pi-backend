const { exec, spawn } = require('child_process');
const os = require('os');
const path = require('path');

function shouldReloadAtMidnight(now = new Date()) {
    return now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 5;
}

function shouldScreenBeOn(now = new Date()) {
    const { SCREEN_START, SCREEN_END } = require('../config/env');
    const start = parseInt(SCREEN_START, 10);
    const end = parseInt(SCREEN_END, 10);
    const hour = now.getHours();

    
    if (start < end) {
        return hour >= start && hour < end;
    }

    return hour >= start || hour < end;
}

function launchChromiumKiosk(url, devMode = false) {
    const browserCandidates = [process.env.CHROMIUM_BINARY || 'chromium-browser', 'chromium'];
    attemptLaunchChromium(browserCandidates, 0, url, devMode);
}

function attemptLaunchChromium(browserCandidates, index, url, devMode) {
    const browserCommand = browserCandidates[index];
    const child = spawn(browserCommand, [
        devMode ? '--disable-web-security' : '--kiosk',
        '--overscroll-history-navigation=0',
        '--enable-accelerated-video',
        '--ignore-gpu-blocklist',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
        '--password-store=basic',
        url
    ], {
        detached: true,
        stdio: 'inherit',
        env: buildChromiumEnv(),
    });

    child.on('error', (error) => {
        if (error.code === 'ENOENT' && index < browserCandidates.length - 1) {
            attemptLaunchChromium(browserCandidates, index + 1, url, devMode);
            return;
        }

        console.error("Impossible de lancer Chromium :", error.message);
    });

    child.unref();
}

function buildChromiumEnv() {
    const env = { ...process.env };
    const currentUser = process.env.SUDO_USER || process.env.USER || os.userInfo().username;
    const userHome = process.env.SUDO_USER ? `/home/${process.env.SUDO_USER}` : os.homedir();

    env.DISPLAY = env.DISPLAY || ':0';
    env.XAUTHORITY = env.XAUTHORITY || `${userHome}/.Xauthority`;

    return env;
}

function createFrontendService(frontPath) {
    const POWER_SCRIPT = path.resolve(__dirname, '../../scripts/power.sh');

    function turnOffScreen() {
        console.log('[SCREEN] Exécution de power.sh off...');

        exec(`"${POWER_SCRIPT}" off`, (err, stdout, stderr) => {
            if (stdout) {
                console.log('[SCREEN]', stdout.trim());
            }

            if (stderr) {
                console.error('[SCREEN]', stderr.trim());
            }

            if (err) {
                console.error("[SCREEN] Erreur lors de l'extinction :", err.message);
                return;
            }

            console.log('[SCREEN] Écran éteint avec succès.');
        });
    }

    function turnOnScreen() {
        console.log('[SCREEN] Exécution de power.sh on...');

        exec(`"${POWER_SCRIPT}" on`, (err, stdout, stderr) => {
            if (stdout) {
                console.log('[SCREEN]', stdout.trim());
            }

            if (stderr) {
                console.error('[SCREEN]', stderr.trim());
            }

            if (err) {
                console.error("[SCREEN] Erreur lors de l'allumage :", err.message);
                return;
            }

            console.log('[SCREEN] Écran allumé avec succès.');
        });
    }

    function startTimeBasedActions() {
        let midnightReloadTriggered = false;
        let lastScreenState = null;

        setInterval(() => {
            const now = new Date();
            const screenShouldBeOn = shouldScreenBeOn(now);

            if (screenShouldBeOn && lastScreenState !== 'on') {
                lastScreenState = 'on';
                console.log(`[SCREEN] ${now.toLocaleTimeString()} → ON`);
                turnOnScreen();
            }

            if (!screenShouldBeOn && lastScreenState !== 'off') {
                lastScreenState = 'off';
                console.log(`[SCREEN] ${now.toLocaleTimeString()} → OFF`);
                turnOffScreen();
            }

            if (!shouldReloadAtMidnight(now)) {
                midnightReloadTriggered = false;
                return;
            }

            if (midnightReloadTriggered) {
                return;
            }

            midnightReloadTriggered = true;
            console.log('Minuit atteint, rechargement de Chromium...');
            reloadChromium('http://localhost:3000');
        }, 1000);
    }

    function reloadChromium(url = 'http://localhost:3000') {
        exec('DISPLAY=:0 wmctrl -a Chromium', (err) => {
            if (err) {
                console.log('Fenêtre Chromium introuvable, relance du navigateur...');
                launchChromiumKiosk(url);
                return;
            }

            exec('DISPLAY=:0 xdotool search --onlyvisible --class Chromium windowfocus key --clearmodifiers ctrl+R', (xdotoolErr) => {
                if (xdotoolErr) {
                    console.log('Impossible de recharger via xdotool, relance du navigateur...');
                    launchChromiumKiosk(url);
                }
            });
        });
    }

    function launch(devMode = false) {
        if (!frontPath) {
            console.log("Le chemin vers le front-end n'est pas défini. Veuillez définir la variable d'environnement PATH_TO_FRONT.");
            return;
        }

        startTimeBasedActions();

        console.log('Démarrage du front-end Vite...');

        exec(`npm run dev --prefix ${frontPath}`, (err) => {
            if (err) {
                console.error('Erreur lors du lancement de Vite :', err);
            }
        });

        const checkAndLaunch = async () => {
            const interfaceAvailable = await isInterfaceAvailable();

            if (interfaceAvailable) {
                console.log('Le front-end est disponible. Lancement de Chromium...');
                launchChromiumKiosk('http://localhost:3000', devMode);
            } else {
                console.log("Le front-end n'est pas encore disponible, nouvelle tentative dans 2 secondes...");
                setTimeout(checkAndLaunch, 2000);
            }
        };

        setTimeout(checkAndLaunch, 3000);
    }

    async function isInterfaceAvailable() {
        try {
            const response = await fetch('http://localhost:3000', { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    function focus(res) {
        exec('DISPLAY=:0 wmctrl -a Chromium', (err) => {
            if (err) {
                launchChromiumKiosk('http://localhost:3000');
            }

            if (res && !res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Focus remis sur le Front-end'
                }));
            }
        });
    }

    function resetFrontProcess() {
        exec('pkill -9 chrom*', () => {
            console.log('Nettoyage initial des processus Chromium effectué.');
        });
    }

    return {
        launch,
        focus,
        reloadChromium,
        resetFrontProcess,
    };
}

module.exports = {
    createFrontendService,
    shouldReloadAtMidnight,
};
