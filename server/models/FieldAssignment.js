module.exports = (sequelize, DataTypes) => {
  const FieldAssignment = sequelize.define('FieldAssignment', {
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
    fieldName: {
      type: DataTypes.STRING,
      allowNull: false
      // e.g., 'assignedUser', 'department', 'location', 'firstName', 'lastName'
    },
    currentValue: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false
      // e.g., 'sentinelone', 'okta-fastpass', 'endpoint-central', 'cdw', etc.
    },
    sourceField: {
      type: DataTypes.STRING,
      allowNull: true
      // Original column name from import sheet
    },
    alternatives: {
      type: DataTypes.TEXT,
      allowNull: true
      // JSON string of array of { value, source, sourceField, priority }
    },
    reasoning: {
      type: DataTypes.TEXT,
      allowNull: true
      // Why this value was chosen (e.g., "S1 prioritized over Okta", "Only option available")
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
      // Priority order (1 = highest)
    },
    importTimestamp: {
      type: DataTypes.STRING,
      allowNull: false
      // When this assignment was made
    }
  });

  return FieldAssignment;
};

