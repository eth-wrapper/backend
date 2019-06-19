/**
 * API Document : https://api.omniexplorer.info
 */

const fetch = require('node-fetch');
const bitcoin = require('./bitcoin');

module.exports.normalizeAddress = normalizeAddress;
module.exports.watchDeposit = watchDeposit;
module.exports.watchTransactionStatus = watchTransactionStatus;
module.exports.sendCoin = sendCoin;
module.exports.validateWallet = validateWallet;
module.exports.getTransaction = getTransaction;
module.exports.withdrawTo = withdrawTo;
module.exports.onWithdrawCronJob = onWithdrawCronJob;
module.exports.WITHDRAW_CRON_JOB_TIMES = "0 0 0 0 0 0"; // never

function onWithdrawCronJob() {
    return Promise.reject(false);
}

function normalizeAddress(addr) {
    return addr;
}

function validateWallet(address){
    return bitcoin.validateWallet(address);
}

function watchDeposit(coin, wallet) {
    return post(`v1/transaction/address`, {page:0, addr:wallet})
        .then(result => {
            return result.transactions
                .filter(tx => tx.propertyname === "TetherUS")
                .map(normalizeTransaction)
        })
}

function watchTransactionStatus(txHash) {
    return getTransaction(txHash)
        .then(result => {
            return result;
        })
}

function sendCoin(coin, from, to, amount) {
    return Promise.resolve(true);
}

function getTransaction(txHash) {
    return get(`v1/transaction/tx/${txHash}`)
        .then(result => {
            return result;
        })
}

function normalizeTransaction(tx) {
    return {
        network: 'tether',
        hash: tx.txid,
        block: tx.blockhash,
        coin: 'USDT',
        status: tx.confirmations >= 6 ? "confirmed" : undefined,
        from: {
            [normalizeAddress(tx.sendingaddress)]: {decimal: tx.amount}
        },
        to:{
            [normalizeAddress(tx.referenceaddress)]: {decimal: tx.amount}
        },
        //originalTx: tx
    };
}

function withdrawTo(coin, address, amount) {
    return Promise.reject({message: "not implemented"});
}

/**
 * Network contact methods
 */

function request(method, uri, data){
    if(!data)
        data = {};
    let uriEncodedData = Object.keys(data)
        .map(key => {
            return encodeURIComponent(key) + "=" + encodeURIComponent(data[key]);
        })
        .join("&");
    let options = {
        method,
        headers: {
            "Cache-Control": "no-cache",
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": (method === 'GET' ? 0 : uriEncodedData.length)
        },
        body: (method === 'GET' ? undefined : uriEncodedData)
    };

    return fetch(`https://api.omniexplorer.info/${uri}` + (method==='GET'?`?${uriEncodedData}`:""), options)
        .then(res => res.json())
}
function get(uri, data){
    return request('GET', uri, data);
}
function post(uri, data){
    return request('POST', uri, data);
}