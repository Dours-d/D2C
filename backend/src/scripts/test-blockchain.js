const TronService = require('../../../src/services/TronService');

const address = process.argv[2];

if (!address) {
  console.error('Usage: node test-blockchain.js <tron-address>');
  process.exit(1);
}

TronService.getWalletBalance(address)
  .then((balance) => {
    console.log('Wallet balance:', balance);
  })
  .catch((error) => {
    console.error('Blockchain test failed:', error);
    process.exit(1);
  });
