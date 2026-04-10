import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Clock, User, ArrowRight, Activity, CheckCircle, XCircle } from 'lucide-react';

const HistoryTimeline = ({ assetId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (assetId) {
      loadHistory();
    }
  }, [assetId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await api.assets.getHistory(assetId);
      setHistory(data);
    } catch (err) {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading history...</div>;
  if (error) return <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>;
  if (history.length === 0) return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No history available</div>;

  return (
    <div className="space-y-4">
      {history.map((log, index) => (
        <div key={log.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              log.action === 'ASSIGN' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
              log.action === 'UNASSIGN' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
              log.action === 'CREATE' ? 'bg-gold-100 dark:bg-gold-900/30 text-gold-600 dark:text-gold-400' :
              'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {log.action === 'ASSIGN' ? <CheckCircle className="w-4 h-4" /> :
               log.action === 'UNASSIGN' ? <XCircle className="w-4 h-4" /> :
               log.action === 'CREATE' ? <Activity className="w-4 h-4" /> :
               <Clock className="w-4 h-4" />}
            </div>
            {index < history.length - 1 && <div className="w-0.5 bg-gray-200 dark:bg-slate-700 flex-1 my-1"></div>}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {log.action === 'UPDATE' ? `Updated ${log.field}` : log.action}
              </p>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {log.action === 'UPDATE' && (
                <div className="flex items-center gap-2">
                  <span className="line-through text-gray-400">{log.oldValue || 'Empty'}</span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">{log.newValue || 'Empty'}</span>
                </div>
              )}
              {log.action === 'ASSIGN' && (
                <p>Assigned to <span className="font-bold">{log.newValue}</span></p>
              )}
              {log.action === 'UNASSIGN' && (
                <p>Returned to storage</p>
              )}
            </div>
            
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
              <User className="w-3 h-3" />
              <span>{log.actor?.username || 'System'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HistoryTimeline;

