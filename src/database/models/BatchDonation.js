const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BatchDonation = sequelize.define('BatchDonation', {
    batchDonationId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'batch_donation_id'
    },
    batchId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'batch_id',
      references: {
        model: 'transaction_batches',
        key: 'batch_id'
      }
    },
    donationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'donation_id',
      references: {
        model: 'donations',
        key: 'donation_id'
      }
    }
  }, {
    tableName: 'batch_donations',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['batch_id', 'donation_id']
      }
    ]
  });

  BatchDonation.associate = (models) => {
    BatchDonation.belongsTo(models.TransactionBatch, {
      foreignKey: 'batchId',
      as: 'batch'
    });
    BatchDonation.belongsTo(models.Donation, {
      foreignKey: 'donationId',
      as: 'donation'
    });
  };

  return BatchDonation;
};
