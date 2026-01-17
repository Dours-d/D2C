const { validationResult } = require('express-validator');

const validate = (validators = []) => {
  return async (req, res, next) => {
    for (const validator of validators) {
      await validator.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation error',
        details: errors.array().map((err) => ({
          field: err.path,
          message: err.msg
        }))
      });
    }

    return next();
  };
};

module.exports = {
  validate
};
