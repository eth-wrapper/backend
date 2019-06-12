const {Router} = require('express');
const requireParam = require('../middleware/requestParamRequire');
const OperatorController = require('../controllers/OperatorController');
let router = Router();

router.post('/unread-messages', OperatorController.unreadMessages);
router.post('/swap-list', OperatorController.getSwapList);
router.post('/set-withdraw', requireParam('swap:Swap', 'txHash:string'), OperatorController.setSwapWithdraw);

module.exports = router;