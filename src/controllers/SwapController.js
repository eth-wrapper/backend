const Swap = require('../database/mongooseModels/Swap');
const Coin = require('../database/mongooseModels/Coin');
const Wallet = require('../database/mongooseModels/Wallet');
const WalletPoolController = require('./WalletPoolController');
const CoinController = require('./CoinController');
const qrcode = require("qrcode");
const i18n = require('i18n');
const EventBus = require('../eventBus');
const moment = require('moment');
const sigUtil = require('eth-sig-util');
const ethUtil = require('ethereumjs-util');

const networkModules = require('../networkModules').allModules;

module.exports.getCoinList = getCoinList;
module.exports.getConversionRate = getConversionRate;
module.exports.new = registerNewSwap;
module.exports.info = getSwapInfo;
module.exports.getUserSwaplist = getUserSwaplist;
module.exports.setEthereumDeposit = setEthereumDeposit;
/**
 * This two methods called by cron job.
 */
module.exports.watchToDetectNewSwap = watchToDetectNewSwap;
module.exports.watchToConfirmDeposit = watchToConfirmNewSwap;
module.exports.watchToConfirmWithdraw = watchSwapWithdrawToConfirm;
module.exports.ethereumTokenAutoMint = ethereumTokenAutoMint;

function conversionRate(deposit, receiving){
    return 1;
}

function getCoinList(req, res, next){
    Coin.find({})
        .then(coinList => {
            res.send({
                success: true,
                coinList
            })
        })
        .catch(error => {
            res.send({
                success: false,
                message: error.message || "Server side error",
                coinList: []
            })
        })
}

function getConversionRate(req, res, next) {
    return res.send({
        success: true,
        rate: 1 //conversionRate(deposit, receiving)
    })
    // Coin.find({})
    //     .then(coinList => {
    //         let deposit = coinList.find(item => item.code === req.body.deposit.toUpperCase());
    //         let receiving = coinList.find(item => item.code === req.body.receiving.toUpperCase());
    //         if(!deposit || !receiving)
    //             return res.send({success: false, message: "Deposit or receiving code is invalid"})
    //         res.send({
    //             success: true,
    //             rate: 1 //conversionRate(deposit, receiving)
    //         })
    //     })
    //     .catch(error => {
    //         res.send({
    //             success: false,
    //             message: error.message || "Server side error",
    //             rate: 0
    //         })
    //     })
}

function getDepositWallet(coin, user){
    if(coin.network === 'ethereum'){
        return Promise.resolve(process.env.ETHEREUM_TOKENS_ADMIN_WALLET);
    }else{
        if(user[`${coin.walletType}Wallet`] === undefined){
            console.log(`assigning new wallet [${coin.walletType}Wallet] to user`);
            return WalletPoolController.assignWalletToUser(user, coin.walletType)
                .then(() => user[`${coin.walletType}Wallet`]);
        }else
            return Promise.resolve(user[`${coin.walletType}Wallet`])
    }
}

function registerNewSwap(req, res, next) {
    let currentUser = req.data.user;
    let swap;
    let {deposit, receiving, amount, recipientWallet} = req.body;
    amount = parseFloat(amount);
    let depositCoin = null, receivingCoin = null;
    Coin.find({})
        .then(coinList => {
            depositCoin = coinList.find(item => item.code === deposit);
            receivingCoin = coinList.find(item => item.code === receiving);

            // Validation
            if(!depositCoin)
                throw {message: "Deposit coin invalid"};
            if(!receivingCoin)
                throw {success: false, message: "Receiving coin invalid"};
            if(amount <= 0)
                throw {success: false, message: "Amount most be a positive number"};
            if(!CoinController.validateWallet(receivingCoin, recipientWallet))
                throw {success: false, message: "Recipient wallet address invalid"};

            return getDepositWallet(depositCoin, currentUser);
        })
        .then(depositWallet => {
            swap = new Swap({
                user: currentUser._id,
                depositCoin,
                depositAmount: amount,
                depositWallet,
                receivingCoin,
                receivingAmount: amount * conversionRate(depositCoin, receivingCoin),
                recipientWallet,
                status: Swap.STATUS_NEW
            });
            return swap.save();
        })
        .then(() => {
            res.send({
                success: true,
                swapId: swap._id
            });
        })
        .catch(error => {
            console.log('swap: ',swap);
            res.send({
                success: false,
                message: error.message || "Server side error",
                error
            })
        })
}

function setEthereumDeposit(req, res, next){
    let {swap, txHash, address, sig} = req.body;
    let depositMsgParams = [
        {
            type: 'string',      // Any valid solidity type
            name: 'from',     // Any string label you want
            value: address  // The value to sign
        },
        {
            type: 'string',      // Any valid solidity type
            name: 'swap',     // Any string label you want
            value: swap._id.toString()  // The value to sign
        }
    ];
    const recovered = sigUtil.recoverTypedSignature({
        data: depositMsgParams,
        sig
    });
    let verified = false;
    if (ethUtil.toChecksumAddress(recovered) === ethUtil.toChecksumAddress(address)) {
        verified = true;
    } else {
        verified = false;
    }
    if(!verified){
        return res.send({success: false, message: "Signature not verified"});
    }
    swap.status = Swap.STATUS_DEPOSIT_SENT;
    swap.depositTxHash = txHash;
    swap.save()
        .then(() => {
            res.send({
                success: true,
                swap
            });
        })
        .catch(error => {
            res.send({
                success: false,
                message: error.message || i18n.__('sse'),
                error
            })
        })
}

function getSwapInfo(req, res, next) {
    let swap = JSON.parse(JSON.stringify(req.body.swap));
    qrcode.toDataURL(swap.depositWallet, async function(err, qrImage){
        if(err){
            console.log(err);
        }
        swap.depositWalletQr = qrImage;
        res.send({
            success: true,
            swap
        })
    });
}

function getUserSwaplist(req, res, next) {
    let currentUser = req.data.user;
    Swap.find({user: currentUser._id})
        .sort({createdAt: -1})
        .then(swapList => {
            res.send({
                success: true,
                swapList
            })
        })
        .catch(error => {
            res.send({
                success: false,
                message: error.message || i18n.__('sse')
            });
        })
}

module.exports.test = function(req, res, next){
    Coin.find({code: 'BTC'})
        .then(coinList => {
            return networkModules.bitcoin.watchDeposit(coinList[0], 'mmAncbKrM2trJykFg1TuJ1oG4XiSM441Qv');
        })
        .then(tx => res.send(tx))
        .catch(error => res.send(error))
}

/**
 * This two methods called by cron job.
 */

function watchToDetectNewSwap() {
    let watchPromises = [];
    let swapList = [];
    // console.log('newSwapWatch ...');
    Swap.find({status: Swap.STATUS_NEW})
        .then(allNewSwap => {
            // console.log(`${allNewSwap.length} new swap to watch.`);
            for(let i=0 ; i<allNewSwap.length ; i++){
                let swap = allNewSwap[i];
                if(moment(swap.createdAt).add(1, 'day') < moment()) {
                    swap.status = Swap.STATUS_CANCEL;
                    swap.save();
                }else{
                    handleSwapDeposit(swap);
                }
            }
        })
}
function handleSwapDeposit(swap){
    let depositHistory = [];
    let correspondingItem = null;
    CoinController.watchDeposit(swap.depositCoin, swap.depositWallet)
        .then(result => {
            depositHistory = result.transactions;
            // console.log('watchDeposit:', JSON.stringify(result,null,2));
            if(depositHistory && depositHistory.length > 0){
                let txs = depositHistory.map(t => t.hash);
                return Swap.find({
                    depositWallet: swap.depositWallet,
                    depositTxHash: {$in: txs}
                });
            }else{
                return [];
            }
        })
        .then(oldSwaps => {
            let wallet = CoinController.normalizeAddress(swap.depositCoin, swap.depositWallet);
            if(depositHistory) {
                correspondingItem = depositHistory.find(item => (
                    item.to[wallet].decimal === swap.depositAmount
                    && !oldSwaps.find(s => s.depositTxHash === item.hash)
                ));
            }
            if(correspondingItem){
                swap.status = Swap.STATUS_DEPOSIT_SENT;
                swap.depositTxHash = correspondingItem.hash;
                return swap.save();
            }
        })
        .then(() => {
            if(correspondingItem)
                EventBus.emit(EventBus.EVENT_SWAP_DEPOSIT_INIT, swap);
        })
        .catch(error => {
            console.log(error);
        })
}

function watchToConfirmNewSwap() {
    let watchPromises = [];
    let swapList = [];
    // console.log('newSwapWatch ...');
    Swap.find({status: Swap.STATUS_DEPOSIT_SENT})
        .then(allNewSwap => {
            // console.log(`${allNewSwap.length} deposit to watch to confirm.`);
            for(let i=0 ; i<allNewSwap.length ; i++){
                let swap = allNewSwap[i];
                handleDepositConfirmation(swap);
            }
        })
}
function handleDepositConfirmation(swap){
    CoinController.watchTransactionStatus(swap.depositCoin, swap.depositTxHash)
        .then(result => {
            // console.log('watchDepositConfirmation:', JSON.stringify(result,null,2));
            if(result.status && result.status === 'confirmed'){
                swap.status = Swap.STATUS_DEPOSIT_CONFIRMED;
                return swap.save();
            }
        })
        .then(() => {
            if(swap.status === Swap.STATUS_DEPOSIT_CONFIRMED)
                EventBus.emit(EventBus.EVENT_SWAP_DEPOSIT_CONFIRMED, swap);
        })
        .catch(error => {
            console.log(error);
        })
}

function watchSwapWithdrawToConfirm() {
    let watchPromises = [];
    Swap.find({status: Swap.STATUS_WITHDRAW_SENT})
        .then(allNewSwap => {
            // console.log(`${allNewSwap.length} withdraw to watch to confirm.`);
            for(let i=0 ; i<allNewSwap.length ; i++){
                handleSwapWithdrawConfirmation(allNewSwap[i]);
            }
        })
}
function handleSwapWithdrawConfirmation(swap){
    let successfullyDone = false;
    CoinController.watchTransactionStatus(swap.receivingCoin, swap.receiveTxHash)
        .then(result => {
            if(result.status === 'confirmed'){
                successfullyDone = true;
                swap.status = Swap.STATUS_WITHDRAW_CONFIRMED;
                return swap.save();
            }
        })
        .then(() => {
            if(successfullyDone)
                EventBus.emit(EventBus.EVENT_SWAP_TRANSACTION_CONFIRMED, swap);
        })
        .catch(error => {
            console.log(error);
        })
}

function ethereumTokenAutoMint() {
    // let watchPromises = [];
    let swap = null;
    return Swap.findOne({
        status: Swap.STATUS_DEPOSIT_CONFIRMED,
        "receivingCoin.network": "ethereum",
        "receivingCoin.info.mintCalled": {$exists: false}
    })
        .then(_swap => {
            if(!_swap)
                throw {message: "No swap to mint"};
            swap = _swap;
            return Swap.updateOne({_id: swap._id},{$set:{
                    "receivingCoin.info.mintCalled": true
                }},{upsert: false})
        })
        .then(() => {
            return CoinController.networkModules.ethereum.mint(
                swap.receivingCoin.info.contractAddress,
                swap.recipientWallet,
                swap.receivingAmount
            )
        })
        .then(txHash => {
            if(!txHash){
                throw {message: 'mint failed'}
            }
            console.log(`Ethereum [${swap.receivingCoin.code}] mint tx_hash: [${txHash}]`);
            swap.status = Swap.STATUS_WITHDRAW_SENT;
            swap.receiveTxHash = txHash;
            return swap.save();
        })
        .then(() => {
            console.log('Swap mint complete successfully');
        })
        .catch(error => {
            console.log(error.message || 'error in mint');
            if(error.message !== "No swap to mint"){
                console.error(error);
            }
        })
}
