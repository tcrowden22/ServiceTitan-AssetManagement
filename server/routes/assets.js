const express = require('express');
const router = express.Router();
const { Asset, User, AssetHistory, FieldAssignment, ImportBatch, sequelize, Sequelize } = require('../models');
const verifyToken = require('../middleware/auth');
const { Op } = require('sequelize');

// Get all assets
router.get('/', verifyToken, async (req, res) => {
  try {
    const assets = await Asset.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assets', error: error.message });
  }
});

// Get all import batches
router.get('/imports', verifyToken, async (req, res) => {
  try {
    const batches = await ImportBatch.findAll({
      attributes: { exclude: ['rawData'] }, // Exclude rawData for list view performance
      order: [['importDate', 'DESC']]
    });
    res.json(batches);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching import history', error: error.message });
  }
});

// Get specific import batch with raw data
router.get('/imports/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await ImportBatch.findByPk(id);
    if (!batch) {
      return res.status(404).json({ message: 'Import batch not found' });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching import details', error: error.message });
  }
});

// Delete all assets
router.delete('/', verifyToken, async (req, res) => {
  try {
    const assets = await Asset.findAll();
    const count = assets.length;

    for (const asset of assets) {
      await AssetHistory.create({
        assetId: asset.id,
        action: 'DELETE',
        oldValue: JSON.stringify(asset.toJSON()),
        newValue: 'Deleted all assets',
        performedBy: req.userId
      });
      await asset.destroy();
    }

    // Also clear field assignments
    await FieldAssignment.destroy({ where: {}, truncate: false }); // truncate not supported in sqlite safely with foreign keys sometimes

    res.json({ message: 'All assets deleted successfully', count });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting all assets', error: error.message });
  }
});

// Bulk update assets
router.post('/bulk-update', verifyToken, async (req, res) => {
  try {
    const { field, value, filters } = req.body;
    
    if (!field) {
      return res.status(400).json({ message: 'Field name is required' });
    }

    const whereClause = {};
    if (filters) {
      // Basic filtering support
      if (filters.status && filters.status !== 'all') whereClause.status = filters.status;
      if (filters.deviceType && filters.deviceType !== 'all') whereClause.deviceType = filters.deviceType;
      // Add more filters as needed
    }

    const assetsToUpdate = await Asset.findAll({ where: whereClause });
    const count = assetsToUpdate.length;

    for (const asset of assetsToUpdate) {
      const oldValue = JSON.stringify(asset.toJSON());
      await asset.update({ 
        [field]: value, 
        lastUpdated: new Date().toISOString() 
      }, { userId: req.userId });

      await AssetHistory.create({
        assetId: asset.id,
        action: 'UPDATE',
        oldValue,
        newValue: JSON.stringify(asset.toJSON()),
        performedBy: req.userId
      });
    }

    res.json({ message: 'Bulk update completed', count });
  } catch (error) {
    res.status(500).json({ message: 'Error during bulk update', error: error.message });
  }
});

// Create new asset (includes bulk import)
router.post('/', verifyToken, async (req, res) => {
  try {
    // Check if it's a bulk import (array directly OR object with assets array)
    const isBulk = Array.isArray(req.body) || (req.body.assets && Array.isArray(req.body.assets));

    if (isBulk) {
      // Handle both formats
      const assetsList = Array.isArray(req.body) ? req.body : req.body.assets;
      const importFilename = !Array.isArray(req.body) ? req.body.filename : 'unknown_file';
      const importSource = !Array.isArray(req.body) ? req.body.source : 'manual_upload';

      // Create import batch record
      const importBatch = await ImportBatch.create({
        filename: importFilename,
        source: importSource,
        status: 'Processing',
        recordCount: assetsList.length,
        rawData: JSON.stringify(assetsList),
        importDate: new Date().toISOString(),
        createdById: req.userId
      });

      const assetsData = assetsList.map(asset => ({
        ...asset,
        createdById: req.userId
      }));
      
      const results = [];
      for (const assetData of assetsData) {
        // Try to find existing asset by serial number first (more reliable than ID)
        if (assetData.serialNumber) {
          const normalizedSerial = String(assetData.serialNumber).trim();
          const existing = await Asset.findOne({
            where: {
              serialNumber: normalizedSerial
            }
          });
          
          if (existing) {
            // Update existing asset - preserve the original ID
            await existing.update({
              ...assetData,
              id: existing.id,
              createdById: req.userId
            }, { userId: req.userId });
            results.push(existing);
            continue;
          }
        }
        
        // If ID exists, try upsert by ID
        if (assetData.id) {
          const existingById = await Asset.findByPk(assetData.id);
          if (existingById) {
            await existingById.update({
              ...assetData,
              createdById: req.userId
            }, { userId: req.userId });
            results.push(existingById);
            continue;
          }
        }
        
        // New asset - create it
        const [asset, created] = await Asset.upsert({
          ...assetData,
          createdById: req.userId
        });
        results.push(asset);
      }
      
      // Update batch status
      await importBatch.update({
        status: 'Completed',
        recordCount: results.length // Actual processed count
      });
      
      return res.status(201).json({ message: 'Assets imported successfully', count: results.length, batchId: importBatch.id });
    }

    // Single asset create - Handle object with metadata wrapper if present
    const singleAssetData = req.body.assets ? req.body.assets[0] : req.body;
    
    // If wrapped in metadata object
    if (req.body.filename || req.body.source) {
       // Also create a batch for single imports if metadata is provided
       await ImportBatch.create({
        filename: req.body.filename || 'single_create',
        source: req.body.source || 'manual',
        status: 'Completed',
        recordCount: 1,
        rawData: JSON.stringify([singleAssetData]),
        importDate: new Date().toISOString(),
        createdById: req.userId
      });
    }

    const asset = await Asset.create({
      ...singleAssetData,
      createdById: req.userId
    }, { userId: req.userId });
    res.status(201).json(asset);
  } catch (error) {
    res.status(500).json({ message: 'Error creating asset', error: error.message });
  }
});

// Update asset
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await Asset.update(req.body, {
      where: { id },
      individualHooks: true,
      userId: req.userId
    });

    if (updated > 0) {
      const updatedAsset = await Asset.findByPk(id);
      res.json(updatedAsset);
    } else {
      const exists = await Asset.findByPk(id);
      if (exists) {
        res.json(exists);
      } else {
        res.status(404).json({ message: 'Asset not found' });
      }
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating asset', error: error.message });
  }
});

// Delete asset
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findByPk(id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    await AssetHistory.create({
      assetId: id,
      action: 'DELETE',
      oldValue: JSON.stringify(asset.toJSON()),
      performedBy: req.userId
    });

    await asset.destroy();
    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting asset', error: error.message });
  }
});

// Migrate assets (bulk import)
router.post('/migrate', verifyToken, async (req, res) => {
  try {
    const assets = req.body;
    if (!Array.isArray(assets)) {
      return res.status(400).json({ message: 'Expected an array of assets' });
    }

    const results = [];
    for (const assetData of assets) {
      const [asset, created] = await Asset.upsert({
        ...assetData,
        createdById: req.userId
      });
      results.push(asset);
    }

    res.json({ message: 'Migration completed', count: results.length });
  } catch (error) {
    res.status(500).json({ message: 'Error during migration', error: error.message });
  }
});

// Get asset history
router.get('/:id/history', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const history = await AssetHistory.findAll({
      where: { assetId: id },
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'performer', attributes: ['username'] }]
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching history', error: error.message });
  }
});

// Assign asset
router.post('/:id/assign', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedUser } = req.body;
    const asset = await Asset.findByPk(id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const oldValue = JSON.stringify(asset.toJSON());
    await asset.update({ assignedUser, lastUpdated: new Date().toISOString() }, { userId: req.userId });
    
    await AssetHistory.create({
      assetId: id,
      action: 'ASSIGN',
      oldValue,
      newValue: JSON.stringify(asset.toJSON()),
      performedBy: req.userId
    });

    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: 'Error assigning asset', error: error.message });
  }
});

// Return asset
router.post('/:id/return', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findByPk(id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const oldValue = JSON.stringify(asset.toJSON());
    await asset.update({ assignedUser: null, lastUpdated: new Date().toISOString() }, { userId: req.userId });
    
    await AssetHistory.create({
      assetId: id,
      action: 'RETURN',
      oldValue,
      newValue: JSON.stringify(asset.toJSON()),
      performedBy: req.userId
    });

    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: 'Error returning asset', error: error.message });
  }
});

// Get field assignments for an asset
router.get('/:id/field-assignments', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const assignments = await FieldAssignment.findAll({
      where: { assetId: id },
      order: [['importTimestamp', 'DESC']]
    });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching field assignments', error: error.message });
  }
});

// Get single field assignment
router.get('/:id/field-assignments/:fieldName', verifyToken, async (req, res) => {
  try {
    const { id, fieldName } = req.params;
    const assignment = await FieldAssignment.findOne({
      where: { assetId: id, fieldName }
    });
    if (!assignment) {
      return res.status(404).json({ message: 'Field assignment not found' });
    }
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching field assignment', error: error.message });
  }
});

// Update field assignment
router.post('/:id/field-assignments/:fieldName/update', verifyToken, async (req, res) => {
  try {
    const { id, fieldName } = req.params;
    const { value, source, sourceField } = req.body;
    
    const asset = await Asset.findByPk(id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    // Update the asset field
    await asset.update({ [fieldName]: value, lastUpdated: new Date().toISOString() }, { userId: req.userId });

    // Update or create field assignment record
    const [assignment] = await FieldAssignment.findOrCreate({
      where: { assetId: id, fieldName },
      defaults: {
        assetId: id,
        fieldName,
        currentValue: value,
        source: source || 'manual',
        sourceField: sourceField || null,
        alternatives: JSON.stringify([]),
        reasoning: 'Manually updated by user',
        priority: 0,
        importTimestamp: new Date().toISOString()
      }
    });

    if (!assignment.isNewRecord) {
      await assignment.update({
        currentValue: value,
        source: source || 'manual',
        sourceField: sourceField || null,
        reasoning: 'Manually updated by user'
      });
    }

    res.json({ asset, assignment });
  } catch (error) {
    res.status(500).json({ message: 'Error updating field assignment', error: error.message });
  }
});

// Bulk create field assignments
router.post('/field-assignments/bulk', verifyToken, async (req, res) => {
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ message: 'Expected an array of assignments' });
    }

    const results = [];
    for (const assignmentData of assignments) {
      const [assignment] = await FieldAssignment.findOrCreate({
        where: {
          assetId: assignmentData.assetId,
          fieldName: assignmentData.fieldName
        },
        defaults: {
          ...assignmentData,
          alternatives: typeof assignmentData.alternatives === 'string' 
            ? assignmentData.alternatives 
            : JSON.stringify(assignmentData.alternatives || [])
        }
      });
      results.push(assignment);
    }

    res.json({ message: 'Field assignments created', count: results.length });
  } catch (error) {
    res.status(500).json({ message: 'Error creating field assignments', error: error.message });
  }
});

// Get unique employees
router.get('/employees', verifyToken, async (req, res) => {
  try {
    const employees = await Asset.findAll({
      attributes: [
        'assignedUser',
        'firstName',
        'lastName',
        'department',
        'location',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'assetCount']
      ],
      where: {
        assignedUser: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['assignedUser', 'firstName', 'lastName', 'department', 'location'],
      having: Sequelize.literal('assignedUser IS NOT NULL AND assignedUser != ""'),
      order: [['assignedUser', 'ASC']],
      raw: true
    });

    const employeeMap = new Map();
    employees.forEach(emp => {
      const email = emp.assignedUser?.trim().toLowerCase();
      if (!email) return;

      if (!employeeMap.has(email)) {
        employeeMap.set(email, {
          email: emp.assignedUser.trim(),
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          fullName: [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.assignedUser.split('@')[0],
          department: emp.department || '',
          location: emp.location || '',
          assetCount: parseInt(emp.assetCount) || 0
        });
      }
    });

    res.json(Array.from(employeeMap.values()));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees', error: error.message });
  }
});

// Find duplicate assets by serial number
router.get('/duplicates', verifyToken, async (req, res) => {
  try {
    const allAssets = await Asset.findAll({
      where: {
        serialNumber: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      order: [['serialNumber', 'ASC'], ['lastUpdated', 'DESC']]
    });

    const serialMap = new Map();
    allAssets.forEach(asset => {
      if (!asset.serialNumber) return;
      const normalizedSerial = String(asset.serialNumber).trim().toLowerCase();
      if (!normalizedSerial) return;
      
      if (!serialMap.has(normalizedSerial)) {
        serialMap.set(normalizedSerial, []);
      }
      serialMap.get(normalizedSerial).push(asset);
    });

    const duplicateGroups = [];
    serialMap.forEach((assets, normalizedSerial) => {
      if (assets.length > 1) {
        duplicateGroups.push({
          normalizedSerial: normalizedSerial,
          assets: assets,
          count: assets.length
        });
      }
    });

    if (duplicateGroups.length === 0) {
      return res.json({
        totalDuplicates: 0,
        totalDuplicateAssets: 0,
        duplicates: []
      });
    }

    duplicateGroups.sort((a, b) => b.count - a.count);

    const duplicates = duplicateGroups.map(group => ({
      serialNumber: group.assets[0].serialNumber,
      count: group.count,
      assets: group.assets.map(a => a.toJSON())
    }));

    res.json({
      totalDuplicates: duplicates.length,
      totalDuplicateAssets: duplicates.reduce((sum, d) => sum + d.count, 0),
      duplicates
    });
  } catch (error) {
    res.status(500).json({ message: 'Error finding duplicates', error: error.message });
  }
});

// Delete duplicate asset
router.delete('/duplicates/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findByPk(id);
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    await AssetHistory.create({
      assetId: id,
      action: 'DELETE',
      oldValue: JSON.stringify(asset.toJSON()),
      performedBy: req.userId
    });

    await asset.destroy();
    res.json({ message: 'Duplicate asset deleted successfully', deletedAsset: { id, serialNumber: asset.serialNumber } });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting duplicate', error: error.message });
  }
});

// Bulk delete duplicates
router.post('/duplicates/cleanup', verifyToken, async (req, res) => {
  try {
    const { keepStrategy = 'mostRecent' } = req.body;
    
    const allAssets = await Asset.findAll({
      order: [['serialNumber', 'ASC'], ['lastUpdated', 'DESC']]
    });

    const serialMap = new Map();
    allAssets.forEach(asset => {
      if (!asset.serialNumber) return;
      const normalizedSerial = String(asset.serialNumber).trim().toLowerCase();
      if (!normalizedSerial) return;
      
      if (!serialMap.has(normalizedSerial)) {
        serialMap.set(normalizedSerial, []);
      }
      serialMap.get(normalizedSerial).push(asset);
    });

    const deleted = [];
    const kept = [];

    for (const [normalizedSerial, assets] of serialMap.entries()) {
      if (assets.length <= 1) continue;

      let assetToKeep;
      let assetsToDelete;

      if (keepStrategy === 'mostRecent') {
        assets.sort((a, b) => {
          const aDate = a.lastUpdated ? new Date(a.lastUpdated) : new Date(a.createdAt);
          const bDate = b.lastUpdated ? new Date(b.lastUpdated) : new Date(b.createdAt);
          return bDate - aDate;
        });
        assetToKeep = assets[0];
        assetsToDelete = assets.slice(1);
      } else if (keepStrategy === 'mostComplete') {
        assets.sort((a, b) => {
          const aFields = Object.values(a.toJSON()).filter(v => v && v !== '' && v !== null && v !== undefined).length;
          const bFields = Object.values(b.toJSON()).filter(v => v && v !== '' && v !== null && v !== undefined).length;
          return bFields - aFields;
        });
        assetToKeep = assets[0];
        assetsToDelete = assets.slice(1);
      } else {
        assets.sort((a, b) => {
          const aDate = new Date(a.createdAt);
          const bDate = new Date(b.createdAt);
          return aDate - bDate;
        });
        assetToKeep = assets[0];
        assetsToDelete = assets.slice(1);
      }

      for (const asset of assetsToDelete) {
        await AssetHistory.create({
          assetId: asset.id,
          action: 'DELETE',
          oldValue: JSON.stringify(asset.toJSON()),
          newValue: `Removed: Duplicate of ${assetToKeep.id}`,
          performedBy: req.userId
        });
        await asset.destroy();
        deleted.push({ id: asset.id, serialNumber: asset.serialNumber });
      }

      kept.push({ id: assetToKeep.id, serialNumber: assetToKeep.serialNumber });
    }

    res.json({
      message: 'Cleanup completed',
      deleted: deleted.length,
      kept: kept.length,
      deletedAssets: deleted,
      keptAssets: kept
    });
  } catch (error) {
    res.status(500).json({ message: 'Error during cleanup', error: error.message });
  }
});

// Data Integrity Check
router.get('/integrity-check', verifyToken, async (req, res) => {
  try {
    const report = {
      futurePurchaseDates: 0,
      invalidEmails: 0,
      negativeCosts: 0,
      statusInconsistencies: 0,
      details: []
    };

    const assets = await Asset.findAll();
    const now = new Date();

    for (const asset of assets) {
      const issues = [];

      // Check for future purchase dates
      if (asset.purchaseDate) {
        const purchaseDate = new Date(asset.purchaseDate);
        if (purchaseDate > now) {
          report.futurePurchaseDates++;
          issues.push('Future purchase date');
        }
      }

      // Check for invalid email formats
      if (asset.assignedUser) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(asset.assignedUser)) {
          report.invalidEmails++;
          issues.push('Invalid email format');
        }
      }

      // Check for negative purchase costs
      if (asset.purchaseCost < 0) {
        report.negativeCosts++;
        issues.push('Negative purchase cost');
      }

      // Check for logical inconsistencies
      if (asset.s1Active && asset.status === 'Retired') {
        report.statusInconsistencies++;
        issues.push('Active S1 agent on Retired asset');
      }

      if (issues.length > 0) {
        report.details.push({
          id: asset.id,
          serialNumber: asset.serialNumber,
          issues
        });
      }
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Error checking integrity', error: error.message });
  }
});

// Comprehensive data cleanup and repair
router.post('/cleanup', verifyToken, async (req, res) => {
  try {
    const { 
      removeDuplicates = true,
      normalizeSerials = true,
      fixStatus = true,
      removeInvalid = true,
      keepStrategy = 'mostRecent' // 'mostRecent', 'mostComplete', 'oldest'
    } = req.body;

    const results = {
      duplicatesRemoved: 0,
      serialsNormalized: 0,
      statusFixed: 0,
      invalidRemoved: 0,
      totalProcessed: 0,
      totalAfter: 0
    };

    // Get all assets
    const allAssets = await Asset.findAll({
      order: [['createdAt', 'ASC']]
    });

    results.totalProcessed = allAssets.length;

    // Step 1: Remove invalid assets (no serial number)
    if (removeInvalid) {
      const invalidAssets = allAssets.filter(a => !a.serialNumber || String(a.serialNumber).trim() === '');
      for (const asset of invalidAssets) {
        await AssetHistory.create({
          assetId: asset.id,
          action: 'DELETE',
          oldValue: JSON.stringify(asset.toJSON()),
          newValue: 'Removed: Invalid (no serial number)',
          performedBy: req.userId
        });
        await asset.destroy();
        results.invalidRemoved++;
      }
    }

    // Step 2: Normalize serial numbers and remove duplicates
    const remainingAssets = await Asset.findAll({
      order: [['createdAt', 'ASC']]
    });

    if (normalizeSerials || removeDuplicates) {
      const serialMap = new Map();
      
      for (const asset of remainingAssets) {
        if (!asset.serialNumber) continue;
        
        // Normalize serial number
        const originalSerial = asset.serialNumber;
        const normalizedSerial = String(asset.serialNumber).trim().toLowerCase();
        
        if (normalizeSerials && originalSerial !== normalizedSerial) {
          await asset.update({ serialNumber: normalizedSerial });
          results.serialsNormalized++;
        }
        
        // Group by normalized serial for duplicate detection
        if (!serialMap.has(normalizedSerial)) {
          serialMap.set(normalizedSerial, []);
        }
        serialMap.get(normalizedSerial).push(asset);
      }

      // Remove duplicates
      if (removeDuplicates) {
        for (const [normalizedSerial, assets] of serialMap.entries()) {
          if (assets.length <= 1) continue;

          // Determine which asset to keep
          let assetToKeep;
          let assetsToDelete;

          if (keepStrategy === 'mostRecent') {
            assets.sort((a, b) => {
              const aDate = a.lastUpdated ? new Date(a.lastUpdated) : new Date(a.createdAt);
              const bDate = b.lastUpdated ? new Date(b.lastUpdated) : new Date(b.createdAt);
              return bDate - aDate;
            });
            assetToKeep = assets[0];
            assetsToDelete = assets.slice(1);
          } else if (keepStrategy === 'mostComplete') {
            assets.sort((a, b) => {
              const aFields = Object.values(a.toJSON()).filter(v => v && v !== '' && v !== null && v !== undefined).length;
              const bFields = Object.values(b.toJSON()).filter(v => v && v !== '' && v !== null && v !== undefined).length;
              return bFields - aFields;
            });
            assetToKeep = assets[0];
            assetsToDelete = assets.slice(1);
          } else {
            // oldest
            assets.sort((a, b) => {
              const aDate = new Date(a.createdAt);
              const bDate = new Date(b.createdAt);
              return aDate - bDate;
            });
            assetToKeep = assets[0];
            assetsToDelete = assets.slice(1);
          }

          // Delete duplicates
          for (const asset of assetsToDelete) {
            await AssetHistory.create({
              assetId: asset.id,
              action: 'DELETE',
              oldValue: JSON.stringify(asset.toJSON()),
              newValue: `Removed: Duplicate of ${assetToKeep.id}`,
              performedBy: req.userId
            });
            await asset.destroy();
            results.duplicatesRemoved++;
          }
        }
      }
    }

    // Step 3: Fix status field issues
    if (fixStatus) {
      const assetsToFix = await Asset.findAll({
        where: {
          [Op.or]: [
            { status: null },
            { status: '' },
            { status: { [Op.not]: ['Active', 'Inactive', 'Retired', 'Lost', 'Stolen'] } }
          ]
        }
      });

      for (const asset of assetsToFix) {
        // Default to 'Active' if status is invalid
        const newStatus = 'Active';
        await asset.update({ status: newStatus });
        results.statusFixed++;
      }
    }

    // Get final count
    const finalCount = await Asset.count();
    results.totalAfter = finalCount;

    res.json({
      message: 'Data cleanup completed successfully',
      results
    });
  } catch (error) {
    res.status(500).json({ message: 'Error during data cleanup', error: error.message });
  }
});module.exports = router;
