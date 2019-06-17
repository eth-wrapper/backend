const Trade = require('../database/mongooseModels/Trade');
const Coin = require('../database/mongooseModels/Coin');
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
    let {page=0, limit=5} = req.body;
    let totalCount = 0
    let filters = {
        // status: {$ne: 'new'}
    };
    Swap.countDocuments(filters)
        .then(n => {
            totalCount = n;
            return Swap.find(filters)
                .sort({createdAt: -1})
                .skip(page * limit)
                .limit(limit);
        })
        .then(swapList => {
            res.send({
                success: true,
                swapList,
                totalCount,
                page,
                limit
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

    swap.status = Swap.STATUS_WITHDRAW_SENT;
    swap.receiveTxHash = txHash;
    swap.save()
        .then(() => {
            res.send({
                success: true,
                body: req.body,
                swap
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