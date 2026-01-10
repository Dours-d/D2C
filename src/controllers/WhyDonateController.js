const multer = require('multer');
const path = require('path');
const fs = require('fs');
const WhyDonateService = require('../services/WhyDonateService');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * WhyDonate Controller
 */
class WhyDonateController {
  /**
   * Import WhyDonate CSV
   * POST /api/whydonate/import
   */
  async import(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'CSV file is required' });
      }

      // Parse CSV
      const payouts = await WhyDonateService.parseCSV(req.file.path);

      if (payouts.length === 0) {
        // Clean up file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'No valid data found in CSV file' });
      }

      // Import payouts
      const importResult = await WhyDonateService.importPayouts(payouts, req.user.userId);

      // Clean up file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        imported: importResult.imported,
        errors: importResult.errors,
        details: importResult.details
      });
    } catch (error) {
      console.error('WhyDonate import error:', error);
      
      // Clean up file if exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({ error: `Failed to import CSV: ${error.message}` });
    }
  }

  /**
   * Create donations from payouts
   * POST /api/whydonate/process
   */
  async processPayouts(req, res) {
    try {
      const { payoutIds } = req.body;

      if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
        return res.status(400).json({ error: 'Payout IDs array is required' });
      }

      const donations = await WhyDonateService.createDonationsFromPayouts(payoutIds);

      res.json({
        success: true,
        donations,
        count: donations.length
      });
    } catch (error) {
      console.error('Process payouts error:', error);
      res.status(500).json({ error: 'Failed to process payouts' });
    }
  }
}

module.exports = {
  controller: new WhyDonateController(),
  upload: upload.single('file')
};
