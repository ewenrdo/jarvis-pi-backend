require('dotenv').config({ override: true });

const { resolveFrontPath } = require('../utils/resolveFrontPath');

const PORT = process.env.PORT || 5788;
const FRONT_PATH = resolveFrontPath(process.env.PATH_TO_FRONT);
const KODI_USER = process.env.KODI_USER || 'kodi';
const KODI_PASSWORD = process.env.KODI_PASSWORD || 'kodi';
const RENAULT_STATS_PATH = process.env.RENAULT_STATS_PI_PATH || resolveFrontPath('renault-stats-pi');
const IDFM_API_KEY = process.env.IDFM_API_KEY;
const SCREEN_START = process.env.SCREEN_START || 9;
const SCREEN_END = process.env.SCREEN_END || 21;
module.exports = {
    PORT,
    FRONT_PATH,
    KODI_USER,
    KODI_PASSWORD,
    RENAULT_STATS_PATH,
    IDFM_API_KEY,
    SCREEN_START,
    SCREEN_END
};