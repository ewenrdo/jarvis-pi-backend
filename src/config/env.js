require('dotenv').config({ override: true });

const { resolveFrontPath } = require('../utils/resolveFrontPath');

const PORT = process.env.PORT || 5788;
const FRONT_PATH = resolveFrontPath(process.env.PATH_TO_FRONT);
const KODI_USER = process.env.KODI_USER || 'kodi';
const KODI_PASSWORD = process.env.KODI_PASSWORD || 'kodi';

module.exports = {
    PORT,
    FRONT_PATH,
    KODI_USER,
    KODI_PASSWORD,
};