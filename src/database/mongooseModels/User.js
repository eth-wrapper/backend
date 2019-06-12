const mongoose = require('mongoose');
const jsonwebtoken = require('jsonwebtoken');
const Transaction = require('./Transaction');
const moment = require('moment');

const PERMISSION_ADMIN = 'admin';
const PERMISSION_OPERATOR = 'operator';

let userSchema = mongoose.Schema({
    username: {type: String, default: "", trim: true, unique: true},
    firstName: {type: String, default: "", trim: true},
    lastName: {type: String, default: "", trim: true},
    avatar: {type: String, default: ''},
    brightIdPublicKey: {type: String, select: false},
    brightIdScore: {type: Number, default: 0},
    email: {type: String, default: "", trim: true, select: false},
    emailConfirmed: {type: mongoose.Schema.Types.Boolean, default: false, trim: true},
    mobile: {type: String, default: "", trim: true, select: false},
    mobileConfirmed: {type: mongoose.Schema.Types.Boolean, default: false, trim: true},
    /**
     * for each network most define new wallet hear.
     * field name most start with network name ("bitcoin" fro example) with the word "Wallet" appended to the end.
     */
    bitcoinWallet: {type: String, unique: true, sparse: true},
    ethereumWallet: {type: String, unique: true, sparse: true},

    lastSeen: {type: Date, default: null},
    permissions: {
        type: [{
            type: String,
            enum: [PERMISSION_ADMIN, PERMISSION_OPERATOR],
            required: [true, 'Trade type required']
        }],
        default: []
    }
}, {
    timestamps: true,
    toObject: {
        virtuals: true
    },
    toJSON: {
        virtuals: true
    }
});

userSchema.methods.createSessionToken = function () {
    const sessionToken = jsonwebtoken.sign(
        {
            id: this._id,
            timestamp: Date.now(),
        },
        process.env.JWT_AUTH_SECRET
    );
    return sessionToken;
};

userSchema.methods.hasPermissions = function (checkList) {
    for (let i = 0; i < checkList.length; i++) {
        if (this.permissions.indexOf(checkList[i]) < 0)
            return false;
    }
    return true;
}

userSchema.virtual('lastSeenInfo').get(function () {
    let lastSeen = {
        time: this.lastSeen,
        minutes: moment.duration(moment().diff(this.lastSeen)).asMinutes(),
        title: moment(this.lastSeen).fromNow()
    };
    return lastSeen;
});

userSchema.virtual('joinedInfo').get(function () {
    let joined = {
        time: this.createdAt,
        minutes: moment.duration(moment().diff(this.createdAt)).asMinutes(),
        title: moment(this.createdAt).fromNow()
    };
    return joined;
});

userSchema.pre('find', function () {
});

module.exports = mongoose.model('user', userSchema);

module.exports.PERMISSION_ADMIN = PERMISSION_ADMIN;
module.exports.PERMISSION_OPERATOR = PERMISSION_OPERATOR;