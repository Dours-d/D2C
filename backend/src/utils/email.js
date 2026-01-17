const logger = require('./logger');

const sendEmail = async (payload) => {
  logger.info('Email sending is not configured', { payload });
  return { accepted: false };
};

module.exports = {
  sendEmail
};
