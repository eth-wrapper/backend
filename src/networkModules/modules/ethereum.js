const provider = `https://${(!!process.env.TEST_MODE ? 'ropsten' : 'mainnet')}.infura.io/YSclbc3zNqU2a9Qeozmb`;
const wssProvider = `wss://${(!!process.env.TEST_MODE ? 'ropsten' : 'mainnet')}.infura.io/ws`;
const erc20ABI = require("../ERC20.json").abi;
const Web3 = require('web3');
var web3 = new Web3(new Web3.providers.WebsocketProvider(wssProvider));

const fromBlock = 0;

const ERC20_INPUT_LENGTH = 10 + 64 + 64;
const ERC20_METHOD_TRANSFER = '0xa9059cbb';


module.exports.normalizeAddress = normalizeAddress;

function normalizeAddress(addr) {
    return addr.toLowerCase();
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