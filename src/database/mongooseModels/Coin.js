const mongoose = require('mongoose');
const Wallet = require('./Wallet');

let modelSchema = mongoose.Schema({
    // The coin, user send to us
    network:{
        type: String,
        required: true
    },
    // amount of coin, that user send to us.
    walletType: {
        type: String,
        enum: Wallet.typeList,
        required: true
    },
    // Our wallet, that receive user sent tokens.
    code: {
        type: String,
        required: true
    },
    // Our wallet, that receive user sent tokens.
    exchange: {
        type: String,
        required: true
    },
    // Recipient coin, that we send to user.
    title:{
        type: String,
        required: true
    },
    info:{
        type: Object,
        default: {
            /**
             * Other info that is not common for all tokens
             */
        }
    }

}, {timestamps: true});

let Model = module.exports = mongoose.model('coin', modelSchema);