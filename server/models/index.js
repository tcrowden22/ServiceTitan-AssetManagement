const Sequelize = require('sequelize');
const path = require('path');

const storagePath = path.join(__dirname, '../local.db');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storagePath,
  logging: false
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require('./User')(sequelize, Sequelize);
db.Asset = require('./Asset')(sequelize, Sequelize);
db.AssetHistory = require('./AssetHistory')(sequelize, Sequelize);
db.FieldAssignment = require('./FieldAssignment')(sequelize, Sequelize);
db.ImportBatch = require('./ImportBatch')(sequelize, Sequelize);

// Associations
db.User.hasMany(db.Asset, { foreignKey: 'createdById', as: 'createdAssets' });
db.Asset.belongsTo(db.User, { foreignKey: 'createdById', as: 'creator' });

db.Asset.hasMany(db.AssetHistory, { foreignKey: 'assetId', as: 'history' });
db.AssetHistory.belongsTo(db.Asset, { foreignKey: 'assetId' });

db.User.hasMany(db.AssetHistory, { foreignKey: 'performedBy', as: 'actions' });
db.AssetHistory.belongsTo(db.User, { foreignKey: 'performedBy', as: 'actor' });

db.Asset.hasMany(db.FieldAssignment, { foreignKey: 'assetId', as: 'fieldAssignments' });
db.FieldAssignment.belongsTo(db.Asset, { foreignKey: 'assetId' });

module.exports = db;

