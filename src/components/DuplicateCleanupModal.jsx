import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Trash2, CheckCircle, RefreshCw, Database, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { api } from '../services/api';

const DuplicateCleanupModal = ({ onClose, onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [totalDuplicates, setTotalDuplicates] = useState(0);
  const [totalDuplicateAssets, setTotalDuplicateAssets] = useState(0);
  const [error, setError] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selectedToKeep, setSelectedToKeep] = useState(new Map()); // serialNumber -> assetId to keep
  const [deleting, setDeleting] = useState(new Set()); // assetIds being deleted

  useEffect(() => {
    loadDuplicates();
  }, []);

  const loadDuplicates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.assets.getDuplicates();
      setDuplicates(data.duplicates || []);
      setTotalDuplicates(data.totalDuplicates || 0);
      setTotalDuplicateAssets(data.totalDuplicateAssets || 0);
      
      // Initialize selectedToKeep with the first (most recent) asset for each group
      const initialSelections = new Map();
      data.duplicates?.forEach(group => {
        if (group.assets && group.assets.length > 0) {
          // Default to most recent (first in list, as backend sorts by lastUpdated DESC)
          initialSelections.set(group.serialNumber, group.assets[0].id);
        }
      });
      setSelectedToKeep(initialSelections);
    } catch (err) {
      console.error('Failed to load duplicates:', err);
      setError('Failed to load duplicates: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (serialNumber) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(serialNumber)) {
      newExpanded.delete(serialNumber);
    } else {
      newExpanded.add(serialNumber);
    }
    setExpandedGroups(newExpanded);
  };

  const handleSelectKeep = (serialNumber, assetId) => {
    const newSelections = new Map(selectedToKeep);
    newSelections.set(serialNumber, assetId);
    setSelectedToKeep(newSelections);
  };

  const handleDeleteDuplicate = async (assetId, serialNumber) => {
    if (!confirm(`Are you sure you want to delete this duplicate asset?`)) {
      return;
    }

    try {
      setDeleting(prev => new Set([...prev, assetId]));
      await api.assets.deleteDuplicate(assetId);
      
      // Remove from duplicates list
      setDuplicates(prev => prev.map(group => {
        if (group.serialNumber === serialNumber) {
          const updatedAssets = group.assets.filter(a => a.id !== assetId);
          if (updatedAssets.length <= 1) {
            // No more duplicates for this serial number, remove the group
            return null;
          }
          return {
            ...group,
            assets: updatedAssets,
            count: updatedAssets.length
          };
        }
        return group;
      }).filter(Boolean));

      // Update selectedToKeep if we deleted the selected one
      if (selectedToKeep.get(serialNumber) === assetId) {
        const group = duplicates.find(g => g.serialNumber === serialNumber);
        if (group && group.assets.length > 1) {
          const remaining = group.assets.filter(a => a.id !== assetId);
          if (remaining.length > 0) {
            setSelectedToKeep(prev => {
              const newMap = new Map(prev);
              newMap.set(serialNumber, remaining[0].id);
              return newMap;
            });
          }
        }
      }

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Failed to delete duplicate:', err);
      setError('Failed to delete duplicate: ' + err.message);
    } finally {
      setDeleting(prev => {
        const newSet = new Set(prev);
        newSet.delete(assetId);
        return newSet;
      });
    }
  };

  const handleBulkCleanup = async (keepStrategy) => {
    if (!confirm(`This will automatically delete duplicate assets, keeping the ${keepStrategy === 'mostRecent' ? 'most recent' : keepStrategy === 'mostComplete' ? 'most complete' : 'oldest'} one for each serial number. Continue?`)) {
      return;
    }

    try {
      setCleaning(true);
      setError(null);
      const result = await api.assets.cleanupDuplicates(keepStrategy);
      
      alert(`Cleanup completed! Deleted ${result.deleted} duplicate assets, kept ${result.kept} assets.`);
      
      // Reload duplicates
      await loadDuplicates();
      
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Failed to cleanup duplicates:', err);
      setError('Failed to cleanup duplicates: ' + err.message);
    } finally {
      setCleaning(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
    } catch {
      return dateString;
    }
  };

  const getFieldCount = (asset) => {
    return Object.values(asset).filter(v => v && v !== '' && v !== null && v !== undefined).length;
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Database className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Duplicate Assets Cleanup
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {totalDuplicates} serial numbers with duplicates ({totalDuplicateAssets} total duplicate assets)
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              <span className="ml-2 text-gray-500">Loading duplicates...</span>
            </div>
          ) : error && duplicates.length === 0 ? (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : duplicates.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Duplicates Found!</h3>
              <p className="text-gray-500 dark:text-gray-400">All assets have unique serial numbers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bulk Actions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Bulk Cleanup</h3>
                    <p className="text-xs text-blue-700 dark:text-blue-400">Automatically clean all duplicates using a strategy</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkCleanup('mostRecent')}
                      disabled={cleaning}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      {cleaning ? 'Cleaning...' : 'Keep Most Recent'}
                    </button>
                    <button
                      onClick={() => handleBulkCleanup('mostComplete')}
                      disabled={cleaning}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      {cleaning ? 'Cleaning...' : 'Keep Most Complete'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Duplicate Groups */}
              {duplicates.map((group) => {
                const isExpanded = expandedGroups.has(group.serialNumber);
                const keepAssetId = selectedToKeep.get(group.serialNumber);
                
                return (
                  <div
                    key={group.serialNumber}
                    className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden"
                  >
                    {/* Group Header */}
                    <div
                      className="bg-gray-50 dark:bg-slate-700/50 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      onClick={() => toggleExpand(group.serialNumber)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-gray-900 dark:text-white">
                                {group.serialNumber}
                              </span>
                              <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-bold">
                                {group.count} duplicates
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Click to {isExpanded ? 'collapse' : 'expand'} and compare
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Delete all except the selected one
                            const assetsToDelete = group.assets.filter(a => a.id !== keepAssetId);
                            if (confirm(`Delete ${assetsToDelete.length} duplicate(s) and keep the selected one?`)) {
                              assetsToDelete.forEach(asset => {
                                handleDeleteDuplicate(asset.id, group.serialNumber);
                              });
                            }
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                          Delete Others
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="p-4 space-y-3">
                        {group.assets.map((asset, index) => {
                          const isSelected = asset.id === keepAssetId;
                          const isDeleting = deleting.has(asset.id);
                          
                          return (
                            <div
                              key={asset.id}
                              className={`border-2 rounded-lg p-4 transition-all ${
                                isSelected
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                              } ${isDeleting ? 'opacity-50' : ''}`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => handleSelectKeep(group.serialNumber, asset.id)}
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                      isSelected
                                        ? 'border-green-500 bg-green-500'
                                        : 'border-gray-300 hover:border-green-400'
                                    }`}
                                  >
                                    {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                                  </button>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {isSelected ? '✓ Keep This Asset' : 'Duplicate Asset'}
                                      </span>
                                      {isSelected && (
                                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-semibold">
                                          SELECTED
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      ID: {asset.id} • Fields: {getFieldCount(asset)}
                                    </p>
                                  </div>
                                </div>
                                {!isSelected && (
                                  <button
                                    onClick={() => handleDeleteDuplicate(asset.id, group.serialNumber)}
                                    disabled={isDeleting}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                  >
                                    {isDeleting ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Deleting...
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* Asset Details Grid */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Computer Name</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {asset.computerName || <span className="text-gray-400 italic">N/A</span>}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Assigned User</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {asset.assignedUser || <span className="text-gray-400 italic">Unassigned</span>}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{asset.status || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Updated</p>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {formatDate(asset.lastUpdated || asset.createdAt)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Model</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{asset.model || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Department</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{asset.department || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Location</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{asset.location || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Source</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{asset.vendor || 'N/A'}</p>
                                </div>
                              </div>

                              {/* Compliance Flags */}
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                                {asset.mdmEnrolled && (
                                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold">
                                    MDM
                                  </span>
                                )}
                                {asset.s1Active && (
                                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-semibold">
                                    S1
                                  </span>
                                )}
                                {asset.oktaEnrolled && (
                                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-semibold">
                                    Okta
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-slate-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateCleanupModal;

