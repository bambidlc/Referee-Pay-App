import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, Users, DollarSign, Trophy } from 'lucide-react';
import { type ArbitratorStats } from '../utils/parser';
import { utils, writeFile } from 'xlsx';

interface DashboardProps {
    arbitrators: ArbitratorStats[];
    rates: Record<string, number>;
    categories: string[];
    onRateChange: (category: string, newRate: number) => void;
    onReset: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ arbitrators, rates, categories, onRateChange, onReset }) => {

    const calculatedData = useMemo(() => {
        return arbitrators.map(arb => {
            let totalPayout = 0;
            let totalGames = 0;

            categories.forEach(cat => {
                const count = arb.categories[cat] || 0;
                const rate = rates[cat] || 0;
                totalPayout += count * rate;
                totalGames += count;
            });

            return {
                ...arb,
                totalPayout,
                totalGames
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [arbitrators, rates, categories]);

    const stats = useMemo(() => {
        const totalPayout = calculatedData.reduce((acc, curr) => acc + curr.totalPayout, 0);
        const totalGames = calculatedData.reduce((acc, curr) => acc + curr.totalGames, 0);
        const topEarner = [...calculatedData].sort((a, b) => b.totalPayout - a.totalPayout)[0];

        return { totalPayout, totalGames, topEarner };
    }, [calculatedData]);

    const handleExport = () => {
        // Create export data structure
        const exportData = calculatedData.map(arb => {
            const row: Record<string, any> = {
                'Arbitrator': arb.name,
            };

            categories.forEach(cat => {
                row[cat] = arb.categories[cat] || 0;
            });

            row['Total Games'] = arb.totalGames;
            row['Total Payout'] = arb.totalPayout;

            return row;
        });

        const ws = utils.json_to_sheet(exportData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Payroll Report");
        writeFile(wb, "Referee_Payroll_Report.xlsx");
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-7xl mx-auto space-y-8"
        >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 text-green-600 rounded-xl">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Payout</p>
                            <h3 className="text-2xl font-bold text-slate-800">
                                ${stats.totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </h3>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Games</p>
                            <h3 className="text-2xl font-bold text-slate-800">
                                {stats.totalGames}
                            </h3>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Top Earner</p>
                            <h3 className="text-lg font-bold text-slate-800 truncate max-w-[150px]" title={stats.topEarner?.name}>
                                {stats.topEarner?.name || '-'}
                            </h3>
                            <p className="text-xs text-slate-400">
                                ${stats.topEarner?.totalPayout.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800">Payroll Details</h2>
                    <div className="flex gap-3">
                        <button
                            onClick={onReset}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                        >
                            Start Over
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-primary-600/20 transition-all"
                        >
                            <Download className="w-4 h-4" />
                            Export to Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Arbitrator</th>
                                {categories.map(cat => (
                                    <th key={cat} className="px-6 py-4 font-semibold text-center whitespace-nowrap min-w-[100px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <span>{cat}</span>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={rates[cat]}
                                                    onChange={(e) => onRateChange(cat, parseFloat(e.target.value) || 0)}
                                                    className="w-20 pl-5 pr-2 py-1 text-xs border border-slate-200 rounded focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all text-center"
                                                />
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-6 py-4 font-semibold text-right">Total Games</th>
                                <th className="px-6 py-4 font-semibold text-right">Total Payout</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {calculatedData.map((arb, idx) => (
                                <motion.tr
                                    key={arb.name}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.02 }}
                                    className="hover:bg-slate-50/50 transition-colors"
                                >
                                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                        {arb.name}
                                    </td>
                                    {categories.map(cat => {
                                        const count = arb.categories[cat] || 0;
                                        return (
                                            <td key={cat} className="px-6 py-4 text-center">
                                                {count > 0 ? (
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 text-primary-600 font-medium">
                                                        {count}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-6 py-4 text-right font-medium text-slate-600">
                                        {arb.totalGames}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">
                                        ${arb.totalPayout.toFixed(2)}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-semibold text-slate-900 border-t border-slate-200">
                            <tr>
                                <td className="px-6 py-4">Totals</td>
                                {categories.map(cat => {
                                    const total = calculatedData.reduce((acc, curr) => acc + (curr.categories[cat] || 0), 0);
                                    return (
                                        <td key={cat} className="px-6 py-4 text-center">
                                            {total}
                                        </td>
                                    );
                                })}
                                <td className="px-6 py-4 text-right">{stats.totalGames}</td>
                                <td className="px-6 py-4 text-right">${stats.totalPayout.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </motion.div>
    );
};
