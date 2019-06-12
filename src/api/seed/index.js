const { Router } = require('express');
const Wallet = require('../../database/mongooseModels/Wallet')
const requireParam = require('../../middleware/requestParamRequire');
const blockchain = require('../../blockchain');
let router = Router();

const nacl = require('tweetnacl');

// const deployWalletScript = require('../../../scripts/deploy_wallet');

router.all('/resources', function (req, res, next) {
  // initialize new 20 test wallets;
  // if(process.env.SEED_REGULAR_WALLET) {
  //     new Array(200).fill(0)
  //         .map(n => blockchain.createWallet())
  //         .map(wallet => ({
  //             assigned: false,
  //             address: wallet.address,
  //             privateKey: wallet.privateKey
  //         }))
  //         .map(keyPair => {
  //             (new Wallet(keyPair)).save();
  //         });
  // }
  res.send({
    success: true,
    message: 'feed successfully done.'
  })
});

router.get('/deploy-wallet', function (req, res, next) {
    // Wallet.find({assigned: false})
    //     .then(wallets => {
    //         if(wallets.length < process.env.MIN_FREE_WALLET_COUNT){
    //             deployWalletScript.run(function (address) {
    //                 new Wallet({address}).save().then(()=>{
    //                     res.send({success: true, address});
    //                 })
    //                     .catch(error => res.send({
    //                         success: false,
    //                         error
    //                     }));
    //             })
    //         }else{
    //             res.send({success: true, message: 'Wallet count is enough now.'})
    //         }
    //     }).catch(error => {
    //         res.send({
    //             success: false,
    //             error
    //         })
    // })
})

module.exports = router;