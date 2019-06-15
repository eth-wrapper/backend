/**
 * API method list:
 *  https://www.blockchain.com/api/blockchain_api
 */

const fetch = require('node-fetch');
const bitcoinaddress = require('bitcoin-address');

module.exports.watchDeposit = watchDeposit;
module.exports.watchTransactionStatus = watchTransactionStatus;
module.exports.sendCoin = sendCoin;
module.exports.getTransaction = getTransaction;
module.exports.validateWallet = validateWallet;
module.exports.normalizeAddress = normalizeAddress;

function normalizeAddress(addr) {
    return addr;
}

function validateWallet(address){
    return bitcoinaddress.validate(address, process.env.TEST_MODE ? 'testnet' : undefined);
}

function watchDeposit(coin, wallet) {
    let transactions = [];
    // https://testnet.blockchain.info/rawaddr/mmAncbKrM2trJykFg1TuJ1oG4XiSM441Qv
    return fetch(`https://${process.env.TEST_MODE ? 'testnet.' : ''}blockchain.info/rawaddr/${wallet}`)
        .then(res => res.json())
        .then(result => {
            transactions = result.txs.map(normalizeTransaction);
            return {transactions}
            console.log('bitcoin watch: ', JSON.stringify(transactions, null, 2));
        })
}

function watchTransactionStatus(txHash) {
    let tx = null;
    return getTransaction(txHash)
        .then(normalizedTx => {
            tx = normalizedTx;
            return fetch(`https://${process.env.TEST_MODE ? 'testnet.' : ''}blockchain.info/latestblock`)
        })
        .then(res => res.json())
        .then(latestBlock => {
            // console.log('Bitcoin latest block:', latestBlock);
            let txBlockHeight = tx.block;
            if(process.env.TEST_MODE && !txBlockHeight)
            {
                console.log(`TEST_MODE tx.block_height not defined`);
                txBlockHeight = 0;
            }
            if(txBlockHeight + 6 < latestBlock.height)
                tx.status = 'confirmed';
            return tx;
        })
}

function sendCoin(coin, from, to, amount) {
    return Promise.resolve(true);
}

function getTransaction(txHash) {
    return fetch(`https://${process.env.TEST_MODE ? 'testnet.' : ''}blockchain.info/rawtx/${txHash}`)
        .then(res => res.json())
        .then(normalizeTransaction)
}

function normalizeTransaction(tx){
    if(!tx)
        return tx;
    let inputsReducer = (result, inputItem) => {
        result[normalizeAddress(inputItem.prev_out.addr)] = {
            satushi: inputItem.prev_out.value,
            decimal: inputItem.prev_out.value / 100000000
        };
        return result;
    }
    let outReducer = (result, outItem) => {
        result[normalizeAddress(outItem.addr)] = {
            spent: outItem.spent,
            satushi: outItem.value,
            decimal: outItem.value / 100000000
        };
        return result;
    }
    let result = {
        network: 'bitcoin',
        hash: tx.hash,
        block: tx.block_height,
        coin: 'BTC',
        status: "",
        from: tx.inputs.reduce(inputsReducer,{}),
        to: tx.out.reduce(outReducer, {})
    }
    return result;
}