module.exports = {
  network: process.env.TRON_NETWORK || 'mainnet',
  privateKey: process.env.TRON_PRIVATE_KEY,
  fullNode: process.env.TRON_FULL_NODE,
  solidityNode: process.env.TRON_SOLIDITY_NODE,
  eventServer: process.env.TRON_EVENT_SERVER,
  usdtContract: process.env.TRON_USDT_CONTRACT || process.env.USDT_TRC20_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
};
