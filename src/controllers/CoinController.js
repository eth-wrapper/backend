let networkModulesList = require('../networkModules').allModules;

function getCoinModule(coin){
    if(!networkModulesList[coin.network])
        throw {message: `Coin network module [${coin.network}] not defined`};
    return networkModulesList[coin.network];
}

module.exports.normalizeAddress = function (coin, addr) {
    let networkModule = getCoinModule(coin);
    return networkModule.normalizeAddress(addr);
}

module.exports.validateWallet = function (coin, wallet) {
    if(!wallet || wallet.length < 1)
        return false;
    let networkModule = getCoinModule(coin);
    return networkModule.validateWallet(wallet);
}

module.exports.watchDeposit = function (coin, wallet) {
    let networkModule = getCoinModule(coin);
    return networkModule.watchDeposit(coin, wallet);
}

module.exports.sendCoinToWallet = function(coin, from, to, amount){
    let networkModule = getCoinModule(coin);
    return networkModule.sendCoin(coin, from, to, amount);
}

module.exports.watchTransactionStatus = function (coin, txHash) {
    let networkModule = getCoinModule(coin);
    return networkModule.watchTransactionStatus(txHash);
}

module.exports.getTransaction = function (coin, txHash) {
    let networkModule = getCoinModule(coin);
    return networkModule.getTransaction(txHash);
}