const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

function createRenaultService({
    baseUrl = 'http://localhost:5789/renault/stats',
    statsPiPath = process.env.RENAULT_STATS_PI_PATH,
    spawnFn = spawn,
} = {}) {
    async function getStats() {
        const response = await fetch(baseUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Impossible de récupérer les stats Renault: ${response.status}`);
        }

        return response.json();
    }

    function resetRenaultProcess() {
        return new Promise((resolve) => {
            exec('pkill -f "python.*uvicorn index:app" || true', () => {
                console.log('Processus Renault stats API arrêtés.');
                resolve();
            });
        });
    }

    async function launch() {
        const resolvedPath = path.resolve(statsPiPath);

        if (!fs.existsSync(resolvedPath)) {
            console.log(`Le projet Renault stats API est introuvable à l'emplacement : ${resolvedPath}`);
            return null;
        }

        await resetRenaultProcess();
        console.log('Démarrage de l’API Renault stats...');

        function tryLaunch(command, index) {
            const child = spawnFn(command, ['-m', 'uvicorn', 'index:app', '--reload', '--host', '0.0.0.0', '--port', '5789'], {
                cwd: resolvedPath,
                detached: true,
                stdio: 'inherit',
                env: process.env,
            });

            child.on('error', (error) => {
                if (error.code === 'ENOENT' && index < pythonCommands.length - 1) {
                    tryLaunch(pythonCommands[index + 1], index + 1);
                    return;
                }

                console.log('Impossible de lancer l’API Renault stats. Vérifiez Python et les dépendances.');
            });

            child.unref();
            return child;
        }

        const pythonCommands = ['python3', 'python'];
        return tryLaunch(pythonCommands[0], 0);
    }

    return {
        getStats,
        launch,
        resetRenaultProcess,
    };
}

module.exports = {
    createRenaultService,
};
