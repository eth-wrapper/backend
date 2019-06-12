const {Router} = require('express');
const User = require('../database/mongooseModels/User');
const requireParam = require('../middleware/requestParamRequire');
let router = Router();

router.post('/get', function (req, res, next) {
    let userId = req.body.userId;
    let user = null;
    let userInfoPromise = null;
    if (!userId) {
        userInfoPromise = Promise.resolve(req.data.user);
    } else {
        userInfoPromise = User.findOne({_id: userId});
    }
    userInfoPromise
        .then(user => {
            let response = {
                success: true,
                user
            };
            res.json(response);
        })
        .catch(error => {

            console.log(error);
            res.status(500).json({
                success: false,
                message: error.message || "Server side error",
                error
            });
        })
});

module.exports = router;