const CronJob = require('cron').CronJob;
const SwapController =require('../controllers/SwapController');

var inProgress = false;

// TODO prevent concurrent running ...
module.exports.start = function () {
    /**
     * constructor(cronTime, onTick, onComplete, start, timezone, context, runOnInit, unrefTimeout)
     */
    new CronJob(
        '0,30 * * * * *',
        () => {
            console.log('AutoMintCroneJob onTick....');
            if(!inProgress) {
                inProgress = true;
                console.log('AutoMintCroneJob start');
                SwapController.ethereumTokenAutoMint()
                    .then(() => {
                        console.log('AutoMintCroneJob onComplete.')
                        inProgress = false;
                    })
            }
        },
        null,
        true,
        'America/Los_Angeles'
    );
}