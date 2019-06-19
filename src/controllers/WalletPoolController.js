var bip39 = require('bip39');
var hdkey = require('hdkey');
var createHash = require('create-hash');
var bs58check = require('bs58check');
var ethUtil = require('ethereumjs-util');
const Wallet = require('../database/mongooseModels/Wallet');

/**
 * this function will called via cron job every hours
 */

module.exports.generatePhrase = function(){
    return bip39.generateMnemonic();
}

module.exports.fillPoolWithEmptyWallet = function(){
    // console.log('WalletPoolController.fillPoolWithEmptyWallet .....');
    Wallet.find({assigned: false, type: Wallet.TYPE_BITCOIN})
        .then(wallets => {
            if(wallets.length < process.env.MIN_FREE_WALLET_COUNT)
                return createNewBitcoinWallets();
        })
        // ethereum wallet type creation disabled
        // .then(() =>{
        //     return Wallet.find({assigned: false, type: Wallet.TYPE_ETHEREUM})
        // })
        // .then(wallets => {
        //     if(wallets.length < process.env.MIN_FREE_WALLET_COUNT)
        //         return createNewEthereumWallets();
        // })
}

function newBitcoinWallet(startIndex, n) {
    let results = [];
    // const mnemonic = bip39.generateMnemonic();
    const seed = bip39.mnemonicToSeedSync(process.env.MASTER_WALLET_MNEMONIC); //creates seed buffer
    const root = hdkey.fromMasterSeed(seed);
    let addrnode, step1, step2,step3,step4,step9;
    for(let i=0 ; i<n ; i++){
        let treePath = `m/44'/0'/0'/0/${startIndex + i}`;
        addrnode = root.derive(treePath);
        step1 = addrnode._publicKey;
        step2 = createHash('sha256').update(step1).digest();
        step3 = createHash('rmd160').update(step2).digest();
        step4 = Buffer.allocUnsafe(21);
        // (0x00 for mainnet, 0x6f for testnet)
        step4.writeUInt8(process.env.TEST_MODE ? 0x6f : 0x00, 0);
        step3.copy(step4, 1); //step4 now holds the extended RIPMD-160 result
        step9 = bs58check.encode(step4);
        results.push({
            // first address assigned to transaction change wallet
            assigned: (startIndex + i) === 0,
            type: Wallet.TYPE_BITCOIN,
            address: step9,
            info: {
                treePath,
                account: 0,
                change: 0,
                address_index: startIndex + i,
            }
        });
    }
    return results;
}

function newEthereumWallet(startIndex, n) {
    let results = [];
    // const mnemonic = bip39.generateMnemonic();
    const seed = bip39.mnemonicToSeedSync(process.env.MASTER_WALLET_MNEMONIC); //creates seed buffer
    const root = hdkey.fromMasterSeed(seed);
    let addrNode, pubKey, addr,address;
    for(let i=0 ; i<n ; i++){
        let treePath = `m/44'/60'/0'/0/${startIndex + i}`;
        addrNode = root.derive(treePath);
        pubKey = ethUtil.privateToPublic(addrNode._privateKey);
        addr = ethUtil.publicToAddress(pubKey).toString('hex');
        address = ethUtil.toChecksumAddress(addr);
        results.push({
            type: Wallet.TYPE_ETHEREUM,
            address: address,
            info: {
                treePath,
                account: 0,
                change: 0,
                address_index: startIndex + i,
            }
        });
    }
    return results;
}

function createNewBitcoinWallets(){
    return new Promise(function (resolve, reject) {
        let aggregations = [
            {$match: {type: Wallet.TYPE_BITCOIN}},
            {$group: {_id: "$network", maxIndex: {$max: "$info.address_index"}}}
        ];
        Wallet.aggregate(aggregations, function (error, result) {
            if(error)
                return reject(error);
            let start_index = 0;
            if(result.length > 0)
                start_index = result[0].maxIndex + 1;

            console.log('start index: ', start_index, result);
            let newWallets = newBitcoinWallet(start_index, 50);
            for(let i=0 ; i<newWallets.length ; i++){
                new Wallet(newWallets[i]).save();
            }
            resolve(true);
        })
    })
}

function createNewEthereumWallets(){
    return new Promise(function (resolve, reject) {
        let aggregations = [
            {$match: {type: Wallet.TYPE_ETHEREUM}},
            {$group: {_id: "$network", maxIndex: {$max: "$info.address_index"}}}
        ];
        Wallet.aggregate(aggregations, function (error, result) {
            if(error)
                return reject(error);
            let start_index = 0;
            if(result.length > 0)
                start_index = result[0].maxIndex + 1;

            console.log('start index: ', start_index, result);
            let newWallets = newEthereumWallet(start_index, 50);
            for(let i=0 ; i<newWallets.length ; i++){
                new Wallet(newWallets[i]).save();
            }
            resolve(true);
        })
    })
}

module.exports.assignWalletToUser = function (user, walletType) {
    console.log(`wallet assign: user: [${user.username}] wallet: [${walletType}]`)
        if(Wallet.typeList.indexOf(walletType) < 0)
            return Promise.reject({message: `WalletPoolController: network type [${walletType}] is invalid to assign to user`})
        return Wallet.updateOne({
            assigned: false,
            type: walletType
        }, {
            $set: {assigned: true, user: user._id}
        }, {
            upsert: false
        })
        .then(() => Wallet.findOne({type: walletType, user: user._id}))
        .then(wallet => {
            if(!wallet)
                throw({message: `Wallet not assigned to user`})
            user[`${walletType}Wallet`] = wallet.address;
            return user.save();
        })
}
