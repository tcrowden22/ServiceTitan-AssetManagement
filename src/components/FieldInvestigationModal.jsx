import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Clock, User, Building, MapPin, FileText, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

const FieldInvestigationModal = ({ asset, fieldName, onClose, onUpdate }) => {
  const [fieldAssignment, setFieldAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const fieldLabels = {
    assignedUser: { label: 'Assigned User', icon: User },
    department: { label: 'Department', icon: Building },
    location: { label: 'Location', icon: MapPin },
    firstName: { label: 'First Name', icon: User },
    lastName: { label: 'Last Name', icon: User },
    status: { label: 'Status', icon: FileText }
  };

  const fieldInfo = fieldLabels[fieldName] || { label: fieldName, icon: FileText };
  const Icon = fieldInfo.icon;

  useEffect(() => {
    loadFieldAssignment();
  }, [asset?.id, fieldName]);

  const loadFieldAssignment = async () => {
    if (!asset?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.assets.getFieldAssignment(asset.id, fieldName);
      setFieldAssignment(data);
    } catch (err) {
      console.error('Failed to load field assignment:', err);
      setError('Failed to load field assignment data');
      // Create a default assignment if none exists
      setFieldAssignment({
        currentValue: asset[fieldName] || '',
        source: 'unknown',
        reasoning: 'No assignment data available',
        alternatives: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAlternative = async (alternative) => {
    if (!asset?.id) return;
    
    try {
      setUpdating(true);
      setError(null);
      
      await api.assets.updateFieldAssignment(
        asset.id,
        fieldName,
        alternative.value,
        alternative.source,
        alternative.sourceField
      );
      
      // Reload field assignment
      await loadFieldAssignment();
      
      // Notify parent to refresh asset
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to update field:', err);
      setError('Failed to update field: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const getSourceLabel = (source) => {
    const labels = {
      'sentinelone': 'SentinelOne',
      'okta-fastpass': 'Okta',
      'endpoint-central': 'Endpoint Central',
      'cdw': 'CDW',
      'manual': 'Manual',
      'existing': 'Existing',
      'unknown': 'Unknown'
    };
    return labels[source] || source;
  };

  const getSourceColor = (source) => {
    const colors = {
      'sentinelone': 'bg-green-100 text-green-700',
      'okta-fastpass': 'bg-purple-100 text-purple-700',
      'endpoint-central': 'bg-blue-100 text-blue-700',
      'cdw': 'bg-yellow-100 text-yellow-700',
      'manual': 'bg-gray-100 text-gray-700',
      'existing': 'bg-gray-100 text-gray-700',
      'unknown': 'bg-gray-100 text-gray-500'
    };
    return colors[source] || 'bg-gray-100 text-gray-700';
  };

  const currentValue = fieldAssignment?.currentValue || asset?.[fieldName] || '';
  const alternatives = fieldAssignment?.alternatives || [];
  const hasAlternatives = alternatives.length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Field Investigation: {fieldInfo.label}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Serial: {asset?.serialNumber || 'N/A'}
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
              <span className="ml-2 text-gray-500">Loading...</span>
            </div>
          ) : error && !fieldAssignment ? (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Value */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Current Value
                </h3>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {currentValue || <span className="text-gray-400 italic">(empty)</span>}
                    </span>
                    {fieldAssignment?.source && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSourceColor(fieldAssignment.source)}`}>
                        {getSourceLabel(fieldAssignment.source)}
                      </span>
                    )}
                  </div>
                  {fieldAssignment?.sourceField && fieldAssignment.sourceField !== 'existing' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Source Field: {fieldAssignment.sourceField}
                    </p>
                  )}
                  {fieldAssignment?.reasoning && (
                    <div className="mt-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {fieldAssignment.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Alternatives */}
              {hasAlternatives ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Alternative Options ({alternatives.length})
                  </h3>
                  <div className="space-y-2">
                    {alternatives.map((alt, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 border border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-medium text-gray-900 dark:text-white">
                            {alt.value || <span className="text-gray-400 italic">(empty)</span>}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSourceColor(alt.source)}`}>
                            {getSourceLabel(alt.source)}
                          </span>
                        </div>
                        {alt.sourceField && alt.sourceField !== 'existing' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            Source Field: {alt.sourceField}
                          </p>
                        )}
                        <button
                          onClick={() => handleSelectAlternative(alt)}
                          disabled={updating}
                          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          {updating ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Use This Value
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No alternative options available for this field.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}
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

export default FieldInvestigationModal;

