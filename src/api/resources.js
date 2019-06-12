const { Router } = require('express');
const ResourceController = require('../controllers/ResourceController');
let router = Router();

router.all('/swap-tokens', ResourceController.swapTokens);

module.exports = router;