const CronJob = require('cron').CronJob;
const SwapController =require('../controllers/SwapController');
const networkModules = require('../networkModules').allModules;

var inProgress = false;

// TODO prevent concurrent running ...
module.exports.start = function () {
    /**
     * constructor(cronTime, onTick, onComplete, start, timezone, context, runOnInit, unrefTimeout)
     */
    Object.keys(networkModules).map(network => {
        makeCronJob(networkModules[network], network);
    })
}

function makeCronJob(networkModule, networkName){
    let inProgress = false;
    return new CronJob(
        networkModule.WITHDRAW_CRON_JOB_TIMES,
        () => {
            // console.log(`${networkName} withdrawCroneJob onTick....`);
            if(!inProgress) {
                inProgress = true;
                console.log(`${networkName} withdrawCroneJob start`);
                networkModule.onWithdrawCronJob()
                    .then(() => {
                    })
                    .catch(error => {
                    })
                    .then(() => {
                        console.log(`${networkName} withdrawCroneJob onComplete.`)
                        inProgress = false;
                    })
            }
        },
        null,
        true,
        'America/Los_Angeles'
    );
}