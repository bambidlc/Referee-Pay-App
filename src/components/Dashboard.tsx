import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Users, DollarSign, Trophy, Settings,
  Calendar, TrendingUp, FileText, ChevronDown, ChevronUp, Building,
  Percent, Receipt, Trash2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { type ArbitratorStats } from '../utils/parser';
import { utils, writeFile } from 'xlsx';
import {
  type GlobalPayrollSettings,
  type PayrollCalculationResult,
  type PayrollBatchRecord,
  type PayrollRefereeRecord,
  getPayrollHistory,
  getGlobalSettings,
  getRefereeSettings,
  calculateRefereePayroll,
  savePayrollBatch,
  getMonthlySummaries,
  getRefereeMonthlySummaries,
  getMonthLabel,
  clearMonth,
  deletePayrollBatch,
} from '../utils/payrollSettings';
import { RefereeSettingsPanel } from './RefereeSettingsPanel';

interface DashboardProps {
  arbitrators?: ArbitratorStats[];
  rates?: Record<string, number>;
  categories?: string[];
  dateRange?: { start: string; end: string };
  batchId?: string;
  onRateChange?: (category: string, newRate: number) => void;
  onReset: () => void;
  initialMonth?: string;
}

type TabType = 'payroll' | 'employees' | 'monthly' | 'history';

interface CalculatedReferee extends ArbitratorStats {
  calculation: PayrollCalculationResult;
  extraPay: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  arbitrators = [],
  rates = {},
  categories = [],
  dateRange,
  batchId = '',
  onRateChange = () => { },
  onReset,
  initialMonth = ''
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('payroll');
  const [globalSettings, setGlobalSettings] = useState<GlobalPayrollSettings>(getGlobalSettings());
  const [extraPays, setExtraPays] = useState<Record<string, number>>({});
  const [fines, setFines] = useState<Record<string, number>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showCategoryReport, setShowCategoryReport] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth); // For filtering history
  const [currentBatchId, setCurrentBatchId] = useState<string>(batchId);

  // Update selected month if initialMonth changes
  useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth]);

  // Sync currentBatchId if prop changes
  useEffect(() => {
    if (batchId) setCurrentBatchId(batchId);
  }, [batchId]);



  // Aggregated data source (either current props or filtered history)
  const sourceData = useMemo(() => {
    if (!selectedMonth) {
      return {
        arbitrators,
        rates,
        // When using current props, we rely on the component's existing logic
        // But we need to structure it so we can swap it out if selectedMonth is active
      };
    }

    // If filtering by month, aggregate from history
    const history = getPayrollHistory();
    const monthBatches = history.filter(b => {
      const bDate = new Date(b.dateRange.start);
      const bKey = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}`;
      return bKey === selectedMonth;
    });

    // Aggregate referees from all batches in this month
    const aggregatedArbitrators: Record<string, ArbitratorStats> = {};
    // const aggregatedRates: Record<string, number> = {}; // Unused for now

    monthBatches.forEach(batch => {
      batch.referees.forEach(ref => {
        const key = ref.employeeNumber;
        if (!aggregatedArbitrators[key]) {
          aggregatedArbitrators[key] = {
            name: ref.scheduleName,
            displayName: ref.refereeName,
            employeeNumber: ref.employeeNumber,
            categories: {},
            total: 0,
            matchedReferee: {
              employeeNumber: ref.employeeNumber,
              fullName: ref.refereeName
            }
          };
        }
        // Merge categories (this is tricky because we don't store category breakdown in PayrollRefereeRecord easily exposed)
        // Wait, PayrollRefereeRecord doesn't store category breakdown! 
        // We only have the totals. 
        // To properly support "Dashboard" view which expects categories, we might be limited.
        // However, for "Dashboard values", usually people want the NET/GROSS/ETC.

        // The prompt says "show me the dashboard values of the month".
        // If we want the FULL dashboard table with categories, we can't fully reconstruct it from PayrollRefereeRecord 
        // because we only save `games`, `grossPay`, `netPay`, etc. We lost the per-category counts in `savePayrollBatch`.

        // BUT, we can display the calculated totals.
        // Let's adapt calculatedData to support "pre-calculated" records if possible, 
        // OR acknowledging we only have summary data for history.

        // Actually, the user says "the same way it shows the current payroll".
        // If the data is missing, we can't show it exactly the same (missing categories).
        // We can only show the aggregate totals (games, gross, net).
        // Let's assume we just want to see the list of referees and their totals for that month.

        const arb = aggregatedArbitrators[key];
        arb.total += ref.games; // Total games
        // We can't reconstruct categories easily without changing the data structure.
        // We will shim it.
      });
    });

    return {
      arbitrators: Object.values(aggregatedArbitrators),
      rates: {}, // Rates aren't relevant if we use pre-calculated values, but we need to handle that.
      isHistoryView: true,
      monthBatches // Pass full batches to extract pre-calculated values
    };
  }, [selectedMonth, arbitrators, rates]);

  // Available months for selector
  const availableMonths = useMemo(() => {
    const history = getPayrollHistory();
    const months = new Set<string>();
    history.forEach(b => {
      const d = new Date(b.dateRange.start);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    });
    return Array.from(months).sort().reverse();
  }, []);

  // Default Extra Pay for Referee 594
  useEffect(() => {
    // Check if referee 594 exists in the current batch
    const targetRef = arbitrators.find(a => (a.employeeNumber === '594' || a.employeeNumber === '2594')); // Checking both just in case mapped
    if (targetRef) {
      const empNum = targetRef.employeeNumber || targetRef.name;
      setExtraPays(prev => {
        // Only set if not already set (avoid overwriting manual changes during session, technically)
        // But user said "always receive", so implying a default initialization.
        if (prev[empNum] === undefined) {
          return { ...prev, [empNum]: 175 };
        }
        return prev;
      });
    }
  }, [arbitrators]);

  // Precompute LIFETIME earnings before current batch for tax exemption
  // This sums up ALL earnings from ALL batches (except the active one)
  const lifetimeEarningsBefore = useMemo(() => {
    const history = getPayrollHistory();
    const totals: Record<string, number> = {};
    history.forEach(batch => {
      // Exclude current batch to avoid double counting
      if (currentBatchId && batch.id === currentBatchId) return;

      batch.referees.forEach(ref => {
        // We track GROSS earning accumulation for tax threshold purposes
        // Assuming "Income" = Gross + Extra.
        const earnings = ref.grossPay + ref.extraPay;
        totals[ref.employeeNumber] = (totals[ref.employeeNumber] || 0) + earnings;
      });
    });
    return totals;
  }, [settingsVersion, currentBatchId]);
  // Ideally, we should depend on 'sourceData' if it reflected the whole DB, but it doesn't.
  // We'll rely on settingsVersion as a trigger for now or just re-calc when component updates. 
  // *Self-correction*: We need a trigger when history changes. 
  // Let's add an explicit effect to load history or just acknowledge it reads from LS on render.
  // Actually, MainOverview triggers re-renders on 'payroll-updated'. Dashboard might not.
  // Let's assume history is stable during the session unless saved.


  // Reload settings when they change
  useEffect(() => {
    setGlobalSettings(getGlobalSettings());
  }, [settingsVersion]);

  const calculatedData = useMemo(() => {
    // If in history view, we reconstruct "CalculatedReferee" objects from the saved batch data
    if (sourceData.isHistoryView && sourceData.monthBatches) {
      const aggregated: Record<string, CalculatedReferee> = {};

      sourceData.monthBatches.forEach(batch => {
        batch.referees.forEach(ref => {
          const key = ref.employeeNumber;
          if (!aggregated[key]) {
            // Initialize
            aggregated[key] = {
              name: ref.scheduleName,
              displayName: ref.refereeName,
              employeeNumber: ref.employeeNumber,
              categories: {}, // Not preserved in history
              total: 0,
              extraPay: 0,
              calculation: {
                games: 0,
                grossPay: 0,
                extraPay: 0,
                fines: 0,
                totalEarnings: 0,
                adminFee: 0,
                taxableIncome: 0,
                haciendaTax: 0,
                depositFee: 0,
                netPay: 0,
                usedFixedRate: false,
              }
            };
          }

          const curr = aggregated[key];
          // Accumulate totals
          curr.total += ref.games;
          curr.extraPay += ref.extraPay;

          curr.calculation.games += ref.games;
          curr.calculation.grossPay += ref.grossPay;
          curr.calculation.extraPay += ref.extraPay;
          curr.calculation.fines += (ref as any).fines || 0; // Type casting in case old records don't have it
          curr.calculation.totalEarnings += (ref.grossPay + ref.extraPay);
          curr.calculation.adminFee += ref.adminFee;
          curr.calculation.taxableIncome += ref.taxableIncome;
          curr.calculation.haciendaTax += ref.haciendaTax;
          curr.calculation.depositFee += ref.depositFee;
          curr.calculation.netPay += ref.netPay;
          // Fixed rate flags might be inconsistent across batches, just take last
          curr.calculation.usedFixedRate = ref.usedFixedRate;
          curr.calculation.fixedRate = ref.fixedRate;
        });
      });
      return Object.values(aggregated).sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
    }

    // Default: Calculate from current arbitrators prop
    return arbitrators.map(arb => {
      const empNum = arb.employeeNumber || arb.name;
      const refereeSettings = getRefereeSettings(empNum);
      const extra = extraPays[empNum] || 0;
      const fine = fines[empNum] || 0;
      const lifetimeBefore = lifetimeEarningsBefore[empNum] || 0;

      const calculation = calculateRefereePayroll({
        employeeNumber: empNum,
        refereeName: arb.displayName || arb.name,
        scheduleName: arb.name,
        categories: arb.categories,
        rates,
        extraPay: extra,
        fines: fine,
        globalSettings,
        refereeSettings,
        lifetimeEarningsBefore: lifetimeBefore,
      });

      return {
        ...arb,
        calculation,
        extraPay: extra,
        fines: fine,
      } as CalculatedReferee;
    }).sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
  }, [arbitrators, rates, globalSettings, extraPays, fines, settingsVersion, sourceData, lifetimeEarningsBefore]);

  const stats = useMemo(() => {
    const totalGross = calculatedData.reduce((acc, curr) => acc + curr.calculation.grossPay, 0);
    const totalExtra = calculatedData.reduce((acc, curr) => acc + curr.calculation.extraPay, 0);
    const totalFines = calculatedData.reduce((acc, curr) => acc + curr.calculation.fines, 0);
    const totalAdminFees = calculatedData.reduce((acc, curr) => acc + curr.calculation.adminFee, 0);
    const totalTax = calculatedData.reduce((acc, curr) => acc + curr.calculation.haciendaTax, 0);
    const totalDeposit = calculatedData.reduce((acc, curr) => acc + curr.calculation.depositFee, 0);
    const totalNet = calculatedData.reduce((acc, curr) => acc + curr.calculation.netPay, 0);
    const totalGames = calculatedData.reduce((acc, curr) => acc + curr.calculation.games, 0);
    const topEarner = [...calculatedData].sort((a, b) => b.calculation.netPay - a.calculation.netPay)[0];

    return { totalGross, totalExtra, totalFines, totalAdminFees, totalTax, totalDeposit, totalNet, totalGames, topEarner };
  }, [calculatedData]);

  const handleExtraPayChange = (employeeNumber: string, value: number) => {
    setExtraPays(prev => ({
      ...prev,
      [employeeNumber]: Math.max(0, value)
    }));
  };

  const handleFinesChange = (employeeNumber: string, value: number) => {
    setFines(prev => ({
      ...prev,
      [employeeNumber]: Math.max(0, value)
    }));
  };

  const toggleRowExpand = (name: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleSave = () => {
    // Ensure we have a persistent ID for this batch session
    const idToUse = currentBatchId || `batch_${Date.now()}`;
    if (!currentBatchId) {
      setCurrentBatchId(idToUse);
    }

    // Create batch record
    const refereeRecords: PayrollRefereeRecord[] = calculatedData.map(arb => ({
      employeeNumber: arb.employeeNumber || arb.name,
      refereeName: arb.displayName || arb.name,
      scheduleName: arb.name,
      games: arb.calculation.games,
      grossPay: arb.calculation.grossPay,
      extraPay: arb.calculation.extraPay,
      adminFee: arb.calculation.adminFee,
      fines: arb.calculation.fines,
      taxableIncome: arb.calculation.taxableIncome,
      haciendaTax: arb.calculation.haciendaTax,
      depositFee: arb.calculation.depositFee,
      netPay: arb.calculation.netPay,
      usedFixedRate: arb.calculation.usedFixedRate,
      fixedRate: arb.calculation.fixedRate,
      categories: arb.categories, // Store category breakdown
      categoryRates: rates, // Store rates used for this batch
    }));

    const batch: PayrollBatchRecord = {
      id: idToUse,
      timestamp: Date.now(),
      dateRange: dateRange || { start: '', end: '' },
      files: [],
      referees: refereeRecords,
      totals: {
        grossPay: stats.totalGross,
        totalExtraPay: stats.totalExtra,
        totalAdminFees: stats.totalAdminFees,
        totalFines: stats.totalFines,
        totalTax: stats.totalTax,
        totalDeposit: stats.totalDeposit,
        netPay: stats.totalNet,
        totalGames: stats.totalGames,
      },
    };

    savePayrollBatch(batch);
    alert('Payroll batch saved successfully!');
  };

  const handleExport = () => {
    // Export to Excel
    // Collect all unique categories from all arbitrators
    const allCategories = new Set<string>();
    calculatedData.forEach(arb => {
      Object.keys(arb.categories || {}).forEach(cat => allCategories.add(cat));
    });
    const categoryList = Array.from(allCategories).sort();

    const exportData = calculatedData.map(arb => {
      const row: Record<string, any> = {
        'Employee #': arb.employeeNumber || 'N/A',
        'Referee Name': arb.displayName || arb.name,
        'Games': arb.calculation.games,
        'Rate Type': arb.calculation.usedFixedRate ? `Fixed $${arb.calculation.fixedRate}` : 'Category',
      };

      // Add category columns with games count and rate
      categoryList.forEach(cat => {
        const count = arb.categories?.[cat] || 0;
        const rate = rates[cat] || 0;
        row[`${cat} (Games)`] = count;
        row[`${cat} (Rate)`] = count > 0 ? `$${rate}` : '-';
        row[`${cat} (Value)`] = count > 0 ? count * rate : 0;
      });

      // Add financial columns
      row['Gross Pay'] = arb.calculation.grossPay;
      row['Extra Pay'] = arb.calculation.extraPay;
      row['Total Earnings'] = arb.calculation.totalEarnings;
      row['Admin Fee'] = arb.calculation.adminFee;
      row['Fines'] = arb.calculation.fines;
      row['Taxable Income'] = arb.calculation.taxableIncome;
      row['Hacienda Tax (10%)'] = arb.calculation.haciendaTax;
      row['Deposit Fee'] = arb.calculation.depositFee;
      row['Net Pay'] = arb.calculation.netPay;

      return row;
    });

    // Add totals row
    const totalsRow: Record<string, any> = {
      'Employee #': '',
      'Referee Name': 'TOTALS',
      'Games': stats.totalGames,
      'Rate Type': '',
    };

    // Add category totals
    categoryList.forEach(cat => {
      const totalGames = calculatedData.reduce((sum, arb) => sum + (arb.categories?.[cat] || 0), 0);
      const rate = rates[cat] || 0;
      totalsRow[`${cat} (Games)`] = totalGames;
      totalsRow[`${cat} (Rate)`] = `$${rate}`;
      totalsRow[`${cat} (Value)`] = totalGames * rate;
    });

    totalsRow['Gross Pay'] = stats.totalGross;
    totalsRow['Extra Pay'] = stats.totalExtra;
    totalsRow['Total Earnings'] = stats.totalGross + stats.totalExtra;
    totalsRow['Admin Fee'] = stats.totalAdminFees;
    totalsRow['Fines'] = stats.totalFines;
    totalsRow['Taxable Income'] = 'N/A'; // Too complex to sum with YTD logic individually
    totalsRow['Hacienda Tax (10%)'] = stats.totalTax;
    totalsRow['Deposit Fee'] = stats.totalDeposit;
    totalsRow['Net Pay'] = stats.totalNet;

    exportData.push(totalsRow);

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Payroll Report");

    let filename = "Referee_Payroll_Report.xlsx";
    if (dateRange?.start && dateRange?.end) {
      filename = `Payroll_${dateRange.start}_to_${dateRange.end}.xlsx`;
    }

    writeFile(wb, filename);
  };

  const categoryReportData = useMemo(() => {
    const categoriesFromSource = new Set<string>();
    const categoryRates: Record<string, number> = {};
    const rows: Array<{
      employeeNumber: string;
      refereeName: string;
      totalGames: number;
      categories: Record<string, number>;
    }> = [];
    let totalGames = 0;

    if (sourceData.isHistoryView && sourceData.monthBatches) {
      const aggregated: Record<string, typeof rows[number]> = {};

      sourceData.monthBatches.forEach(batch => {
        batch.referees.forEach(ref => {
          const key = ref.employeeNumber;
          if (!aggregated[key]) {
            aggregated[key] = {
              employeeNumber: ref.employeeNumber,
              refereeName: ref.refereeName || ref.scheduleName,
              totalGames: 0,
              categories: {},
            };
          }

          aggregated[key].totalGames += ref.games;
          const categoryCounts = ref.categories || {};
          Object.entries(categoryCounts).forEach(([category, count]) => {
            aggregated[key].categories[category] = (aggregated[key].categories[category] || 0) + count;
            categoriesFromSource.add(category);
          });

          const refRates = ref.categoryRates || {};
          Object.entries(refRates).forEach(([category, rate]) => {
            if (!Number.isNaN(rate)) {
              categoryRates[category] = rate;
              categoriesFromSource.add(category);
            }
          });
        });
      });

      Object.values(aggregated)
        .sort((a, b) => a.refereeName.localeCompare(b.refereeName))
        .forEach(ref => {
          totalGames += ref.totalGames;
          rows.push(ref);
        });
    } else {
      calculatedData.forEach(arb => {
        Object.keys(arb.categories || {}).forEach(category => categoriesFromSource.add(category));
      });

      calculatedData.forEach(arb => {
        totalGames += arb.calculation.games;
        rows.push({
          employeeNumber: arb.employeeNumber || 'N/A',
          refereeName: arb.displayName || arb.name,
          totalGames: arb.calculation.games,
          categories: arb.categories || {},
        });
      });

      Object.entries(rates).forEach(([category, rate]) => {
        if (!Number.isNaN(rate)) {
          categoryRates[category] = rate;
        }
      });
    }

    const categorySortInfo = (category: string) => {
      const trimmed = category.trim();
      const exactUMatch = trimmed.match(/^(\d{1,2})u(f)?$/i);
      if (exactUMatch) {
        const num = Number(exactUMatch[1]);
        if (num >= 6 && num <= 19) {
          return { group: 0, order: num + (exactUMatch[2] ? 0.5 : 0), label: trimmed };
        }
      }

      const numMatch = trimmed.match(/(\d{1,2})/);
      const numericOrder = numMatch ? Number(numMatch[1]) : Number.POSITIVE_INFINITY;
      return { group: 1, order: numericOrder, label: trimmed };
    };

    const categories = Array.from(categoriesFromSource).sort((a, b) => {
      const aInfo = categorySortInfo(a);
      const bInfo = categorySortInfo(b);
      if (aInfo.group !== bInfo.group) {
        return aInfo.group - bInfo.group;
      }
      if (aInfo.order !== bInfo.order) {
        return aInfo.order - bInfo.order;
      }
      return aInfo.label.localeCompare(bInfo.label);
    });
    return { categories, rows, totalGames, categoryRates };
  }, [sourceData, calculatedData, rates]);

  const formatCategoryRate = (category: string) => {
    const rate = categoryReportData.categoryRates[category];
    if (rate === undefined) {
      return 'Rate n/a';
    }
    return `$${rate.toFixed(2)}/game`;
  };

  const handleCategoryReportExport = () => {
    if (categoryReportData.rows.length === 0 || categoryReportData.categories.length === 0) {
      alert('No category data available for this report.');
      return;
    }

    const dataRows: Array<Record<string, string | number>> = categoryReportData.rows.map(ref => {
      const row: Record<string, string | number> = {
        'Employee #': ref.employeeNumber || 'N/A',
        'Referee Name': ref.refereeName,
        'Total Games': ref.totalGames,
      };
      categoryReportData.categories.forEach(category => {
        row[category] = ref.categories[category] || 0;
      });
      return row;
    });

    const rateRow: Record<string, string | number> = {
      'Employee #': '',
      'Referee Name': 'Rate ($/game)',
      'Total Games': '',
    };
    categoryReportData.categories.forEach(category => {
      const rate = categoryReportData.categoryRates[category];
      rateRow[category] = rate !== undefined ? rate : '';
    });

    const totalsRow: Record<string, string | number> = {
      'Employee #': '',
      'Referee Name': 'TOTALS',
      'Total Games': categoryReportData.totalGames,
    };
    categoryReportData.categories.forEach(category => {
      totalsRow[category] = dataRows.reduce((sum, row) => sum + Number(row[category] || 0), 0);
    });

    const rows: Array<Record<string, string | number>> = [rateRow, ...dataRows, totalsRow];

    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Category Report');

    let filename = 'Category_Report.xlsx';
    if (selectedMonth) {
      filename = `Category_Report_${selectedMonth}.xlsx`;
    } else if (dateRange?.start && dateRange?.end) {
      filename = `Category_Report_${dateRange.start}_to_${dateRange.end}.xlsx`;
    }

    writeFile(wb, filename);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full space-y-6"
    >
      {/* Settings Panel */}
      <RefereeSettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSettingsChange={() => setSettingsVersion(v => v + 1)}
      />

      {/* Header with tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Payroll Dashboard</h2>
            {selectedMonth ? (
              <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                Viewing History: {getMonthLabel(selectedMonth)}
              </p>
            ) : (dateRange?.start && dateRange?.end && (
              <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                Period: {dateRange.start} to {dateRange.end}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Month Selector */}
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <option value="">{arbitrators.length > 0 ? "Current Batch" : "Select Month..."}</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{getMonthLabel(m)}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {!selectedMonth && arbitrators.length > 0 && (
              <>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={onReset}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg font-medium transition-all"
                >
                  <FileText className="w-4 h-4" />
                  Save Batch
                </button>
              </>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-primary-600/20 transition-all"
            >
              <Download className="w-4 h-4" />
              Export {selectedMonth ? 'Month' : 'Batch'}
            </button>
            <button
              onClick={() => setShowCategoryReport(prev => !prev)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border ${showCategoryReport
                ? 'bg-primary-50 text-primary-700 border-primary-200'
                : 'bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
                }`}
            >
              <FileText className="w-4 h-4" />
              {showCategoryReport ? 'Hide Category Report' : 'Category Report'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-t border-slate-100 pt-4">
          {[
            { id: 'payroll' as TabType, label: 'Current Payroll', icon: Receipt },
            { id: 'employees' as TabType, label: 'Employee View', icon: Users },
            { id: 'monthly' as TabType, label: 'Monthly Summary', icon: TrendingUp },
            { id: 'history' as TabType, label: 'History', icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === tab.id
                ? 'bg-primary-100 text-primary-700'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'payroll' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={DollarSign}
              iconBg="bg-green-100"
              iconColor="text-green-600"
              label="Net Payout"
              value={`$${stats.totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              sublabel={`Gross: $${stats.totalGross.toFixed(2)}`}
            />
            <StatCard
              icon={Percent}
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
              label="Hacienda Tax"
              value={`$${stats.totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              sublabel="10% of taxable income"
            />
            <StatCard
              icon={Users}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              label="Total Games"
              value={stats.totalGames.toString()}
              sublabel={`${calculatedData.length} referees`}
            />
            <StatCard
              icon={Trophy}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
              label="Top Earner"
              value={stats.topEarner?.displayName?.split(' ')[0] || stats.topEarner?.name || '-'}
              sublabel={`$${stats.topEarner?.calculation.netPay.toFixed(2) || 0}`}
            />
          </div>

          {/* Deductions Summary */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Building className="w-5 h-5" />
              Deductions Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
              <div>
                <p className="text-slate-400 text-xs uppercase">Gross Total</p>
                <p className="text-xl font-bold">${(stats.totalGross + stats.totalExtra).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase">Admin Fees</p>
                <p className="text-xl font-bold text-red-400">-${stats.totalAdminFees.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase">Fines</p>
                <p className="text-xl font-bold text-red-400">-${stats.totalFines.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase">Hacienda Tax</p>
                <p className="text-xl font-bold text-amber-400">-${stats.totalTax.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase">Deposit Fees</p>
                <p className="text-xl font-bold text-blue-400">-${stats.totalDeposit.toFixed(2)}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2">
                <p className="text-green-300 text-xs uppercase">Net Payout</p>
                <p className="text-2xl font-bold text-green-400">${stats.totalNet.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Referee</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Games</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Gross</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600">Extra Pay</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Admin Fee</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Fines</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Tax (10%)</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Deposit</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Net Pay</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculatedData.map((arb, idx) => {
                    const isExpanded = expandedRows.has(arb.name);
                    const empNum = arb.employeeNumber || arb.name;

                    return (
                      <React.Fragment key={arb.name}>
                        <motion.tr
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">
                                {arb.displayName || arb.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {arb.employeeNumber && (
                                  <span className="text-xs text-slate-400">#{arb.employeeNumber}</span>
                                )}
                                {arb.calculation.usedFixedRate && (
                                  <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                    Fixed ${arb.calculation.fixedRate}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 text-primary-600 font-medium">
                              {arb.calculation.games}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            ${arb.calculation.grossPay.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                value={extraPays[empNum] || 0}
                                onChange={(e) => handleExtraPayChange(empNum, parseFloat(e.target.value) || 0)}
                                className="w-20 text-center px-2 py-1 border border-slate-200 rounded text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-red-600">
                            {arb.calculation.adminFee > 0 ? `-$${arb.calculation.adminFee.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="0"
                                value={fines[empNum] || 0}
                                onChange={(e) => handleFinesChange(empNum, parseFloat(e.target.value) || 0)}
                                className={`w-16 text-center px-2 py-1 border rounded text-sm ${(fines[empNum] || 0) > 0 ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200'
                                  }`}
                                placeholder="0"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-amber-600">
                            -${arb.calculation.haciendaTax.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-600">
                            -${arb.calculation.depositFee.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            ${arb.calculation.netPay.toFixed(2)}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              onClick={() => toggleRowExpand(arb.name)}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>
                        </motion.tr>

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              <td colSpan={10} className="bg-slate-50 px-6 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {categories.map(cat => {
                                    const count = arb.categories[cat] || 0;
                                    if (count === 0) return null;
                                    return (
                                      <div key={cat} className="bg-white rounded-lg p-3 border border-slate-200">
                                        <p className="text-xs text-slate-500 uppercase">{cat}</p>
                                        <p className="text-lg font-bold text-slate-800">{count} games</p>
                                        {!arb.calculation.usedFixedRate && (
                                          <p className="text-xs text-slate-400">@ ${rates[cat]}/game</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-semibold">
                  <tr>
                    <td className="px-4 py-3">Totals ({calculatedData.length} referees)</td>
                    <td className="px-4 py-3 text-center">{stats.totalGames}</td>
                    <td className="px-4 py-3 text-right">${stats.totalGross.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">${stats.totalExtra.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-red-600">-${stats.totalAdminFees.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-red-600">-${stats.totalFines.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">-${stats.totalTax.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">-${stats.totalDeposit.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-600">${stats.totalNet.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {showCategoryReport && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-800">Category Report</h3>
                  <p className="text-sm text-slate-500">All categories in this batch and the categories each referee worked.</p>
                </div>
                <button
                  onClick={handleCategoryReportExport}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Report
                </button>
              </div>
              {categoryReportData.categories.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  No category data available for this report.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Referee</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">Total Games</th>
                        {categoryReportData.categories.map(category => (
                          <th key={category} className="px-4 py-3 text-center font-semibold text-slate-600">
                            <div className="flex flex-col items-center gap-1">
                              <span>{category}</span>
                              <span className="text-xs font-normal text-slate-400">
                                {formatCategoryRate(category)}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categoryReportData.rows.map(ref => (
                        <tr key={`${ref.employeeNumber}-${ref.refereeName}`} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{ref.refereeName}</span>
                              {ref.employeeNumber && (
                                <span className="text-xs text-slate-400">#{ref.employeeNumber}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-slate-700">
                            {ref.totalGames}
                          </td>
                          {categoryReportData.categories.map(category => (
                            <td key={category} className="px-4 py-3 text-center text-slate-700">
                              {ref.categories[category] || 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-semibold">
                      <tr>
                        <td className="px-4 py-3">Totals</td>
                        <td className="px-4 py-3 text-center">{categoryReportData.totalGames}</td>
                        {categoryReportData.categories.map(category => (
                          <td key={category} className="px-4 py-3 text-center">
                            {categoryReportData.rows.reduce((sum, row) => sum + (row.categories[category] || 0), 0)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Category Rates Editor */}
          {!selectedMonth && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Category Rates</h3>
              <div className="flex flex-wrap gap-3">
                {categories.map(cat => (
                  <div key={cat} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                    <span className="text-sm font-medium text-slate-700">{cat}</span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rates[cat]}
                        onChange={(e) => onRateChange(cat, parseFloat(e.target.value) || 0)}
                        className="w-20 pl-6 pr-2 py-1 text-sm border border-slate-200 rounded focus:border-primary-500 outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'employees' && <EmployeeView />}
      {activeTab === 'monthly' && <MonthlySummaryView />}
      {activeTab === 'history' && <HistoryView />}
    </motion.div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sublabel?: string;
}> = ({ icon: Icon, iconBg, iconColor, label, value, sublabel }) => (
  <motion.div
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"
  >
    <div className="flex items-center gap-3">
      <div className={`p-2.5 ${iconBg} ${iconColor} rounded-lg`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
      </div>
    </div>
  </motion.div>
);

// Employee View Component
const EmployeeView: React.FC = () => {
  const [refereeSummaries, setRefereeSummaries] = useState(() => getRefereeMonthlySummaries());
  const months = useMemo(() => {
    const allMonths = new Set<string>();
    refereeSummaries.forEach(ref => {
      Object.keys(ref.months).forEach(m => allMonths.add(m));
    });
    return Array.from(allMonths).sort().reverse();
  }, [refereeSummaries]);

  const refreshData = () => {
    setRefereeSummaries(getRefereeMonthlySummaries());
  };

  if (refereeSummaries.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-600 mb-2">No Employee Data Yet</h3>
        <p className="text-slate-400">Process and save some payroll batches to see employee summaries.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-slate-800">Employee Monthly Income</h3>
          <p className="text-sm text-slate-500">View each referee's earnings by month</p>
        </div>
        <button
          onClick={refreshData}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        <button
          onClick={() => {
            const exportData = refereeSummaries.map(ref => {
              const row: Record<string, any> = {
                'Employee Name': ref.refereeName,
                'Employee #': ref.employeeNumber,
              };
              months.forEach(m => {
                row[getMonthLabel(m)] = ref.months[m] ? ref.months[m].netPay : 0;
              });
              row['Total'] = ref.totals.netPay;
              return row;
            });

            const ws = utils.json_to_sheet(exportData);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Employee Summaries");
            writeFile(wb, "Employee_Yearly_Summary.xlsx");
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm ml-2"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Employee</th>
              {months.map(m => (
                <th key={m} className="px-4 py-3 text-right font-semibold text-slate-600">
                  {getMonthLabel(m)}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-slate-800 bg-slate-100">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {refereeSummaries.map(ref => (
              <tr key={ref.employeeNumber} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-800">{ref.refereeName}</p>
                    <p className="text-xs text-slate-400">#{ref.employeeNumber}</p>
                  </div>
                </td>
                {months.map(m => (
                  <td key={m} className="px-4 py-3 text-right">
                    {ref.months[m] ? (
                      <span className="font-medium text-slate-700">
                        ${ref.months[m].netPay.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-green-600 bg-slate-50">
                  ${ref.totals.netPay.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Monthly Summary View Component
const MonthlySummaryView: React.FC = () => {
  const [summaries, setSummaries] = useState(() => getMonthlySummaries());
  const [confirmClear, setConfirmClear] = useState<string | null>(null);

  const handleClearMonth = (monthKey: string) => {
    clearMonth(monthKey);
    setSummaries(getMonthlySummaries());
    setConfirmClear(null);
  };

  const refreshData = () => {
    setSummaries(getMonthlySummaries());
  };

  if (summaries.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-600 mb-2">No Monthly Data Yet</h3>
        <p className="text-slate-400">Process and save some payroll batches to see monthly summaries.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={refreshData}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        <button
          onClick={() => {
            const exportData = summaries.map(s => ({
              'Month': s.monthLabel,
              'Batches': s.batches.length,
              'Referees': s.refereeCount,
              'Games': s.totalGames,
              'Gross Pay': s.totalGross,
              'Extra Pay': s.totalExtra,
              'Admin Fees': s.totalAdminFees,
              'Hacienda Tax': s.totalTax,
              'Net Payout': s.totalNet
            }));

            const ws = utils.json_to_sheet(exportData);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Monthly Summaries");
            writeFile(wb, "Monthly_Performance_Summary.xlsx");
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm ml-2"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {summaries.map(summary => (
        <div key={summary.month} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800">{summary.monthLabel}</h3>
              <p className="text-sm text-slate-500">{summary.batches.length} batch(es) • {summary.refereeCount} referees</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">${summary.totalNet.toFixed(2)}</p>
                <p className="text-xs text-slate-400">Net Payout</p>
              </div>

              {/* Clear Month Button */}
              {confirmClear === summary.month ? (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700">Clear all?</span>
                  <button
                    onClick={() => handleClearMonth(summary.month)}
                    className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(null)}
                    className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(summary.month)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Clear this month and start over"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Gross</p>
              <p className="text-lg font-bold text-slate-800">${summary.totalGross.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Extra Pay</p>
              <p className="text-lg font-bold text-slate-800">${summary.totalExtra.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Admin Fees</p>
              <p className="text-lg font-bold text-red-600">-${summary.totalAdminFees.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Hacienda Tax</p>
              <p className="text-lg font-bold text-amber-600">-${summary.totalTax.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Total Games</p>
              <p className="text-lg font-bold text-slate-800">{summary.totalGames}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// History View Component
const HistoryView: React.FC = () => {
  const [history, setHistory] = useState(() => getPayrollHistory());
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDeleteBatch = (id: string) => {
    deletePayrollBatch(id);
    setHistory(getPayrollHistory());
    setConfirmDelete(null);
    if (expandedBatch === id) {
      setExpandedBatch(null);
    }
  };

  const refreshData = () => {
    setHistory(getPayrollHistory());
  };

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-600 mb-2">No History Yet</h3>
        <p className="text-slate-400">Saved payroll batches will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{history.length} saved batch(es)</p>
        <button
          onClick={refreshData}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {history.map(batch => (
        <div key={batch.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 flex justify-between items-center">
            <div
              onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
              className="flex-1 cursor-pointer"
            >
              <p className="font-semibold text-slate-800">
                {batch.dateRange.start} to {batch.dateRange.end}
              </p>
              <p className="text-sm text-slate-500">
                {new Date(batch.timestamp).toLocaleDateString()} • {batch.referees.length} referees • {batch.totals.totalGames} games
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-bold text-green-600">${batch.totals.netPay.toFixed(2)}</p>
                <p className="text-xs text-slate-400">Net Payout</p>
              </div>

              {/* Delete Button */}
              {confirmDelete === batch.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDeleteBatch(batch.id)}
                    className="p-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="p-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(batch.id); }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Delete this batch"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                {expandedBatch === batch.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {expandedBatch === batch.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-100"
              >
                <div className="p-4 bg-slate-50">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="text-left py-2">Referee</th>
                          <th className="text-center py-2">Games</th>
                          <th className="text-right py-2">Gross</th>
                          <th className="text-right py-2">Extra</th>
                          <th className="text-right py-2">Admin Fee</th>
                          <th className="text-right py-2">Tax</th>
                          <th className="text-right py-2">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {batch.referees.map(ref => (
                          <tr key={ref.employeeNumber}>
                            <td className="py-2 font-medium">{ref.refereeName}</td>
                            <td className="py-2 text-center">{ref.games}</td>
                            <td className="py-2 text-right">${ref.grossPay.toFixed(2)}</td>
                            <td className="py-2 text-right">${ref.extraPay.toFixed(2)}</td>
                            <td className="py-2 text-right text-purple-600">-${ref.adminFee.toFixed(2)}</td>
                            <td className="py-2 text-right text-amber-600">-${ref.haciendaTax.toFixed(2)}</td>
                            <td className="py-2 text-right font-bold text-green-600">${ref.netPay.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};
