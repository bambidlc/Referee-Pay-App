import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Trash2, History } from 'lucide-react';
import clsx from 'clsx';
import { type ArbitratorStats } from '../utils/parser';

interface HistoryItem {
  id: string;
  timestamp: number;
  dateRange: { start: string; end: string };
  files: string[];
  data: {
    arbitrators: ArbitratorStats[];
    categories: string[];
  };
  rates: Record<string, number>;
}

interface HistoryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryItem[];
    selectedId: string | null;
    onSelect: (item: HistoryItem) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
    isOpen,
    onClose,
    history,
    selectedId,
    onSelect,
    onDelete
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                    />
                    
                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-100"
                    >
                        <div className="flex flex-col h-full">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <History className="w-5 h-5 text-primary-500" />
                                    History
                                </h2>
                                <button 
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {history.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                            <History className="w-8 h-8" />
                                        </div>
                                        <p className="text-slate-500 font-medium">No history yet</p>
                                        <p className="text-slate-400 text-sm mt-1">Processed batches will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {history.map(item => (
                                            <div 
                                                key={item.id}
                                                onClick={() => {
                                                    onSelect(item);
                                                    onClose();
                                                }}
                                                className={clsx(
                                                    "p-4 rounded-2xl cursor-pointer transition-all border relative group",
                                                    selectedId === item.id 
                                                        ? "bg-primary-50 border-primary-200 shadow-sm"
                                                        : "bg-white border-slate-200 hover:border-primary-200 hover:shadow-md"
                                                )}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <button 
                                                        onClick={(e) => onDelete(item.id, e)}
                                                        className="text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="font-semibold text-slate-800 text-sm mb-1">
                                                    {item.dateRange.start} - {item.dateRange.end}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                                        {item.files.length} file{item.files.length !== 1 ? 's' : ''}
                                                    </span>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                        ${Object.values(item.data.arbitrators).reduce((acc, arb) => {
                                                            return acc + Object.entries(arb.categories).reduce((sum, [cat, count]) => sum + count * (item.rates[cat] || 0), 0);
                                                        }, 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

