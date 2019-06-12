const EventBus = require('./eventBus');

EventBus.on(EventBus.EVENT_SWAP_POST_SAVE, function (tx) {
})

EventBus.on(EventBus.EVENT_SWAP_DEPOSIT_INIT, function (swap) {
    console.log('Swap deposit init');
})

EventBus.on(EventBus.EVENT_SWAP_DEPOSIT_CONFIRMED, function (swap) {
    console.log('Swap deposit confirmed');
})

EventBus.on(EventBus.EVENT_SWAP_TRANSACTION_CONFIRMED, function (swap) {
    console.log('Swap transaction confirmed');
})