module.exports = (sequelize, DataTypes) => {
  const Asset = sequelize.define('Asset', {
    // We'll use UUID or a specific string ID to match frontend's "ASSET-..." format if we want consistency, 
    // but typically DBs use Integer IDs or UUIDs. 
    // The frontend generates IDs like `ASSET-${timestamp}-${index}-...`. 
    // We can keep that as a string 'id' or let DB handle it.
    // Let's use a String ID to allow migration of existing IDs easily.
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    serialNumber: {
      type: DataTypes.STRING,
      allowNull: false
    },
    computerName: DataTypes.STRING,
    assetTag: DataTypes.STRING,
    deviceType: DataTypes.STRING,
    manufacturer: DataTypes.STRING,
    model: DataTypes.STRING,
    purchaseDate: DataTypes.STRING, // Keeping as string for simplicity, or DATEONLY
    purchaseCost: DataTypes.FLOAT,
    vendor: DataTypes.STRING,
    assignedUser: DataTypes.STRING, // Email
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    department: DataTypes.STRING,
    location: DataTypes.STRING,
    status: DataTypes.STRING,
    lastUpdated: DataTypes.STRING, // Explicit tracking field from frontend
    
    // Compliance Flags
    mdmEnrolled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    s1Active: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    oktaEnrolled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    createdById: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Users',
        key: 'id'
      }
    }
  }, {
    hooks: {
      afterCreate: async (asset, options) => {
        if (options.userId && sequelize.models.AssetHistory) {
          await sequelize.models.AssetHistory.create({
            assetId: asset.id,
            action: 'CREATE',
            newValue: JSON.stringify(asset.toJSON()),
            performedBy: options.userId
          });
        }
      },
      afterUpdate: async (asset, options) => {
        if (options.userId && sequelize.models.AssetHistory) {
          const changed = asset.changed();
          if (changed) {
            for (const field of changed) {
              if (field === 'updatedAt' || field === 'lastUpdated') continue;
              
              await sequelize.models.AssetHistory.create({
                assetId: asset.id,
                action: 'UPDATE',
                field: field,
                oldValue: String(asset.previous(field)),
                newValue: String(asset.get(field)),
                performedBy: options.userId
              });
            }
          }
        }
      }
    }
  });

  return Asset;
};

