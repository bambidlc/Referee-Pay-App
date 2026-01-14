import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Users, Calendar, 
  TrendingUp, ArrowRight, Clock, ChevronRight, DollarSign,
  Upload, BarChart3, History, Pencil
} from 'lucide-react';
import { 
  getPayrollHistory, 
  getMonthlySummaries, 
  getRefereeMonthlySummaries,
  updatePayrollBatchName, 
  type PayrollBatchRecord 
} from '../utils/payrollSettings';
import { useAuth } from '../contexts/AuthContext';

interface MainOverviewProps {
  onStartNew: () => void;
  onViewHistory: () => void;
  onViewMonth: (monthKey: string) => void;
}

export const MainOverview: React.FC<MainOverviewProps> = ({ 
  onStartNew, 
  onViewHistory,
  onViewMonth,
}) => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<PayrollBatchRecord[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  useEffect(() => {
    // Load history for overview
    setBatches(getPayrollHistory());
    
    // Listen for updates
    const handleUpdate = () => setBatches(getPayrollHistory());
    window.addEventListener('payroll-updated', handleUpdate);
    return () => window.removeEventListener('payroll-updated', handleUpdate);
  }, []);

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    let ytdPayout = 0;
    let monthPayout = 0;
    let totalReferees = new Set<string>();
    let totalGames = 0;

    batches.forEach(batch => {
        const date = new Date(batch.timestamp);
        if (date.getFullYear() === currentYear) {
            ytdPayout += batch.totals.netPay;
            if (date.getMonth() === currentMonth) {
                monthPayout += batch.totals.netPay;
            }
        }
        
        batch.referees.forEach(r => totalReferees.add(r.employeeNumber));
        totalGames += batch.totals.totalGames;
    });

    return {
        ytdPayout,
        monthPayout,
        uniqueReferees: totalReferees.size,
        totalGames
    };
  }, [batches]);

  const recentBatches = batches.slice(0, 3);
  const monthlySummaries = useMemo(() => getMonthlySummaries().slice(0, 3), [batches]);
  const refereeMonthlySummaries = useMemo(() => getRefereeMonthlySummaries(), [batches]);

  const toggleBatch = (id: string) => {
    setExpandedBatchId(prev => (prev === id ? null : id));
  };

  const startEditingBatch = (batch: PayrollBatchRecord) => {
    setEditingBatchId(batch.id);
    setEditingName(batch.name || `${batch.dateRange.start} - ${batch.dateRange.end}`);
  };

  const commitBatchName = () => {
    if (!editingBatchId) return;
    const trimmed = editingName.trim();
    const updatedName = trimmed || editingName;

    setBatches(prev => prev.map(b => b.id === editingBatchId ? { ...b, name: updatedName } : b));
    updatePayrollBatchName(editingBatchId, updatedName);
    setEditingBatchId(null);
    setEditingName('');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-5xl mx-auto space-y-8 py-6"
    >
        {/* Welcome Section */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
            <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="text-black">OFFICIAL'S PAYROLL</span>
                </h2>
                <p className="text-slate-500 font-medium">Welcome back, {user?.displayName?.split(' ')[0] || 'Official'}</p>
            </div>
            <button
                onClick={onStartNew}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 transition-all group"
            >
                <Plus className="w-5 h-5" />
                NEW RUN
                <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
            </button>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard 
                title="This Month" 
                value={`$${stats.monthPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                icon={Calendar}
                color="bg-blue-500"
                subtitle="Net Payout"
            />
            <StatsCard 
                title="YTD Payout" 
                value={`$${stats.ytdPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                icon={TrendingUp}
                color="bg-green-500"
                subtitle={`${new Date().getFullYear()} Total`}
            />
            <StatsCard 
                title="Active Referees" 
                value={stats.uniqueReferees.toString()}
                icon={Users}
                color="bg-purple-500"
                subtitle={`Across ${batches.length} batches`}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <motion.div variants={itemVariants} className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-slate-400" />
                        Recent Batches
                    </h3>
                    <button 
                        onClick={onViewHistory}
                        className="text-sm text-primary-600 font-medium hover:text-primary-700"
                    >
                        View All
                    </button>
                </div>
                <div className="divide-y divide-slate-50">
                    {recentBatches.length > 0 ? (
                        recentBatches.map(batch => {
                            const isExpanded = expandedBatchId === batch.id;
                            return (
                                <div 
                                    key={batch.id} 
                                    className="p-4 hover:bg-slate-50 transition-colors flex flex-col gap-3 group cursor-pointer"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleBatch(batch.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleBatch(batch.id);
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                                <DollarSign className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                {editingBatchId === batch.id ? (
                                                    <input
                                                        value={editingName}
                                                        autoFocus
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                commitBatchName();
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setEditingBatchId(null);
                                                                setEditingName('');
                                                            }
                                                        }}
                                                        onBlur={commitBatchName}
                                                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-800 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-slate-800">
                                                            {batch.name || `${batch.dateRange.start} - ${batch.dateRange.end}`}
                                                        </p>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); startEditingBatch(batch); }}
                                                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors"
                                                            title="Rename batch"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                                <p className="text-xs text-slate-500">
                                                    {new Date(batch.timestamp).toLocaleDateString()} • {batch.referees.length} referees
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="font-bold text-slate-700">${batch.totals.netPay.toFixed(2)}</p>
                                            <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform transition-colors group-hover:text-primary-500 ${isExpanded ? 'rotate-90 text-primary-500' : ''}`} />
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="pl-14 pr-2 text-sm text-slate-600 space-y-1">
                                            <div className="flex justify-between">
                                                <span>Total games</span>
                                                <span className="font-semibold text-slate-800">{batch.totals.totalGames}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Gross pay</span>
                                                <span className="font-semibold text-slate-800">${batch.totals.grossPay.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Net pay</span>
                                                <span className="font-semibold text-slate-800">${batch.totals.netPay.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            No payroll batches processed yet.
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Quick Links */}
            <motion.div variants={itemVariants} className="space-y-4">
                 
                 <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4">Quick Stats</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Total Games</span>
                            <span className="font-medium text-slate-900">{stats.totalGames}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-primary-500 h-full rounded-full" style={{ width: '100%' }}></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Total games processed all time</p>
                    </div>
                 </div>

                 <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4">Quick Navigation</h3>
                    <div className="flex gap-3">
                        <button
                            onClick={onStartNew}
                            className="flex-1 flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center mb-2 transition-colors">
                                <Upload className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
                            </div>
                            <span className="font-semibold text-slate-800 text-sm">Upload</span>
                        </button>
                        <button
                            onClick={onViewHistory}
                            className="flex-1 flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center mb-2 transition-colors">
                                <History className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
                            </div>
                            <span className="font-semibold text-slate-800 text-sm">History</span>
                        </button>
                    </div>
                 </div>
            </motion.div>
        </div>

        {/* Monthly snapshot */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary-500" />
                    <h3 className="font-bold text-slate-800">Recent Monthly Performance</h3>
                </div>
                <span className="text-xs text-slate-400">Last {monthlySummaries.length} months</span>
            </div>
            {monthlySummaries.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {monthlySummaries.map(month => {
                            const isMonthExpanded = expandedMonth === month.month;
                            return (
                                <div key={month.month} className="relative group">
                                    <button
                                        onClick={() => setExpandedMonth(prev => prev === month.month ? null : month.month)}
                                        className={`w-full border border-slate-100 rounded-xl p-4 text-left hover:border-primary-200 transition-colors ${isMonthExpanded ? 'border-primary-200 bg-primary-50/40' : 'bg-white'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs uppercase text-slate-400">{month.monthLabel}</p>
                                                <p className="text-lg font-bold text-slate-900 mt-1">
                                                    ${month.totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform ${isMonthExpanded ? 'rotate-90 text-primary-500' : ''}`} />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {month.refereeCount} referees • {month.totalGames} games
                                        </p>
                                    </button>
                                    
                                    {/* Quick View Action - visible on hover or when expanded */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewMonth(month.month);
                                        }}
                                        className={`absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all opacity-0 group-hover:opacity-100 ${isMonthExpanded ? 'opacity-100' : ''}`}
                                        title="View full dashboard"
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {expandedMonth && (
                        <div className="mt-6 border border-slate-100 rounded-xl p-4 bg-slate-50">
                            {monthlySummaries.find(m => m.month === expandedMonth) ? (
                                <>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-xs uppercase text-slate-400">Month</p>
                                            <p className="font-semibold text-slate-800">
                                                {monthlySummaries.find(m => m.month === expandedMonth)?.monthLabel}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => onViewMonth(expandedMonth)}
                                            className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                                        >
                                            View Dashboard <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-100 overflow-hidden">
                                        {monthlySummaries.find(m => m.month === expandedMonth)?.batches.map(batch => (
                                            <div key={batch.id} className="p-3 flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-800">{batch.name || `${batch.dateRange.start} - ${batch.dateRange.end}`}</p>
                                                    <p className="text-xs text-slate-500">{batch.dateRange.start} → {batch.dateRange.end}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-slate-800">${batch.totals.netPay.toFixed(2)}</p>
                                                    <p className="text-xs text-slate-500">{batch.totals.totalGames} games</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Employee payroll breakdown for the selected month */}
                                    <div className="mt-4">
                                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Employee payroll for this month</h4>
                                        <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-200 overflow-hidden">
                                            {refereeMonthlySummaries
                                                .filter(ref => ref.months[expandedMonth])
                                                .map(ref => (
                                                    <div key={ref.employeeNumber} className="p-3 flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium text-slate-800">{ref.refereeName}</p>
                                                            <p className="text-xs text-slate-500">Emp #{ref.employeeNumber}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-semibold text-slate-800">
                                                                ${ref.months[expandedMonth].netPay.toFixed(2)}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {ref.months[expandedMonth].games} games
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-slate-500">Select a month to view details.</p>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <p className="text-sm text-slate-500">No monthly data yet. Run a payroll to see summaries.</p>
            )}
        </motion.div>
    </motion.div>
  );
};

const StatsCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <motion.div 
        variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
    >
        <div className="flex items-start justify-between mb-4">
            <div>
                <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
                <Icon className={`w-6 h-6 text-${color.split('-')[1]}-500`} />
            </div>
        </div>
        <p className="text-xs text-slate-400">{subtitle}</p>
    </motion.div>
);

