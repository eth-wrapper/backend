const fs = require('fs');
const path = require('path');

let allModules = {};
let allModuleNecessaryMethods = ['watchDeposit', 'watchTransactionStatus', 'sendCoin', 'getTransaction', 'normalizeAddress'];

var normalizedPath = path.join(__dirname, "./modules");
fs.readdirSync(normalizedPath).forEach(function(file) {
    if(path.extname(file).toLowerCase() === '.js'){
        let moduleName = path.basename(file, '.js');
        let modulePath = "./modules/" + file;
        let currentModule = require(modulePath);
        allModuleNecessaryMethods.map(method => {
            if(currentModule[method] === undefined){
                let errorMessage = `Cryptocurrency module [${moduleName}] has not defined the method [${method}]`;
                console.error(errorMessage)
                throw {message: errorMessage};
            }
        })
        allModules[moduleName] = currentModule
    }
});

// console.log('Network modules: ', Object.keys(allModules));

module.exports.allModules = allModules;