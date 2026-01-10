const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SystemConfig = sequelize.define('SystemConfig', {
    configKey: {
      type: DataTypes.STRING(100),
      primaryKey: true,
      field: 'config_key'
    },
    configValue: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'config_value'
    },
    configType: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
      allowNull: false,
      field: 'config_type'
    },
    description: {
      type: DataTypes.TEXT
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    },
    updatedBy: {
      type: DataTypes.UUID,
      field: 'updated_by',
      references: {
        model: 'users',
        key: 'user_id'
      }
    }
  }, {
    tableName: 'system_config',
    timestamps: false,
    underscored: true
  });

  SystemConfig.associate = (models) => {
    SystemConfig.belongsTo(models.User, {
      foreignKey: 'updatedBy',
      as: 'updater'
    });
  };

  return SystemConfig;
};
