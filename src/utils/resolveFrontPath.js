const path = require('path');
const os = require('os');

function resolveFrontPath(frontPath) {
    if (!frontPath) {
        return null;
    }

    if (frontPath === '~') {
        return os.homedir();
    }

    if (frontPath.startsWith('~/')) {
        return path.join(os.homedir(), frontPath.slice(2));
    }

    return path.isAbsolute(frontPath) ? frontPath : path.resolve(process.cwd(), frontPath);
}

module.exports = {
    resolveFrontPath,
};