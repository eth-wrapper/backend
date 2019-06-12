const mongoose = require('mongoose');

const TYPE_BITCOIN = 'bitcoin';
const TYPE_ETHEREUM = 'ethereum';

const typeList = [TYPE_BITCOIN, TYPE_ETHEREUM];

let modelSchema = mongoose.Schema({
    type:{
        type: String,
        enum: typeList,
        required: [true, "Wallet network type required"]
    },
    assigned: {
        type: Boolean,
        default: false
    },
    user: {
        type: mongoose.Schema.Types.ObjectId, ref: 'user'
    },
    address: {
        type: String,
        unique: true,
        required: [true, "Wallet publicKey required"]
    },
    privateKey: {
        type: String,
        unique: true,
        sparse: true
    },
    customData:{
        type: Object,
        default: {}
    }
}, {timestamps: false});

modelSchema.index(
    { type: 1, user: 1},
    {unique: true, partialFilterExpression: {user: {$exists: true}}}
);

const Model = module.exports = mongoose.model('wallet', modelSchema);

module.exports.TYPE_BITCOIN = TYPE_BITCOIN;
module.exports.TYPE_ETHEREUM = TYPE_ETHEREUM;

module.exports.typeList = typeList;