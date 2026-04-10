import React, { useState } from 'react';
import { 
  Trash2, 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Edit, 
  Filter,
  Save,
  RotateCcw
} from 'lucide-react';
import { api } from '../services/api';
import DataCleanupModal from './DataCleanupModal';
import DuplicateCleanupModal from './DuplicateCleanupModal';

const SettingsView = ({ onLoadAssets }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  
  // Bulk Update State
  const [bulkField, setBulkField] = useState('status');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkFilters, setBulkFilters] = useState({ status: 'all', deviceType: 'all' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(null);

  const handleDeleteAll = async () => {
    try {
      setIsDeleting(true);
      await api.assets.deleteAll();
      setDeleteSuccess(true);
      setShowDeleteConfirm(false);
      if (onLoadAssets) onLoadAssets();
      setTimeout(() => setDeleteSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to delete all assets:', err);
      alert('Failed to delete assets: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkValue) {
      alert('Please enter a value to update.');
      return;
    }
    
    if (!confirm(`Are you sure you want to update ${bulkField} to "${bulkValue}" for matching assets?`)) {
      return;
    }

    try {
      setIsUpdating(true);
      const result = await api.assets.bulkUpdate(bulkField, bulkValue, bulkFilters);
      setUpdateSuccess(`Updated ${result.count} assets successfully.`);
      if (onLoadAssets) onLoadAssets();
      setTimeout(() => setUpdateSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to bulk update:', err);
      alert('Failed to update: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

    
    const [validationReport, setValidationReport] = useState(null);
    const [isValidating, setIsValidating] = useState(false);
  
    const runValidation = async () => {
      try {
        setIsValidating(true);
        const report = await api.assets.checkIntegrity();
        setValidationReport(report);
      } catch (error) {
        console.error('Validation failed:', error);
        alert('Failed to run validation: ' + error.message);
      } finally {
        setIsValidating(false);
      }
    };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings & Data Management</h2>
        <p className="text-gray-500 dark:text-gray-400">Manage your asset database, perform bulk operations, and maintain data hygiene.</p>
      </div>

      {/* Data Validation Section */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Data Validation</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Run integrity checks to ensure data correctness</p>
          </div>
        </div>
        
        <div className="p-6">
          {!validationReport ? (
            <div className="text-center py-8">
              <div className="mb-4 text-gray-500 dark:text-gray-400">
                Run a comprehensive scan to detect anomalies like future purchase dates, invalid emails, and logical inconsistencies.
              </div>
              <button
                onClick={runValidation}
                disabled={isValidating}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 mx-auto"
              >
                {isValidating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Run Integrity Check
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-xl border-l-4 ${validationReport.futurePurchaseDates > 0 ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-300'}`}>
                  <div className="text-sm text-gray-500">Future Purchase Dates</div>
                  <div className="text-2xl font-bold">{validationReport.futurePurchaseDates}</div>
                </div>
                <div className={`p-4 rounded-xl border-l-4 ${validationReport.invalidEmails > 0 ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-300'}`}>
                  <div className="text-sm text-gray-500">Invalid Emails</div>
                  <div className="text-2xl font-bold">{validationReport.invalidEmails}</div>
                </div>
                <div className={`p-4 rounded-xl border-l-4 ${validationReport.negativeCosts > 0 ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-300'}`}>
                  <div className="text-sm text-gray-500">Negative Costs</div>
                  <div className="text-2xl font-bold">{validationReport.negativeCosts}</div>
                </div>
                <div className={`p-4 rounded-xl border-l-4 ${validationReport.statusInconsistencies > 0 ? 'bg-red-50 border-red-500' : 'bg-gray-50 border-gray-300'}`}>
                  <div className="text-sm text-gray-500">Status Issues</div>
                  <div className="text-2xl font-bold">{validationReport.statusInconsistencies}</div>
                </div>
              </div>

              {validationReport.details.length > 0 && (
                <div className="mt-4">
                   <h4 className="font-semibold mb-2">Detailed Issues:</h4>
                   <div className="max-h-60 overflow-y-auto bg-gray-50 dark:bg-slate-900 rounded-xl p-4 text-sm font-mono">
                     {validationReport.details.map((item, idx) => (
                       <div key={idx} className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                         <span className="font-bold">{item.serialNumber || 'No Serial'}</span> (ID: {item.id}): {item.issues.join(', ')}
                       </div>
                     ))}
                   </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                 <button
                    onClick={() => setValidationReport(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                 >
                   Clear Report
                 </button>
                 <button
                    onClick={runValidation}
                    disabled={isValidating}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                 >
                    <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
                    Re-run Check
                 </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Data Hygiene</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tools to clean and repair your asset data</p>
          </div>
        </div>
        
        <div className="p-6 grid md:grid-cols-2 gap-6">
          <button
            onClick={() => setShowCleanupModal(true)}
            className="flex flex-col items-center p-6 bg-gray-50 dark:bg-slate-700/50 rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/20 border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-700 transition-all group text-center"
          >
            <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Data Cleanup & Repair</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fix formatting, normalize serial numbers, and remove invalid entries</p>
          </button>

          <button
            onClick={() => setShowDuplicateModal(true)}
            className="flex flex-col items-center p-6 bg-gray-50 dark:bg-slate-700/50 rounded-2xl hover:bg-orange-50 dark:hover:bg-orange-900/20 border-2 border-transparent hover:border-orange-200 dark:hover:border-orange-700 transition-all group text-center"
          >
            <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Remove Duplicates</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Find and merge duplicate assets based on serial number</p>
          </button>
        </div>
      </div>

      {/* Bulk Operations Section */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
            <Edit className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Operations</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Update multiple assets at once</p>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                1. Select Field to Update
              </label>
              <select
                value={bulkField}
                onChange={(e) => setBulkField(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="status">Status</option>
                <option value="location">Location</option>
                <option value="department">Department</option>
                <option value="vendor">Vendor</option>
                <option value="deviceType">Device Type</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                2. Enter New Value
              </label>
              <input
                type="text"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={`Enter new ${bulkField}...`}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-slate-700/30 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Optional: Apply Filters (leave as 'All' to update everything)
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Current Status</label>
                <select
                  value={bulkFilters.status}
                  onChange={(e) => setBulkFilters({...bulkFilters, status: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Retired">Retired</option>
                  <option value="Lost">Lost</option>
                  <option value="Stolen">Stolen</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Device Type</label>
                <select
                  value={bulkFilters.deviceType}
                  onChange={(e) => setBulkFilters({...bulkFilters, deviceType: e.target.value})}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="Windows">Windows</option>
                  <option value="Mac">Mac</option>
                  <option value="Linux">Linux</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {updateSuccess ? (
              <div className="text-green-600 dark:text-green-400 flex items-center gap-2 font-medium bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                {updateSuccess}
              </div>
            ) : (
              <div></div>
            )}
            <button
              onClick={handleBulkUpdate}
              disabled={isUpdating || !bulkValue}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center gap-2"
            >
              {isUpdating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Apply Bulk Update
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl shadow-sm border border-red-100 dark:border-red-900/30 overflow-hidden">
        <div className="p-6 border-b border-red-100 dark:border-red-900/30 flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-red-900 dark:text-red-100">Danger Zone</h3>
            <p className="text-sm text-red-700 dark:text-red-300">Irreversible actions</p>
          </div>
        </div>
        
        <div className="p-6 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">Delete All Assets</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Permanently delete the entire asset database. This cannot be undone.</p>
          </div>
          
          {deleteSuccess ? (
            <div className="flex items-center gap-2 text-green-600 font-bold px-4 py-2">
              <CheckCircle className="w-5 h-5" />
              Deleted Successfully
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-6 py-3 bg-white dark:bg-slate-800 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl font-bold transition-all flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Delete All Data
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">Delete Everything?</h3>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-6">
              This will permanently delete ALL assets from the database. This action cannot be undone. Are you absolutely sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {showCleanupModal && (
        <DataCleanupModal
          onClose={() => setShowCleanupModal(false)}
          onComplete={() => {
            if (onLoadAssets) onLoadAssets();
          }}
        />
      )}

      {showDuplicateModal && (
        <DuplicateCleanupModal
          onClose={() => setShowDuplicateModal(false)}
          onComplete={() => {
            if (onLoadAssets) onLoadAssets();
          }}
        />
      )}
    </div>
  );
};

export default SettingsView;
