const { body, param } = require('express-validator');

module.exports = {
  requiredString: (field) => body(field).isString().notEmpty(),
  optionalString: (field) => body(field).optional().isString(),
  requiredParam: (field) => param(field).notEmpty()
};
