import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, User, Building, MapPin, FileText, Calendar, DollarSign, Laptop, Smartphone, Search, AlertCircle, Monitor, Keyboard, Mouse, Headphones } from 'lucide-react';
import { api } from '../services/api';

const EditAssetModal = ({ asset, onClose, onSave }) => {
  const [formData, setFormData] = useState({ ...asset });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Employee search state
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    // Load initial employees list
    loadEmployees();
  }, []);

  useEffect(() => {
    // Update formData when employee search term changes (if user is typing manually)
    if (showEmployeeDropdown) {
      // Don't update assignedUser while searching, only on selection
    }
  }, [employeeSearchTerm]);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const list = await api.assets.getEmployees();
      setEmployees(list.slice(0, 200)); // Limit for performance
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!employeeSearchTerm) return employees.slice(0, 10);
    const lowerTerm = employeeSearchTerm.toLowerCase();
    return employees.filter(e => 
      (e.email && e.email.toLowerCase().includes(lowerTerm)) || 
      (e.fullName && e.fullName.toLowerCase().includes(lowerTerm))
    ).slice(0, 15);
  }, [employees, employeeSearchTerm]);

  const validateAsset = (data) => {
    const errors = [];
    if (!data.serialNumber || data.serialNumber.trim() === '') {
      errors.push('Serial number is required');
    }
    
    // Validate device type if standard types
    const validTypes = ['Windows', 'Mac', 'Linux', 'Monitor', 'Keyboard', 'Mouse', 'Headset', 'Phone', 'Custom'];
    if (data.deviceType && data.deviceType.trim() !== '' && !validTypes.includes(data.deviceType)) {
      // Allow custom types if needed, but warn? For now, enforce list if selected from dropdown, but allow text if custom
    }

    if (data.purchaseCost !== undefined && data.purchaseCost !== null && data.purchaseCost !== '') {
      const cost = typeof data.purchaseCost === 'string' 
        ? parseFloat(data.purchaseCost.toString().replace(/[$,\s]/g, ''))
        : data.purchaseCost;
      if (isNaN(cost) || cost < 0) {
        errors.push('Purchase cost must be a valid positive number');
      }
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validationErrors = validateAsset(formData);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      setError('Failed to save: ' + err.message);
      setSaving(false);
    }
  };

  const handleEmployeeSelect = (email) => {
    setFormData({ ...formData, assignedUser: email });
    setEmployeeSearchTerm('');
    setShowEmployeeDropdown(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Edit Asset
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Update asset details and assignment</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form id="edit-asset-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Primary Info */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
                <Laptop className="w-4 h-4" /> Device Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Serial Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.serialNumber || ''}
                    onChange={(e) => setFormData({...formData, serialNumber: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Computer Name</label>
                  <input
                    type="text"
                    value={formData.computerName || ''}
                    onChange={(e) => setFormData({...formData, computerName: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Asset Tag</label>
                  <input
                    type="text"
                    value={formData.assetTag || ''}
                    onChange={(e) => setFormData({...formData, assetTag: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Device Type</label>
                  <select
                    value={formData.deviceType || ''}
                    onChange={(e) => setFormData({...formData, deviceType: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  >
                    <option value="">Select Type...</option>
                    <option value="Windows">Windows</option>
                    <option value="Mac">Mac</option>
                    <option value="Linux">Linux</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Keyboard">Keyboard</option>
                    <option value="Mouse">Mouse</option>
                    <option value="Headset">Headset</option>
                    <option value="Phone">Phone</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Manufacturer</label>
                  <input
                    type="text"
                    value={formData.manufacturer || ''}
                    onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Model</label>
                  <input
                    type="text"
                    value={formData.model || ''}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Assignment & Location */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
                <User className="w-4 h-4" /> Assignment & Location
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="relative">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Assigned User</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.assignedUser || ''}
                      onChange={(e) => {
                        setFormData({...formData, assignedUser: e.target.value});
                        setEmployeeSearchTerm(e.target.value);
                        setShowEmployeeDropdown(true);
                      }}
                      onFocus={() => {
                        setEmployeeSearchTerm(formData.assignedUser || '');
                        setShowEmployeeDropdown(true);
                      }}
                      placeholder="Search or enter email..."
                      className="w-full px-3 py-2 pl-9 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                  
                  {/* Employee Dropdown */}
                  {showEmployeeDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowEmployeeDropdown(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 max-h-60 overflow-y-auto z-20">
                        {loadingEmployees ? (
                          <div className="p-4 text-center text-gray-500 text-xs">Loading...</div>
                        ) : filteredEmployees.length > 0 ? (
                          filteredEmployees.map(emp => (
                            <button
                              key={emp.email}
                              type="button"
                              onClick={() => handleEmployeeSelect(emp.email)}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex flex-col"
                            >
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{emp.fullName || emp.email.split('@')[0]}</span>
                              <span className="text-xs text-gray-500">{emp.email}</span>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-gray-500 text-xs">No employees found</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Department</label>
                  <input
                    type="text"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Location</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Status</label>
                  <select
                    value={formData.status || 'Active'}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Storage">Storage</option>
                    <option value="Retired">Retired</option>
                    <option value="Broken">Broken</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Purchase Info */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Purchase Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Purchase Cost</label>
                  <input
                    type="text"
                    value={formData.purchaseCost || ''}
                    onChange={(e) => setFormData({...formData, purchaseCost: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Purchase Date</label>
                  <input
                    type="text"
                    value={formData.purchaseDate || ''}
                    onChange={(e) => setFormData({...formData, purchaseDate: e.target.value})}
                    placeholder="YYYY-MM-DD"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Vendor / Source</label>
                  <input
                    type="text"
                    value={formData.vendor || ''}
                    onChange={(e) => setFormData({...formData, vendor: e.target.value})}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Compliance Flags */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Compliance & Security
              </h3>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.mdmEnrolled ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                    {formData.mdmEnrolled && <X className="w-3 h-3 text-white rotate-45" style={{ transform: 'rotate(0deg)' }}><path d="M20 6L9 17l-5-5"/></X>} 
                    {/* Lucide Check icon is not exported as 'Check', using manual path or just Check from lucide if available. 
                        Wait, I imported X but not Check. Let me use X rotated or just import Check. 
                        Actually I imported 'CheckCircle' in App.jsx but here I need a checkbox.
                        I'll just use a native checkbox for simplicity but styled.
                    */}
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.mdmEnrolled || false}
                      onChange={(e) => setFormData({...formData, mdmEnrolled: e.target.checked})}
                    />
                    <svg className={`w-3.5 h-3.5 text-white ${formData.mdmEnrolled ? 'block' : 'hidden'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 transition-colors">MDM Enrolled</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.s1Active ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'}`}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.s1Active || false}
                      onChange={(e) => setFormData({...formData, s1Active: e.target.checked})}
                    />
                    <svg className={`w-3.5 h-3.5 text-white ${formData.s1Active ? 'block' : 'hidden'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-green-600 transition-colors">SentinelOne Active</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.oktaEnrolled ? 'bg-purple-600 border-purple-600' : 'bg-white border-gray-300'}`}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.oktaEnrolled || false}
                      onChange={(e) => setFormData({...formData, oktaEnrolled: e.target.checked})}
                    />
                    <svg className={`w-3.5 h-3.5 text-white ${formData.oktaEnrolled ? 'block' : 'hidden'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 transition-colors">Okta Enrolled</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex justify-end gap-3 rounded-b-3xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-600 transition-all"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditAssetModal;


