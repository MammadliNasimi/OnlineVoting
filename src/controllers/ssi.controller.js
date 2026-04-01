const crypto = require('crypto');
const db = require('../config/database-sqlite');
const state = require('../config/state');
const { ethers } = require('ethers');
const { hashEmail, createMailTransporter, getUserFromSession } = require('../utils/helpers');

class SsiController {

}

module.exports = new SsiController();
