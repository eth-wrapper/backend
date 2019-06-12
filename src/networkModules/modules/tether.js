
module.exports.normalizeAddress = normalizeAddress;

function normalizeAddress(addr) {
    return addr;
}

module.exports.watchDeposit = function (coin, wallet) {
    return Promise.resolve([]);
}

module.exports.watchTransactionStatus = function (txHash) {
    return Promise.resolve(false);
}

module.exports.sendCoin = function (coin, from, to, amount) {
    return Promise.resolve(true);
}

module.exports.getTransaction = function (txHash) {
    return Promise.resolve(null);
}