const WhyDonateService = require('../../../src/services/WhyDonateService');

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node import-whydonate.js <csv-path>');
  process.exit(1);
}

WhyDonateService.parseCSV(filePath)
  .then((payouts) => WhyDonateService.importPayouts(payouts, 'system'))
  .then((result) => {
    console.log('Import complete:', result);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
