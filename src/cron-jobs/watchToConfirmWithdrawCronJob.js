const CronJob = require('cron').CronJob;
const SwapController =require('../controllers/SwapController');

module.exports.start = function () {
    /**
     * constructor(cronTime, onTick, onComplete, start, timezone, context, runOnInit, unrefTimeout)
     */
    new CronJob('0,10,20,30,40,50 * * * * *', SwapController.watchToConfirmWithdraw, null, true, 'America/Los_Angeles');
}