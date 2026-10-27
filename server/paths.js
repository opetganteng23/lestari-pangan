const path = require('path');
module.exports = { DATA: process.env.LP_DATA_DIR || path.join(__dirname, '..', 'data') };
