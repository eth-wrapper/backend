const validator = require('../validator');
const {isModelToBind, bind} = require('./bindRequestToModel');

module.exports = function () {
    let requiredParams = [];
    for (let i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] === 'string')
            requiredParams.push(arguments[i]);
    }
    return function (req, res, next) {
        let bindParams = [];
        for (let i = 0; i < requiredParams.length; i++) {
            let paramParts = requiredParams[i].split(":");
            let param = paramParts[0];
            let paramValidator = paramParts[1];
            if(isModelToBind(paramValidator)) {
                bindParams.push({
                    model: paramValidator,
                    param,
                    id: req.body[param]
                });
            }else {
                let error = applyValidator(req.body, param, paramValidator);
                if (error) {
                    console.log(error);
                    return res.status(500).send({
                        success: false,
                        message: "Request param validation failed at [" + param + "] \n\t " + error
                    });
                }
            }
        }
        // bind all request param to mongodb model
        Promise.all(bindParams.map(b => bind(b.model, b.id)))
            .then(results => {
                for (let i = 0; i < bindParams.length; i++) {
                    req.body[bindParams[i].param] = results[i];
                }
                next();
            })
            .catch(error => {
                console.log(error);
            })
    }
}

function applyValidator(obj, param, validation) {
    if (obj[param] === undefined)
        return `field required: [${param}]`
    else {
        if (validation) {
            if (/^(.)*\[([0-9])*\]$/.test(validation)) {
                // validate array of params
                if (!Array.isArray(obj[param])) {
                    return `field [${param}] most be an array.`;
                }
                let find = validation.match(/^(.)*\[([0-9])*\]$/);
                let nestedValidation = "";
                if (find[2]) {
                    if (obj[param].length != parseInt(find[2])) {
                        return `length of array of '${param}' most be ${parseInt(find[2])}.`;
                    }
                    nestedValidation = validation.substr(0, validation.length - 2 - find[2].length);
                } else {
                    nestedValidation = validation.substr(0, validation.length - 2);
                }
                for (let i = 0; i < obj[param].length; i++) {
                    // let error = validator[nestedValidation](req.body[param][i]);
                    let error = applyValidator(obj[param], i, nestedValidation);
                    if (error) {
                        return `error at index [${i}].\n\t ${error}`;
                    }
                }
            } else if (validator[validation]) {
                let error = validator[validation](obj[param]);
                if (error) {
                    return error;
                }
            } else {
                return `Invalid validator function: "${validation}"`;
            }
        }
    }
}