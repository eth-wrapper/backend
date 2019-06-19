const provider = `https://${(!!process.env.TEST_MODE ? 'ropsten' : 'mainnet')}.infura.io/YSclbc3zNqU2a9Qeozmb`;
const wssProvider = `wss://${(!!process.env.TEST_MODE ? 'ropsten' : 'mainnet')}.infura.io/ws`;
const erc20ABI = require("../ERC20.json").abi;
const wrapTokenABI = require("../WRAP-token.json").abi;
const Tx = require('ethereumjs-tx');
const Web3 = require('web3');
const Swap = require('../../database/mongooseModels/Swap');
var web3 = new Web3(new Web3.providers.WebsocketProvider(wssProvider));

const fromBlock = 0;

const ERC20_INPUT_LENGTH = 10 + 64 + 64;
const ERC20_METHOD_TRANSFER = '0xa9059cbb';


module.exports.validateWallet = validateWallet;
module.exports.normalizeAddress = normalizeAddress;
module.exports.withdrawTo = withdrawTo;
module.exports.onWithdrawCronJob = onWithdrawCronJob;
module.exports.WITHDRAW_CRON_JOB_TIMES = "0 * * * * *"; // every minute

function onWithdrawCronJob() {
    let swap = null;
    return Swap.findOne({
        status: Swap.STATUS_DEPOSIT_CONFIRMED,
        "receivingCoin.network": "ethereum",
        "receivingCoin.info.withdrawCalled": {$exists: false}
    })
        .then(_swap => {
            if(!_swap)
                throw {message: "No swap to withdraw"};
            swap = _swap;
            return Swap.updateOne({_id: swap._id},{$set:{
                    "receivingCoin.info.withdrawCalled": true
                }},{upsert: false})
        })
        .then(() => {
            return withdrawTo(
                swap.receivingCoin,
                swap.recipientWallet,
                swap.receivingAmount
            )
        })
        .then(txHash => {
            if(!txHash){
                throw {message: 'mint failed'}
            }
            console.log(`Ethereum [${swap.receivingCoin.code}] mint tx_hash: [${txHash}]`);
            swap.status = Swap.STATUS_WITHDRAW_SENT;
            swap.receiveTxHash = txHash;
            return swap.save();
        })
        .then(() => {
            console.log('Swap mint complete successfully');
        })
        .catch(error => {
            console.log(error.message || 'error in mint');
            if(error.message !== "No swap to mint"){
                console.error(error);
            }
        })
}

function normalizeAddress(addr) {
    return addr.toLowerCase();
}

function validateWallet(address){
    return web3.utils.isAddress(address);
}

module.exports.watchDeposit = function (coin, wallet) {
    let lastBlock = 0;
    return new Promise(function (resolve, reject) {
        web3.eth.getBlockNumber()
            .then(value => {
                lastBlock = value;
                console.log('ethereum last block: ', lastBlock);
                let contract = new web3.eth.Contract(erc20ABI, coin.contractAddress);
                return contract.getPastEvents("Transfer", {
                    fromBlock: fromBlock,
                    toBlock: lastBlock,
                    filter: {
                        isError: 0,
                        txreceipt_status: 1,
                        to: wallet
                    },
                })
            })
            .then(_events => {
                let events = _events.map(normalizeTokenTransferEvent);
                return {
                    lastBlock: lastBlock,
                    transactions: events
                };
            })
            .then(resolve)
            .catch(reject)
    })
}

function normalizeTokenTransferEvent(e) {
    let {address, blockNumber, transactionHash, returnValues: {from, to, value}} = e;
    let result = {
        network: 'ethereum',
        hash: transactionHash,
        block: blockNumber,
        coin: normalizeAddress(address),
        from: {
            [normalizeAddress(from)]: {
                hex: value._hex,
                wei: web3.utils.toBN(value._hex).toString(),
                decimal: web3.utils.fromWei(value._hex, 'ether')
            }
        },
        to: {
            [normalizeAddress(to)]: {
                hex: value._hex,
                wei: web3.utils.toBN(value._hex).toString(),
                decimal: web3.utils.fromWei(value._hex, 'ether')
            }
        }
    };
    return result;
}

module.exports.watchTransactionStatus = function (txHash) {
    console.log('ethereum watch status ...')
    return web3.eth.getTransactionReceipt(txHash)
        .then(tx => {
            if (tx && tx.status)
                return {
                    status: 'confirmed'
                }
        });
}

module.exports.sendCoin = function (coin, from, to, amount) {
    return Promise.resolve(true);
}

/**
 * sample:
 *  ETH transaction:
 *      https://ropsten.etherscan.io/tx/0x3bd6af40bd4da982b1ad566f87b80b5f7842959410692fb2f0e99b032aabd41c
 *  ERC20 transaction:
 *      https://ropsten.etherscan.io/tx/0x2457788d46c1a41fa8822180cd1fc4fdbcddba90adb6c8c1a926e7cc99e83abb
 *
 * @param txHash
 * @returns {Promise<Transaction | never>}
 */
module.exports.getTransaction = function (txHash) {
    // console.log(`web3.eth.getTransaction [${txHash}]`);
    return web3.eth.getTransaction(txHash)
        .then(normalizeTransaction)
}

function normalizeTransaction(tx) {
    if (!tx)
        return tx;
    let result = {
        network: 'ethereum',
        hash: tx.hash,
        block: tx.blockHash,
        coin: 'ETH',
        from: {[normalizeAddress(tx.from)]: {wei: tx.value}},
        to: {[normalizeAddress(tx.to)]: {wei: tx.value}}
    }

    if (tx.input.length === ERC20_INPUT_LENGTH && tx.input.startsWith(ERC20_METHOD_TRANSFER)) {
        let _to = tx.input.substr(ERC20_METHOD_TRANSFER.length, 64);
        let _amount = tx.input.substr(ERC20_METHOD_TRANSFER.length + 64, 64);

        _to = normalizeAddress(normalizeBlock(_to));
        _amount = normalizeBlock(_amount);

        result.coin = normalizeAddress(tx.to);
        result.from = {
            [normalizeAddress(tx.from)]: {
                hex: _amount,
                wei: web3.utils.toBN(_amount).toString()
            }
        };
        result.to = {
            [_to]: {
                hex: _amount,
                wei: web3.utils.toBN(_amount).toString()
            }
        };
    }
    Object.keys(result.from).map(address => {
        result.from[address].decimal = web3.utils.fromWei(result.from[address].hex).toString()
    });
    Object.keys(result.to).map(address => {
        result.to[address].decimal = web3.utils.fromWei(result.to[address].hex).toString()
    });

    return result;
}

function normalizeBlock(block) {
    return block.replace(/^[0]*/g, '0x');
}

function withdrawTo(coin, address, amount) {
    return callTokenMint(coin.info.contractAddress, address, amount);
}

function callTokenMint(contractAddress, to, amount){
    let from = process.env.ETHEREUM_TOKENS_ADMIN_WALLET;
    let contract = new web3.eth.Contract(wrapTokenABI, contractAddress);
    let gasLimit = 0;
    amount = web3.utils.toWei(amount.toString(), 'ether');
    const privateKey = new Buffer(process.env.ETHEREUM_TOKENS_ADMIN_WALLET_PRIVATE_KEY, 'hex');

    console.log('getting gas price ...');
    return contract.methods.mint(to, amount).estimateGas({from})
        .then(gp => {
            console.log('network gas price: ', gp);
            gasLimit = web3.utils.toBN(gp).mul(web3.utils.toBN(2));
            console.log('gasLimit: ', gasLimit.toNumber());

            console.log('getting txCount ...')
            return web3.eth.getTransactionCount(from);
        })
        .then(txCount => {
            console.log('txCount:', txCount)
            // throw 'test';
            let txData = {
                nonce: web3.utils.toHex(txCount),
                gasLimit: web3.utils.toHex(gasLimit), //web3.utils.toHex(750000),
                gasPrice: web3.utils.toHex(10e9), // 10 Gwei
                from,
                to: contractAddress,
                data: contract.methods.mint(to, amount).encodeABI(),
                value: "0x0", // web3.utils.toHex(web3.utils.toWei('0.01', 'ether'))
            }
            // fire away!
            return signAndSendTx(txData, privateKey)
        })
        .then(receipt => {
            // https://web3js.readthedocs.io/en/1.0/web3-eth.html#eth-gettransactionreceipt-return
            console.log("mint receipt:", JSON.stringify(receipt, null, 2));
            return receipt.transactionHash;
        })
        .catch(error => {
            let failErrorList = ['transaction underpriced','exceeds block gas limit'];
            if(failErrorList.indexOf(error.message) >=0){
                //
            }
            throw error;
        })
}

function signAndSendTx(txData, privateKey, cb) {
    const transaction = new Tx(txData)
    transaction.sign(privateKey)
    const serializedTx = transaction.serialize().toString('hex');
    console.log('sending transaction ...');
    return web3.eth.sendSignedTransaction('0x' + serializedTx)
}