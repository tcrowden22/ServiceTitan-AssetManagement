module.exports = (sequelize, DataTypes) => {
  const AssetHistory = sequelize.define('AssetHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    assetId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Assets',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
      // 'CREATE', 'UPDATE', 'ASSIGN', 'UNASSIGN', 'DELETE'
    },
    field: {
      type: DataTypes.STRING,
      allowNull: true
    },
    oldValue: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    newValue: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    performedBy: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Users',
        key: 'id'
      }
    }
  });

  return AssetHistory;
};


