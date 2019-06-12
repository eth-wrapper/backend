const Trade = require('../database/mongooseModels/Trade');
const TradeMessage = require('../database/mongooseModels/TradeMessage');
const Swap = require('../database/mongooseModels/Swap');
const CoinController = require('./CoinController');

module.exports.unreadMessages = function (req, res, next) {
    let currentUser = req.data.user;
    Trade.find({disputeOperator: currentUser._id})
        .then(trades => trades.map(t => t._id))
        .then(tradesID => TradeMessage.find({
            sender: {$ne: currentUser._id},
            [`seen.${currentUser._id}`]: null,
            trade: {$in: tradesID}
        }))
        .then(unseenMessages => {
            let unreadMessages = {};
            unseenMessages.map(msg => {
                if (unreadMessages[msg.trade] === undefined)
                    unreadMessages[msg.trade] = [];
                unreadMessages[msg.trade].push(msg._id);
            });
            res.send({
                success: true,
                unreadMessages
            })
        })
        .catch(error => {
            res.status(500).send({
                success: false,
                message: error.message || "",
                error
            })
        })
}
module.exports.getSwapList = function (req, res, next) {
    let filters = {
        // status: {$ne: 'new'}
    }
    Swap.find(filters)
        .sort({createdAt: -1})
        .then(swapList => {
            res.send({
                success: true,
                swapList
            })
        })
        .catch(error => {
            res.status(500).send({
                success: false,
                message: error.message || "",
                error
            })
        })
}
module.exports.setSwapWithdraw = function (req, res, next) {
    let {swap, txHash} = req.body;
    let tx = null;
    let coin = swap.receivingCoin;
    let wallet = CoinController.normalizeAddress(coin, swap.recipientWallet);
    CoinController.getTransaction(swap.receivingCoin, txHash)
        .then(_tx => {
            tx = _tx;
            if(!tx)
                throw {message: 'Transaction not found'};
            if(tx.to[wallet] === undefined) {
                throw {message: "Transaction target address not matched with swap"};
            }
            if(swap.receivingAmount != tx.to[wallet].decimal)
                throw {message: "Transaction amount not matched with swap receiving amount"};

            if(coin.code !== tx.coin && coin.contractAddress && CoinController.normalizeAddress(coin, coin.contractAddress) !== tx.coin){
                console.log(`comparing [${CoinController.normalizeAddress(coin, coin.contractAddress) }] with [${tx.coin}]`);
                throw {message: "Transaction coin not matched with swap receiving coin"};
            }

            swap.status = Swap.STATUS_WITHDRAW_SENT;
            swap.receiveTxHash = txHash;

            return swap.save();
        })
        .then(() => {
            res.send({
                success: true,
                body: req.body,
                swap,
                transaction: tx
            });
        })
        .catch(error => {
            res.send({
                success: false,
                message: error.message || "Server side error",
                body: req.body
            });
        })
}