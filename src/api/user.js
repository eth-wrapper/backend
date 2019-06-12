const randomString = require("../utils/randomString");
const {Router} = require('express');
const requireParam = require('../middleware/requestParamRequire');
const UserController = require('../controllers/UserController');
let router = Router();

router.all('/get-info', UserController.getInfo);
router.post('/check-username', requireParam('username:string'), UserController.checkUsername)
router.post('/update-username', requireParam('username:string'), UserController.updateUsername)
router.post('/check-email', requireParam('email:email'), UserController.checkEmail)
router.post('/update-email', requireParam('email:email'), UserController.updateEmail)
router.post('/update', UserController.update)
router.post('/transactions', UserController.transactions)
router.post('/unread-messages', UserController.unreadMessages)
router.post('/read-trade-messages', requireParam('tradeId:objectId'), UserController.readTradeMessages)

module.exports = router;