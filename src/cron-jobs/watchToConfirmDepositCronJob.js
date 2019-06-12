const CronJob = require('cron').CronJob;
const SwapController =require('../controllers/SwapController');

module.exports.start = function () {
    /**
     * constructor(cronTime, onTick, onComplete, start, timezone, context, runOnInit, unrefTimeout)
     */
    // new CronJob('0,5,10,15,20,25,30,35,40,45,50,55 * * * * *', SwapController.newSwapWatch, null, true, 'America/Los_Angeles');
    new CronJob('0,30 * * * * *', SwapController.watchToConfirmDeposit, null, true, 'America/Los_Angeles');
}