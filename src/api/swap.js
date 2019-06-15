const {Router} = require('express');
const requireParam = require('../middleware/requestParamRequire');
const SwapController = require('../controllers/SwapController');
let router = Router();

function swapOwner(req, res, next){
    let currentUser = req.data.user;
    if(currentUser && currentUser._id.toString() === req.body.swap.user.toString())
        next();
    else{
        res.status(403).send({
            success: false,
            message: "Permission denied to access this Swap"
        })
    }
}

router.all('/coin-list', SwapController.getCoinList);
router.post('/conversion-rate', requireParam('deposit:string','receiving:string'), SwapController.getConversionRate);
let newParams = ['deposit:string','receiving:string',"amount:number", "recipientWallet:string"]
router.post('/new', requireParam(newParams), SwapController.new);
router.post(
    '/set-ethereum-deposit',
    requireParam('swap:Swap',"address:string","sig:string", "txHash:string"),
    swapOwner,
    SwapController.setEthereumDeposit
);
router.post(
    '/info',
    requireParam("swap:Swap"),
    swapOwner,
    SwapController.info
);
router.post('/list', SwapController.getUserSwaplist);
router.get('/test', SwapController.test);

module.exports = router;