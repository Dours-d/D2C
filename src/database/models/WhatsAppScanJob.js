const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatsAppScanJob = sequelize.define('WhatsAppScanJob', {
    scanId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'scan_id'
    },
    whatsappNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'whatsapp_number'
    },
    initiatedBy: {
      type: DataTypes.UUID,
      field: 'initiated_by',
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'scanning', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'status'
    },
    messagesScanned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'messages_scanned'
    },
    donationsIdentified: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'donations_identified'
    },
    walletsFound: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'wallets_found'
    },
    campaignsCreated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'campaigns_created'
    },
    campaignsUpdated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'campaigns_updated'
    },
    startedAt: {
      type: DataTypes.DATE,
      field: 'started_at'
    },
    completedAt: {
      type: DataTypes.DATE,
      field: 'completed_at'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      field: 'error_message'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'whatsapp_scan_jobs',
    timestamps: false,
    underscored: true,
    hooks: {
      beforeUpdate: (job) => {
        job.updatedAt = new Date();
      }
    }
  });

  WhatsAppScanJob.associate = (models) => {
    WhatsAppScanJob.belongsTo(models.User, {
      foreignKey: 'initiatedBy',
      as: 'initiator'
    });
  };

  return WhatsAppScanJob;
};
