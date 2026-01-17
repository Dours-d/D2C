const parseMessage = (message) => {
  if (!message) {
    return { text: '', amount: null, currency: null };
  }

  return { text: message, amount: null, currency: null };
};

module.exports = {
  parseMessage
};
