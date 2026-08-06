const { exec, spawn } = require('child_process');
const os = require('os');

function shouldReloadAtMidnight(now = new Date()) {
    return now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 5;
}

function launchChromiumKiosk(url) {
    const browserCandidates = [process.env.CHROMIUM_BINARY || 'chromium-browser', 'chromium'];
    attemptLaunchChromium(browserCandidates, 0, url);
}

function attemptLaunchChromium(browserCandidates, index, url) {
    const browserCommand = browserCandidates[index];
    const child = spawn(browserCommand, ['--kiosk', url], {
        detached: true,
        stdio: 'inherit',
        env: buildChromiumEnv(),
    });

    child.on('error', (error) => {
        if (error.code === 'ENOENT' && index < browserCandidates.length - 1) {
            attemptLaunchChromium(browserCandidates, index + 1, url);
            return;
        }

        console.log("Impossible de lancer chromium-browser (déjà ouvert ou non installé ?)");
    });

    child.unref();
}

function buildChromiumEnv() {
    const env = { ...process.env };

    // Détermine l'utilisateur actif (que l'on soit en sudo ou en utilisateur standard)
    const currentUser = process.env.SUDO_USER || process.env.USER || os.userInfo().username;
    const userHome = process.env.SUDO_USER ? `/home/${process.env.SUDO_USER}` : os.homedir();

    // Force le display et l'authentification X11 pour la session graphique
    env.DISPLAY = env.DISPLAY || ':0';
    env.XAUTHORITY = env.XAUTHORITY || `${userHome}/.Xauthority`;

    return env;
}

function createFrontendService(frontPath) {
    function startTimeBasedActions() {
        let midnightReloadTriggered = false;

        setInterval(() => {
            const now = new Date();

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

    function launch() {
        if (!frontPath) {
            console.log("Le chemin vers le front-end n'est pas défini. Veuillez définir la variable d'environnement PATH_TO_FRONT.");
            return;
        }

        startTimeBasedActions();

        console.log("Démarrage du front-end Vite...");
        exec(`npm run dev --prefix ${frontPath}`, (err) => {
            if (err) {
                console.error("Erreur lors du lancement de Vite :", err);
            }
        });

        setTimeout(() => {
            console.log("Lancement de Chromium en mode kiosque...");
            launchChromiumKiosk('http://localhost:3000');
        }, 2000);
    }

    function focus(res) {
        exec('DISPLAY=:0 wmctrl -a Chromium', (err) => {
            if (err) {
                launchChromiumKiosk('http://localhost:3000');
            }

            if (res && !res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: "Focus remis sur le Front-end" }));
            }
        });
    }

    return {
        launch,
        focus,
        reloadChromium,
    };
}

module.exports = {
    createFrontendService,
    shouldReloadAtMidnight,
};