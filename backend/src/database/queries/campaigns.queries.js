const models = require('../models');

const listCampaigns = (options = {}) => {
  return models.Campaign.findAll(options);
};

const getCampaignById = (campaignId) => {
  return models.Campaign.findByPk(campaignId);
};

module.exports = {
  listCampaigns,
  getCampaignById
};
