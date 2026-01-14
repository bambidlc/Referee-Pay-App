import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUpload } from './components/FileUpload';
import { RateConfig } from './components/RateConfig';
import { Dashboard } from './components/Dashboard';
import { HistoryDrawer } from './components/HistoryDrawer';
import { RefereeMatchModal } from './components/RefereeMatchModal';
import { MainOverview } from './components/MainOverview';
import { parseSchedule, type ArbitratorStats } from './utils/parser';
import {
  matchAllReferees,
  type MatchResult,
  type Referee,
  getRefereeDisplayName,
  REFEREE_DATABASE
} from './utils/refereeMatcher';
import { RefereeSettingsPanel } from './components/RefereeSettingsPanel';
import {
  getPersistedAppState,
  saveAppState,
  initializeDefaultSettings,
  saveSettings,
  getPayrollHistory,
  getStoredSettings,
  getCategoryRate,
} from './utils/payrollSettings';
import { Loader2, Calendar, History, Plus, FileText, ArrowRight, X, LogIn, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import {
  saveHistoryToFirestore,
  loadHistoryFromFirestore,
  savePayrollHistoryToFirestore,
  loadPayrollHistoryFromFirestore,
  loadSettingsFromFirestore,
  saveSettingsToFirestore
} from './services/firestoreService';

export interface HistoryItem {
  id: string;
  timestamp: number;
  dateRange: { start: string; end: string };
  files: string[]; // File names
  data: {
    arbitrators: ArbitratorStats[];
    categories: string[];
  };
  rates: Record<string, number>;
}

function App() {
  const { user, signInWithGoogle, logout, loading: authLoading } = useAuth();
  const [step, setStep] = useState<'overview' | 'upload' | 'date' | 'matching' | 'config' | 'dashboard'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncKey, setSyncKey] = useState(0); // Used to force re-render of components after sync
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Current Batch State
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [currentDateRange, setCurrentDateRange] = useState({ start: '', end: '' });
  const [currentData, setCurrentData] = useState<{
    arbitrators: ArbitratorStats[];
    categories: string[];
  } | null>(null);
  const [currentRates, setCurrentRates] = useState<Record<string, number>>({});

  // Referee Matching State
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);

  // History State - Initialize from localStorage
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const persisted = getPersistedAppState();
    return persisted?.history || [];
  });
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [dashboardInitialMonth, setDashboardInitialMonth] = useState<string>('');

  // Initialize default referee settings on app start
  useEffect(() => {
    initializeDefaultSettings(REFEREE_DATABASE);
  }, []);

  // Check auth state to switch to overview without interrupting manual navigation
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // Default logged-in landing is overview, but respect any ongoing flow
      setStep(prev => (prev === 'overview' || prev === 'upload' ? 'overview' : prev));
    } else {
      // Signed-out users land on upload; preserve in-progress steps otherwise
      setStep(prev => (prev === 'overview' ? 'upload' : prev));
    }
  }, [user, authLoading]);


  // Persist history to localStorage whenever it changes
  useEffect(() => {
    saveAppState({
      history,
      lastUpdated: Date.now(),
    });

    // Sync UP: Save session history to cloud if user is logged in
    if (user && !isSyncing) {
      saveHistoryToFirestore(user.uid, history);
    }
  }, [history, user]);

  // Sync DOWN: Load data from cloud on login
  useEffect(() => {
    const syncDown = async () => {
      if (user) {
        setIsSyncing(true);
        console.log("Syncing down for user:", user.uid);

        try {
          // 1. Load App History (Session)
          const cloudHistory = await loadHistoryFromFirestore(user.uid);
          if (cloudHistory && cloudHistory.length > 0) {
            setHistory(cloudHistory);
          }

          // 2. Load Payroll History (Saved Batches)
          const cloudPayroll = await loadPayrollHistoryFromFirestore(user.uid);
          if (cloudPayroll && cloudPayroll.length > 0) {
            // Update LocalStorage directly so utils/payrollSettings picks it up
            localStorage.setItem('payroll_history', JSON.stringify(cloudPayroll));
          }

          // 3. Load Settings
          const cloudSettings = await loadSettingsFromFirestore(user.uid);
          if (cloudSettings) {
            saveSettings(cloudSettings); // Use util to save to LS
          }

          // Force re-render of components that rely on LocalStorage
          setSyncKey(prev => prev + 1);

        } catch (error) {
          console.error("Error syncing down:", error);
        } finally {
          setIsSyncing(false);
        }
      }
    };

    if (!authLoading) {
      syncDown();
    }
  }, [user, authLoading]);

  // Listen for local payroll updates (UP SYNC)
  useEffect(() => {
    const handlePayrollUpdate = async () => {
      if (user) {
        // Read latest from LS and push to Cloud
        const currentPayroll = getPayrollHistory(); // This is synchronous from LS
        await savePayrollHistoryToFirestore(user.uid, currentPayroll);
      }
      // Also refresh Dashboard if needed
      setSyncKey(prev => prev + 1);
    };

    const handleSettingsUpdate = async () => {
      if (user) {
        const currentSettings = getStoredSettings();
        await saveSettingsToFirestore(user.uid, currentSettings);
      }
    };

    window.addEventListener('payroll-updated', handlePayrollUpdate);
    window.addEventListener('settings-updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('payroll-updated', handlePayrollUpdate);
      window.removeEventListener('settings-updated', handleSettingsUpdate);
    };
  }, [user]);


  const getDefaultRate = (category: string): number => {
    // Use the configurable category rates from settings
    return getCategoryRate(category);
  };

  const handleFileSelect = (newFiles: File[]) => {
    setCurrentFiles(prev => {
      // Filter out duplicates based on name and size
      const uniqueNewFiles = newFiles.filter(
        nf => !prev.some(pf => pf.name === nf.name && pf.size === nf.size)
      );
      return [...prev, ...uniqueNewFiles];
    });
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setCurrentFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleContinueToDate = () => {
    if (currentFiles.length > 0) {
      setStep('date');
    }
  };

  const handleDateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Parse all files and aggregate
      let allArbitrators: ArbitratorStats[] = [];
      const allCategories = new Set<string>();
      const allScheduleNames = new Set<string>();

      for (const file of currentFiles) {
        const result = await parseSchedule(file);

        // Merge categories
        result.allCategories.forEach(c => allCategories.add(c));

        // Collect all schedule names for matching
        result.scheduleNames.forEach(n => allScheduleNames.add(n));

        // Merge arbitrators
        result.arbitrators.forEach(newArb => {
          const existing = allArbitrators.find(a => a.name === newArb.name);
          if (existing) {
            // Merge counts
            Object.entries(newArb.categories).forEach(([cat, count]) => {
              existing.categories[cat] = (existing.categories[cat] || 0) + count;
            });
            existing.total += newArb.total;
          } else {
            allArbitrators.push(newArb);
          }
        });
      }

      const sortedCategories = Array.from(allCategories).sort((a, b) => {
        const getVal = (cat: string) => {
          if (cat.endsWith('u')) return parseInt(cat.slice(0, -1));
          if (cat.endsWith('uF')) return parseInt(cat.slice(0, -2)) + 0.5;
          return 0;
        };
        return getVal(a) - getVal(b);
      });

      // Initialize Rates
      const initialRates: Record<string, number> = {};
      sortedCategories.forEach(cat => {
        initialRates[cat] = getDefaultRate(cat);
      });

      // Store temporary data
      setCurrentData({
        arbitrators: allArbitrators,
        categories: sortedCategories
      });
      setCurrentRates(initialRates);

      // Perform referee matching
      const dateRange = `${currentDateRange.start} to ${currentDateRange.end}`;
      const { matched, unmatched } = matchAllReferees(
        Array.from(allScheduleNames),
        dateRange
      );

      // Combine all match results
      const allMatchResults = [...unmatched, ...matched];
      setMatchResults(allMatchResults);

      // Show matching modal
      setShowMatchModal(true);
      setStep('matching');

    } catch (error) {
      console.error("Error processing files:", error);
      alert("Error processing files.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle confirmed matches from the modal
  const handleMatchConfirm = (confirmedMatches: Map<string, Referee>) => {
    if (!currentData) return;

    // Update arbitrators with matched referee info
    const updatedArbitrators = currentData.arbitrators.map(arb => {
      const matchedReferee = confirmedMatches.get(arb.name);
      if (matchedReferee) {
        return {
          ...arb,
          matchedReferee,
          employeeNumber: matchedReferee.employeeNumber,
          displayName: getRefereeDisplayName(matchedReferee)
        };
      }
      return arb;
    });

    const updatedData = {
      ...currentData,
      arbitrators: updatedArbitrators
    };

    setCurrentData(updatedData);
    setShowMatchModal(false);

    // Check for existing batch to deduplicate validation logic
    const fileSignature = currentFiles.map(f => f.name).sort().join(',');
    const existingBatch = history.find(h =>
      h.dateRange.start === currentDateRange.start &&
      h.dateRange.end === currentDateRange.end &&
      h.files.sort().join(',') === fileSignature
    );

    const batchId = existingBatch ? existingBatch.id : Date.now().toString();

    // Create History Item with matched data
    const newItem: HistoryItem = {
      id: batchId,
      timestamp: existingBatch ? existingBatch.timestamp : Date.now(),
      dateRange: currentDateRange,
      files: currentFiles.map(f => f.name),
      data: updatedData,
      rates: currentRates
    };

    setHistory(prev => {
      if (existingBatch) {
        return prev.map(h => h.id === batchId ? newItem : h);
      }
      return [newItem, ...prev];
    });
    setSelectedHistoryId(newItem.id);
    setStep('dashboard');
  };

  const handleMatchCancel = () => {
    setShowMatchModal(false);
    setStep('date');
  };

  const handleRateChange = (category: string, newRate: number) => {
    setCurrentRates(prev => ({
      ...prev,
      [category]: newRate
    }));
  };

  const handleRateConfirm = (newRates: Record<string, number>) => {
    setCurrentRates(newRates);

    // Create History Item
    if (currentData) {
      // Check for existing batch to deduplicate
      const fileSignature = currentFiles.map(f => f.name).sort().join(',');
      const existingBatch = history.find(h =>
        h.dateRange.start === currentDateRange.start &&
        h.dateRange.end === currentDateRange.end &&
        h.files.sort().join(',') === fileSignature
      );

      const batchId = existingBatch ? existingBatch.id : Date.now().toString();

      const newItem: HistoryItem = {
        id: batchId,
        timestamp: existingBatch ? existingBatch.timestamp : Date.now(),
        dateRange: currentDateRange,
        files: currentFiles.map(f => f.name),
        data: currentData,
        rates: newRates
      };

      setHistory(prev => {
        if (existingBatch) {
          return prev.map(h => h.id === batchId ? newItem : h);
        }
        return [newItem, ...prev];
      });
      setSelectedHistoryId(newItem.id);
    }

    setStep('dashboard');
  };

  const handleStartNew = () => {
    setStep('upload');
    setCurrentFiles([]);
    setCurrentDateRange({ start: '', end: '' });
    setCurrentData(null);
    setCurrentRates({});
    setSelectedHistoryId(null);
    setDashboardInitialMonth('');
    setMatchResults([]);
    setShowMatchModal(false);
  };

  const handleGoHome = () => {
    if (user) {
      setStep('overview');
      setDashboardInitialMonth('');
    } else {
      handleStartNew();
    }
  }

  const handleSelectHistory = (item: HistoryItem) => {
    setSelectedHistoryId(item.id);
    setCurrentData(item.data);
    setCurrentRates(item.rates);
    setCurrentDateRange(item.dateRange);
    setDashboardInitialMonth('');
    setStep('dashboard');
  };

  const handleViewMonth = (monthKey: string) => {
    setDashboardInitialMonth(monthKey);
    setStep('dashboard');
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(h => h.id !== id));
    if (selectedHistoryId === id) {
      handleStartNew();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-100 selection:text-primary-700">
      {/* Background decoration */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-200/20 rounded-full blur-3xl mix-blend-multiply animate-blob" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 w-full px-6 py-8">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div className="text-center md:text-left">
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 cursor-pointer"
              onClick={handleGoHome}
              role="button"
            >
              Referee<span className="text-primary-600">Pay</span>
            </motion.h1>
            <p className="text-slate-500 text-sm mt-1">Automated Payroll System</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Settings Button */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 rounded-xl hover:bg-slate-50 hover:text-primary-600 transition-colors border border-slate-200 font-medium shadow-sm"
            >
              <Settings className="w-5 h-5" />
              Settings
            </motion.button>

            {/* Auth Button */}
            {user ? (
              <div className="flex items-center gap-3 mr-4 bg-white rounded-xl p-1 pr-4 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.displayName || 'User'}</span>
                </div>
                {isSyncing && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors" title="Sign Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-xl hover:bg-slate-50 hover:text-primary-600 transition-colors border border-slate-200 font-medium shadow-sm mr-2"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}

            {(history.length > 0 || step === 'dashboard') && step !== 'overview' && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setIsHistoryOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 rounded-xl hover:bg-slate-50 hover:text-primary-600 transition-colors border border-slate-200 font-medium shadow-sm"
              >
                <History className="w-5 h-5" />
                History
              </motion.button>
            )}

            {step === 'dashboard' && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={handleStartNew}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20"
              >
                <Plus className="w-5 h-5" />
                New Process
              </motion.button>
            )}
          </div>
        </header>

        <main className="w-full min-h-[600px]">

          {/* History Drawer */}
          <HistoryDrawer
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            history={history}
            selectedId={selectedHistoryId}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
          />

          {/* Settings Panel */}
          <RefereeSettingsPanel
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onSettingsChange={() => setSyncKey(prev => prev + 1)}
          />

          {/* Referee Matching Modal */}
          <RefereeMatchModal
            isOpen={showMatchModal}
            matchResults={matchResults}
            dateProcessed={`${currentDateRange.start} to ${currentDateRange.end}`}
            onConfirm={handleMatchConfirm}
            onCancel={handleMatchCancel}
          />

          {/* Main Content Area */}
          <div className="w-full max-w-full">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-96 gap-4"
                >
                  <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
                  <p className="text-slate-500 font-medium">Processing schedule...</p>
                </motion.div>
              ) : step === 'overview' ? (
                <MainOverview
                  onStartNew={handleStartNew}
                  onViewHistory={() => setIsHistoryOpen(true)}
                  onViewMonth={handleViewMonth}
                />
              ) : step === 'upload' ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full py-12"
                >
                  <div className="text-center mb-12">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Schedules</h2>
                    <p className="text-slate-500">Select or drop files to add them to the batch.</p>
                  </div>

                  <FileUpload onFileSelect={handleFileSelect} />

                  {/* Staged Files List */}
                  <AnimatePresence>
                    {currentFiles.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-8 max-w-xl mx-auto"
                      >
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Selected Files ({currentFiles.length})
                            </h3>
                          </div>
                          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                            {currentFiles.map((file, idx) => (
                              <div key={`${file.name}-${idx}`} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0">
                                    <span className="text-xs font-bold">
                                      {file.name.split('.').pop()?.toUpperCase().slice(0, 3)}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveFile(idx)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="p-4 bg-slate-50 border-t border-slate-100">
                            <button
                              onClick={handleContinueToDate}
                              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 transition-all group"
                            >
                              Continue to Date Selection
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              ) : step === 'date' ? (
                <motion.div
                  key="date"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-full max-w-lg mx-auto bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100"
                >
                  <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                    <Calendar className="w-6 h-6 text-primary-500" />
                    Select Date Range
                  </h2>
                  <form onSubmit={handleDateSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                        value={currentDateRange.start}
                        onChange={(e) => setCurrentDateRange(prev => ({ ...prev, start: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">End Date</label>
                      <input
                        type="date"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                        value={currentDateRange.end}
                        onChange={(e) => setCurrentDateRange(prev => ({ ...prev, end: e.target.value }))}
                      />
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setStep('upload')}
                        className="flex-1 px-6 py-3 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-6 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all"
                      >
                        Process {currentFiles.length} File{currentFiles.length !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </form>
                </motion.div>
              ) : step === 'config' && currentData ? (
                <motion.div
                  key="config"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-full"
                >
                  <RateConfig
                    categories={currentData.categories}
                    onConfirm={handleRateConfirm}
                    initialRates={currentRates}
                  />
                </motion.div>
              ) : step === 'dashboard' && (currentData || dashboardInitialMonth) ? (
                <motion.div
                  key={`dashboard-${syncKey}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="w-full"
                >
                  <Dashboard
                    arbitrators={currentData?.arbitrators || []}
                    categories={currentData?.categories || []}
                    rates={currentData ? currentRates : {}}
                    dateRange={currentData ? currentDateRange : undefined}
                    batchId={selectedHistoryId || Date.now().toString()}
                    onRateChange={handleRateChange}
                    onReset={handleGoHome}
                    initialMonth={dashboardInitialMonth}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
