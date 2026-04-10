import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, AlertCircle, CheckCircle, XCircle, Package, DollarSign, Users, Upload, FileText, Shield, Laptop, Smartphone, TrendingUp, Activity, Server, Edit, Trash2, Save, User, X, LogOut, Database, ArrowRight, Sun, Moon, Info, AlertTriangle, Ticket, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import Login from './components/Login';
import Register from './components/Register';
import { api } from './services/api';
import HistoryTimeline from './components/HistoryTimeline';
import FieldInvestigationModal from './components/FieldInvestigationModal';
import DuplicateCleanupModal from './components/DuplicateCleanupModal';
import DataCleanupModal from './components/DataCleanupModal';
import EditAssetModal from './components/EditAssetModal';
import SettingsView from './components/SettingsView';
import ImportsView from './components/ImportsView';

const STORAGE_KEY = 'asset-management-data'; // Kept for migration logic

const AssetManagementApp = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [authView, setAuthView] = useState('login');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState(null);

  const [assets, setAssets] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState('source');
  const [selectedSource, setSelectedSource] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState({ new: 0, updated: 0, total: 0, skipped: 0 });
  const [bulkImportOverrides, setBulkImportOverrides] = useState({});
  const [showBulkImportEdit, setShowBulkImportEdit] = useState(false);
  const [filters, setFilters] = useState({
    deviceType: 'all',
    status: 'all',
    complianceIssue: 'all',
    healthScore: 'all' // 'all', 'critical' (<50%), 'warning' (50-99%), 'healthy' (100%)
  });
  const [error, setError] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all'); // 'all', 'multiple', 'single', 'unassigned'
  const [expandedInvestigation, setExpandedInvestigation] = useState(null); // 'multipleAssets', 'unassigned', etc.
  const [selectedAssetIds, setSelectedAssetIds] = useState(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); // New state for single edit modal
  const [bulkEditForm, setBulkEditForm] = useState({});
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [showInvestigationModal, setShowInvestigationModal] = useState(null); // { assetId, fieldName }
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showDataCleanupModal, setShowDataCleanupModal] = useState(false);
  const [editEmployees, setEditEmployees] = useState([]);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeeSearchDebounce, setEmployeeSearchDebounce] = useState('');
  
  // Debounce the search term to avoid filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setEmployeeSearchDebounce(editFormData.assignedUser || '');
    }, 150); // 150ms debounce
    
    return () => clearTimeout(timer);
  }, [editFormData.assignedUser]);
  
  // Memoized filtered employees - only recalculate when debounced search changes
  const filteredEditEmployees = useMemo(() => {
    if (!showEmployeeDropdown || editEmployees.length === 0) return [];
    
    const search = employeeSearchDebounce.toLowerCase().trim();
    
    // If no search, just return first 15 (reduced for performance)
    if (!search) {
      return editEmployees.slice(0, 15);
    }
    
    // Very optimized filtering - single pass, early exit
    const results = [];
    const searchLower = search;
    const maxResults = 15; // Reduced from 20
    
    // Pre-filter: only check employees if search is at least 1 character
    if (searchLower.length === 0) {
      return editEmployees.slice(0, maxResults);
    }
    
    // Fast path: if search looks like email (contains @), prioritize email matches
    const isEmailSearch = searchLower.includes('@');
    
    for (let i = 0; i < editEmployees.length && results.length < maxResults; i++) {
      const emp = editEmployees[i];
      
      // Quick email check first (most common case)
      if (isEmailSearch) {
        const email = (emp.email || '').toLowerCase();
        if (email.includes(searchLower)) {
          results.push(emp);
          continue;
        }
      }
      
      // Check other fields only if email didn't match
      const email = (emp.email || '').toLowerCase();
      const fullName = (emp.fullName || '').toLowerCase();
      
      if (email.includes(searchLower) || fullName.includes(searchLower)) {
        results.push(emp);
        continue;
      }
      
      // Only check first/last name if search is longer (more specific)
      if (searchLower.length > 2) {
        const firstName = (emp.firstName || '').toLowerCase();
        const lastName = (emp.lastName || '').toLowerCase();
        if (firstName.includes(searchLower) || lastName.includes(searchLower)) {
          results.push(emp);
        }
      }
    }
    
    return results;
  }, [employeeSearchDebounce, editEmployees, showEmployeeDropdown]);
  
  // Lifecycle Modal States
  const [showCheckOutModal, setShowCheckOutModal] = useState(null);
  const [showCheckInModal, setShowCheckInModal] = useState(null);
  const [checkOutUser, setCheckOutUser] = useState('');

  // Load assets from localStorage on mount
  // Load assets from API when user is logged in
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      setAuthView('login');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout]);

  useEffect(() => {
    if (user) {
      loadAssets();
    }
  }, [user]);

  // Close employee dropdown when clicking outside (non-blocking)
  useEffect(() => {
    if (!showEmployeeDropdown) return;

    const handleClickOutside = (event) => {
      // Check if click is outside the employee picker container
      const isInPicker = event.target.closest('.employee-picker-container');
      if (!isInPicker) {
        // Use setTimeout to avoid blocking the click event
        setTimeout(() => {
          setShowEmployeeDropdown(false);
        }, 0);
      }
    };

    // Use capture phase but don't prevent default or stop propagation
    document.addEventListener('mousedown', handleClickOutside, false);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, false);
    };
  }, [showEmployeeDropdown]);

  const loadAssets = async () => {
    try {
      setIsProcessing(true);
      const data = await api.assets.getAll();
      setAssets(data);
    } catch (err) {
      console.error('Failed to load assets', err);
      setError('Failed to load assets from server');
    } finally {
      setIsProcessing(false);
    }
  };

  // Migration function
  const handleMigration = async () => {
    try {
      setIsMigrating(true);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setMigrationStatus('No local data found to migrate.');
        return;
      }
      
      const localAssets = JSON.parse(stored);
      if (!Array.isArray(localAssets) || localAssets.length === 0) {
        setMigrationStatus('Local data is empty.');
        return;
      }

      await api.assets.migrate(localAssets);
      setMigrationStatus(`Successfully migrated ${localAssets.length} assets!`);
      loadAssets(); // Reload from server
      
      // Optional: Clear local storage after successful migration
      // localStorage.removeItem(STORAGE_KEY); 
    } catch (err) {
      setMigrationStatus('Migration failed: ' + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  // Data validation function
  const validateAsset = (asset) => {
    const errors = [];
    
    if (!asset.serialNumber || asset.serialNumber.trim() === '') {
      errors.push('Serial number is required');
    }
    
    if (asset.deviceType && asset.deviceType.trim() !== '' && !['Windows', 'Mac', 'Linux', 'Monitor', 'Keyboard', 'Mouse', 'Headset', 'Phone', 'Custom'].includes(asset.deviceType)) {
      errors.push('Device type must be Windows, Mac, Linux, Monitor, Keyboard, Mouse, Headset, Phone, or Custom');
    }
    
    // Only validate status if it's provided and not empty
    if (asset.status && asset.status.trim() !== '' && !['Active', 'Storage', 'Retired'].includes(asset.status)) {
      errors.push('Status must be Active, Storage, or Retired');
    }
    
    if (asset.purchaseCost !== undefined && asset.purchaseCost !== null && asset.purchaseCost !== '') {
      const cost = typeof asset.purchaseCost === 'string' 
        ? parseFloat(asset.purchaseCost.toString().replace(/[$,\s]/g, ''))
        : asset.purchaseCost;
      if (isNaN(cost) || cost < 0) {
        errors.push('Purchase cost must be a valid positive number');
      }
    }
    
    return errors;
  };

  const stats = useMemo(() => {
    try {
      // Safety check: ensure assets is an array
      if (!Array.isArray(assets)) {
        console.error('Assets is not an array:', typeof assets, assets);
        return { 
          total: 0, 
          deployed: 0, 
          totalValue: 0, 
          mdmCompliance: 0, 
          s1Compliance: 0, 
          oktaCompliance: 0, 
          issues: { noMdm: 0, noS1: 0, noOkta: 0, unassigned: 0, multipleAssets: 0 },
          healthScore: { average: 0, critical: 0, warning: 0, healthy: 0 }
        };
      }
      
      // Filter out invalid assets (no serial number)
      const validAssets = assets.filter(a => {
        if (!a || typeof a !== 'object') return false;
        if (!a.serialNumber || typeof a.serialNumber !== 'string') return false;
        return a.serialNumber.trim() !== '';
      });
      
      // Deduplicate by normalized serial number (case-insensitive, trimmed)
      // This ensures we count unique assets, not duplicates
      const uniqueAssetsMap = new Map();
      validAssets.forEach(asset => {
        const normalizedSerial = String(asset.serialNumber).trim().toLowerCase();
        if (!normalizedSerial) return;
        
        // If we haven't seen this serial, add it
        // If we have, keep the one with more data or more recent update
        if (!uniqueAssetsMap.has(normalizedSerial)) {
          uniqueAssetsMap.set(normalizedSerial, asset);
        } else {
          const existing = uniqueAssetsMap.get(normalizedSerial);
          // Keep the one with more fields or more recent update
          const existingFields = Object.values(existing).filter(v => v && v !== '' && v !== null && v !== undefined).length;
          const newFields = Object.values(asset).filter(v => v && v !== '' && v !== null && v !== undefined).length;
          const existingDate = existing.lastUpdated ? new Date(existing.lastUpdated) : new Date(existing.createdAt || 0);
          const newDate = asset.lastUpdated ? new Date(asset.lastUpdated) : new Date(asset.createdAt || 0);
          
          if (newFields > existingFields || (newFields === existingFields && newDate > existingDate)) {
            uniqueAssetsMap.set(normalizedSerial, asset);
          }
        }
      });
      
      const uniqueAssets = Array.from(uniqueAssetsMap.values());
      const total = uniqueAssets.length;
      
      // Safety check: deployed should never exceed total
      // Normalize status comparison to handle case variations
      const deployedCount = uniqueAssets.filter(a => {
        if (!a) return false;
        const status = a.status ? String(a.status).trim().toLowerCase() : '';
        return status === 'active';
      }).length;
      
      // Safety check: deployed can never exceed total
      const deployed = Math.min(deployedCount, total);
      
      // Debug logging if something seems wrong
      if (deployedCount > total) {
        console.warn('Deployed count exceeds total!', { 
          total, 
          deployedCount, 
          uniqueAssetsCount: uniqueAssets.length,
          sampleStatuses: uniqueAssets.slice(0, 10).map(a => a.status)
        });
      }
      const totalValue = uniqueAssets.reduce((sum, a) => sum + ((a.purchaseCost) || 0), 0);
      const mdmCompliance = total > 0 ? ((uniqueAssets.filter(a => Boolean(a.mdmEnrolled)).length / total) * 100).toFixed(1) : 0;
      const s1Compliance = total > 0 ? ((uniqueAssets.filter(a => Boolean(a.s1Active)).length / total) * 100).toFixed(1) : 0;
      const oktaCompliance = total > 0 ? ((uniqueAssets.filter(a => Boolean(a.oktaEnrolled)).length / total) * 100).toFixed(1) : 0;
      
      // Count employees with multiple assets (using unique assets)
      const userAssetCount = new Map();
      uniqueAssets.forEach(asset => {
        if (asset.assignedUser && asset.assignedUser.trim() !== '') {
          const email = asset.assignedUser.trim().toLowerCase();
          userAssetCount.set(email, (userAssetCount.get(email) || 0) + 1);
        }
      });
      const employeesWithMultipleAssets = Array.from(userAssetCount.values()).filter(count => count >= 2).length;
      
      const issues = {
        noMdm: uniqueAssets.filter(a => {
          const isActive = a.status === 'Active';
          const hasMdm = Boolean(a.mdmEnrolled);
          return isActive && !hasMdm;
        }).length,
        noS1: uniqueAssets.filter(a => {
          const isActive = a.status === 'Active';
          const hasS1 = Boolean(a.s1Active);
          return isActive && !hasS1;
        }).length,
        noOkta: uniqueAssets.filter(a => {
          const isActive = a.status === 'Active';
          const hasOkta = Boolean(a.oktaEnrolled);
          return isActive && !hasOkta;
        }).length,
        unassigned: uniqueAssets.filter(a => {
          const isActive = a.status === 'Active';
          const hasUser = a.assignedUser && a.assignedUser.trim() !== '';
          return isActive && !hasUser;
        }).length,
        multipleAssets: employeesWithMultipleAssets
      };

      // Calculate health score statistics (using unique assets)
      const activeAssets = uniqueAssets.filter(a => a.status === 'Active');
      const healthScores = activeAssets.map(a => {
        let score = 0;
        if (Boolean(a.s1Active)) score += 33.33;
        if (Boolean(a.mdmEnrolled)) score += 33.33;
        if (Boolean(a.oktaEnrolled)) score += 33.34;
        return Math.round(score);
      });
      const avgHealthScore = healthScores.length > 0 
        ? (healthScores.reduce((sum, s) => sum + s, 0) / healthScores.length).toFixed(1)
        : 0;
      const criticalCount = healthScores.filter(s => s < 50).length;
      const warningCount = healthScores.filter(s => s >= 50 && s < 100).length;
      const healthyCount = healthScores.filter(s => s === 100).length;

      const result = { 
        total, 
        deployed, 
        totalValue, 
        mdmCompliance, 
        s1Compliance, 
        oktaCompliance, 
        issues,
        healthScore: {
          average: avgHealthScore,
          critical: criticalCount,
          warning: warningCount,
          healthy: healthyCount
        }
      };
      return result;
    } catch (error) {
      console.error('Stats calculation error:', error);
      return { 
        total: 0, 
        deployed: 0, 
        totalValue: 0, 
        mdmCompliance: 0, 
        s1Compliance: 0, 
        oktaCompliance: 0, 
        issues: { noMdm: 0, noS1: 0, noOkta: 0, unassigned: 0, multipleAssets: 0 } 
      };
    }
  }, [assets]);

  // Chart data for dashboard
  const chartData = useMemo(() => {
    try {
      const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
      
      // Deduplicate by normalized serial number (same logic as stats)
      const uniqueAssetsMap = new Map();
      validAssets.forEach(asset => {
        const normalizedSerial = String(asset.serialNumber).trim().toLowerCase();
        if (!normalizedSerial) return;
        
        if (!uniqueAssetsMap.has(normalizedSerial)) {
          uniqueAssetsMap.set(normalizedSerial, asset);
        } else {
          const existing = uniqueAssetsMap.get(normalizedSerial);
          const existingFields = Object.values(existing).filter(v => v && v !== '' && v !== null && v !== undefined).length;
          const newFields = Object.values(asset).filter(v => v && v !== '' && v !== null && v !== undefined).length;
          const existingDate = existing.lastUpdated ? new Date(existing.lastUpdated) : new Date(existing.createdAt || 0);
          const newDate = asset.lastUpdated ? new Date(asset.lastUpdated) : new Date(asset.createdAt || 0);
          
          if (newFields > existingFields || (newFields === existingFields && newDate > existingDate)) {
            uniqueAssetsMap.set(normalizedSerial, asset);
          }
        }
      });
      
      const uniqueAssets = Array.from(uniqueAssetsMap.values());
      
      // Device Type Distribution
      const deviceTypeData = uniqueAssets.reduce((acc, asset) => {
        const type = asset.deviceType || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      const deviceTypeChart = Object.entries(deviceTypeData).map(([name, value]) => ({
        name: name,
        value: value
      }));

      // Model Distribution (top 10)
      const modelData = uniqueAssets.reduce((acc, asset) => {
        const model = asset.model || 'Unknown';
        acc[model] = (acc[model] || 0) + 1;
        return acc;
      }, {});
      const modelChart = Object.entries(modelData)
        .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Status Distribution
      const statusData = uniqueAssets.reduce((acc, asset) => {
        const status = asset.status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      const statusChart = Object.entries(statusData).map(([name, value]) => ({
        name: name,
        value: value
      }));

      // Manufacturer Distribution (top 8)
      const manufacturerData = validAssets.reduce((acc, asset) => {
        const mfr = asset.manufacturer || 'Unknown';
        acc[mfr] = (acc[mfr] || 0) + 1;
        return acc;
      }, {});
      const manufacturerChart = Object.entries(manufacturerData)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      // Compliance Status
      const complianceData = [
        { name: 'MDM Enrolled', value: validAssets.filter(a => a.mdmEnrolled).length, total: validAssets.length },
        { name: 'S1 Active', value: validAssets.filter(a => a.s1Active).length, total: validAssets.length },
        { name: 'Okta Enrolled', value: validAssets.filter(a => a.oktaEnrolled).length, total: validAssets.length }
      ];

      return {
        deviceType: deviceTypeChart,
        model: modelChart,
        status: statusChart,
        manufacturer: manufacturerChart,
        compliance: complianceData
      };
    } catch (error) {
      console.error('Chart data calculation error:', error);
      return {
        deviceType: [],
        model: [],
        status: [],
        manufacturer: [],
        compliance: []
      };
    }
  }, [assets]);

  // Calculate compliance health score for an asset (0-100%)
  const calculateHealthScore = (asset) => {
    if (!asset || asset.status !== 'Active') return null; // Only score active assets
    let score = 0;
    if (Boolean(asset.s1Active)) score += 33.33;
    if (Boolean(asset.mdmEnrolled)) score += 33.33;
    if (Boolean(asset.oktaEnrolled)) score += 33.34;
    return Math.round(score);
  };

  // Detect which sources have data for an asset
  const getSourceCoverage = (asset) => {
    const sources = {
      s1: Boolean(asset.s1Active) || (asset.vendor && asset.vendor.toLowerCase().includes('sentinelone')),
      mdm: Boolean(asset.mdmEnrolled) || (asset.vendor && asset.vendor.toLowerCase().includes('endpoint-central')),
      okta: Boolean(asset.oktaEnrolled) || (asset.vendor && asset.vendor.toLowerCase().includes('okta')),
      cdw: asset.vendor && asset.vendor.toLowerCase().includes('cdw'),
      jira: asset.vendor && asset.vendor.toLowerCase().includes('jira'),
      allwhere: asset.vendor && asset.vendor.toLowerCase().includes('allwhere'),
      shi: asset.vendor && asset.vendor.toLowerCase().includes('shi')
    };
    const sourceCount = Object.values(sources).filter(Boolean).length;
    return { sources, sourceCount, totalSources: 7 };
  };

  const filteredAssets = useMemo(() => {
    try {
      if (!Array.isArray(assets)) return [];
      
      return assets.filter(asset => {
        if (!asset || !asset.serialNumber || asset.serialNumber.trim() === '') return false;
        
        // Optimized search - single toLowerCase call
        let matchesSearch = true;
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          matchesSearch = (asset.serialNumber?.toLowerCase().includes(searchLower)) ||
                         (asset.model?.toLowerCase().includes(searchLower)) ||
                         (asset.computerName?.toLowerCase().includes(searchLower));
        }
        
        const matchesType = filters.deviceType === 'all' || asset.deviceType === filters.deviceType;
        const matchesStatus = filters.status === 'all' || asset.status === filters.status;
        
        const matchesCompliance = filters.complianceIssue === 'all' || 
          (filters.complianceIssue === 'noMdm' && !asset.mdmEnrolled) ||
          (filters.complianceIssue === 'noS1' && !asset.s1Active) ||
          (filters.complianceIssue === 'noOkta' && !asset.oktaEnrolled) ||
          (filters.complianceIssue === 'unassigned' && (!asset.assignedUser || asset.assignedUser === ''));
        
        // Early exit if search doesn't match
        if (!matchesSearch) return false;
        
        // Filter by health score if set (optimized - inline calculation, no function call)
        if (filters.healthScore !== 'all' && filters.healthScore) {
          let score = 0;
          if (asset.s1Active) score += 33.33;
          if (asset.mdmEnrolled) score += 33.33;
          if (asset.oktaEnrolled) score += 33.34;
          score = Math.round(score);
          
          switch(filters.healthScore) {
            case 'critical': if (score >= 50) return false; break;
            case 'warning': if (score < 50 || score >= 100) return false; break;
            case 'healthy': if (score !== 100) return false; break;
          }
        }
        
        return matchesType && matchesStatus && matchesCompliance;
      });
    } catch (error) {
      console.error('Filter error:', error);
      return [];
    }
  }, [assets, searchTerm, filters]);

  // Employees data - grouped by assignedUser
  const employees = useMemo(() => {
    try {
      if (!Array.isArray(assets)) return [];
      
      // Get all unique users with their assets
      const userMap = new Map();
      
      assets.forEach(asset => {
        if (!asset || !asset.serialNumber || asset.serialNumber.trim() === '') return;
        if (!asset.assignedUser || asset.assignedUser.trim() === '') return;
        
        const userEmail = asset.assignedUser.trim();
        if (!userMap.has(userEmail)) {
          // Construct name from firstName and lastName, fallback to email username
          const firstName = asset.firstName || '';
          const lastName = asset.lastName || '';
          const fullName = firstName && lastName 
            ? `${firstName} ${lastName}`.trim()
            : firstName || lastName || userEmail.split('@')[0];
          
          userMap.set(userEmail, {
            email: userEmail,
            name: fullName,
            firstName: firstName,
            lastName: lastName,
            department: asset.department || '',
            location: asset.location || '',
            assets: [],
            totalAssets: 0,
            activeAssets: 0,
            totalValue: 0,
            mdmCompliant: 0,
            s1Compliant: 0,
            oktaCompliant: 0
          });
        }
        
        const user = userMap.get(userEmail);
        user.assets.push(asset);
        user.totalAssets++;
        if (asset.status === 'Active') user.activeAssets++;
        if (asset.purchaseCost) user.totalValue += asset.purchaseCost;
        if (asset.mdmEnrolled) user.mdmCompliant++;
        if (asset.s1Active) user.s1Compliant++;
        if (asset.oktaEnrolled) user.oktaCompliant++;
        
        // Update name, department/location if not set (use first non-empty value)
        if (!user.firstName && asset.firstName) {
          user.firstName = asset.firstName;
          // Reconstruct full name
          const fullName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.firstName || user.lastName || user.email.split('@')[0];
          user.name = fullName;
        }
        if (!user.lastName && asset.lastName) {
          user.lastName = asset.lastName;
          // Reconstruct full name
          const fullName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.firstName || user.lastName || user.email.split('@')[0];
          user.name = fullName;
        }
        if (!user.department && asset.department) user.department = asset.department;
        if (!user.location && asset.location) user.location = asset.location;
      });
      
      const allEmployees = Array.from(userMap.values());
      
      return allEmployees
        .filter(user => {
          // Filter by employee filter type
          if (employeeFilter === 'multiple') {
            if (user.totalAssets < 2) return false;
          } else if (employeeFilter === 'single') {
            if (user.totalAssets !== 1) return false;
          } else if (employeeFilter === 'unassigned') {
            // This doesn't apply to employees, but keep for consistency
            return true;
          }
          // 'all' passes through
          
          // Filter by search term
          if (!employeeSearchTerm) return true;
          const search = employeeSearchTerm.toLowerCase();
          return user.email.toLowerCase().includes(search) ||
                 user.name.toLowerCase().includes(search) ||
                 (user.firstName && user.firstName.toLowerCase().includes(search)) ||
                 (user.lastName && user.lastName.toLowerCase().includes(search)) ||
                 (user.department && user.department.toLowerCase().includes(search));
        })
        .sort((a, b) => {
          // If filtering by multiple, sort by asset count descending
          if (employeeFilter === 'multiple') {
            return b.totalAssets - a.totalAssets;
          }
          return a.email.localeCompare(b.email);
        });
    } catch (error) {
      console.error('Employees calculation error:', error);
      return [];
    }
  }, [assets, employeeSearchTerm, employeeFilter]);

  // All employees count (unfiltered) for display
  const allEmployeesCount = useMemo(() => {
    try {
      if (!Array.isArray(assets)) return 0;
      const userSet = new Set();
      assets.forEach(asset => {
        if (asset && asset.serialNumber && asset.assignedUser && asset.assignedUser.trim() !== '') {
          userSet.add(asset.assignedUser.trim().toLowerCase());
        }
      });
      return userSet.size;
    } catch (error) {
      return 0;
    }
  }, [assets]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      const isImage = file.type.startsWith('image/') || file.type === 'application/pdf';
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel';
      
      if (isImage) {
        const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
        if (!apiKey) {
          setError('API key not configured. Please set VITE_ANTHROPIC_API_KEY in your .env file.');
          setIsProcessing(false);
          return;
        }

        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const mediaType = file.type === 'application/pdf' ? 'application/pdf' : file.type;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                {
                  type: mediaType === 'application/pdf' ? 'document' : 'image',
                  source: { type: "base64", media_type: mediaType, data: base64Data }
                },
                {
                  type: "text",
                  text: "Extract ALL asset information from this document. Return ONLY valid JSON array with ALL fields you can find: serialNumber, computerName (hostname or device name), assetTag, model, deviceType (must be exactly Windows, Mac, or Linux), manufacturer, purchaseCost, purchaseDate, vendor, assignedUser, department, location. Return only JSON, nothing else."
                }
              ]
            }]
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        let text = data.content.filter(i => i.type === "text").map(i => i.text).join("");
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const extracted = JSON.parse(text);
        
        setParsedData(Array.isArray(extracted) ? extracted : [extracted]);
        
        setFieldMapping({
          serialNumber: 'serialNumber',
          computerName: 'computerName',
          assetTag: 'assetTag',
          model: 'model',
          deviceType: 'deviceType',
          manufacturer: 'manufacturer',
          purchaseCost: 'purchaseCost',
          purchaseDate: 'purchaseDate',
          vendor: 'vendor',
          assignedUser: 'assignedUser',
          department: 'department',
          location: 'location'
        });
        setImportStep('preview');
      } else if (isExcel) {
        // Handle Excel files
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            if (jsonData.length === 0) {
              throw new Error('Excel file appears to be empty');
            }
            
            setParsedData(jsonData);
            
            // Auto-map fields from Excel headers
            const headers = Object.keys(jsonData[0] || {});
          const mapping = {};
          headers.forEach(h => {
            const lc = h.toLowerCase();
                if (lc.includes('computer') || lc.includes('hostname') || lc.includes('device name') || lc.includes('display name') || lc.includes('endpoint name')) mapping.computerName = h;
                else if (lc.includes('serial') || lc === 's/n' || lc === 'sn' || lc.includes('serial_no') || lc.includes('serialno')) mapping.serialNumber = h;
            else if (lc.includes('asset')) mapping.assetTag = h;
            else if (lc.includes('model')) mapping.model = h;
              // Check for OS Username patterns BEFORE generic 'os' check to avoid deviceType mapping
              else if ((lc.includes('os') && lc.includes('username')) || lc.includes('os username') || lc.includes('last login')) mapping.assignedUser = h;
              else if (lc.includes('type') || (lc.includes('os') && !lc.includes('user'))) mapping.deviceType = h;
            else if (lc.includes('manufacturer') || lc.includes('brand')) mapping.manufacturer = h;
            else if (lc.includes('cost') || lc.includes('price')) mapping.purchaseCost = h;
            else if (lc.includes('date')) mapping.purchaseDate = h;
            else if (lc.includes('vendor') || lc.includes('source')) mapping.vendor = h;
            else if (lc.includes('user') || lc.includes('email') || lc.includes('login')) mapping.assignedUser = h;
            else if (lc.includes('first') && lc.includes('name')) mapping.firstName = h;
            else if (lc.includes('last') && lc.includes('name')) mapping.lastName = h;
            else if (lc.includes('status')) mapping.status = h;
            else if (lc.includes('department')) mapping.department = h;
            else if (lc.includes('location')) mapping.location = h;
          });
          
          setFieldMapping(mapping);
          setImportStep('preview');
            setIsProcessing(false);
          } catch (error) {
            setError('Error parsing Excel file: ' + error.message);
            setIsProcessing(false);
          }
        };
        reader.onerror = () => {
          setError('Error reading Excel file');
          setIsProcessing(false);
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Handle CSV files with papaparse
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              if (results.errors.length > 0) {
                console.warn('CSV parsing warnings:', results.errors);
              }
              
              if (results.data.length === 0) {
                throw new Error('CSV file appears to be empty');
              }
              
              setParsedData(results.data);
              
              // Auto-map fields from CSV headers
              const headers = Object.keys(results.data[0] || {});
              const mapping = {};
              headers.forEach(h => {
                const lc = h.toLowerCase();
                if (lc.includes('computer') || lc.includes('hostname') || lc.includes('device name') || lc.includes('display name') || lc.includes('endpoint name')) mapping.computerName = h;
                else if (lc.includes('serial') || lc === 's/n' || lc === 'sn' || lc.includes('serial_no') || lc.includes('serialno')) mapping.serialNumber = h;
                else if (lc.includes('asset')) mapping.assetTag = h;
                else if (lc.includes('model')) mapping.model = h;
                // Check for OS Username patterns BEFORE generic 'os' check to avoid deviceType mapping
                else if ((lc.includes('os') && lc.includes('username')) || lc.includes('os username') || lc.includes('last login')) mapping.assignedUser = h;
                else if (lc.includes('type') || (lc.includes('os') && !lc.includes('user'))) mapping.deviceType = h;
                else if (lc.includes('manufacturer') || lc.includes('brand')) mapping.manufacturer = h;
                else if (lc.includes('cost') || lc.includes('price')) mapping.purchaseCost = h;
                else if (lc.includes('date')) mapping.purchaseDate = h;
                else if (lc.includes('vendor') || lc.includes('source')) mapping.vendor = h;
                else if (lc.includes('user') || lc.includes('email') || lc.includes('login')) mapping.assignedUser = h;
                else if (lc.includes('first') && lc.includes('name')) mapping.firstName = h;
                else if (lc.includes('last') && lc.includes('name')) mapping.lastName = h;
                else if (lc.includes('status')) mapping.status = h;
                else if (lc.includes('department')) mapping.department = h;
                else if (lc.includes('location')) mapping.location = h;
              });
              
              setFieldMapping(mapping);
              setImportStep('preview');
              setIsProcessing(false);
    } catch (error) {
              setError('Error processing CSV data: ' + error.message);
              setIsProcessing(false);
            }
          },
          error: (error) => {
            setError('Error parsing CSV file: ' + error.message);
            setIsProcessing(false);
          }
        });
      }
    } catch (error) {
      console.error('File upload error:', error);
      setError('Error processing file: ' + error.message);
      setIsProcessing(false);
    }
  };

  const handleImportComplete = () => {
    setError(null);
    const parseCost = (value) => {
      if (!value) return 0;
      const cleaned = String(value).replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Normalize status - if empty or invalid, return empty string
    const normalizeStatus = (status) => {
      if (!status || status.trim() === '') return '';
      const validStatuses = ['Active', 'Storage', 'Retired', 'Broken'];
      return validStatuses.includes(status.trim()) ? status.trim() : '';
    };

    // Normalize device type - handle common variations and infer from model/manufacturer
    const normalizeDeviceType = (deviceType, model = '', manufacturer = '') => {
      if (!deviceType || deviceType.trim() === '') {
        // Try to infer from model/manufacturer if device type is missing
        const modelLower = (model || '').toLowerCase();
        const mfrLower = (manufacturer || '').toLowerCase();
        
        // Check for Mac indicators
        if (modelLower.includes('mac') || modelLower.includes('imac') || modelLower.includes('macbook') || 
            modelLower.includes('mac pro') || mfrLower.includes('apple')) {
          return 'Mac';
        }
        
        // Check for Windows indicators (common Windows models)
        if (modelLower.includes('surface') || modelLower.includes('thinkpad') || 
            modelLower.includes('latitude') || modelLower.includes('optiplex') ||
            mfrLower.includes('dell') || mfrLower.includes('hp') || mfrLower.includes('lenovo') ||
            mfrLower.includes('microsoft')) {
          return 'Windows';
        }
        
        // Check for Linux indicators
        if (modelLower.includes('ubuntu') || modelLower.includes('linux')) {
          return 'Linux';
        }
        
        return '';
      }
      
      const normalized = deviceType.trim();
      const normalizedLower = normalized.toLowerCase();
      
      // Exact matches
      if (['Windows', 'Mac', 'Linux'].includes(normalized)) {
        return normalized;
      }
      
      // Handle common variations
      if (normalizedLower.includes('windows') || normalizedLower.includes('win')) {
        return 'Windows';
      }
      if (normalizedLower.includes('mac') || normalizedLower.includes('macos') || 
          normalizedLower.includes('os x') || normalizedLower.includes('darwin')) {
        return 'Mac';
      }
      if (normalizedLower.includes('linux') || normalizedLower.includes('ubuntu') || 
          normalizedLower.includes('debian') || normalizedLower.includes('redhat') ||
          normalizedLower.includes('centos')) {
        return 'Linux';
      }
      
      return '';
    };

    const timestamp = Date.now();
    const validationWarnings = [];
    const skippedCount = { noSerial: 0 };
    
    // Optimization: Create a map of existing assets for O(1) lookup
    // This prevents page freeze on large imports
    const existingAssetMap = new Map();
    assets.forEach(a => {
      if (a && a.serialNumber) {
        existingAssetMap.set(String(a.serialNumber).trim().toLowerCase(), a);
      }
    });

    // Helper to collect field alternatives and determine chosen value
    const collectFieldAlternatives = (fieldName, row, existingAsset, selectedSource, fieldMapping, bulkImportOverrides) => {
      const alternatives = [];
      let chosenValue = null;
      let chosenSource = null;
      let chosenSourceField = null;
      let reasoning = '';
      let priority = 1;

      // Source priority: S1 > Okta > Endpoint Central > CDW > Jira > Manual
      const sourcePriority = {
        'sentinelone': 1,
        'okta-fastpass': 2,
        'endpoint-central': 3,
        'cdw': 4,
        'jira': 5,
        'manual': 6
      };

      // Collect all possible values from the row
      const collectFromRow = (fieldName) => {
        const values = [];
        
        // Check mapped field
        if (fieldMapping[fieldName] && row[fieldMapping[fieldName]]) {
          const value = String(row[fieldMapping[fieldName]]).trim();
          if (value) {
            values.push({
              value,
              source: selectedSource,
              sourceField: fieldMapping[fieldName],
              priority: sourcePriority[selectedSource] || 5
            });
          }
        }
        
        // Check direct field
        if (row[fieldName]) {
          const value = String(row[fieldName]).trim();
          if (value) {
            values.push({
              value,
              source: selectedSource,
              sourceField: fieldName,
              priority: sourcePriority[selectedSource] || 5
            });
          }
        }
        
        // Special handling for assignedUser in SentinelOne
        if (fieldName === 'assignedUser' && selectedSource === 'sentinelone') {
          const lastLoggedInUser = Object.keys(row).find(key => 
            key && key.toLowerCase().includes('last') && key.toLowerCase().includes('login') && key.toLowerCase().includes('user')
          );
          const osUsername = Object.keys(row).find(key => 
            key && (key.toLowerCase().includes('os') && key.toLowerCase().includes('username')) || key.toLowerCase() === 'os username'
          );
          
          if (lastLoggedInUser && row[lastLoggedInUser]) {
            const value = String(row[lastLoggedInUser]).trim();
            if (value) {
              values.push({
                value,
                source: 'sentinelone',
                sourceField: lastLoggedInUser,
                priority: 1
              });
            }
          }
          if (osUsername && row[osUsername]) {
            const value = String(row[osUsername]).trim();
            if (value) {
              values.push({
                value,
                source: 'sentinelone',
                sourceField: osUsername,
                priority: 1
              });
            }
          }
        }
        
        return values;
      };

      // Collect values from row
      const rowValues = collectFromRow(fieldName);
      alternatives.push(...rowValues);

      // Collect value from existing asset
      if (existingAsset && existingAsset[fieldName]) {
        const existingValue = String(existingAsset[fieldName]).trim();
        if (existingValue) {
          // Determine source from existing asset
          let existingSource = 'unknown';
          if (existingAsset.s1Active) existingSource = 'sentinelone';
          else if (existingAsset.oktaEnrolled) existingSource = 'okta-fastpass';
          else if (existingAsset.mdmEnrolled) existingSource = 'endpoint-central';
          else if (existingAsset.vendor) {
            const vendorLower = existingAsset.vendor.toLowerCase();
            if (vendorLower.includes('cdw')) existingSource = 'cdw';
            else if (vendorLower.includes('jira')) existingSource = 'jira';
            else if (vendorLower.includes('sentinelone') || vendorLower.includes('s1')) existingSource = 'sentinelone';
            else if (vendorLower.includes('okta')) existingSource = 'okta-fastpass';
            else if (vendorLower.includes('endpoint')) existingSource = 'endpoint-central';
          }
          
          alternatives.push({
            value: existingValue,
            source: existingSource,
            sourceField: 'existing',
            priority: sourcePriority[existingSource] || 5
          });
        }
      }

      // Check bulk import overrides
      if (bulkImportOverrides[fieldName]) {
        alternatives.push({
          value: String(bulkImportOverrides[fieldName]).trim(),
          source: 'manual',
          sourceField: 'bulkOverride',
          priority: 0 // Highest priority
        });
      }

      // Determine chosen value based on priority logic
      if (alternatives.length > 0) {
        // Sort by priority (lower is better)
        alternatives.sort((a, b) => a.priority - b.priority);
        
        // For S1 imports, prioritize S1 data
        const isS1Import = selectedSource === 'sentinelone';
        if (isS1Import && fieldName === 'assignedUser') {
          // For assignedUser in S1, prefer "Last logged in user" over "OS Username"
          const lastLoggedIn = alternatives.find(a => 
            a.sourceField && a.sourceField.toLowerCase().includes('last') && a.sourceField.toLowerCase().includes('login')
          );
          const osUser = alternatives.find(a => 
            a.sourceField && (a.sourceField.toLowerCase().includes('os') && a.sourceField.toLowerCase().includes('username'))
          );
          
          if (lastLoggedIn) {
            chosenValue = lastLoggedIn.value;
            chosenSource = lastLoggedIn.source;
            chosenSourceField = lastLoggedIn.sourceField;
            reasoning = 'S1 Last logged in user prioritized over OS Username';
            priority = lastLoggedIn.priority;
          } else if (osUser) {
            chosenValue = osUser.value;
            chosenSource = osUser.source;
            chosenSourceField = osUser.sourceField;
            reasoning = 'S1 OS Username used';
            priority = osUser.priority;
          } else {
            const best = alternatives[0];
            chosenValue = best.value;
            chosenSource = best.source;
            chosenSourceField = best.sourceField;
            reasoning = `S1 import: ${best.sourceField || 'mapped field'}`;
            priority = best.priority;
          }
        } else {
          // For other fields or sources, use priority logic
          const best = alternatives[0];
          chosenValue = best.value;
          chosenSource = best.source;
          chosenSourceField = best.sourceField;
          
          if (isS1Import && existingAsset && existingAsset.s1Active && existingAsset[fieldName]) {
            // Keep existing S1 data if it exists
            const existingAlt = alternatives.find(a => a.source === 'sentinelone' && a.sourceField === 'existing');
            if (existingAlt && existingAlt.value === String(existingAsset[fieldName]).trim()) {
              chosenValue = existingAlt.value;
              chosenSource = existingAlt.source;
              chosenSourceField = existingAlt.sourceField;
              reasoning = 'Existing S1 data preserved';
            } else {
              reasoning = `S1 data prioritized (${best.sourceField || 'new value'})`;
            }
          } else if (best.source === 'manual' && best.sourceField === 'bulkOverride') {
            reasoning = 'Bulk import override applied';
          } else if (best.source === 'existing') {
            reasoning = `Existing value from ${best.source} preserved`;
          } else {
            reasoning = `Value from ${best.source} (${best.sourceField || 'mapped field'})`;
          }
          priority = best.priority;
        }

        // Remove chosen value from alternatives
        const remainingAlternatives = alternatives.filter(a => 
          !(a.value === chosenValue && a.source === chosenSource && a.sourceField === chosenSourceField)
        );
        
        return {
          chosenValue,
          chosenSource,
          chosenSourceField,
          alternatives: remainingAlternatives,
          reasoning,
          priority
        };
      }

      return {
        chosenValue: null,
        chosenSource: null,
        chosenSourceField: null,
        alternatives: [],
        reasoning: 'No value available',
        priority: 999
      };
    };
    
    // Helper to find serial number in row (try multiple field variations)
    const findSerialNumber = (row) => {
      // Try mapped field first
      if (fieldMapping.serialNumber && row[fieldMapping.serialNumber]) {
        return String(row[fieldMapping.serialNumber]).trim();
      }
      // Try direct field
      if (row.serialNumber) {
        return String(row.serialNumber).trim();
      }
      // Try common variations
      const variations = ['serial', 'serial number', 'serialnumber', 's/n', 'sn', 'serial_no', 'serialno'];
      for (const key of Object.keys(row)) {
        const lcKey = key.toLowerCase().trim();
        if (variations.some(v => lcKey.includes(v))) {
          const value = String(row[key]).trim();
          if (value) return value;
        }
      }
      return '';
    };
    
    // For CDW imports, we're primarily updating costs on existing assets
    const isCDWImport = selectedSource === 'cdw';
    
    // Array to collect field assignments for all assets
    const fieldAssignmentsToCreate = [];
    
    // First, filter out rows without serial numbers and create assets
    // Store row data with each asset for field assignment collection
    const newAssetsWithRows = parsedData
      .filter((row, index) => {
        const serialNumber = findSerialNumber(row);
        if (!serialNumber) {
          // For CDW, try to match by other fields if serial number not found
          if (isCDWImport) {
            // Try to find existing asset by model + computer name or other identifiers
            const model = (row[fieldMapping.model] || row.model || '').trim();
            const computerName = (row[fieldMapping.computerName] || row.computerName || '').trim();
            if (model || computerName) {
              const canMatch = assets.some(a => {
                if (!a || !a.serialNumber) return false;
                if (model && a.model && a.model.toLowerCase() === model.toLowerCase()) return true;
                if (computerName && a.computerName && a.computerName.toLowerCase() === computerName.toLowerCase()) return true;
                return false;
              });
              if (canMatch) {
                // We can potentially match, but warn about missing serial number
                return true;
              }
            }
          }
          skippedCount.noSerial++;
          return false; // Skip rows without serial numbers
        }
        return true;
      })
      .map((row, index) => {
        let serialNumber = findSerialNumber(row);
        
        // If no serial number but we have other identifiers (CDW case), try to find existing asset
        if (!serialNumber && isCDWImport) {
          const model = (row[fieldMapping.model] || row.model || '').trim();
          const computerName = (row[fieldMapping.computerName] || row.computerName || '').trim();
          const assetTag = (row[fieldMapping.assetTag] || row.assetTag || '').trim();
          
          // Try to find existing asset by model, computer name, or asset tag
          // Optimization: This is still O(N) but only runs for CDW imports without serials
          const matchedAsset = assets.find(a => {
            if (!a || !a.serialNumber) return false;
            if (model && a.model && a.model.toLowerCase() === model.toLowerCase()) return true;
            if (computerName && a.computerName && a.computerName.toLowerCase() === computerName.toLowerCase()) return true;
            if (assetTag && a.assetTag && a.assetTag.toLowerCase() === assetTag.toLowerCase()) return true;
            return false;
          });
          
          if (matchedAsset) {
            serialNumber = matchedAsset.serialNumber; // Use existing serial number
          }
        }
        // For S1 imports, prioritize "Last logged in user" over "OS Username"
        let assignedUserEmail = '';
        if (selectedSource === 'sentinelone') {
          // Check for "Last logged in user" first, then "OS Username", then fallback to mapped field
          const lastLoggedInUser = Object.keys(row).find(key => 
            key && key.toLowerCase().includes('last') && key.toLowerCase().includes('login') && key.toLowerCase().includes('user')
          );
          const osUsername = Object.keys(row).find(key => 
            key && (key.toLowerCase().includes('os') && key.toLowerCase().includes('username')) || key.toLowerCase() === 'os username'
          );
          
          if (lastLoggedInUser && row[lastLoggedInUser]) {
            assignedUserEmail = (row[lastLoggedInUser] || '').trim();
          } else if (osUsername && row[osUsername]) {
            assignedUserEmail = (row[osUsername] || '').trim();
          } else {
            assignedUserEmail = (row[fieldMapping.assignedUser] || row.assignedUser || '').trim();
          }
        } else {
          assignedUserEmail = (row[fieldMapping.assignedUser] || row.assignedUser || '').trim();
        }
        
        // Find existing asset by serial number (serial number is the primary identifier)
        // This ensures assets from different sources (Okta, Endpoint Central, etc.) merge correctly
        // Normalize serial numbers for comparison (trim and case-insensitive)
        const normalizedSerial = serialNumber.trim().toLowerCase();
        // Optimization: Use Map for O(1) lookup instead of find()
        const existingAsset = existingAssetMap.get(normalizedSerial);
        
        // Extract first name and last name
        const firstName = (row[fieldMapping.firstName] || row.firstName || '').trim();
        const lastName = (row[fieldMapping.lastName] || row.lastName || '').trim();
      
      if (existingAsset) {
          // SentinelOne (S1) is the most authoritative source with live data - prioritize it
          const isS1Import = selectedSource === 'sentinelone';
          
          // For CDW imports, prioritize cost updates and preserve existing valid data
          // Extract model and manufacturer first for device type inference
          const newModel = (row[fieldMapping.model] || row.model || '').trim();
          const newManufacturer = (row[fieldMapping.manufacturer] || row.manufacturer || '').trim();
          const newDeviceType = normalizeDeviceType(
            row[fieldMapping.deviceType] || row.deviceType || '', 
            newModel, 
            newManufacturer
          );
          
          // For CDW cost updates, don't overwrite device type with invalid values
          const finalDeviceType = isCDWImport && !newDeviceType
            ? existingAsset.deviceType 
            : (newDeviceType || existingAsset.deviceType);
          
          // Smart merge: prefer new data if available, otherwise keep existing
          // For S1 imports, prioritize S1 data as it's the most up-to-date
          const newComputerName = (row[fieldMapping.computerName] || row.computerName || '').trim();
          const newAssetTag = (row[fieldMapping.assetTag] || row.assetTag || '').trim();
          const newStatus = bulkImportOverrides.status || normalizeStatus(row[fieldMapping.status] || row.status);
          // For S1 imports, if status is empty or invalid, set to "Active" (S1 only tracks active devices)
          const finalStatus = isS1Import && !newStatus ? 'Active' : (newStatus || (isS1Import ? 'Active' : existingAsset.status || ''));
          const newDepartment = bulkImportOverrides.department || (row[fieldMapping.department] || row.department || '').trim();
          const newLocation = bulkImportOverrides.location || (row[fieldMapping.location] || row.location || '').trim();
          
          // Merge vendor - if different sources, combine them
          const existingVendor = existingAsset.vendor || '';
          const newVendor = row[fieldMapping.vendor] || row.vendor || selectedSource;
          const mergedVendor = existingVendor && newVendor && existingVendor !== newVendor
            ? `${existingVendor}, ${newVendor}`.replace(/,/g, '').split(' ').filter((v, i, a) => a.indexOf(v) === i).join(', ')
            : (newVendor || existingVendor);
          
        return {
          asset: {
            ...existingAsset,
              // For S1 imports, prioritize S1 data; otherwise prefer new data if available, keep existing if not
              computerName: isS1Import && newComputerName ? newComputerName : (newComputerName || existingAsset.computerName),
              assetTag: isS1Import && newAssetTag ? newAssetTag : (newAssetTag || existingAsset.assetTag),
              deviceType: bulkImportOverrides.deviceType || finalDeviceType,
              manufacturer: isS1Import && newManufacturer ? newManufacturer : (newManufacturer || existingAsset.manufacturer),
              model: isS1Import && newModel ? newModel : (newModel || existingAsset.model),
              purchaseDate: (row[fieldMapping.purchaseDate] || row.purchaseDate || '').trim() || existingAsset.purchaseDate,
              // For CDW, prioritize cost from import if available
              purchaseCost: isCDWImport && (row[fieldMapping.purchaseCost] || row.purchaseCost)
                ? parseCost(row[fieldMapping.purchaseCost] || row.purchaseCost)
                : (parseCost(row[fieldMapping.purchaseCost] || row.purchaseCost) || existingAsset.purchaseCost),
              vendor: mergedVendor,
              // For S1 imports, always use S1 data (it's the most authoritative)
              // For other sources, fill in missing data but don't overwrite existing non-empty S1 data
              assignedUser: isS1Import && assignedUserEmail 
                ? assignedUserEmail 
                : (existingAsset.assignedUser && existingAsset.assignedUser.trim() !== '' && existingAsset.s1Active)
                  ? existingAsset.assignedUser  // Keep existing S1 data if it exists
                  : (assignedUserEmail || existingAsset.assignedUser || null),  // Fill in missing data from other sources
              firstName: isS1Import && firstName 
                ? firstName 
                : (existingAsset.firstName && existingAsset.firstName.trim() !== '' && existingAsset.s1Active)
                  ? existingAsset.firstName
                  : (firstName || existingAsset.firstName || ''),
              lastName: isS1Import && lastName 
                ? lastName 
                : (existingAsset.lastName && existingAsset.lastName.trim() !== '' && existingAsset.s1Active)
                  ? existingAsset.lastName
                  : (lastName || existingAsset.lastName || ''),
              department: isS1Import && newDepartment 
                ? newDepartment 
                : (newDepartment || existingAsset.department || ''),
              location: isS1Import && newLocation 
                ? newLocation 
                : (newLocation || existingAsset.location || ''),
              status: finalStatus,
              // Update compliance flags based on source - these are additive (once true, stay true)
            mdmEnrolled: selectedSource === 'endpoint-central' ? true : existingAsset.mdmEnrolled,
            s1Active: selectedSource === 'sentinelone' ? true : existingAsset.s1Active,
            oktaEnrolled: selectedSource === 'okta-fastpass' ? true : existingAsset.oktaEnrolled,
            lastUpdated: new Date().toISOString()
          },
          row: row
        };
      } else {
          // For new assets from S1, ensure status is set to Active
          const isS1Import = selectedSource === 'sentinelone';
          const newStatus = normalizeStatus(row[fieldMapping.status] || row.status);
          const finalStatus = isS1Import && !newStatus ? 'Active' : (newStatus || '');
          
        return {
          asset: {
            id: `ASSET-${timestamp}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            serialNumber,
            computerName: row[fieldMapping.computerName] || row.computerName || '',
            assetTag: row[fieldMapping.assetTag] || row.assetTag || '',
              deviceType: normalizeDeviceType(
                row[fieldMapping.deviceType] || row.deviceType || '',
                row[fieldMapping.model] || row.model || '',
                row[fieldMapping.manufacturer] || row.manufacturer || ''
              ),
            manufacturer: row[fieldMapping.manufacturer] || row.manufacturer || '',
            model: row[fieldMapping.model] || row.model || '',
            purchaseDate: row[fieldMapping.purchaseDate] || row.purchaseDate || '',
            purchaseCost: parseCost(row[fieldMapping.purchaseCost] || row.purchaseCost),
            vendor: row[fieldMapping.vendor] || row.vendor || selectedSource,
              assignedUser: assignedUserEmail || null,
              firstName: firstName || '',
              lastName: lastName || '',
            department: row[fieldMapping.department] || row.department || '',
            location: row[fieldMapping.location] || row.location || 'Unknown',
              // For S1 imports, always set to "Active" (S1 only tracks active devices)
              status: finalStatus || (isS1Import ? 'Active' : ''),
            mdmEnrolled: selectedSource === 'endpoint-central',
            s1Active: selectedSource === 'sentinelone',
            oktaEnrolled: selectedSource === 'okta-fastpass',
            createdAt: new Date().toISOString()
          },
          row: row
        };
      }
      })
      .map(item => {
        const asset = item.asset || item; // Handle both formats
        // For CDW imports updating existing assets, be more lenient with validation
        // Only validate critical fields, skip device type if we're just updating cost
        // Optimization: Use Map for O(1) lookup
        const isCDWUpdate = isCDWImport && asset.serialNumber && existingAssetMap.has(String(asset.serialNumber).trim().toLowerCase());
        
        if (isCDWUpdate) {
          // For CDW cost updates, only validate serial number (required)
          if (!asset.serialNumber || asset.serialNumber.trim() === '') {
            validationWarnings.push(`Asset: Serial number is required`);
          }
          // Skip device type validation for cost-only updates
        } else {
          // Full validation for new assets
          const errors = validateAsset(asset);
          if (errors.length > 0) {
            validationWarnings.push(`Asset ${asset.serialNumber || 'unknown'}: ${errors.join(', ')}`);
          }
        }
        return item; // Return the item with both asset and row
      });

    // Collect field assignments for each asset
    const processedAssets = newAssetsWithRows.map((item) => {
      // Safely extract asset and row
      const asset = item && (item.asset || item);
      const row = item && item.row;
      
      // If no asset or invalid asset, skip field assignment collection but return the asset
      if (!asset || typeof asset !== 'object' || !asset.serialNumber) {
        return asset;
      }
      
      // If no row data, still return the asset (field assignments won't be created)
      if (!row || typeof row !== 'object') {
        return asset;
      }
      
      // Find existing asset to check for alternatives
      const normalizedSerial = String(asset.serialNumber).trim().toLowerCase();
      // Optimization: Use Map for O(1) lookup
      const existingAsset = existingAssetMap.get(normalizedSerial);
      
      // Collect field assignments for key fields
      const fieldsToTrack = ['assignedUser', 'department', 'location', 'firstName', 'lastName', 'status'];
      
      try {
        fieldsToTrack.forEach(fieldName => {
          try {
            const fieldData = collectFieldAlternatives(
              fieldName,
              row,
              existingAsset,
              selectedSource,
              fieldMapping,
              bulkImportOverrides
            );
            
            // Only create assignment if there's a chosen value or alternatives
            if (fieldData && (fieldData.chosenValue || (fieldData.alternatives && fieldData.alternatives.length > 0))) {
              if (asset.id) {
                fieldAssignmentsToCreate.push({
                  assetId: asset.id,
                  fieldName: fieldName,
                  currentValue: fieldData.chosenValue || null,
                  source: fieldData.chosenSource || selectedSource || 'unknown',
                  sourceField: fieldData.chosenSourceField || null,
                  alternatives: fieldData.alternatives || [],
                  reasoning: fieldData.reasoning || '',
                  priority: fieldData.priority || 999,
                  importTimestamp: new Date().toISOString()
                });
              }
            }
          } catch (fieldError) {
            console.error(`Error collecting field alternatives for ${fieldName}:`, fieldError);
            // Continue with other fields
          }
        });
      } catch (error) {
        console.error('Error processing field assignments:', error);
        // Continue processing the asset even if field assignment collection fails
      }
      
      return asset; // Return just the asset for further processing
    }).filter(asset => asset && typeof asset === 'object' && asset.serialNumber); // Filter out any invalid assets

    // Show warnings if any
    const warningMessages = [];
    if (skippedCount.noSerial > 0) {
      warningMessages.push(`${skippedCount.noSerial} row(s) skipped (no serial number)`);
    }
    if (validationWarnings.length > 0) {
      warningMessages.push(`Validation issues: ${validationWarnings.slice(0, 3).join('; ')}${validationWarnings.length > 3 ? ` (and ${validationWarnings.length - 3} more)` : ''}`);
    }
    if (warningMessages.length > 0) {
      setError(warningMessages.join('. '));
    } else {
      setError(null);
    }

    const existingSerials = new Set(assets.map(a => a && a.serialNumber ? a.serialNumber : null).filter(Boolean));
    
    // Filter and validate processed assets
    const validProcessedAssets = processedAssets.filter(a => {
      return a && 
             typeof a === 'object' && 
             a.serialNumber && 
             typeof a.serialNumber === 'string' && 
             a.serialNumber.trim() !== '' &&
             a.id; // Ensure asset has an ID
    });
    
    const newOnes = validProcessedAssets.filter(a => a && a.serialNumber && !existingSerials.has(a.serialNumber));
    const updatedOnes = validProcessedAssets.filter(a => a && a.serialNumber && existingSerials.has(a.serialNumber));

    // Remove old versions and add updated/new assets
    // Use serial number as the deduplication key to ensure no duplicates
    // Normalize serial numbers for comparison
    const updatedSerials = new Set(
      updatedOnes.map(a => String(a.serialNumber).trim().toLowerCase()).filter(Boolean)
    );
    
    const finalAssets = [
      // Keep assets that are NOT being updated (normalize serial for comparison)
      ...assets.filter(a => {
        if (!a || !a.serialNumber) return false;
        const normalizedSerial = String(a.serialNumber).trim().toLowerCase();
        return !updatedSerials.has(normalizedSerial);
      }),
      // Add updated assets (these replace the old ones)
      ...updatedOnes,
      // Add new assets
      ...newOnes
    ];
    
    // Update field assignment asset IDs to match final assets (in case IDs changed during deduplication)
    const assetIdMap = new Map();
    finalAssets.forEach(asset => {
      if (asset && asset.serialNumber && asset.id) {
        // Find the original asset ID from validProcessedAssets (normalize serial for comparison)
        const assetSerialNormalized = String(asset.serialNumber).trim().toLowerCase();
        const originalAsset = validProcessedAssets.find(a => {
          if (!a || !a.serialNumber || !a.id) return false;
          const aSerialNormalized = String(a.serialNumber).trim().toLowerCase();
          return aSerialNormalized === assetSerialNormalized;
        });
        if (originalAsset && originalAsset.id && originalAsset.id !== asset.id) {
          assetIdMap.set(originalAsset.id, asset.id);
        }
      }
    });
    
    // Update field assignment asset IDs
    fieldAssignmentsToCreate.forEach(fa => {
      if (assetIdMap.has(fa.assetId)) {
        fa.assetId = assetIdMap.get(fa.assetId);
      }
    });
    
    // Final deduplication by serial number - use Map to ensure one asset per serial number
    // Prioritize SentinelOne (S1) data as it's the most authoritative source with live data
    const assetMap = new Map();
    finalAssets.forEach(asset => {
      // Safety check: ensure asset is valid before processing
      if (!asset || typeof asset !== 'object' || !asset.serialNumber || typeof asset.serialNumber !== 'string' || !asset.id) {
        return;
      }
      // Normalize serial number for deduplication (trim and lowercase)
      const serial = String(asset.serialNumber).trim().toLowerCase();
      if (!serial) return;
      if (!assetMap.has(serial)) {
        assetMap.set(serial, asset);
      } else {
        // If duplicate found, merge them with priority rules:
        // 1. SentinelOne (S1) data is most authoritative - always prefer it
        // 2. Otherwise prefer the one with more recent lastUpdated or more fields
        const existing = assetMap.get(serial);
        // Check if asset is from S1 by vendor or s1Active flag
        const existingIsS1 = (existing.vendor && existing.vendor.toLowerCase().includes('sentinelone')) || existing.s1Active === true;
        const newIsS1 = (asset.vendor && asset.vendor.toLowerCase().includes('sentinelone')) || asset.s1Active === true;
        
        // Priority: S1 data > more recent > more complete
        if (newIsS1 && !existingIsS1) {
          // New asset is from S1, existing is not - prefer S1
          assetMap.set(serial, asset);
        } else if (existingIsS1 && !newIsS1) {
          // Existing is from S1, new is not - keep existing
          // Don't update
        } else {
          // Both or neither are S1 - use field count and recency
          const existingFieldCount = Object.values(existing).filter(v => v && v !== '' && v !== null && v !== undefined).length;
          const newFieldCount = Object.values(asset).filter(v => v && v !== '' && v !== null && v !== undefined).length;
          // Keep the one with more data, or the more recently updated one
          if (newFieldCount > existingFieldCount || 
              (asset.lastUpdated && existing.lastUpdated && asset.lastUpdated > existing.lastUpdated)) {
            assetMap.set(serial, asset);
          }
        }
      }
    });
    
    const uniqueAssets = Array.from(assetMap.values());
    
    // Optimistic UI update
    setAssets(uniqueAssets);
    
    // Save to backend
    setIsProcessing(true);
    
    // Use create endpoint to support Import History with metadata
    const uploadFilename = selectedSource === 'custom' ? 'custom_upload.csv' : `${selectedSource}_import_${new Date().toISOString()}.csv`;
    
    const payload = {
        filename: uploadFilename,
        source: selectedSource || 'manual_upload',
        assets: uniqueAssets
    };

    api.assets.create(payload)
      .then(async () => {
        const data = await api.assets.getAll();
        setAssets(data);
        
        // Update field assignment asset IDs to match saved assets
        const savedAssetIdMap = new Map();
        data.forEach(asset => {
          if (asset && asset.serialNumber) {
            const matchingFa = fieldAssignmentsToCreate.find(fa => {
              const originalAsset = processedAssets.find(a => a && a.serialNumber === asset.serialNumber);
              return originalAsset && originalAsset.id === fa.assetId;
            });
            if (matchingFa) {
              savedAssetIdMap.set(matchingFa.assetId, asset.id);
            }
          }
        });
        
        // Update and create field assignments
        const finalFieldAssignments = fieldAssignmentsToCreate.map(fa => ({
          ...fa,
          assetId: savedAssetIdMap.get(fa.assetId) || fa.assetId
        }));
        
        if (finalFieldAssignments.length > 0) {
          try {
            await api.assets.bulkCreateFieldAssignments(finalFieldAssignments);
          } catch (err) {
            console.error('Failed to create field assignments:', err);
            // Don't show error to user as assets were saved successfully
          }
        }
      })
      .catch(err => {
        console.error('Failed to save imported assets:', err);
        setError('Imported assets visible locally but failed to save to server: ' + err.message);
      })
      .finally(() => {
        setIsProcessing(false);
      });
    
    setImportSummary({
      new: newOnes.length,
      updated: updatedOnes.length,
      total: processedAssets.length,
      skipped: skippedCount.noSerial
    });
    
    setImportStep('complete');
    // Don't clear bulk overrides immediately so user can see what they applied if needed, but clear on resetImport
  };

  const resetImport = () => {
    setImportStep('source');
    setSelectedSource(null);
    setParsedData([]);
    setFieldMapping({});
    setBulkImportOverrides({});
    setShowBulkImportEdit(false);
    setImportSummary({ new: 0, updated: 0, total: 0, skipped: 0 });
    setShowImportModal(false);
  };

  const handleCheckOut = (asset) => {
    setShowCheckOutModal(asset.id);
    setCheckOutUser('');
  };

  const submitCheckOut = async () => {
    if (!checkOutUser.trim()) {
      setError('Please enter a user email');
      return;
    }
    
    try {
      const updatedAsset = await api.assets.assign(showCheckOutModal, checkOutUser);
      setAssets(prev => prev.map(a => a.id === showCheckOutModal ? updatedAsset : a));
      setShowCheckOutModal(null);
      setCheckOutUser('');
    } catch (err) {
      setError('Check-out failed: ' + err.message);
    }
  };

  const handleCheckIn = (asset) => {
    setShowCheckInModal(asset.id);
  };

  const submitCheckIn = async () => {
    try {
      const updatedAsset = await api.assets.return(showCheckInModal);
      setAssets(prev => prev.map(a => a.id === showCheckInModal ? updatedAsset : a));
      setShowCheckInModal(null);
    } catch (err) {
      setError('Check-in failed: ' + err.message);
    }
  };

  // Export functionality
  const handleExport = async (format) => {
    setIsExporting(true);
    setError(null);
    
    try {
      const dataToExport = filteredAssets.length > 0 ? filteredAssets : assets;
      
      if (format === 'csv') {
        // CSV export
        const headers = ['Serial Number', 'Computer Name', 'Asset Tag', 'Model', 'Device Type', 'Manufacturer', 'Purchase Cost', 'Purchase Date', 'Vendor', 'Assigned User', 'First Name', 'Last Name', 'Department', 'Location', 'Status', 'MDM Enrolled', 'S1 Active', 'Okta Enrolled'];
        const rows = dataToExport.map(asset => [
          asset.serialNumber || '',
          asset.computerName || '',
          asset.assetTag || '',
          asset.model || '',
          asset.deviceType || '',
          asset.manufacturer || '',
          asset.purchaseCost || 0,
          asset.purchaseDate || '',
          asset.vendor || '',
          asset.assignedUser || '',
          asset.firstName || '',
          asset.lastName || '',
          asset.department || '',
          asset.location || '',
          asset.status || '',
          asset.mdmEnrolled ? 'Yes' : 'No',
          asset.s1Active ? 'Yes' : 'No',
          asset.oktaEnrolled ? 'Yes' : 'No'
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => {
            const str = String(cell);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `assets_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === 'excel') {
        // Excel export
        const worksheetData = [
          ['Serial Number', 'Computer Name', 'Asset Tag', 'Model', 'Device Type', 'Manufacturer', 'Purchase Cost', 'Purchase Date', 'Vendor', 'Assigned User', 'First Name', 'Last Name', 'Department', 'Location', 'Status', 'MDM Enrolled', 'S1 Active', 'Okta Enrolled'],
          ...dataToExport.map(asset => [
            asset.serialNumber || '',
            asset.computerName || '',
            asset.assetTag || '',
            asset.model || '',
            asset.deviceType || '',
            asset.manufacturer || '',
            asset.purchaseCost || 0,
            asset.purchaseDate || '',
            asset.vendor || '',
            asset.assignedUser || '',
            asset.firstName || '',
            asset.lastName || '',
            asset.department || '',
            asset.location || '',
            asset.status || '',
            asset.mdmEnrolled ? 'Yes' : 'No',
            asset.s1Active ? 'Yes' : 'No',
            asset.oktaEnrolled ? 'Yes' : 'No'
          ])
        ];
        
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
        XLSX.writeFile(workbook, `assets_${new Date().toISOString().split('T')[0]}.xlsx`);
      }
      
      setShowExportMenu(false);
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export data: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Edit asset handler
  const handleBulkEdit = (e) => {
    e.preventDefault();
    if (selectedAssetIds.size === 0) return;

    const updatedAssets = assets.map(asset => {
      if (selectedAssetIds.has(asset.id)) {
        return {
          ...asset,
          ...Object.fromEntries(Object.entries(bulkEditForm).filter(([_, v]) => v !== ''))
        };
      }
      return asset;
    });

    setAssets(updatedAssets);
    setShowBulkEditModal(false);
    setBulkEditForm({});
    setSelectedAssetIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedAssetIds.size === filteredAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const toggleSelectAsset = (id) => {
    const newSelected = new Set(selectedAssetIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAssetIds(newSelected);
  };
  
  const handleEdit = async (asset) => {
    // When opening the modal, use the asset data passed in.
    // If the list is filtered, this asset object is still valid.
    setEditingAsset(asset.id);
    setEditFormData({ ...asset });
    setError(null);
    setShowEditModal(true); // Open Modal
    
    // Load employees for picker (limit aggressively for performance)
    try {
      const employeeList = await api.assets.getEmployees();
      // Limit to 200 employees for better performance - most users won't need more
      setEditEmployees(employeeList.slice(0, 200));
    } catch (err) {
      console.error('Failed to load employees:', err);
      // Continue without employee list
    }
  };

  const handleSaveEdit = async (updatedAssetData) => {
    // If receiving data from modal, use it. Otherwise use local state (legacy)
    const dataToSave = updatedAssetData || editFormData;

    const validationErrors = validateAsset(dataToSave);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      // Re-throw if called from modal so modal stays open
      if (updatedAssetData) throw new Error(validationErrors.join(', '));
      return;
    }

    const parseCost = (value) => {
      if (!value) return 0;
      const cleaned = String(value).replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    try {
      const updatedData = { 
        ...dataToSave, 
        purchaseCost: parseCost(dataToSave.purchaseCost),
        lastUpdated: new Date().toISOString()
      };

      // Optimistic update
      setAssets(prevAssets => 
        prevAssets.map(asset => 
          asset.id === editingAsset ? updatedData : asset
        )
      );

      // Save to server
      await api.assets.update(editingAsset, updatedData);

      setEditingAsset(null);
      setEditFormData({});
      setError(null);
      setShowEmployeeDropdown(false);
      setShowEditModal(false); // Close Modal
    } catch (error) {
      console.error('Error saving asset:', error);
      setError('Failed to save changes: ' + error.message);
      loadAssets(); // Revert on error
      if (updatedAssetData) throw error; // Re-throw for modal
    }
  };

  const handleCancelEdit = () => {
    setEditingAsset(null);
    setEditFormData({});
    setError(null);
    setShowEditModal(false); // Close Modal
  };

  // Delete asset handler
  const handleDelete = async (assetId) => {
    try {
      // Optimistic update
      setAssets(prevAssets => prevAssets.filter(asset => asset.id !== assetId));
      
      // Delete from server
      await api.assets.delete(assetId);
      
      setShowDeleteConfirm(null);
      setError(null);
    } catch (error) {
      console.error('Error deleting asset:', error);
      setError('Failed to delete asset: ' + error.message);
      loadAssets(); // Revert on error
    }
  };

  const SidebarItem = ({ id, icon: Icon, label, active, onClick }) => (
    <button
      onClick={() => {
        if (id === 'issues') setFilters({...filters, complianceIssue: 'all'});
        if (id === 'employees') { setEmployeeFilter('all'); setEmployeeSearchTerm(''); }
        onClick(id);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        active 
          ? 'bg-gold-400 text-black shadow-lg shadow-gold-400/20' 
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      <Icon className={`w-5 h-5 ${active ? 'text-black' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
      <span className="font-medium">{label}</span>
      {id === 'issues' && (() => {
        const totalIssues = ((stats.issues?.noMdm || 0) + (stats.issues?.noS1 || 0) + (stats.issues?.noOkta || 0) + (stats.issues?.unassigned || 0) + (stats.issues?.multipleAssets || 0));
        return totalIssues > 0 && (
          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${
            active ? 'bg-black/10 text-black' : 'bg-brand-brown/10 dark:bg-slate-900/30 text-slate-950 dark:text-slate-200'
          }`}>
            {totalIssues > 99 ? '99+' : totalIssues}
          </span>
        );
      })()}
    </button>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900 flex items-center justify-center p-4 transition-colors duration-200">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl p-8 md:p-12 flex items-center gap-12 transition-colors duration-200">
          <div className="flex-1 hidden md:block">
            <div className="bg-slate-900 dark:bg-black rounded-2xl p-8 text-white h-full flex flex-col justify-between relative overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gold-400/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold-600/10 rounded-full blur-3xl -ml-32 -mb-32"></div>
              
              <div>
                <div className="p-3 bg-white/10 rounded-xl w-fit mb-6 backdrop-blur-sm">
                  <Shield className="w-8 h-8 text-gold-400" />
                </div>
                <h1 className="text-3xl font-bold mb-4 text-white">ServiceTitan</h1>
                <p className="text-slate-300 text-lg leading-relaxed">
                  Secure, intelligent asset management for modern teams. Track, manage, and audit your inventory with ease.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-12">
                <div className="p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
                  <Server className="w-6 h-6 mb-2 text-gold-400" />
                  <p className="text-sm font-semibold text-white">Centralized DB</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
                  <Shield className="w-6 h-6 mb-2 text-gold-400" />
                  <p className="text-sm font-semibold text-white">Secure Auth</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1">
            {authView === 'login' ? (
              <Login onSwitchToRegister={() => setAuthView('register')} />
            ) : (
              <Register onSwitchToLogin={() => setAuthView('login')} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-brand-black text-brand-black dark:text-brand-light transition-colors duration-200">
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-white dark:bg-brand-dark border-r border-gray-100 dark:border-brand-darker flex-shrink-0 hidden md:flex flex-col p-6 z-20 transition-colors duration-200">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="p-2.5 bg-brand-gold rounded-xl shadow-lg shadow-brand-gold/20">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">ServiceTitan</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Asset Management</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <SidebarItem 
            id="dashboard" 
            icon={TrendingUp} 
            label="Dashboard" 
            active={currentView === 'dashboard'} 
            onClick={setCurrentView} 
          />
          <SidebarItem 
            id="assets" 
            icon={Laptop} 
            label="Assets Inventory" 
            active={currentView === 'assets'} 
            onClick={() => {
              setCurrentView('assets');
              setFilters({
                deviceType: 'all',
                status: 'all',
                complianceIssue: 'all',
                healthScore: 'all'
              });
              setSearchTerm('');
              setSelectedAssetIds(new Set());
            }} 
          />
          <SidebarItem 
            id="imports" 
            icon={Database} 
            label="Imports" 
            active={currentView === 'imports'} 
            onClick={setCurrentView} 
          />
          <SidebarItem 
            id="employees"  
            icon={Users} 
            label="Employees" 
            active={currentView === 'employees'} 
            onClick={setCurrentView} 
          />
          <SidebarItem 
            id="issues" 
            icon={AlertCircle} 
            label="Compliance & Issues" 
            active={currentView === 'issues'} 
            onClick={setCurrentView} 
          />
          <SidebarItem 
            id="settings" 
            icon={Settings} 
            label="Settings" 
            active={currentView === 'settings'} 
            onClick={setCurrentView} 
          />
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100 dark:border-brand-darker">
          <button
            onClick={handleMigration}
            disabled={isMigrating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-gold/10 dark:bg-brand-darker text-brand-gold dark:text-brand-gold rounded-xl hover:bg-brand-gold/20 dark:hover:bg-brand-black transition-all font-medium mb-3 disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            {isMigrating ? 'Migrating...' : 'Migrate Local Data'}
          </button>
          
          <button
            onClick={() => setShowImportModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-black dark:bg-white text-white dark:text-brand-black rounded-xl hover:bg-brand-dark dark:hover:bg-brand-light transition-all shadow-lg shadow-gray-200 dark:shadow-none font-medium"
          >
            <Upload className="w-4 h-4" />
            Import Data
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-gray-50 dark:bg-brand-black transition-colors duration-200">
        {/* Top Header */}
        <header className="bg-white/80 dark:bg-brand-dark/80 backdrop-blur-xl border-b border-gray-100 dark:border-brand-darker sticky top-0 z-10 px-8 py-4 flex items-center justify-between transition-colors duration-200">
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 z-10" />
              <input
                type="text"
                placeholder={currentView === 'employees' ? "Search employees..." : "Search assets by serial, tag, user..."}
                value={currentView === 'employees' ? employeeSearchTerm : searchTerm}
                onChange={(e) => currentView === 'employees' ? setEmployeeSearchTerm(e.target.value) : setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:border-gold-400 dark:focus:border-gold-400 focus:ring-4 focus:ring-gold-400/10 rounded-2xl transition-all outline-none text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-6">
            <button
              onClick={toggleTheme}
              className="p-3 hover:bg-gray-50 dark:hover:bg-brand-darker rounded-xl text-gray-500 dark:text-gray-400 hover:text-brand-gold dark:hover:text-brand-gold transition-all"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-3 hover:bg-gray-50 dark:hover:bg-brand-darker rounded-xl text-gray-500 dark:text-gray-400 hover:text-brand-gold dark:hover:text-brand-gold transition-all"
                title="Export Data"
              >
                <Download className="w-5 h-5" />
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-brand-dark rounded-2xl shadow-xl border border-gray-100 dark:border-brand-darker p-2 w-48 z-50">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-brand-darker rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-brand-green" />
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-brand-darker rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-brand-gold" />
                    Export as Excel
                  </button>
                </div>
              )}
            </div>
            <button 
              onClick={logout}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-gold to-brand-brown p-0.5 hover:scale-105 transition-transform"
              title={`Logout (${user?.username})`}
            >
              <div className="w-full h-full rounded-full bg-white dark:bg-brand-dark flex items-center justify-center">
                <LogOut className="w-5 h-5 text-brand-gold dark:text-brand-gold" />
              </div>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {migrationStatus && (
              <div className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 mb-4">
                <Database className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{migrationStatus}</p>
                <button onClick={() => setMigrationStatus(null)} className="ml-auto text-indigo-400 hover:text-indigo-700">
                  <XCircle className="w-5 h-5" />
                </button>
      </div>
            )}
            
            {error && (
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-950/20 dark:border-slate-950/40 text-slate-950 dark:text-slate-200 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            )}
        {currentView === 'dashboard' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-[#cc9a48] to-[#826343] rounded-3xl p-6 shadow-xl text-white">
                <Package className="w-10 h-10 mb-4 opacity-90" />
                <p className="text-sm opacity-80 font-medium">Total Assets</p>
                <p className="text-4xl font-bold">{stats.total || 0}</p>
              </div>
              
              <div className="bg-gradient-to-br from-[#13361c] to-[#212717] rounded-3xl p-6 shadow-xl text-white">
                <Users className="w-10 h-10 mb-4 opacity-90" />
                <p className="text-sm opacity-80 font-medium">Deployed</p>
                <p className="text-4xl font-bold">{stats.deployed || 0}</p>
              </div>
              
              <div className="bg-gradient-to-br from-[#826343] to-[#212717] rounded-3xl p-6 shadow-xl text-white">
                <DollarSign className="w-10 h-10 mb-4 opacity-90" />
                <p className="text-sm opacity-80 font-medium">Total Value</p>
                <p className="text-4xl font-bold">
                  {new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: 'USD', 
                    notation: 'compact', 
                    maximumFractionDigits: 1 
                  }).format(stats.totalValue || 0)}
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-[#212717] to-[#161616] rounded-3xl p-6 shadow-xl text-white">
                <AlertCircle className="w-10 h-10 mb-4 opacity-90" />
                <p className="text-sm opacity-80 font-medium">Issues</p>
                <p className="text-4xl font-bold">{((stats.issues?.noMdm || 0) + (stats.issues?.noS1 || 0) + (stats.issues?.noOkta || 0))}</p>
              </div>
            </div>

            {/* Compliance Health Score Summary */}
            <div className="bg-white/80 dark:bg-brand-dark/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-brand-darker transition-colors duration-200">
              <h2 className="text-2xl font-bold mb-6 text-brand-black dark:text-white">Compliance Health Score</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-brand-brown/10 dark:bg-brand-brown/20 rounded-2xl p-6 border-2 border-brand-brown/20 dark:border-brand-brown/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-brand-brown dark:text-brand-gold">Critical</span>
                    <span className="text-2xl font-bold text-brand-brown dark:text-brand-gold">{stats.healthScore?.critical || 0}</span>
                  </div>
                  <p className="text-xs text-brand-brown/60 dark:text-brand-brown/80">&lt;50% compliance</p>
                </div>
                <div className="bg-brand-gold/10 dark:bg-brand-gold/20 rounded-2xl p-6 border-2 border-brand-gold/20 dark:border-brand-gold/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-brand-gold dark:text-white">Warning</span>
                    <span className="text-2xl font-bold text-brand-gold dark:text-white">{stats.healthScore?.warning || 0}</span>
                  </div>
                  <p className="text-xs text-brand-gold/60 dark:text-brand-gold/80">50-99% compliance</p>
                </div>
                <div className="bg-brand-green/10 dark:bg-brand-green/20 rounded-2xl p-6 border-2 border-brand-green/20 dark:border-brand-green/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-brand-green dark:text-brand-green">Healthy</span>
                    <span className="text-2xl font-bold text-brand-green dark:text-brand-green">{stats.healthScore?.healthy || 0}</span>
                  </div>
                  <p className="text-xs text-brand-green/60 dark:text-brand-green/80">100% compliance</p>
                </div>
                <div className="bg-brand-light/20 dark:bg-brand-dark/40 rounded-2xl p-6 border-2 border-brand-light/50 dark:border-brand-darker">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-brand-black dark:text-brand-light">Average</span>
                    <span className="text-2xl font-bold text-brand-black dark:text-white">{stats.healthScore?.average || 0}%</span>
                  </div>
                  <p className="text-xs text-brand-black/60 dark:text-brand-light/60">Overall health</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFilters({...filters, healthScore: 'critical'});
                  setCurrentView('assets');
                }}
                className="w-full py-3 bg-brand-dark text-white rounded-xl font-semibold hover:bg-brand-black transition-all shadow-lg shadow-brand-dark/20"
              >
                View {stats.healthScore?.critical || 0} Critical Assets
              </button>
            </div>

            <div className="bg-white/80 dark:bg-brand-dark/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-brand-darker transition-colors duration-200">
              <h2 className="text-2xl font-bold mb-6 text-brand-black dark:text-white">System Compliance</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Endpoint Central (MDM)</span>
                    <span className="font-bold">{stats.mdmCompliance}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all" style={{ width: `${stats.mdmCompliance}%` }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">SentinelOne (S1)</span>
                    <span className="font-bold">{stats.s1Compliance}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all" style={{ width: `${stats.s1Compliance}%` }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Okta Fastpass</span>
                    <span className="font-bold">{stats.oktaCompliance}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-gradient-to-r from-purple-500 to-violet-600 h-3 rounded-full transition-all" style={{ width: `${stats.oktaCompliance}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 transition-colors duration-200">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Action Required</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setFilters({...filters, complianceIssue: 'noMdm'});
                    setCurrentView('assets');
                  }}
                  className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 rounded-2xl border-2 border-slate-950/20 dark:border-slate-950/40 hover:border-slate-950/40 dark:hover:border-slate-950/60 transition-all hover:scale-105 text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-slate-950 rounded-xl">
                      <XCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-3xl font-bold text-slate-950 dark:text-slate-200">{stats.issues?.noMdm || 0}</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Missing MDM</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Not enrolled in Endpoint Central</p>
                </button>

                <button
                  onClick={() => {
                    setFilters({...filters, complianceIssue: 'noS1'});
                    setCurrentView('assets');
                  }}
                  className="p-6 bg-gradient-to-br from-gold-50 to-gold-100 dark:from-gold-900/20 dark:to-gold-800/20 rounded-2xl border-2 border-gold-500/30 dark:border-gold-500/40 hover:border-gold-500/50 dark:hover:border-gold-500/60 transition-all hover:scale-105 text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-gold-500 rounded-xl">
                      <XCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-3xl font-bold text-gold-600 dark:text-gold-400">{stats.issues?.noS1 || 0}</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">S1 Agent Inactive</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">SentinelOne protection missing</p>
                </button>

                <button
                  onClick={() => {
                    setFilters({...filters, complianceIssue: 'noOkta'});
                    setCurrentView('assets');
                  }}
                  className="p-6 bg-gradient-to-br from-gold-50 to-amber-50 dark:from-gold-900/20 dark:to-amber-900/20 rounded-2xl border-2 border-gold-400/30 dark:border-gold-400/40 hover:border-gold-400/50 dark:hover:border-gold-400/60 transition-all hover:scale-105 text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-gold-400 rounded-xl">
                      <XCircle className="w-5 h-5 text-black" />
                    </div>
                    <span className="text-3xl font-bold text-gold-600 dark:text-gold-400">{stats.issues?.noOkta || 0}</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No Okta Enrollment</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Zero trust not configured</p>
                </button>

                <button
                  onClick={() => {
                    setFilters({...filters, complianceIssue: 'unassigned'});
                    setCurrentView('assets');
                  }}
                  className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-100 hover:border-blue-300 transition-all hover:scale-105 text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-blue-500 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-3xl font-bold text-blue-600">{stats.issues.unassigned || 0}</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Unassigned</h3>
                  <p className="text-sm text-gray-600">Devices without user assignment</p>
                </button>

                <button
                  onClick={() => {
                    setCurrentView('employees');
                    setEmployeeFilter('multiple');
                    setEmployeeSearchTerm('');
                  }}
                  className="p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border-2 border-purple-100 hover:border-purple-300 transition-all hover:scale-105 text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-purple-500 rounded-xl">
                      <Users className="w-5 h-5 text-white" />
              </div>
                    <span className="text-3xl font-bold text-purple-600">{stats.issues.multipleAssets || 0}</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">Multiple Assets</h3>
                  <p className="text-sm text-gray-600">Employees with 2+ assets assigned</p>
                </button>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Device Type Distribution */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 transition-colors duration-200">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Device Type Distribution</h2>
                {chartData.deviceType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData.deviceType}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelStyle={{ fill: isDark ? '#f1f5f9' : '#1f2937', fontSize: 12, fontWeight: 500 }}
                        outerRadius={100}
                        fill="#cc9a48"
                        dataKey="value"
                      >
                        {chartData.deviceType.map((entry, index) => {
                          // ServiceTitan color palette: Gold, Brown, Dark Green, Dark Olive, Silver
                          const colors = ['#cc9a48', '#826343', '#13361c', '#212717', '#dfdfdf'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? '#1e293b' : '#ffffff',
                          border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: isDark ? '#f1f5f9' : '#1f2937'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* Status Distribution */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 transition-colors duration-200">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Status Distribution</h2>
                {chartData.status.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData.status}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelStyle={{ fill: isDark ? '#f1f5f9' : '#1f2937', fontSize: 12, fontWeight: 500 }}
                        outerRadius={100}
                        fill="#cc9a48"
                        dataKey="value"
                      >
                        {chartData.status.map((entry, index) => {
                          // Map status to appropriate colors: Active=Gold, Storage=Brown, Retired=Dark Green, Broken=Dark Olive
                          const statusColors = {
                            'Active': '#cc9a48',
                            'Storage': '#826343',
                            'Retired': '#13361c',
                            'Broken': '#212717',
                            'Unknown': '#dfdfdf'
                          };
                          const color = statusColors[entry.name] || ['#cc9a48', '#826343', '#13361c', '#212717'][index % 4];
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? '#1e293b' : '#ffffff',
                          border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: isDark ? '#f1f5f9' : '#1f2937'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* Top Models */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 transition-colors duration-200">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Top Models</h2>
                {chartData.model.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.model}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e5e7eb'} />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        fontSize={12}
                        stroke={isDark ? '#94a3b8' : '#6b7280'}
                      />
                      <YAxis stroke={isDark ? '#94a3b8' : '#6b7280'} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? '#1e293b' : '#ffffff',
                          border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: isDark ? '#f1f5f9' : '#1f2937'
                        }}
                      />
                      <Bar dataKey="value" fill="#cc9a48" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500">
                    No data available
                  </div>
                )}
              </div>

              {/* Top Manufacturers */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 transition-colors duration-200">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Top Manufacturers</h2>
                {chartData.manufacturer.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData.manufacturer}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e5e7eb'} />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        fontSize={12}
                        stroke={isDark ? '#94a3b8' : '#6b7280'}
                      />
                      <YAxis stroke={isDark ? '#94a3b8' : '#6b7280'} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDark ? '#1e293b' : '#ffffff',
                          border: isDark ? '1px solid #334155' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          color: isDark ? '#f1f5f9' : '#1f2937'
                        }}
                      />
                      <Bar dataKey="value" fill="#826343" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : currentView === 'issues' ? (
          <div className="space-y-6">
            <div className="bg-white/80 dark:bg-brand-dark/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-brand-darker transition-colors duration-200">
              <h2 className="text-2xl font-bold mb-6 text-brand-black dark:text-white">Compliance Issues</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Review and resolve compliance issues across your asset inventory</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-2 border-brand-brown/30 rounded-2xl p-6 bg-brand-brown/5 dark:bg-brand-brown/10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-brand-brown rounded-xl">
                      <XCircle className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-4xl font-bold text-brand-brown dark:text-brand-gold">{stats.issues?.noMdm || 0}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Missing MDM Enrollment</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">These devices are not enrolled in Endpoint Central and lack management capabilities</p>
                  <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFilters({...filters, complianceIssue: 'noMdm'});
                      setCurrentView('assets');
                    }}
                      className="flex-1 py-3 bg-brand-brown text-white rounded-xl font-semibold hover:bg-brand-brown-hover transition-all shadow-lg shadow-brand-brown/20"
                    >
                      View {stats.issues?.noMdm || 0} Assets
                    </button>
                    <button
                      onClick={() => setExpandedInvestigation(expandedInvestigation === 'noMdm' ? null : 'noMdm')}
                      className="px-4 py-3 bg-brand-brown text-white rounded-xl font-semibold hover:bg-brand-brown-hover transition-all shadow-lg shadow-brand-brown/20"
                      title="Investigate"
                    >
                      {expandedInvestigation === 'noMdm' ? 'Hide' : '🔍'}
                  </button>
                  </div>
                  {expandedInvestigation === 'noMdm' && (
                    <div className="mt-4 pt-4 border-t border-brand-brown/20">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Investigation Details ({stats.issues?.noMdm || 0} assets)</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(() => {
                          const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
                          const noMdmAssets = validAssets.filter(a => !a.mdmEnrolled && a.status === 'Active').slice(0, 50);
                          return noMdmAssets.map(asset => (
                            <div 
                              key={asset.id}
                              className="bg-white dark:bg-brand-darker rounded-lg p-2 border border-brand-brown/20 hover:border-brand-brown cursor-pointer transition-colors"
                              onClick={() => {
                                setCurrentView('assets');
                                setSearchTerm(asset.serialNumber);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{asset.computerName || asset.assetTag || 'Unknown'}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">SN: {asset.serialNumber} • {asset.model || 'N/A'}</p>
                                  {asset.assignedUser && <p className="text-xs text-gray-500 dark:text-gray-400">👤 {asset.assignedUser}</p>}
                                </div>
                                <span className="text-xs text-gray-400">→</span>
                              </div>
                            </div>
                          ));
                        })()}
                        {(stats.issues?.noMdm || 0) > 50 && (
                          <p className="text-xs text-gray-500 text-center py-2">... and {(stats.issues?.noMdm || 0) - 50} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-2 border-brand-gold/30 rounded-2xl p-6 bg-brand-gold/5 dark:bg-brand-gold/10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-brand-gold rounded-xl">
                      <XCircle className="w-8 h-8 text-black" />
                    </div>
                    <span className="text-4xl font-bold text-brand-gold">{stats.issues?.noS1 || 0}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">S1 Agent Inactive</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">SentinelOne protection is not active on these devices, leaving them vulnerable</p>
                  <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFilters({...filters, complianceIssue: 'noS1'});
                      setCurrentView('assets');
                    }}
                      className="flex-1 py-3 bg-brand-gold text-black rounded-xl font-semibold hover:bg-brand-gold-hover transition-all shadow-lg shadow-brand-gold/20"
                    >
                      View {stats.issues?.noS1 || 0} Assets
                    </button>
                    <button
                      onClick={() => setExpandedInvestigation(expandedInvestigation === 'noS1' ? null : 'noS1')}
                      className="px-4 py-3 bg-brand-gold text-black rounded-xl font-semibold hover:bg-brand-gold-hover transition-all shadow-lg shadow-brand-gold/20"
                      title="Investigate"
                    >
                      {expandedInvestigation === 'noS1' ? 'Hide' : '🔍'}
                  </button>
                  </div>
                  {expandedInvestigation === 'noS1' && (
                    <div className="mt-4 pt-4 border-t border-brand-gold/20">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Investigation Details ({stats.issues?.noS1 || 0} assets)</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(() => {
                          const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
                          const noS1Assets = validAssets.filter(a => !a.s1Active && a.status === 'Active').slice(0, 50);
                          return noS1Assets.map(asset => (
                            <div 
                              key={asset.id}
                              className="bg-white rounded-lg p-2 border border-orange-100 hover:border-orange-300 cursor-pointer"
                              onClick={() => {
                                setCurrentView('assets');
                                setSearchTerm(asset.serialNumber);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-900">{asset.computerName || asset.assetTag || 'Unknown'}</p>
                                  <p className="text-xs text-gray-500">SN: {asset.serialNumber} • {asset.model || 'N/A'}</p>
                                  {asset.assignedUser && <p className="text-xs text-gray-500">👤 {asset.assignedUser}</p>}
                                </div>
                                <span className="text-xs text-gray-400">→</span>
                              </div>
                            </div>
                          ));
                        })()}
                        {(stats.issues?.noS1 || 0) > 50 && (
                          <p className="text-xs text-gray-500 text-center py-2">... and {(stats.issues?.noS1 || 0) - 50} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-2 border-yellow-200 rounded-2xl p-6 bg-yellow-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-yellow-500 rounded-xl">
                      <XCircle className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-4xl font-bold text-yellow-600">{stats.issues?.noOkta || 0}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Missing Okta Enrollment</h3>
                  <p className="text-sm text-gray-600 mb-4">Zero trust is not configured on these devices, compromising security posture</p>
                  <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFilters({...filters, complianceIssue: 'noOkta'});
                      setCurrentView('assets');
                    }}
                      className="flex-1 py-3 bg-yellow-600 text-white rounded-xl font-semibold hover:bg-yellow-700 transition-all"
                    >
                      View {stats.issues?.noOkta || 0} Assets
                    </button>
                    <button
                      onClick={() => setExpandedInvestigation(expandedInvestigation === 'noOkta' ? null : 'noOkta')}
                      className="px-4 py-3 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 transition-all"
                      title="Investigate"
                    >
                      {expandedInvestigation === 'noOkta' ? 'Hide' : '🔍'}
                  </button>
                  </div>
                  {expandedInvestigation === 'noOkta' && (
                    <div className="mt-4 pt-4 border-t border-yellow-200">
                      <h4 className="text-sm font-bold text-gray-900 mb-3">Investigation Details ({stats.issues?.noOkta || 0} assets)</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(() => {
                          const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
                          const noOktaAssets = validAssets.filter(a => !a.oktaEnrolled && a.status === 'Active').slice(0, 50);
                          return noOktaAssets.map(asset => (
                            <div 
                              key={asset.id}
                              className="bg-white rounded-lg p-2 border border-yellow-100 hover:border-yellow-300 cursor-pointer"
                              onClick={() => {
                                setCurrentView('assets');
                                setSearchTerm(asset.serialNumber);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-900">{asset.computerName || asset.assetTag || 'Unknown'}</p>
                                  <p className="text-xs text-gray-500">SN: {asset.serialNumber} • {asset.model || 'N/A'}</p>
                                  {asset.assignedUser && <p className="text-xs text-gray-500">👤 {asset.assignedUser}</p>}
                                </div>
                                <span className="text-xs text-gray-400">→</span>
                              </div>
                            </div>
                          ));
                        })()}
                        {(stats.issues?.noOkta || 0) > 50 && (
                          <p className="text-xs text-gray-500 text-center py-2">... and {(stats.issues?.noOkta || 0) - 50} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-2 border-blue-200 rounded-2xl p-6 bg-blue-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-blue-500 rounded-xl">
                      <AlertCircle className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-4xl font-bold text-blue-600">{stats.issues?.unassigned || 0}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Unassigned Devices</h3>
                  <p className="text-sm text-gray-600 mb-4">These active devices have no user assignment and may require attention</p>
                  <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFilters({...filters, complianceIssue: 'unassigned'});
                      setCurrentView('assets');
                    }}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
                    >
                      View {stats.issues?.unassigned || 0} Assets
                    </button>
                    <button
                      onClick={() => setExpandedInvestigation(expandedInvestigation === 'unassigned' ? null : 'unassigned')}
                      className="px-4 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-all"
                      title="Investigate"
                    >
                      {expandedInvestigation === 'unassigned' ? 'Hide' : '🔍'}
                  </button>
                </div>
                  {expandedInvestigation === 'unassigned' && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <h4 className="text-sm font-bold text-gray-900 mb-3">Investigation Details ({stats.issues?.unassigned || 0} assets)</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(() => {
                          const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
                          const unassignedAssets = validAssets.filter(a => (!a.assignedUser || a.assignedUser.trim() === '') && a.status === 'Active').slice(0, 50);
                          return unassignedAssets.map(asset => (
                            <div 
                              key={asset.id}
                              className="bg-white rounded-lg p-2 border border-blue-100 hover:border-blue-300 cursor-pointer"
                              onClick={() => {
                                setCurrentView('assets');
                                setSearchTerm(asset.serialNumber);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-900">{asset.computerName || asset.assetTag || 'Unknown'}</p>
                                  <p className="text-xs text-gray-500">SN: {asset.serialNumber} • {asset.model || 'N/A'}</p>
                                  <p className="text-xs text-gray-500">📍 {asset.location || 'N/A'}</p>
                                </div>
                                <span className="text-xs text-gray-400">→</span>
                              </div>
                            </div>
                          ));
                        })()}
                        {(stats.issues?.unassigned || 0) > 50 && (
                          <p className="text-xs text-gray-500 text-center py-2">... and {(stats.issues?.unassigned || 0) - 50} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-2 border-purple-200 rounded-2xl p-6 bg-purple-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-purple-500 rounded-xl">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-4xl font-bold text-purple-600">{stats.issues?.multipleAssets || 0}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Employees with Multiple Assets</h3>
                  <p className="text-sm text-gray-600 mb-4">These employees have 2 or more assets assigned, which may indicate an issue</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setCurrentView('employees');
                        setEmployeeFilter('multiple');
                        setEmployeeSearchTerm('');
                      }}
                      className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all"
                    >
                      View {stats.issues?.multipleAssets || 0} Employees
                    </button>
                    <button
                      onClick={() => setExpandedInvestigation(expandedInvestigation === 'multipleAssets' ? null : 'multipleAssets')}
                      className="px-4 py-3 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600 transition-all"
                      title="Investigate"
                    >
                      {expandedInvestigation === 'multipleAssets' ? 'Hide' : '🔍'}
                    </button>
                  </div>
                  {expandedInvestigation === 'multipleAssets' && (
                    <div className="mt-4 pt-4 border-t border-purple-200">
                      <h4 className="text-sm font-bold text-gray-900 mb-3">Investigation Details ({stats.issues?.multipleAssets || 0} employees)</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {(() => {
                          const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
                          const userAssetMap = new Map();
                          validAssets.forEach(asset => {
                            if (asset.assignedUser && asset.assignedUser.trim() !== '') {
                              const email = asset.assignedUser.trim().toLowerCase();
                              if (!userAssetMap.has(email)) {
                                userAssetMap.set(email, {
                                  email: asset.assignedUser.trim(),
                                  firstName: asset.firstName || '',
                                  lastName: asset.lastName || '',
                                  assets: []
                                });
                              }
                              userAssetMap.get(email).assets.push(asset);
                              if (!userAssetMap.get(email).firstName && asset.firstName) {
                                userAssetMap.get(email).firstName = asset.firstName;
                              }
                              if (!userAssetMap.get(email).lastName && asset.lastName) {
                                userAssetMap.get(email).lastName = asset.lastName;
                              }
                            }
                          });
                          const employeesWithMultiple = Array.from(userAssetMap.values())
                            .filter(user => user.assets.length >= 2)
                            .sort((a, b) => b.assets.length - a.assets.length)
                            .slice(0, 50);
                          
                          return employeesWithMultiple.map(employee => {
                            const fullName = employee.firstName && employee.lastName
                              ? `${employee.firstName} ${employee.lastName}`
                              : employee.firstName || employee.lastName || employee.email.split('@')[0];
                            
                            return (
                              <div 
                                key={employee.email}
                                className="bg-white rounded-lg p-3 border border-purple-100 hover:border-purple-300 cursor-pointer"
                                onClick={() => {
                                  setCurrentView('employees');
                                  setEmployeeFilter('multiple');
                                  setEmployeeSearchTerm(employee.email.split('@')[0]);
                                }}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">{fullName}</p>
                                    <p className="text-xs text-gray-500">{employee.email}</p>
                                  </div>
                                  <span className="px-2 py-1 bg-purple-600 text-white rounded-full text-xs font-bold">
                                    {employee.assets.length} assets
                                  </span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-purple-50">
                                  <p className="text-xs font-semibold text-gray-700 mb-1">Assigned Assets:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {employee.assets.map(asset => (
                                      <span 
                                        key={asset.id}
                                        className="px-2 py-0.5 bg-purple-50 border border-purple-200 rounded text-xs text-gray-700"
                                      >
                                        {asset.computerName || asset.assetTag || asset.serialNumber}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                        {(stats.issues?.multipleAssets || 0) > 50 && (
                          <p className="text-xs text-gray-500 text-center py-2">... and {(stats.issues?.multipleAssets || 0) - 50} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 transition-colors duration-200">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Issue Summary</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-brown/10 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-slate-950 dark:text-slate-200">{stats.issues?.noMdm || 0}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">MDM Compliance</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{stats.mdmCompliance}% enrolled</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{(100 - parseFloat(stats.mdmCompliance)).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Missing</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gold-100 dark:bg-gold-900/30 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-gold-600 dark:text-gold-400">{stats.issues?.noS1 || 0}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">S1 Protection</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{stats.s1Compliance}% active</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{(100 - parseFloat(stats.s1Compliance)).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Inactive</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.issues?.noOkta || 0}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Okta Zero Trust</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{stats.oktaCompliance}% enrolled</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{(100 - parseFloat(stats.oktaCompliance)).toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Not Enrolled</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.issues?.unassigned || 0}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">User Assignment</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{Math.max(0, (stats.total || 0) - (stats.issues?.unassigned || 0))} assigned</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{(stats.total || 0) > 0 ? (((stats.issues?.unassigned || 0) / (stats.total || 1)) * 100).toFixed(1) : 0}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Unassigned</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{stats.issues?.multipleAssets || 0}</span>
              </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Multiple Assets</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Employees with 2+ assets</p>
            </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.issues?.multipleAssets || 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Employees</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Assets with Issues */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 transition-colors duration-200">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Assets Requiring Attention</h2>
              <div className="space-y-4">
                {(() => {
                  const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
                  const assetsWithIssues = validAssets.filter(asset => {
                    return (asset.status === 'Active' && !asset.mdmEnrolled) ||
                           (asset.status === 'Active' && !asset.s1Active) ||
                           (asset.status === 'Active' && !asset.oktaEnrolled) ||
                           (asset.status === 'Active' && (!asset.assignedUser || asset.assignedUser.trim() === ''));
                  }).slice(0, 20); // Show top 20

                  if (assetsWithIssues.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>No assets with compliance issues found!</p>
                      </div>
                    );
                  }

                  return assetsWithIssues.map(asset => {
                    const issues = [];
                    if (asset.status === 'Active' && !asset.mdmEnrolled) issues.push('No MDM');
                    if (asset.status === 'Active' && !asset.s1Active) issues.push('No S1');
                    if (asset.status === 'Active' && !asset.oktaEnrolled) issues.push('No Okta');
                    if (asset.status === 'Active' && (!asset.assignedUser || asset.assignedUser.trim() === '')) issues.push('Unassigned');

                    return (
                      <div 
                        key={asset.id} 
                        className="bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
                        onClick={() => {
                          setCurrentView('assets');
                          setSearchTerm(asset.serialNumber);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {asset.computerName || asset.assetTag || 'Unknown'}
                              </h3>
                              {asset.deviceType === 'Mac' && (
                                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-1.02.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                </svg>
                              )}
                              {asset.deviceType === 'Windows' && (
                                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22L10 20.8v-7.45l10 1.5z"/>
                                </svg>
                              )}
                              <span className="text-sm text-gray-500 dark:text-gray-400">SN: {asset.serialNumber}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {issues.map((issue, idx) => (
                                <span 
                                  key={idx}
                                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    issue === 'No MDM' ? 'bg-brand-brown/10 dark:bg-brand-brown/20 text-brand-brown dark:text-brand-brown' :
                                    issue === 'No S1' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                                    issue === 'No Okta' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  }`}
                                >
                                  {issue}
                                </span>
                              ))}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              <span>{asset.model || 'N/A'}</span>
                              {asset.assignedUser && <span className="ml-4">👤 {asset.assignedUser}</span>}
                              {asset.department && <span className="ml-4">📁 {asset.department}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              asset.status === 'Active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                            }`}>
                              {asset.status || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              {(() => {
                const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
                const totalIssues = validAssets.filter(asset => {
                  return (asset.status === 'Active' && !asset.mdmEnrolled) ||
                         (asset.status === 'Active' && !asset.s1Active) ||
                         (asset.status === 'Active' && !asset.oktaEnrolled) ||
                         (asset.status === 'Active' && (!asset.assignedUser || asset.assignedUser.trim() === ''));
                }).length;
                if (totalIssues > 20) {
                  return (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setCurrentView('assets')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
                      >
                        View All {totalIssues} Assets with Issues
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Employees with Multiple Assets */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 transition-colors duration-200">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Employees with Multiple Assets</h2>
              <p className="text-gray-600 mb-6">These employees have 2 or more assets assigned, which may indicate an assignment issue</p>
              <div className="space-y-4">
                {(() => {
                  const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
                  
                  // Group assets by assigned user
                  const userAssetMap = new Map();
                  validAssets.forEach(asset => {
                    if (asset.assignedUser && asset.assignedUser.trim() !== '') {
                      const email = asset.assignedUser.trim().toLowerCase();
                      if (!userAssetMap.has(email)) {
                        userAssetMap.set(email, {
                          email: asset.assignedUser.trim(),
                          firstName: asset.firstName || '',
                          lastName: asset.lastName || '',
                          assets: [],
                          department: asset.department || '',
                          location: asset.location || ''
                        });
                      }
                      userAssetMap.get(email).assets.push(asset);
                      if (!userAssetMap.get(email).department && asset.department) {
                        userAssetMap.get(email).department = asset.department;
                      }
                      if (!userAssetMap.get(email).location && asset.location) {
                        userAssetMap.get(email).location = asset.location;
                      }
                      if (!userAssetMap.get(email).firstName && asset.firstName) {
                        userAssetMap.get(email).firstName = asset.firstName;
                      }
                      if (!userAssetMap.get(email).lastName && asset.lastName) {
                        userAssetMap.get(email).lastName = asset.lastName;
                      }
                    }
                  });

                  // Filter to only employees with 2+ assets
                  const employeesWithMultiple = Array.from(userAssetMap.values())
                    .filter(user => user.assets.length >= 2)
                    .sort((a, b) => b.assets.length - a.assets.length)
                    .slice(0, 20); // Show top 20

                  if (employeesWithMultiple.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>No employees with multiple assets found!</p>
                      </div>
                    );
                  }

                  return employeesWithMultiple.map((employee, index) => {
                    const fullName = employee.firstName && employee.lastName
                      ? `${employee.firstName} ${employee.lastName}`
                      : employee.firstName || employee.lastName || employee.email.split('@')[0];

                    const isExpanded = expandedInvestigation === `employee-${employee.email}`;
                    
                    return (
                      <div 
                        key={employee.email}
                        className="border-2 border-purple-200 rounded-xl p-4 hover:border-purple-300 transition-all bg-purple-50"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => {
                            setCurrentView('employees');
                            setEmployeeSearchTerm(employee.email.split('@')[0]);
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-500 rounded-lg">
                                  <User className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-gray-900">{fullName}</h3>
                                  <p className="text-sm text-gray-500">{employee.email}</p>
                                </div>
                                <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm font-bold">
                                  {employee.assets.length} Assets
                                </span>
                              </div>
                              {(employee.department || employee.location) && (
                                <div className="flex gap-4 text-sm text-gray-600 mb-2">
                                  {employee.department && <span>📁 {employee.department}</span>}
                                  {employee.location && <span>📍 {employee.location}</span>}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {employee.assets.slice(0, 5).map(asset => (
                                  <span 
                                    key={asset.id}
                                    className="px-2 py-1 bg-white border border-purple-200 rounded-lg text-xs font-semibold text-gray-700"
                                  >
                                    {asset.computerName || asset.assetTag || asset.serialNumber}
                                  </span>
                                ))}
                                {employee.assets.length > 5 && (
                                  <span className="px-2 py-1 bg-white border border-purple-200 rounded-lg text-xs font-semibold text-gray-700">
                                    +{employee.assets.length - 5} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-purple-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedInvestigation(isExpanded ? null : `employee-${employee.email}`);
                            }}
                            className="w-full py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200 transition-all flex items-center justify-center gap-2"
                          >
                            {isExpanded ? 'Hide Details' : '🔍 Show All Assets'}
                          </button>
                          {isExpanded && (
                            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                              {employee.assets.map(asset => (
                                <div 
                                  key={asset.id}
                                  className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-purple-100 dark:border-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700 cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentView('assets');
                                    setSearchTerm(asset.serialNumber);
                                  }}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{asset.computerName || asset.assetTag || 'Unknown'}</p>
                                        {asset.deviceType === 'Mac' && (
                                          <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-1.02.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                          </svg>
                                        )}
                                        {asset.deviceType === 'Windows' && (
                                          <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22L10 20.8v-7.45l10 1.5z"/>
                                          </svg>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">SN: {asset.serialNumber}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{asset.model || 'N/A'} • {asset.deviceType || 'N/A'}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        {asset.mdmEnrolled && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">MDM</span>}
                                        {asset.s1Active && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">S1</span>}
                                        {asset.oktaEnrolled && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Okta</span>}
                                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                                          asset.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                        }`}>
                                          {asset.status || 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-xs text-gray-400 ml-2">→</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              {(() => {
                const validAssets = assets.filter(a => a && a.serialNumber && a.serialNumber.trim() !== '');
                const userAssetMap = new Map();
                validAssets.forEach(asset => {
                  if (asset.assignedUser && asset.assignedUser.trim() !== '') {
                    const email = asset.assignedUser.trim().toLowerCase();
                    userAssetMap.set(email, (userAssetMap.get(email) || 0) + 1);
                  }
                });
                const totalMultiple = Array.from(userAssetMap.values()).filter(count => count >= 2).length;
                
                if (totalMultiple > 20) {
                  return (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => {
                          setCurrentView('employees');
                          setEmployeeFilter('multiple');
                          setEmployeeSearchTerm('');
                        }}
                        className="px-6 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all"
                      >
                        View All {totalMultiple} Employees with Multiple Assets
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        ) : currentView === 'employees' ? (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Employees</h2>
                  <p className="text-sm text-gray-600 mt-1">Okta user information and assigned assets</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {employeeFilter !== 'all' || employeeSearchTerm ? 'Filtered' : 'Total'} Employees
                  </p>
                  <p className="text-3xl font-bold text-purple-600">{employees.length}</p>
                  {(employeeFilter !== 'all' || employeeSearchTerm) && (
                    <p className="text-xs text-gray-400 mt-1">of {allEmployeesCount} total</p>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search employees by name, email, or department..."
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-400/20 focus:border-gold-400 dark:focus:border-gold-400 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-400/20 focus:border-gold-400 dark:focus:border-gold-400 transition-all"
                  >
                    <option value="all">All Employees</option>
                    <option value="multiple">Multiple Assets (2+)</option>
                    <option value="single">Single Asset</option>
                  </select>

                  {employeeFilter !== 'all' && (
                    <button
                      onClick={() => setEmployeeFilter('all')}
                      className="px-4 py-2.5 bg-brand-brown/10 text-brand-brown rounded-xl text-sm font-medium hover:bg-gold-200 dark:hover:bg-gold-900/30 transition-all"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-500 font-medium">
                Showing {employees.length} employee{employees.length !== 1 ? 's' : ''}
                {employeeFilter === 'multiple' && ` (with 2+ assets)`}
                {employeeFilter === 'single' && ` (with 1 asset)`}
              </div>
            </div>

            {employees.length === 0 ? (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-12 text-center border border-gray-100 dark:border-slate-700 transition-colors duration-200">
                <User className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">No Employees Found</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {assets.length === 0 
                    ? 'Import assets with assigned users to see employees' 
                    : 'No employees match your search criteria'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {employees.map((employee, index) => {
                  const hasMultipleAssets = employee.totalAssets >= 2;
                  return (
                  <div key={employee.email} className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all border-2 ${hasMultipleAssets ? 'border-purple-300 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-gray-100 dark:border-slate-700'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-4 rounded-xl ${hasMultipleAssets ? 'bg-gradient-to-br from-purple-600 to-violet-700' : 'bg-gradient-to-br from-purple-500 to-violet-600'}`}>
                          <User className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{employee.name}</h3>
                            {hasMultipleAssets && (
                              <span className="px-2 py-1 bg-purple-600 text-white rounded-full text-xs font-bold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Multiple Assets
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{employee.email}</p>
                          {(employee.department || employee.location) && (
                            <div className="flex gap-4 mt-2 text-xs text-gray-600">
                              {employee.department && <span>📁 {employee.department}</span>}
                              {employee.location && <span>📍 {employee.location}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total Assets</p>
                        <p className="text-3xl font-bold text-purple-600">{employee.totalAssets}</p>
                        <p className="text-xs text-gray-500 mt-1">{employee.activeAssets} active</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs text-gray-600 mb-1">MDM Compliance</p>
                        <p className="text-lg font-bold text-blue-600">
                          {employee.totalAssets > 0 ? Math.round((employee.mdmCompliant / employee.totalAssets) * 100) : 0}%
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3">
                        <p className="text-xs text-gray-600 mb-1">S1 Compliance</p>
                        <p className="text-lg font-bold text-green-600">
                          {employee.totalAssets > 0 ? Math.round((employee.s1Compliant / employee.totalAssets) * 100) : 0}%
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-xl p-3">
                        <p className="text-xs text-gray-600 mb-1">Okta Compliance</p>
                        <p className="text-lg font-bold text-purple-600">
                          {employee.totalAssets > 0 ? Math.round((employee.oktaCompliant / employee.totalAssets) * 100) : 0}%
                        </p>
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-3">
                        <p className="text-xs text-gray-600 mb-1">Total Value</p>
                        <p className="text-lg font-bold text-indigo-600">
                          ${employee.totalValue > 0 ? (employee.totalValue / 1000).toFixed(0) + 'K' : '0'}
                        </p>
                      </div>
                    </div>

                    {employee.assets.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Assigned Assets ({employee.assets.length})</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {employee.assets.map(asset => (
                            <div 
                              key={asset.id} 
                              className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 border border-gray-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all cursor-pointer"
                              onClick={() => {
                                setCurrentView('assets');
                                setSearchTerm(asset.serialNumber);
                              }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {asset.computerName || asset.assetTag || 'Unknown'}
                                  </p>
                                  <p className="text-xs text-gray-500">{asset.model || 'N/A'}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  asset.status === 'Active' ? 'bg-green-100 text-green-700' : 
                                  asset.status === 'Storage' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {asset.status || 'N/A'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <p className="text-xs text-gray-500">SN: {asset.serialNumber}</p>
                              </div>
                              <div className="flex items-center gap-1 mt-2">
                                {asset.mdmEnrolled && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">MDM</span>
                                )}
                                {asset.s1Active && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">S1</span>
                                )}
                                {asset.oktaEnrolled && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold">Okta</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : currentView === 'settings' ? (
          <SettingsView onLoadAssets={loadAssets} />
        ) : currentView === 'imports' ? (
          <ImportsView />
        ) : (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-400/20 focus:border-gold-400 dark:focus:border-gold-400 transition-all"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowCleanupModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-2xl font-medium hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center"
                    title="Find and clean up duplicate assets"
                  >
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    Cleanup Duplicates
                  </button>
                  <div className="relative">
                    <button 
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      disabled={isExporting}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-medium hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    <Download className="w-5 h-5 mr-2" />
                      {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                    {showExportMenu && (
                      <div className="absolute right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-2 z-50 min-w-[150px]">
                        <button
                          onClick={() => handleExport('csv')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
                        >
                          Export as CSV
                        </button>
                        <button
                          onClick={() => handleExport('excel')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
                        >
                          Export as Excel
                    </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <select
                  value={filters.deviceType}
                  onChange={(e) => setFilters({...filters, deviceType: e.target.value})}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-400/20 focus:border-gold-400 dark:focus:border-gold-400 transition-all"
                >
                  <option value="all">All Types</option>
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

                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-400/20 focus:border-gold-400 dark:focus:border-gold-400 transition-all"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Storage">Storage</option>
                  <option value="Retired">Retired</option>
                  <option value="Broken">Broken</option>
                </select>

                <select
                  value={filters.complianceIssue}
                  onChange={(e) => setFilters({...filters, complianceIssue: e.target.value})}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-400/20 focus:border-gold-400 dark:focus:border-gold-400 transition-all"
                >
                  <option value="all">All Compliance</option>
                  <option value="noMdm">Missing MDM</option>
                  <option value="noS1">Missing S1</option>
                  <option value="noOkta">Missing Okta</option>
                  <option value="unassigned">Unassigned</option>
                </select>

                <select
                  value={filters.healthScore}
                  onChange={(e) => setFilters({...filters, healthScore: e.target.value})}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gold-400/20 focus:border-gold-400 dark:focus:border-gold-400 transition-all"
                >
                  <option value="all">All Health Scores</option>
                  <option value="critical">Critical (&lt;50%)</option>
                  <option value="warning">Warning (50-99%)</option>
                  <option value="healthy">Healthy (100%)</option>
                </select>

                {(filters.complianceIssue !== 'all' || filters.healthScore !== 'all') && (
                  <button
                    onClick={() => setFilters({...filters, complianceIssue: 'all', healthScore: 'all'})}
                    className="px-4 py-2.5 bg-brand-brown/10 text-brand-brown rounded-xl text-sm font-medium hover:bg-gold-200 dark:hover:bg-gold-900/30 transition-all"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedAssetIds.size > 0 && selectedAssetIds.size === filteredAssets.length}
                    onChange={toggleSelectAll}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="text-sm text-gray-500 font-medium">
                Showing {filteredAssets.length} of {assets.length} assets
                  </div>
                </div>
                
                {selectedAssetIds.size > 0 && (
                  <div className="flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200 bg-white shadow-lg border border-blue-100 px-4 py-2 rounded-xl">
                    <span className="text-sm font-semibold text-blue-900">{selectedAssetIds.size} selected</span>
                    <div className="h-4 w-px bg-gray-200"></div>
                    <button 
                      onClick={() => setShowBulkEditModal(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Bulk Edit
                    </button>
                    <button 
                      onClick={() => setSelectedAssetIds(new Set())}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {filteredAssets.length === 0 ? (
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Assets Found</h3>
                <p className="text-gray-500 mb-6">
                  {assets.length === 0 ? 'Import assets to get started' : 'Try adjusting your filters'}
                </p>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-medium inline-flex items-center"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Import Assets
                </button>
              </div>
            ) : (
              Array.isArray(filteredAssets) && filteredAssets.map(asset => {
                // Safety check: skip invalid assets
                if (!asset || typeof asset !== 'object' || !asset.id || !asset.serialNumber) {
                  return null;
                }
                
                const isSelected = selectedAssetIds.has(asset.id);
                return (
                <div key={asset.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border relative group ${isSelected ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400 dark:ring-blue-500 bg-blue-50/30 dark:bg-blue-900/20' : 'border-gray-100 dark:border-slate-700'}`}>
                  <div className="flex items-start gap-4">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectAsset(asset.id)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1">
                      {/* Asset Card Display */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-3 rounded-xl ${
                          asset.deviceType === 'Mac' ? 'bg-gradient-to-br from-gray-800 to-gray-900' :
                          asset.deviceType === 'Windows' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                          'bg-gradient-to-br from-blue-500 to-indigo-600'
                        }`}>
                          {asset.deviceType === 'Mac' ? (
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-1.02.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                            </svg>
                          ) : asset.deviceType === 'Windows' ? (
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm17 .25V22L10 20.8v-7.45l10 1.5z"/>
                            </svg>
                          ) : asset.deviceType === 'Phone' ? (
                            <Smartphone className="w-6 h-6 text-white" />
                          ) : (
                            <Laptop className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{asset.computerName || asset.assetTag || 'Unknown Computer'}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>{asset.model || 'Unknown Model'}</span>
                            {asset.deviceType && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">{asset.deviceType}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Serial Number</p>
                          <p className="text-sm font-semibold text-gray-900">{asset.serialNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Manufacturer</p>
                          <p className="text-sm font-semibold text-gray-900">{asset.manufacturer || 'N/A'}</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-500">Assigned To</p>
                            <button
                              onClick={() => setShowInvestigationModal({ assetId: asset.id, fieldName: 'assignedUser' })}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Investigate field assignment"
                            >
                              <Info className="w-3 h-3 text-gray-400 hover:text-blue-600" />
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{asset.assignedUser || 'Unassigned'}</p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-500">Department</p>
                            <button
                              onClick={() => setShowInvestigationModal({ assetId: asset.id, fieldName: 'department' })}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Investigate field assignment"
                            >
                              <Info className="w-3 h-3 text-gray-400 hover:text-blue-600" />
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{asset.department || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-500">Location</p>
                            <button
                              onClick={() => setShowInvestigationModal({ assetId: asset.id, fieldName: 'location' })}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Investigate field assignment"
                            >
                              <Info className="w-3 h-3 text-gray-400 hover:text-blue-600" />
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{asset.location}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Source</p>
                          <p className="text-sm font-semibold text-gray-900">{asset.vendor}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Purchase Date</p>
                          <p className="text-sm font-semibold text-gray-900">{asset.purchaseDate || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Status</p>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            asset.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {asset.status}
                          </span>
                        </div>
                      </div>
                      
                      {/* Compliance Health Score */}
                      {(() => {
                        const healthScore = calculateHealthScore(asset);
                        const sourceCoverage = getSourceCoverage(asset);
                        return (
                          <div className="space-y-3">
                            {healthScore !== null && (
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-500">Compliance Health</span>
                                    <span className={`text-sm font-bold ${
                                      healthScore === 100 ? 'text-green-600 dark:text-green-400' :
                                      healthScore >= 50 ? 'text-gold-600 dark:text-gold-400' : 'text-slate-950 dark:text-slate-200'
                                    }`}>
                                      {healthScore}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        healthScore === 100 ? 'bg-green-500' :
                                        healthScore >= 50 ? 'bg-gold-500' : 'bg-slate-950'
                                      }`}
                                      style={{ width: `${healthScore}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Source Coverage */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-500">Source Coverage</span>
                                <span className="text-xs font-semibold text-gray-700">
                                  {sourceCoverage.sourceCount}/{sourceCoverage.totalSources}
                                </span>
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {['s1', 'mdm', 'okta', 'cdw', 'jira', 'allwhere', 'shi'].map(source => (
                                  <span
                                    key={source}
                                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                      sourceCoverage.sources[source]
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}
                                    title={source.toUpperCase()}
                                  >
                                    {source.toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            {/* Compliance Badges */}
                      <div className="flex items-center gap-2">
                        {asset.mdmEnrolled ? (
                          <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 rounded-full">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-blue-700">MDM</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-3 py-1 bg-brand-brown/10 rounded-full">
                            <XCircle className="w-4 h-4 text-slate-950 dark:text-slate-200" />
                            <span className="text-xs font-semibold text-brand-brown">No MDM</span>
                          </div>
                        )}
                        
                        {asset.s1Active ? (
                          <div className="flex items-center gap-1 px-3 py-1 bg-green-100 rounded-full">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-semibold text-green-700">S1</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-3 py-1 bg-brand-brown/10 rounded-full">
                            <XCircle className="w-4 h-4 text-slate-950 dark:text-slate-200" />
                            <span className="text-xs font-semibold text-brand-brown">No S1</span>
                          </div>
                        )}
                        
                        {asset.oktaEnrolled ? (
                          <div className="flex items-center gap-1 px-3 py-1 bg-purple-100 rounded-full">
                            <CheckCircle className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-700">Okta</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-3 py-1 bg-brand-brown/10 rounded-full">
                            <XCircle className="w-4 h-4 text-slate-950 dark:text-slate-200" />
                            <span className="text-xs font-semibold text-brand-brown">No Okta</span>
                          </div>
                        )}
                      </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="text-right ml-6">
                      <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-gray-500 mb-1">Purchase Cost</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {asset.purchaseCost > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(asset.purchaseCost) : 'N/A'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {asset.assignedUser ? (
                          <button
                            onClick={() => handleCheckIn(asset)}
                            className="p-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-all"
                            title="Check In (Return)"
                          >
                            <ArrowRight className="w-4 h-4 rotate-180" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCheckOut(asset)}
                            className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all"
                            title="Check Out (Assign)"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(asset)}
                          className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all"
                          title="Edit asset"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                          <button
                            onClick={() => setShowDeleteConfirm(asset.id)}
                            className="p-2 bg-brand-brown/10 text-brand-brown rounded-lg hover:bg-gold-200 dark:hover:bg-gold-900/30 transition-all"
                            title="Delete asset"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
            })
            )}
          </div>
        )}
      </div>
        </div>
      </main>

      {showCheckOutModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Check Out Asset</h2>
            <p className="text-sm text-gray-500 mb-4">Assign this asset to a user.</p>
            <input
              type="email"
              value={checkOutUser}
              onChange={(e) => setCheckOutUser(e.target.value)}
              placeholder="User Email (e.g. john@example.com)"
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 outline-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCheckOutModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={submitCheckOut}
                className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckInModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Check In Asset</h2>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to return this asset to storage? This will clear the assigned user.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCheckInModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={submitCheckIn}
                className="px-4 py-2 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700"
              >
                Return to Storage
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-2xl">
                  <Activity className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Asset History</h2>
                  <p className="text-sm text-gray-500">Timeline of changes and assignments</p>
                </div>
              </div>
              <button 
                onClick={() => setShowHistoryModal(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <HistoryTimeline assetId={showHistoryModal} />
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(null)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvestigationModal && (() => {
        const asset = assets.find(a => a && a.id === showInvestigationModal.assetId);
        if (!asset) return null;
        return (
          <FieldInvestigationModal
            asset={asset}
            fieldName={showInvestigationModal.fieldName}
            onClose={() => setShowInvestigationModal(null)}
            onUpdate={() => {
              loadAssets();
            }}
          />
        );
      })()}

      {showCleanupModal && (
        <DuplicateCleanupModal
          onClose={() => setShowCleanupModal(false)}
          onComplete={() => {
            loadAssets();
          }}
        />
      )}

      {showDataCleanupModal && (
        <DataCleanupModal
          onClose={() => setShowDataCleanupModal(false)}
          onComplete={() => {
            loadAssets();
            setShowDataCleanupModal(false);
          }}
        />
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Assets</h2>
                <p className="text-sm text-gray-500">Upload data from various sources</p>
              </div>
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  resetImport();
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
            {importStep === 'source' && (
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        setSelectedSource('csv');
                        setImportStep('upload');
                      }}
                      className="p-4 border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 rounded-2xl transition-all group text-left flex items-start gap-4"
                    >
                      <div className="p-3 bg-blue-100 rounded-xl group-hover:scale-110 transition-transform">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                    <div>
                        <h3 className="font-bold text-gray-900">CSV / Excel</h3>
                        <p className="text-xs text-gray-500">Spreadsheet files</p>
                    </div>
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedSource('sentinelone');
                        setImportStep('upload');
                      }}
                      className="p-4 border-2 border-gray-100 hover:border-purple-500 hover:bg-purple-50 rounded-2xl transition-all group text-left flex items-start gap-4"
                    >
                      <div className="p-3 bg-purple-100 rounded-xl group-hover:scale-110 transition-transform">
                        <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                      <div>
                        <h3 className="font-bold text-gray-900">SentinelOne</h3>
                        <p className="text-xs text-gray-500">S1 console export</p>
                </div>
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedSource('endpoint-central');
                        setImportStep('upload');
                      }}
                      className="p-4 border-2 border-gray-100 hover:border-green-500 hover:bg-green-50 rounded-2xl transition-all group text-left flex items-start gap-4"
                    >
                      <div className="p-3 bg-green-100 rounded-xl group-hover:scale-110 transition-transform">
                        <Activity className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Endpoint Central</h3>
                        <p className="text-xs text-gray-500">Inventory report</p>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedSource('okta-fastpass');
                        setImportStep('upload');
                      }}
                      className="p-4 border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50 rounded-2xl transition-all group text-left flex items-start gap-4"
                    >
                      <div className="p-3 bg-blue-100 rounded-xl group-hover:scale-110 transition-transform">
                        <Shield className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Okta Fastpass</h3>
                        <p className="text-xs text-gray-500">Device report</p>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedSource('cdw');
                        setImportStep('upload');
                      }}
                      className="p-4 border-2 border-gray-100 dark:border-slate-700 hover:border-gold-500 dark:hover:border-gold-500 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-2xl transition-all group text-left flex items-start gap-4"
                    >
                      <div className="p-3 bg-brand-brown/10 rounded-xl group-hover:scale-110 transition-transform">
                        <Package className="w-6 h-6 text-gold-600 dark:text-gold-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">CDW / Vendor</h3>
                        <p className="text-xs text-gray-500">Purchase orders</p>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => {
                        setSelectedSource('jira');
                        setImportStep('upload');
                      }}
                      className="p-4 border-2 border-gray-100 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl transition-all group text-left flex items-start gap-4"
                    >
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:scale-110 transition-transform">
                        <Ticket className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Jira Assets</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Jira asset export</p>
                      </div>
                    </button>
                  </div>
                </div>
            )}

            {importStep === 'upload' && (
                <div className="p-8">
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-3xl cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-blue-400 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500" />
                </div>
                      <p className="mb-2 text-sm text-gray-500 font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400">Supported formats: CSV, Excel, PDF, Images</p>
                    </div>
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg" />
                  </label>
                  {isProcessing && (
                    <div className="mt-6 flex items-center justify-center gap-3 text-blue-600 bg-blue-50 p-4 rounded-xl animate-pulse">
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span className="font-medium">Processing file...</span>
                </div>
                  )}
                  
                  <div className="mt-6">
                    <button 
                      onClick={() => setImportStep('source')}
                      className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                    >
                    Back
                  </button>
                </div>
                </div>
            )}

            {importStep === 'preview' && (
                <div className="flex flex-col h-full">
                  <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">Ready to Import</p>
                      <p className="text-xs text-blue-700">{parsedData.length} records found</p>
                    </div>
                </div>
                
                  <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {/* Bulk Edit Controls */}
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Edit className="w-4 h-4 text-blue-600" />
                          <h3 className="text-sm font-bold text-blue-900">Bulk Set Fields</h3>
                        </div>
                        <button 
                          onClick={() => setShowBulkImportEdit(!showBulkImportEdit)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {showBulkImportEdit ? 'Hide' : 'Edit All'}
                        </button>
                      </div>
                      
                      {showBulkImportEdit && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                          <div>
                            <label className="text-xs text-blue-800 font-medium mb-1 block">Set Status</label>
                            <select
                              value={bulkImportOverrides.status || ''}
                              onChange={(e) => setBulkImportOverrides({...bulkImportOverrides, status: e.target.value})}
                              className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm"
                            >
                              <option value="">Keep Original</option>
                              <option value="Active">Active</option>
                              <option value="Storage">Storage</option>
                              <option value="Retired">Retired</option>
                              <option value="Broken">Broken</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-blue-800 font-medium mb-1 block">Set Location</label>
                            <input
                              type="text"
                              placeholder="e.g. NYC Office"
                              value={bulkImportOverrides.location || ''}
                              onChange={(e) => setBulkImportOverrides({...bulkImportOverrides, location: e.target.value})}
                              className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-blue-800 font-medium mb-1 block">Set Department</label>
                            <input
                              type="text"
                              placeholder="e.g. Engineering"
                              value={bulkImportOverrides.department || ''}
                              onChange={(e) => setBulkImportOverrides({...bulkImportOverrides, department: e.target.value})}
                              className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-blue-800 font-medium mb-1 block">Set Device Type</label>
                            <select
                              value={bulkImportOverrides.deviceType || ''}
                              onChange={(e) => setBulkImportOverrides({...bulkImportOverrides, deviceType: e.target.value})}
                              className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm"
                            >
                              <option value="">Keep Original</option>
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
                        </div>
                      )}
                      {!showBulkImportEdit && Object.keys(bulkImportOverrides).length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {Object.entries(bulkImportOverrides).map(([key, value]) => value && (
                            <span key={key} className="px-2 py-1 bg-white rounded-lg text-xs font-medium text-blue-700 border border-blue-100">
                              {key}: {value}
                            </span>
                      ))}
                    </div>
                    )}
                  </div>
                  
                  {/* Field Investigation Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                        <Info className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Field Investigation Available</h4>
                        <p className="text-xs text-blue-700">
                          After import, you can investigate why fields were assigned certain values. 
                          Click the info icon next to any field in the asset detail view 
                          to see alternative options from different import sources and change assignments if needed.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Field Mapping</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(fieldMapping).map(([key, value]) => (
                          <div key={key} className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-blue-300 transition-colors">
                            <span className="text-xs font-medium text-gray-500 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <select
                              value={value || ''}
                              onChange={(e) => setFieldMapping(prev => ({ ...prev, [key]: e.target.value }))}
                              className="text-sm font-bold text-gray-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer w-full truncate"
                            >
                              <option value="">-- Select Column --</option>
                              {parsedData.length > 0 && Object.keys(parsedData[0]).map(col => (
                                <option key={col} value={col}>{col}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Data Preview</h3>
                      <div className="space-y-3">
                        {parsedData.slice(0, 3).map((row, i) => (
                          <div key={i} className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm flex flex-col gap-2">
                            <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                              <span className="text-xs font-bold text-gray-400">Record {i + 1}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500 text-xs block">Serial</span>
                                <span className="font-mono font-medium">{row[fieldMapping.serialNumber] || row.serialNumber || '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 text-xs block">Computer</span>
                                <span className="font-medium">{row[fieldMapping.computerName] || row.computerName || '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                      </div>
                  </div>
                </div>
                
                  <div className="p-6 border-t bg-gray-50 flex gap-3">
                    <button 
                      onClick={() => setImportStep('upload')}
                      className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleImportComplete}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                    >
                      Import {parsedData.length} Assets
                    </button>
                </div>
                </div>
            )}

            {importStep === 'complete' && (
                <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce-in">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Import Complete</h2>
                  <p className="text-gray-500 mb-8">Your asset inventory has been successfully updated.</p>
                  
                  <div className="grid grid-cols-3 gap-4 w-full max-w-lg mb-8">
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                      <p className="text-3xl font-bold text-green-600">{importSummary.new}</p>
                      <p className="text-xs text-green-700 uppercase tracking-wide font-bold mt-1">New</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <p className="text-3xl font-bold text-blue-600">{importSummary.updated}</p>
                      <p className="text-xs text-blue-700 uppercase tracking-wide font-bold mt-1">Updated</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                      <p className="text-3xl font-bold text-gray-500">{importSummary.skipped}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mt-1">Skipped</p>
                    </div>
                  </div>

                  <button 
                    onClick={resetImport}
                    className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showEditModal && (() => {
        const asset = assets.find(a => a.id === editingAsset);
        if (!asset) return null;
        return (
          <EditAssetModal
            asset={asset}
            onClose={handleCancelEdit}
            onSave={handleSaveEdit}
          />
        );
      })()}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-5 mb-6">
              <div className="p-3 bg-brand-brown/10 rounded-2xl">
                <AlertCircle className="w-8 h-8 text-slate-950 dark:text-slate-200" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Asset?</h2>
                <p className="text-gray-500 leading-relaxed">
                  This action cannot be undone. This asset will be permanently removed from your inventory.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 bg-white border-2 border-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-3 bg-slate-950 dark:bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 dark:hover:bg-slate-700 transition-all shadow-lg shadow-slate-950/20"
              >
                Delete
              </button>
            </div>
          </div>
                  </div>
                )}

      {showBulkEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-2xl">
                  <Edit className="w-6 h-6 text-blue-600" />
              </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Bulk Edit Assets</h2>
                  <p className="text-sm text-gray-500">{selectedAssetIds.size} assets selected</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBulkEditModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    value={bulkEditForm.status || ''}
                    onChange={(e) => setBulkEditForm({ ...bulkEditForm, status: e.target.value })}
                  >
                    <option value="">No Change</option>
                    <option value="Active">Active</option>
                    <option value="Storage">Storage</option>
                    <option value="Retired">Retired</option>
                    <option value="Broken">Broken</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Device Type</label>
                  <select
                    className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    value={bulkEditForm.deviceType || ''}
                    onChange={(e) => setBulkEditForm({ ...bulkEditForm, deviceType: e.target.value })}
                  >
                    <option value="">No Change</option>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="No Change"
                    value={bulkEditForm.location || ''}
                    onChange={(e) => setBulkEditForm({ ...bulkEditForm, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="No Change"
                    value={bulkEditForm.department || ''}
                    onChange={(e) => setBulkEditForm({ ...bulkEditForm, department: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Assign User (Email)</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="No Change"
                    value={bulkEditForm.assignedUser || ''}
                    onChange={(e) => setBulkEditForm({ ...bulkEditForm, assignedUser: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBulkEditModal(false)}
                  className="flex-1 px-4 py-3 bg-white border-2 border-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  Apply Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExportMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
};

export default AssetManagementApp;