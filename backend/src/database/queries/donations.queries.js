const models = require('../models');

const listDonations = (options = {}) => {
  return models.Donation.findAll(options);
};

const getDonationById = (donationId) => {
  return models.Donation.findByPk(donationId);
};

module.exports = {
  listDonations,
  getDonationById
};
