import React, { useState } from 'react';
import { X, Database, AlertTriangle, CheckCircle, RefreshCw, Trash2, Wrench } from 'lucide-react';
import { api } from '../services/api';

const DataCleanupModal = ({ onClose, onComplete }) => {
  const [cleaning, setCleaning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState({
    removeDuplicates: true,
    normalizeSerials: true,
    fixStatus: true,
    removeInvalid: true,
    keepStrategy: 'mostRecent' // 'mostRecent', 'mostComplete', 'oldest'
  });

  const handleCleanup = async () => {
    if (!confirm('This will clean and repair your asset data. This action cannot be undone. Continue?')) {
      return;
    }

    try {
      setCleaning(true);
      setError(null);
      setResults(null);

      const result = await api.assets.cleanupData(options);
      setResults(result.results);
      
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Failed to cleanup data:', err);
      setError('Failed to cleanup data: ' + err.message);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Wrench className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Data Cleanup & Repair
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Clean and repair corrupted asset data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!results ? (
            <div className="space-y-6">
              {/* Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-1">
                      Important Warning
                    </h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-400">
                      This operation will permanently modify your database. Make sure you have a backup before proceeding. 
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Cleanup Options</h3>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={options.removeDuplicates}
                      onChange={(e) => setOptions({...options, removeDuplicates: e.target.checked})}
                      className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Remove Duplicate Assets</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Remove duplicate assets with the same serial number (case-insensitive)
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={options.normalizeSerials}
                      onChange={(e) => setOptions({...options, normalizeSerials: e.target.checked})}
                      className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Normalize Serial Numbers</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Convert all serial numbers to lowercase and trim whitespace
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={options.fixStatus}
                      onChange={(e) => setOptions({...options, fixStatus: e.target.checked})}
                      className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Fix Invalid Status Fields</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Set invalid or missing status fields to 'Active'
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={options.removeInvalid}
                      onChange={(e) => setOptions({...options, removeInvalid: e.target.checked})}
                      className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Remove Invalid Assets</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Delete assets without serial numbers
                      </div>
                    </div>
                  </label>
                </div>

                {/* Keep Strategy */}
                {options.removeDuplicates && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      When removing duplicates, keep:
                    </label>
                    <select
                      value={options.keepStrategy}
                      onChange={(e) => setOptions({...options, keepStrategy: e.target.value})}
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
                    >
                      <option value="mostRecent">Most Recent (by lastUpdated)</option>
                      <option value="mostComplete">Most Complete (most fields filled)</option>
                      <option value="oldest">Oldest (by createdAt)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Results */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Cleanup completed successfully!</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Processed</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{results.totalProcessed}</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total After Cleanup</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{results.totalAfter}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                  <div className="text-sm text-red-600 dark:text-red-400 mb-1">Duplicates Removed</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{results.duplicatesRemoved}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Serials Normalized</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{results.serialsNormalized}</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                  <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-1">Status Fixed</div>
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{results.statusFixed}</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
                  <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">Invalid Removed</div>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{results.invalidRemoved}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-slate-700 p-4 flex justify-end gap-3">
          {!results ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                {cleaning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Run Cleanup
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataCleanupModal;

