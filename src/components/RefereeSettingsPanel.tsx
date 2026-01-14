import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, DollarSign, Percent, Check, Search, User, Plus, Trash2, Edit2, Save, Database, AlertCircle } from 'lucide-react';
import { 
  getRefereeDatabase, 
  addRefereeToDatabase,
  updateRefereeInDatabase,
  deleteRefereeFromDatabase,
  type Referee 
} from '../utils/refereeMatcher';
import {
  type RefereePayrollSettings,
  type GlobalPayrollSettings,
  getGlobalSettings,
  saveGlobalSettings,
  saveRefereeSettings,
  getAllRefereeSettings,
  DEFAULT_GLOBAL_SETTINGS,
  isAdminFeeExempt,
} from '../utils/payrollSettings';

interface RefereeSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange?: () => void;
}

export const RefereeSettingsPanel: React.FC<RefereeSettingsPanelProps> = ({
  isOpen,
  onClose,
  onSettingsChange,
}) => {
  const [activeTab, setActiveTab] = useState<'global' | 'referees' | 'database'>('global');
  const [globalSettings, setGlobalSettings] = useState<GlobalPayrollSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [refereeSettings, setRefereeSettings] = useState<Record<string, RefereePayrollSettings>>({});
  const [referees, setReferees] = useState<Referee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedReferee, setExpandedReferee] = useState<string | null>(null);

  // Edit/Add state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Referee>({ employeeNumber: '', fullName: '' });
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      setGlobalSettings(getGlobalSettings());
      setRefereeSettings(getAllRefereeSettings());
      setReferees(getRefereeDatabase());
    }
  }, [isOpen]);

  const handleGlobalChange = (key: keyof GlobalPayrollSettings, value: number) => {
    const updated = { ...globalSettings, [key]: value };
    setGlobalSettings(updated);
    saveGlobalSettings(updated);
    onSettingsChange?.();
  };

  const handleRefereeSettingChange = (
    employeeNumber: string,
    key: keyof RefereePayrollSettings,
    value: boolean | number
  ) => {
    const current = refereeSettings[employeeNumber] || {
      employeeNumber,
      hasFixedRate: false,
      fixedRate: 0,
      hasAdminFee: false,
    };
    
    const updated = { ...current, [key]: value };
    setRefereeSettings(prev => ({ ...prev, [employeeNumber]: updated }));
    saveRefereeSettings(updated);
    onSettingsChange?.();
  };

  const filteredReferees = referees.filter(ref =>
    ref.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.employeeNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startAdding = () => {
    setIsAdding(true);
    setEditingId(null);
    setEditForm({ employeeNumber: '', fullName: '' });
    setError(null);
  };

  const startEditing = (ref: Referee) => {
    setEditingId(ref.employeeNumber);
    setIsAdding(false);
    setEditForm({ ...ref });
    setError(null);
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    setEditForm({ employeeNumber: '', fullName: '' });
    setError(null);
  };

  const saveReferee = () => {
    if (!editForm.fullName.trim() || !editForm.employeeNumber.trim()) {
      setError('Name and Employee Number are required');
      return;
    }

    try {
      if (isAdding) {
        addRefereeToDatabase(editForm);
      } else if (editingId) {
        updateRefereeInDatabase(editingId, editForm);
      }
      
      // Refresh list
      setReferees(getRefereeDatabase());
      cancelEdit();
    } catch (err: any) {
      setError(err.message || 'Failed to save referee');
    }
  };

  const deleteReferee = (id: string) => {
    if (confirm('Are you sure you want to delete this referee? This cannot be undone.')) {
      deleteRefereeFromDatabase(id);
      setReferees(getRefereeDatabase());
      if (editingId === id) cancelEdit();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-xl">
                <Settings className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Payroll Settings</h2>
                <p className="text-sm text-slate-500">Configure rates, fees, and database</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('global')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'global'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Percent className="w-4 h-4" />
                Global Settings
              </div>
            </button>
            <button
              onClick={() => setActiveTab('referees')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'referees'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <User className="w-4 h-4" />
                Referee Rates
              </div>
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'database'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Database className="w-4 h-4" />
                Database
              </div>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'global' && (
              <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-800 mb-1">Puerto Rico Hacienda Tax</h3>
                  <p className="text-sm text-amber-600 mb-3">
                    This is the mandatory tax deduction from all referee earnings.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-[150px]">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={globalSettings.haciendaTaxRate * 100}
                        onChange={(e) => handleGlobalChange('haciendaTaxRate', parseFloat(e.target.value) / 100 || 0)}
                        className="w-full px-4 py-2 pr-8 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600">%</span>
                    </div>
                    <span className="text-sm text-amber-700">of taxable income</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-800 mb-1">Deposit Fee</h3>
                  <p className="text-sm text-blue-600 mb-3">
                    Fixed fee deducted from each referee's pay.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-[150px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={globalSettings.depositFee}
                        onChange={(e) => handleGlobalChange('depositFee', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2 pl-8 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <span className="text-sm text-blue-700">per referee</span>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <h3 className="font-semibold text-purple-800 mb-1">Administration Fee</h3>
                  <p className="text-sm text-purple-600 mb-3">
                    Fixed at $2 per game for non-exempt referees. Exemptions are set per referee below.
                  </p>
                  <div className="flex items-center gap-3 text-purple-700">
                    <div className="flex items-center gap-2 bg-white border border-purple-200 rounded-lg px-3 py-2">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold">2.00</span>
                      <span className="text-sm text-purple-500">per game</span>
                    </div>
                    <span className="text-sm">Non-editable (policy)</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'referees' && (
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search referees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm">
                  <p className="text-slate-600 mb-2">
                    <strong>Admin Fee:</strong> $2/game is charged to all referees <strong>except</strong> those marked as exempt.
                  </p>
                  <p className="text-slate-500">
                    Configure individual referee settings for fixed rates and admin fee exemptions below.
                  </p>
                </div>

                {/* Referee List */}
                <div className="space-y-2">
                  {filteredReferees.map((referee) => {
                    const isExemptByDefault = isAdminFeeExempt(referee.employeeNumber);
                    const settings = refereeSettings[referee.employeeNumber] || {
                      employeeNumber: referee.employeeNumber,
                      hasFixedRate: false,
                      fixedRate: 0,
                      hasAdminFee: !isExemptByDefault, // Default: ON unless exempt
                    };
                    const isExpanded = expandedReferee === referee.employeeNumber;

                    return (
                      <div
                        key={referee.employeeNumber}
                        className="border border-slate-200 rounded-xl overflow-hidden"
                      >
                        <div
                          onClick={() => setExpandedReferee(isExpanded ? null : referee.employeeNumber)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-medium">
                              {referee.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{referee.fullName}</p>
                              <p className="text-xs text-slate-400">#{referee.employeeNumber}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {settings.hasFixedRate && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                Fixed ${settings.fixedRate}
                              </span>
                            )}
                            {settings.hasAdminFee ? (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                Admin Fee $2/game
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                                Exempt
                              </span>
                            )}
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-slate-200 bg-slate-50"
                            >
                              <div className="p-4 space-y-4">
                                {/* Fixed Rate Toggle */}
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-slate-700">Fixed Rate</p>
                                    <p className="text-xs text-slate-500">Same pay per game, ignores category rates</p>
                                  </div>
                                  <button
                                    onClick={() => handleRefereeSettingChange(
                                      referee.employeeNumber,
                                      'hasFixedRate',
                                      !settings.hasFixedRate
                                    )}
                                    className={`w-12 h-6 rounded-full transition-colors ${
                                      settings.hasFixedRate ? 'bg-green-500' : 'bg-slate-300'
                                    }`}
                                  >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                                      settings.hasFixedRate ? 'translate-x-6' : 'translate-x-0.5'
                                    }`} />
                                  </button>
                                </div>

                                {settings.hasFixedRate && (
                                  <div className="pl-4 border-l-2 border-green-300">
                                    <label className="block text-sm text-slate-600 mb-1">Rate per game</label>
                                    <div className="relative w-32">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={settings.fixedRate}
                                        onChange={(e) => handleRefereeSettingChange(
                                          referee.employeeNumber,
                                          'fixedRate',
                                          parseFloat(e.target.value) || 0
                                        )}
                                        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Admin Fee Toggle */}
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-slate-700">
                                      {settings.hasAdminFee ? 'Pays Admin Fee' : 'Exempt from Admin Fee'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {settings.hasAdminFee 
                                        ? '$2/game deducted from earnings' 
                                        : 'No admin fee deduction'}
                                      {isExemptByDefault && !settings.hasAdminFee && (
                                        <span className="ml-1 text-emerald-600">(default exempt)</span>
                                      )}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleRefereeSettingChange(
                                      referee.employeeNumber,
                                      'hasAdminFee',
                                      !settings.hasAdminFee
                                    )}
                                    className={`w-12 h-6 rounded-full transition-colors ${
                                      settings.hasAdminFee ? 'bg-purple-500' : 'bg-emerald-500'
                                    }`}
                                  >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                                      settings.hasAdminFee ? 'translate-x-6' : 'translate-x-0.5'
                                    }`} />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'database' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="relative flex-1 mr-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search database..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                    />
                  </div>
                  <button
                    onClick={startAdding}
                    disabled={isAdding}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Referee
                  </button>
                </div>

                {/* Add/Edit Form */}
                <AnimatePresence>
                  {(isAdding || editingId) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-semibold text-slate-800">
                          {isAdding ? 'Add New Referee' : 'Edit Referee'}
                        </h3>
                        <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                         <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                           <input
                             type="text"
                             value={editForm.fullName}
                             onChange={e => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                             className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                             placeholder="e.g., JOHN DOE"
                           />
                         </div>
                         <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Employee Number</label>
                           <input
                             type="text"
                             value={editForm.employeeNumber}
                             onChange={e => setEditForm(prev => ({ ...prev, employeeNumber: e.target.value }))}
                             className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                             placeholder="e.g., 1234"
                             disabled={!!editingId} // Can't change ID when editing to avoid mess (or allow it with warning?)
                             // Allowing ID change requires checking collision with OTHER IDs.
                           />
                           {editingId && <p className="text-xs text-slate-500 mt-1">Employee ID cannot be changed once created.</p>}
                         </div>

                         {error && (
                           <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded-lg">
                             <AlertCircle className="w-4 h-4" />
                             {error}
                           </div>
                         )}

                         <div className="flex justify-end gap-3">
                           <button
                             onClick={cancelEdit}
                             className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                           >
                             Cancel
                           </button>
                           <button
                             onClick={saveReferee}
                             className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center gap-2"
                           >
                             <Save className="w-4 h-4" />
                             Save
                           </button>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Database List */}
                <div className="space-y-2">
                  {filteredReferees.map((referee) => (
                    <div
                      key={referee.employeeNumber}
                      className={`border rounded-xl p-4 flex justify-between items-center bg-white hover:border-primary-200 transition-colors ${
                        editingId === referee.employeeNumber ? 'border-primary-500 ring-1 ring-primary-500' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-slate-800">{referee.fullName}</p>
                        <p className="text-xs text-slate-400">#{referee.employeeNumber}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(referee)}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteReferee(referee.employeeNumber)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredReferees.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      No referees found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-lg shadow-primary-600/20 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
