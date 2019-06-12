const EventEmitter = require('events');
const ee = new EventEmitter();

module.exports = ee;


module.exports.EVENT_SWAP_POST_SAVE = 'swap_post_save';
module.exports.EVENT_TRANSACTION_POST_SAVE = 'transaction_post_save';
module.exports.EVENT_SWAP_DEPOSIT_INIT = 'swap_deposit_init';
module.exports.EVENT_SWAP_DEPOSIT_CONFIRMED = 'swap_deposit_confirmed';
module.exports.EVENT_SWAP_TRANSACTION_CONFIRMED = 'swap_transaction_confirmed';
module.exports.EVENT_TRADE_POST_SAVE = 'trade_post_save';
module.exports.EVENT_BRIGHTID_SCORE_UPDATED = 'broghtID_score_updated';