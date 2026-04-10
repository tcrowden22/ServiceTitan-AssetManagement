import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FileText, Calendar, Database, Search, Download, X, Eye } from 'lucide-react';

const ImportsView = () => {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImport, setSelectedImport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchImports();
  }, []);

  const fetchImports = async () => {
    try {
      setLoading(true);
      const data = await api.imports.getAll();
      setImports(data);
    } catch (error) {
      console.error('Failed to fetch imports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (id) => {
    try {
      setDetailLoading(true);
      const data = await api.imports.getById(id);
      setSelectedImport(data);
    } catch (error) {
      console.error('Failed to fetch import details:', error);
      alert('Failed to load import details');
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredImports = imports.filter(batch => 
    batch.filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    batch.source?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Import History</h2>
        <p className="text-gray-500 dark:text-gray-400">View and inspect historical data imports</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search imports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>
          <button 
            onClick={fetchImports}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <Database className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-slate-700/30 border-b border-gray-100 dark:border-slate-700">
                <th className="px-6 py-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Date</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Filename</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Source</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Records</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-500 dark:text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">Loading imports...</td>
                </tr>
              ) : filteredImports.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">No imports found</td>
                </tr>
              ) : (
                filteredImports.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white font-medium">
                          {new Date(batch.importDate).toLocaleDateString()}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {new Date(batch.importDate).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        {batch.filename}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-xs font-medium border border-blue-100 dark:border-blue-900/30">
                        {batch.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">
                      {batch.recordCount}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        batch.status === 'Completed' 
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/30'
                          : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-100 dark:border-yellow-900/30'
                      }`}>
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleViewDetails(batch.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="View Raw Data"
                      >
                        {detailLoading && selectedImport?.id === batch.id ? (
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Data Modal */}
      {selectedImport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  {selectedImport.filename}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Imported on {new Date(selectedImport.importDate).toLocaleString()} via {selectedImport.source}
                </p>
              </div>
              <button
                onClick={() => setSelectedImport(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-slate-900">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                 <div className="overflow-x-auto">
                  {(() => {
                    try {
                      const data = JSON.parse(selectedImport.rawData);
                      if (!Array.isArray(data) || data.length === 0) return <div className="p-8 text-center text-gray-500">No data found</div>;
                      
                      const headers = Object.keys(data[0]);

                      return (
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                              {headers.map(header => (
                                <th key={header} className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {data.map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                {headers.map(header => (
                                  <td key={`${i}-${header}`} className="px-4 py-2 border-r border-gray-100 dark:border-slate-700 last:border-r-0 max-w-xs truncate text-gray-600 dark:text-gray-300" title={typeof row[header] === 'object' ? JSON.stringify(row[header]) : row[header]}>
                                    {typeof row[header] === 'object' ? JSON.stringify(row[header]) : String(row[header] || '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    } catch (e) {
                      return <div className="p-8 text-center text-red-500">Error parsing raw data: {e.message}</div>;
                    }
                  })()}
                 </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setSelectedImport(null)}
                className="px-6 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportsView;


