module.exports = (sequelize, DataTypes) => {
  const ImportBatch = sequelize.define('ImportBatch', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: true
    },
    source: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Completed'
    },
    recordCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    rawData: {
      type: DataTypes.TEXT, // Stored as JSON string
      allowNull: true
    },
    importDate: {
      type: DataTypes.STRING, // ISO string
      allowNull: false
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  });

  return ImportBatch;
};


