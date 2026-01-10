const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      field: 'user_id'
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.ENUM('admin', 'operator', 'viewer'),
      allowNull: false
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash'
    },
    lastLogin: {
      type: DataTypes.DATE,
      field: 'last_login'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'users',
    timestamps: false,
    underscored: true
  });

  User.associate = (models) => {
    User.hasMany(models.Campaign, {
      foreignKey: 'createdBy',
      as: 'campaigns'
    });
    User.hasMany(models.Donation, {
      foreignKey: 'processedBy',
      as: 'processedDonations'
    });
    User.hasMany(models.TransactionBatch, {
      foreignKey: 'initiatedBy',
      as: 'batches'
    });
    User.hasMany(models.WhatsAppScanJob, {
      foreignKey: 'initiatedBy',
      as: 'scanJobs'
    });
    User.hasMany(models.AuditLog, {
      foreignKey: 'userId',
      as: 'auditLogs'
    });
  };

  return User;
};
