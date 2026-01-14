import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ArrowRight, Settings2 } from 'lucide-react';

interface RateConfigProps {
    categories: string[];
    onConfirm: (rates: Record<string, number>) => void;
    initialRates?: Record<string, number>;
}

export const RateConfig: React.FC<RateConfigProps> = ({ categories, onConfirm, initialRates = {} }) => {
    const [rates, setRates] = useState<Record<string, number>>(initialRates);

    // Initialize rates with 0 if not present
    useEffect(() => {
        const newRates = { ...rates };
        let changed = false;
        categories.forEach(cat => {
            if (newRates[cat] === undefined) {
                newRates[cat] = 0;
                changed = true;
            }
        });
        if (changed) setRates(newRates);
    }, [categories]);

    const handleChange = (category: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        setRates(prev => ({
            ...prev,
            [category]: numValue
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(rates);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100"
        >
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                <div className="p-3 bg-primary-100 text-primary-600 rounded-xl">
                    <Settings2 className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Configure Rates</h2>
                    <p className="text-slate-500">Assign payment rates for each category found in the schedule.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map((category, index) => (
                        <motion.div
                            key={category}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group"
                        >
                            <label className="block text-sm font-medium text-slate-700 mb-2 group-hover:text-primary-600 transition-colors">
                                {category}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={rates[category] || ''}
                                    onChange={(e) => handleChange(category, e.target.value)}
                                    className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none font-medium text-slate-800"
                                    placeholder="0.00"
                                />
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-10 flex justify-end">
                    <button
                        type="submit"
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary-600/20 hover:shadow-primary-600/30 transform hover:-translate-y-0.5 transition-all"
                    >
                        Generate Report
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </motion.div>
    );
};
