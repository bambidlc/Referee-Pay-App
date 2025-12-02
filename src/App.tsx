import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUpload } from './components/FileUpload';
import { RateConfig } from './components/RateConfig';
import { Dashboard } from './components/Dashboard';
import { parseSchedule, type ArbitratorStats } from './utils/parser';
import { Loader2, Calendar, Clock, History, Plus, Trash2, FileText, ArrowRight, X } from 'lucide-react';
import clsx from 'clsx';

interface HistoryItem {
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
  const [step, setStep] = useState<'upload' | 'date' | 'config' | 'dashboard'>('upload');
  const [isLoading, setIsLoading] = useState(false);
  
  // Current Batch State
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [currentDateRange, setCurrentDateRange] = useState({ start: '', end: '' });
  const [currentData, setCurrentData] = useState<{
    arbitrators: ArbitratorStats[];
    categories: string[];
  } | null>(null);
  const [currentRates, setCurrentRates] = useState<Record<string, number>>({});

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const getDefaultRate = (category: string): number => {
    const match = category.match(/(\d+)/);
    if (!match) return 0;

    const num = parseInt(match[1]);

    if (num >= 6 && num <= 8) return 25;
    if (num >= 9 && num <= 11) return 27;
    if (num >= 12 && num <= 14) return 29;
    if (num >= 15 && num <= 16) return 30;
    if (num >= 17 && num <= 19) return 35;

    return 0;
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

        for (const file of currentFiles) {
            const result = await parseSchedule(file);
            
            // Merge categories
            result.allCategories.forEach(c => allCategories.add(c));

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

        setCurrentData({
            arbitrators: allArbitrators,
            categories: sortedCategories
        });
        setCurrentRates(initialRates);

        // Create History Item directly
        const newItem: HistoryItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            dateRange: currentDateRange,
            files: currentFiles.map(f => f.name),
            data: {
                arbitrators: allArbitrators,
                categories: sortedCategories
            },
            rates: initialRates
        };

        setHistory(prev => [newItem, ...prev]);
        setSelectedHistoryId(newItem.id);
        setStep('dashboard');

    } catch (error) {
        console.error("Error processing files:", error);
        alert("Error processing files.");
    } finally {
        setIsLoading(false);
    }
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
        const newItem: HistoryItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            dateRange: currentDateRange,
            files: currentFiles.map(f => f.name),
            data: currentData,
            rates: newRates
        };
        
        setHistory(prev => [newItem, ...prev]);
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
  };

  const handleSelectHistory = (item: HistoryItem) => {
      setSelectedHistoryId(item.id);
      setCurrentData(item.data);
      setCurrentRates(item.rates);
      setCurrentDateRange(item.dateRange);
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

      <div className="relative z-10 container mx-auto px-4 py-12">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
            <div className="text-center md:text-left">
                <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900"
                    onClick={handleStartNew}
                    role="button"
                >
                    Referee<span className="text-primary-600">Pay</span>
                </motion.h1>
                <p className="text-slate-500 text-sm mt-1">Automated Payroll System</p>
            </div>

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
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[600px]">
           
           {/* Sidebar / History */}
           {(step === 'dashboard' || history.length > 0) && (
               <div className="lg:col-span-1 order-2 lg:order-1">
                   <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-slate-200 shadow-sm h-full">
                       <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                           <History className="w-5 h-5 text-primary-500" />
                           History
                       </h2>
                       
                       <div className="space-y-3">
                           {history.length === 0 ? (
                               <p className="text-slate-400 text-sm italic">No history yet.</p>
                           ) : (
                               history.map(item => (
                                   <div 
                                       key={item.id}
                                       onClick={() => handleSelectHistory(item)}
                                       className={clsx(
                                           "p-4 rounded-2xl cursor-pointer transition-all border relative group",
                                           selectedHistoryId === item.id 
                                            ? "bg-primary-50 border-primary-200 shadow-sm"
                                            : "bg-slate-50 border-transparent hover:bg-white hover:border-slate-200"
                                       )}
                                   >
                                       <div className="flex justify-between items-start mb-2">
                                           <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                               <Clock className="w-3 h-3" />
                                               {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                           </span>
                                           <button 
                                                onClick={(e) => handleDeleteHistory(item.id, e)}
                                                className="text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                                            >
                                               <Trash2 className="w-4 h-4" />
                                           </button>
                                       </div>
                                       <p className="font-semibold text-slate-800 text-sm mb-1">
                                           {item.dateRange.start} - {item.dateRange.end}
                                       </p>
                                       <p className="text-xs text-slate-500 truncate">
                                           {item.files.length} file{item.files.length !== 1 ? 's' : ''}
                                       </p>
                                   </div>
                               ))
                           )}
                       </div>
                   </div>
               </div>
           )}

           {/* Main Content Area */}
           <div className={clsx(
               "order-1 lg:order-2",
               (step === 'dashboard' || history.length > 0) ? "lg:col-span-3" : "lg:col-span-4 max-w-4xl mx-auto w-full"
           )}>
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
                ) : step === 'dashboard' && currentData ? (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="w-full"
                  >
                    <Dashboard
                      arbitrators={currentData.arbitrators}
                      categories={currentData.categories}
                      rates={currentRates}
                      dateRange={currentDateRange}
                      onRateChange={handleRateChange}
                      onReset={handleStartNew}
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