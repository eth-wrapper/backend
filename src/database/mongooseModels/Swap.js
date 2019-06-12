const mongoose = require('mongoose');
const EventBus = require('../../eventBus');

const STATUS_NEW = 'new';
const STATUS_DEPOSIT_SENT = 'deposit-sent';
const STATUS_DEPOSIT_CONFIRMED = 'deposit-confirmed';
const STATUS_WITHDRAW_SENT = 'withdraw-sent';
const STATUS_WITHDRAW_CONFIRMED = 'withdraw-confirmed';
const STATUS_DONE = 'done';
const STATUS_CANCEL = 'cancel';
const STATUS_FAIL = 'fail';

let modelSchema = mongoose.Schema({
    // the user that request the swap.
    user: {
        type: mongoose.Schema.Types.ObjectId, ref: 'user',
        required: [true, 'User required for creating swap.']
    },
    // The coin, user send to us
    depositCoin:{
        type: Object,
        required: true
    },
    // amount of coin, that user send to us.
    depositAmount: {
        type: Number,
        required: true
    },
    // Our wallet, that receive user sent tokens.
    depositWallet: {
        type: String,
        required: true
    },
    // Recipient coin, that we send to user.
    receivingCoin:{
        type: Object,
        required: true
    },
    // Amount of recipient token, that we sent to user wallet
    receivingAmount: {
        type: Number,
        required: true
    },
    // User wallet, that we send swapped tokens to
    recipientWallet: {
        type: String,
        required: true
    },
    depositTxHash:{
        type: String,
        unique: true,
        sparse: true
    },
    receiveTxHash:{
        type: String,
        unique: true,
        sparse: true
    },
    // Current swap status
    status: {
        type: String,
        enum: [
            STATUS_NEW,
            STATUS_DEPOSIT_SENT,
            STATUS_DEPOSIT_CONFIRMED,
            STATUS_WITHDRAW_SENT,
            STATUS_WITHDRAW_CONFIRMED,
            STATUS_DONE,
            STATUS_CANCEL,
            STATUS_FAIL
        ],
        required: [true, 'Swap status required.']
    }
}, {timestamps: true});

modelSchema.post('save', function (doc) {
    EventBus.emit(EventBus.EVENT_SWAP_POST_SAVE, doc);
});

let Model = module.exports = mongoose.model('swap', modelSchema);

module.exports.STATUS_NEW = STATUS_NEW;
module.exports.STATUS_DEPOSIT_SENT = STATUS_DEPOSIT_SENT;
module.exports.STATUS_DEPOSIT_CONFIRMED = STATUS_DEPOSIT_CONFIRMED;
module.exports.STATUS_WITHDRAW_SENT = STATUS_WITHDRAW_SENT;
module.exports.STATUS_WITHDRAW_CONFIRMED = STATUS_WITHDRAW_CONFIRMED;
module.exports.STATUS_DONE = STATUS_DONE;
module.exports.STATUS_CANCEL = STATUS_CANCEL;
module.exports.STATUS_FAIL = STATUS_FAIL;