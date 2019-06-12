const User = require('../database/mongooseModels/User');
const Trade = require('../database/mongooseModels/Trade');
const TradeMessage = require('../database/mongooseModels/TradeMessage');
const Transaction = require('../database/mongooseModels/Transaction');
const blockchain = require('../blockchain');
const web3 = require('../../scripts/web3-object');
const EventBus = require('../eventBus');
const i18n = require('i18n');

function checkUsernameAvailable(username) {
    if (username.length < 6) {
        return Promise.reject({message: i18n.__('api.user.usernameAtLEast6')});
    }
    return User.findOne({username: new RegExp(`^${username}$`, "i")})
        .then(user => {
            if (user)
                throw {message: i18n.__('api.user.usernameTaken')}
        })
}

function checkEmailAvailable(email) {
    return User.findOne({email: new RegExp(`^${email}$`, "i")})
        .then(user => {
            if (user)
                throw {message: i18n.__('api.user.emailTaken')}
        })
}

module.exports.getInfo =  function (req, res, next) {
    let response = {
        success: true,
        user: req.data.user
    };
    res.json(response);
};

module.exports.checkUsername = function (req, res, next) {
    let username = req.body.username;
    checkUsernameAvailable(username)
        .then(() => {
            res.send({
                success: true,
                message: i18n.__('api.user.usernameAvailable')
            })
        })
        .catch(error => {
            res.send({
                success: false,
                message: error.message || i18n.__('sse'),
                error: error
            })
        })
}

module.exports.updateUsername = function (req, res, next) {
    let username = req.body.username;
    checkUsernameAvailable(username)
        .then(() => {
            let user = req.data.user;
            user.username = username;
            return user.save();
        })
        .then(() => {
            res.send({
                success: true,
                message: i18n.__('api.user.usernameUpdateSuccess')
            })
        })
        .catch(error => {
            res.send({
                success: false,
                message: error.message || i18n.__('sse'),
                error: error
            })
        })
}

module.exports.checkEmail = function (req, res, next) {
    let email = req.body.email;
    checkEmailAvailable(email)
        .then(() => {
            res.send({
                success: true,
                message: i18n.__('api.user.emailNotTaken')
            })
        })
        .catch(error => {
            res.send({
                success: false,
                message: error.message || i18n.__('sse'),
                error: error
            })
        })
}

module.exports.updateEmail = function (req, res, next) {
    let email = req.body.email;
    checkEmailAvailable(email)
        .then(() => {
            let user = req.data.user;
            user.email = email;
            return user.save();
        })
        .then(() => {
            res.send({
                success: true,
                message: i18n.__('api.user.emailUpdateSuccess')
            })
        })
        .catch(error => {
            res.send({
                success: false,
                message: error.message || i18n.__('sse'),
                error: error
            })
        })
}

module.exports.update = function (req, res, next) {
    let user = req.data.user;
    let update = {};
    if (req.body.firstName !== undefined && typeof req.body.firstName === 'string')
        update.firstName = req.body.firstName;
    if (req.body.lastName !== undefined && typeof req.body.lastName === 'string')
        update.lastName = req.body.lastName;
    if (req.body.about !== undefined && typeof req.body.about === 'string')
        update.about = req.body.about;
    if (req.body.country !== undefined && typeof req.body.country === 'string')
        update.country = req.body.country;
    if (req.body.mobile !== undefined && typeof req.body.mobile === 'string') {
        update.mobile = req.body.mobile;
        update.mobileConfirmed = false;
    }
    Object.keys(update).map(key => {
        user[key] = update[key]
    });
    user.save();
    res.send({
        success: true,
        message: i18n.__('api.user.dataUpdateSuccess'),
        updatedFields: update
    })
    // let user = req.data.user;
    // return user.save();
}

module.exports.transactions = function (req, res, next) {
    let currentUser = req.data.user;
    res.send({
        success: true,
        transactions: []
    })
}

module.exports.unreadMessages = function (req, res, next) {
    let currentUser = req.data.user;
    res.send({
        success: true,
        unreadMessages:{}
    })

}

module.exports.readTradeMessages = function (req, res, next) {
    return res.send({
        success: true
    });
}