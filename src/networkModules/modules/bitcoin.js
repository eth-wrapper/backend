/**
 * API method list:
 *  https://www.blockchain.com/api/blockchain_api
 */

const fetch = require('node-fetch');
const bip39 = require('bip39');
const hdkey = require('hdkey');
const wif = require('wif');
const bitcore = require('bitcore-lib');
const Wallet = require('../../database/mongooseModels/Wallet');
const Swap = require('../../database/mongooseModels/Swap');
const bitcoinaddress = require('bitcoin-address');

module.exports.watchDeposit = watchDeposit;
module.exports.watchTransactionStatus = watchTransactionStatus;
module.exports.sendCoin = sendCoin;
module.exports.getTransaction = getTransaction;
module.exports.validateWallet = validateWallet;
module.exports.normalizeAddress = normalizeAddress;
module.exports.unspentTransactions = unspentTransactions;
module.exports.withdrawTo = withdrawTo;
module.exports.onWithdrawCronJob = onWithdrawCronJob;
module.exports.WITHDRAW_CRON_JOB_TIMES = "5,20,35,50 * * * * *";

function onWithdrawCronJob() {
    let swaps = [];
    let walletsWithBalance = [];
    // find all bitcoin pending withdraw
    return Swap.find({
        status: Swap.STATUS_DEPOSIT_CONFIRMED,
        "receivingCoin.network": "bitcoin",
        "receivingCoin.code": "BTC",
        "receivingCoin.info.withdrawCalled": {$exists: false}
    })
    // update selected to prevent from re-select
        .then(result => {
            swaps = result;
            if (swaps.length <= 0)
                throw {message: "No swap to withdraw"};
            return Swap.updateMany({_id: {$in: swaps.map(s => s._id)}}, {
                $set: {
                    // "receivingCoin.info.withdrawCalled": true
                }
            }, {upsert: false})
        })
        .then(() => getUsersThatDepositBTC())
        .then(userList => {
            return Wallet.find({
                type: 'bitcoin',
                assigned: true,
                $or: [
                    {user: {$in: userList}},
                    {address: process.env.BITCOIN_CHANGE_WALLET}
                ]
            })
        })
        .then(wallets => {
            walletsWithBalance = wallets;
            return Promise.all(wallets.map(w => unspentTransactions(w.address)))
        })
        .then(allWalletTxs => {
            // console.log('txs', JSON.stringify(txs, null, 2));
            let satoshi = 0, decimal = 0;
            for (let i = 0; i < allWalletTxs.length; i++) {
                let currentWalletTxs = allWalletTxs[i];
                satoshi = 0;
                decimal = 0;
                currentWalletTxs.map(tx => {
                    satoshi += tx.value.satoshi;
                    decimal += tx.value.decimal;
                });
                walletsWithBalance[i].balance = {
                    satoshi,
                    decimal,
                    unspentTsx: currentWalletTxs
                }
            }
        })
        .then(() => {
            let totalBTC = 0;
            swaps.map(swap => {
                totalBTC += swap.receivingAmount;
            });

            let utxos = [];
            let sum = 0;
            let selectedWallets = [];
            for (let i=0 ; i<walletsWithBalance.length ; i++) {
                let currentWallet = walletsWithBalance[i];
                selectedWallets.push(currentWallet);
                for(let j=0 ; j<currentWallet.balance.unspentTsx.length ; j++){
                    let tx = currentWallet.balance.unspentTsx[j];
                    sum += tx.value.decimal;
                    utxos.push({
                        "txId": tx.txId,
                        "outputIndex": tx.outputIndex,
                        "address": currentWallet.address,
                        "script": tx.script,
                        "satoshis": tx.value.satoshi
                    });
                    if(sum > totalBTC+0.0001)
                        break;
                }
                if(sum > totalBTC+0.0001)
                    break;
            }
            let outputs = {};
            swaps.map(s => {
                if(!outputs[s.recipientWallet])
                    outputs[s.recipientWallet] = bitcore.Unit.fromBTC(s.receivingAmount).toSatoshis();
                else
                    outputs[s.recipientWallet] += bitcore.Unit.fromBTC(s.receivingAmount).toSatoshis();
            });
            console.log('outputs:',JSON.stringify(outputs, null, 2));
            console.log('utxos:',JSON.stringify(utxos, null, 2));
            console.log('sum of unspent:',bitcore.Unit.fromBTC(sum).toSatoshis());
            console.log('total amount to receive:',bitcore.Unit.fromBTC(totalBTC).toSatoshis());
            if(sum < totalBTC + 0.0001)
                throw {message: 'No enough BTC to withdraw'};
            // throw {message: "test"}


            let unit = bitcore.Unit;
            let minerFee = unit.fromMilis(0.128).toSatoshis(); //cost of transaction in satoshis (minerfee)
            let privateKeys = selectedWallets
                .map(w => getWalletPrivateKey(w))
                .map(privateKeyWif => {
                    return bitcore.PrivateKey.fromWIF(privateKeyWif, process.env.TEST_MODE ? bitcore.Networks.testnet : undefined)
                });

            let newTx = new bitcore.Transaction()
                .from(utxos)
                .to(Object.keys(outputs).map(address => ({
                    address,
                    satoshis: outputs[address]
                })))
                .fee(minerFee)
                .change(process.env.BITCOIN_CHANGE_WALLET)
                .sign(privateKeys);

            // handle serialization errors
            if (newTx.getSerializationError()) {
                let error = newTx.getSerializationError().message;
                switch (error) {
                    case 'Some inputs have not been fully signed':
                        throw('Please check your private key');
                    default:
                        throw(error);
                }
            }
            return newTx.toString();
        })
        .then(rawTransaction => {
            console.log(rawTransaction);
            return broadcastRawTransaction(rawTransaction);
        })
        .then(txHash => {
            if (!txHash) {
                throw {message: 'mint failed'}
            }
            console.log(`Bitcoin [BTC] withdraw tx_hash: [${txHash}]`);
            return Swap.updateMany({
                _id: {$in: swaps.map(s => s._id)}
            },{
                $set:{
                    status: Swap.STATUS_WITHDRAW_SENT,
                    receiveTxHash: txHash
                }
            },{
                upsert: false
            });
        })
        .then(() => {
            console.log('Swap mint complete successfully');
        })
        .catch(error => {
            console.log(error.message || 'error in mint');
            if (error.message !== "No swap to mint") {
                console.error(error);
            }
        })
}

function getUsersThatDepositBTC() {
    return new Promise(function (resolve, reject) {
        let aggregation = [
            {
                $match: {
                    status: {
                        $in: [
                            Swap.STATUS_DEPOSIT_CONFIRMED,
                            Swap.STATUS_WITHDRAW_SENT,
                            Swap.STATUS_WITHDRAW_CONFIRMED,
                            Swap.STATUS_DONE,
                        ]
                    },
                    "depositCoin.network": "bitcoin",
                    "depositCoin.code": "BTC",
                },
            },
            {$group: {_id: '$user'}}
        ];
        Swap.aggregate(aggregation, function (error, result) {
            if (error)
                return reject(error);
            resolve(result.map(item => item._id));
        })
    })
}

function normalizeAddress(addr) {
    return addr;
}

function validateWallet(address) {
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
            if (process.env.TEST_MODE && !txBlockHeight) {
                console.log(`TEST_MODE tx.block_height not defined`);
                txBlockHeight = 0;
            }
            if (txBlockHeight + 6 < latestBlock.height)
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

function normalizeTransaction(tx) {
    if (!tx)
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
        from: tx.inputs.reduce(inputsReducer, {}),
        to: tx.out.reduce(outReducer, {})
    }
    return result;
}

function unspentTransactions(address) {
    return fetch(`https://${process.env.TEST_MODE ? 'testnet.' : ''}blockchain.info/unspent?active=${address}`)
        .then(res => res.json())
        .then(response => {
            return response.unspent_outputs.map(tx => ({
                txId: tx.tx_hash_big_endian,
                outputIndex: tx.tx_output_n,
                //address: address,
                script: tx.script,
                value: {
                    satoshi: tx.value,
                    decimal: bitcore.Unit.fromSatoshis(tx.value).toBTC()
                }
            }))
        })
        // return empty list when error.
        .catch(error => [])
}

function getUnspentWallets(amount) {
    return Wallet.find({"balance.BTC.decimal": {$gt: 0}})
        .then(wallets => {
            let sum = 0;
            let list = [];
            for (let i = 0; i < wallets.length; i++) {
                sum += wallets[i].balance.BTC.decimal;
                list.push(wallets[i])
                if (sum > amount + 0.001) {
                    console.log('unspent amount: ' + sum);
                    return list
                }
            }
            throw {message: "Not enough BTC in admin wallet in order to withdraw."};
        })
}

function getWalletPrivateKey(wallet) {
    const seed = bip39.mnemonicToSeedSync(process.env.MASTER_WALLET_MNEMONIC); //creates seed buffer
    const root = hdkey.fromMasterSeed(seed);
    const addrnode = root.derive(wallet.info.treePath);
    return wif.encode(128, addrnode._privateKey, true);
}

function withdrawTo(coin, address, amount) {
    let unspentWallets = [];
    return getUnspentWallets(amount)
        .then(wallets => {
            unspentWallets = wallets;
            let utxos = [];
            wallets.map(wallet => {
                wallet.balance.BTC.unspentTxs.map(tx => {
                    utxos.push({
                        "txId": tx.txId,
                        "outputIndex": tx.outputIndex,
                        "address": wallet.address,
                        "script": tx.script,
                        "satoshis": tx.value.satoshi
                    });
                })
            })

            let unit = bitcore.Unit;
            let minerFee = unit.fromMilis(0.128).toSatoshis(); //cost of transaction in satoshis (minerfee)
            let transactionAmount = unit.fromBTC(amount).toSatoshis(); //convert mBTC to Satoshis using bitcore unit
            let privateKeys = wallets
                .map(w => getWalletPrivateKey(w))
                .map(privateKeyWif => {
                    return bitcore.PrivateKey.fromWIF(privateKeyWif, process.env.TEST_MODE ? bitcore.Networks.testnet : undefined)
                });

            let newTx = new bitcore.Transaction()
                .from(utxos)
                .to(address, transactionAmount)
                .fee(minerFee)
                .change(process.env.BITCOIN_CHANGE_WALLET)
                .sign(privateKeys);

            // handle serialization errors
            if (newTx.getSerializationError()) {
                let error = newTx.getSerializationError().message;
                switch (error) {
                    case 'Some inputs have not been fully signed':
                        throw('Please check your private key');
                    default:
                        throw(error);
                }
            }
            return newTx.toString();
        })
        .then(rawTransaction => {
            console.log(rawTransaction);
            return broadcastRawTransaction(rawTransaction);
        })
}

// see https://www.blockcypher.com/dev/bitcoin/#restful-resources
function broadcastRawTransaction(rawTx) {
    let apiVersion = 'v1';
    let coin = 'btc';
    let chain = process.env.TEST_MODE ? "test3" : "main";
    console.log('broadcasting bitcoin raw tx ...');
    return fetch(`https://api.blockcypher.com/${apiVersion}/${coin}/${chain}/txs/push`, {
        method: 'POST',
        body: JSON.stringify({tx: rawTx}),
        headers: {'Content-Type': 'application/json'}
    })
        .then(res => res.json())
        .then(response => {
            console.log('withdraw response:', response);
            return (response.tx && response.tx.hash) ? response.tx.hash : null;
        })
}
