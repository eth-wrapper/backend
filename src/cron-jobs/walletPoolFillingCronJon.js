const CronJob = require('cron').CronJob;
const WalletPoolController =require('../controllers/WalletPoolController');

module.exports.start = function () {
    /**
     * constructor(cronTime, onTick, onComplete, start, timezone, context, runOnInit, unrefTimeout)
     */
    new CronJob('0,5,10,15,20,25,30,35,40,45,50,55 * * * * *', WalletPoolController.fillPoolWithEmptyWallet, null, true, 'America/Los_Angeles');
}