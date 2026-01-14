// Payroll Settings Management
// Handles fixed rates, admin fees, extra pay, and payroll history

const SETTINGS_KEY = 'referee_payroll_settings';
const PAYROLL_HISTORY_KEY = 'payroll_history';
const APP_STATE_KEY = 'referee_app_state';
const ADMIN_FEE_PER_GAME = 2; // Fixed admin fee per game

// Default admin-fee EXEMPT employee numbers (these do NOT pay admin fee)
// Everyone else PAYS the admin fee by default
export const ADMIN_FEE_EXEMPT = new Set([
  '346',
  '1421',
  '1865',
  '2594',
  '5192',
  '5379',
  '6222',
  '9475',
  '4073',
  '2455',
  '4006',
]);

// Check if an employee is exempt from admin fee
export const isAdminFeeExempt = (employeeNumber: string): boolean => {
  return ADMIN_FEE_EXEMPT.has(employeeNumber);
};

// === TYPES ===

export interface RefereePayrollSettings {
  employeeNumber: string;
  hasFixedRate: boolean;          // If true, ignore category rates
  fixedRate: number;              // Fixed rate per game (if hasFixedRate)
  hasAdminFee: boolean;           // If true, deduct admin fee from gross
}

export interface GlobalPayrollSettings {
  haciendaTaxRate: number;        // Default 10% (0.10)
  depositFee: number;             // Default $1
  adminFeeAmount: number;         // Fixed at $2 per game (kept for display)
}

export interface PayrollExtraPay {
  [employeeNumber: string]: number; // Extra pay per referee for a specific batch
}

export interface PayrollBatchRecord {
  id: string;
  timestamp: number;
  name?: string;
  dateRange: { start: string; end: string };
  files: string[];
  referees: PayrollRefereeRecord[];
  totals: {
    grossPay: number;
    totalExtraPay: number;
    totalAdminFees: number;
    totalFines: number;
    totalTax: number;
    totalDeposit: number;
    netPay: number;
    totalGames: number;
  };
}

export interface PayrollRefereeRecord {
  employeeNumber: string;
  refereeName: string;
  scheduleName: string;
  games: number;
  grossPay: number;
  extraPay: number;
  adminFee: number;
  fines: number;
  taxableIncome: number;
  haciendaTax: number;
  depositFee: number;
  netPay: number;
  usedFixedRate: boolean;
  fixedRate?: number;
}

// === DEFAULT VALUES ===

export const DEFAULT_GLOBAL_SETTINGS: GlobalPayrollSettings = {
  haciendaTaxRate: 0.10,  // 10%
  depositFee: 1.00,
  adminFeeAmount: ADMIN_FEE_PER_GAME,
};

// === STORAGE FUNCTIONS ===

export interface StoredSettings {
  global: GlobalPayrollSettings;
  referees: Record<string, RefereePayrollSettings>;
}

export const getStoredSettings = (): StoredSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }
  return {
    global: DEFAULT_GLOBAL_SETTINGS,
    referees: {}
  };
};

export const saveSettings = (settings: StoredSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getGlobalSettings = (): GlobalPayrollSettings => {
  return getStoredSettings().global;
};

export const saveGlobalSettings = (global: GlobalPayrollSettings) => {
  const current = getStoredSettings();
  // Force admin fee to the fixed amount
  saveSettings({ ...current, global: { ...global, adminFeeAmount: ADMIN_FEE_PER_GAME } });
};

export const getRefereeSettings = (employeeNumber: string): RefereePayrollSettings => {
  const stored = getStoredSettings();
  const existing = stored.referees[employeeNumber];

  // If no stored settings, create default with admin fee ON unless exempt
  if (!existing) {
    return {
      employeeNumber,
      hasFixedRate: false,
      fixedRate: 0,
      hasAdminFee: !ADMIN_FEE_EXEMPT.has(employeeNumber), // ON by default, OFF only for exempt
    };
  }

  return existing;
};

// Initialize default settings for all known referees (call on app start)
export const initializeDefaultSettings = (refereeDatabase: Array<{ employeeNumber: string }>) => {
  const stored = getStoredSettings();
  let changed = false;

  refereeDatabase.forEach(ref => {
    if (!stored.referees[ref.employeeNumber]) {
      stored.referees[ref.employeeNumber] = {
        employeeNumber: ref.employeeNumber,
        hasFixedRate: false,
        fixedRate: 0,
        hasAdminFee: !ADMIN_FEE_EXEMPT.has(ref.employeeNumber),
      };
      changed = true;
    }
  });

  if (changed) {
    saveSettings(stored);
  }
};

export const saveRefereeSettings = (settings: RefereePayrollSettings) => {
  const current = getStoredSettings();
  current.referees[settings.employeeNumber] = settings;
  saveSettings(current);
  window.dispatchEvent(new Event('settings-updated'));
};

export const getAllRefereeSettings = (): Record<string, RefereePayrollSettings> => {
  return getStoredSettings().referees;
};

// === PAYROLL HISTORY ===

export const getPayrollHistory = (): PayrollBatchRecord[] => {
  try {
    const stored = localStorage.getItem(PAYROLL_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const savePayrollBatch = (batch: PayrollBatchRecord) => {
  const history = getPayrollHistory();
  // Check if this batch already exists (by id) and update it, or add new
  const existingIndex = history.findIndex(h => h.id === batch.id);
  if (existingIndex >= 0) {
    history[existingIndex] = batch;
  } else {
    history.unshift(batch);
  }
  localStorage.setItem(PAYROLL_HISTORY_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event('payroll-updated'));
};

export const deletePayrollBatch = (id: string) => {
  const history = getPayrollHistory().filter(h => h.id !== id);
  localStorage.setItem(PAYROLL_HISTORY_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event('payroll-updated'));
};

// Update the name of a batch without altering other data
export const updatePayrollBatchName = (id: string, name: string) => {
  const history = getPayrollHistory();
  const updated = history.map(batch => batch.id === id ? { ...batch, name } : batch);
  localStorage.setItem(PAYROLL_HISTORY_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('payroll-updated'));
};

// Clear all batches for a specific month
export const clearMonth = (monthKey: string) => {
  const history = getPayrollHistory().filter(batch => {
    const bDate = new Date(batch.dateRange.start);
    const bKey = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}`;
    return bKey !== monthKey;
  });
  localStorage.setItem(PAYROLL_HISTORY_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event('payroll-updated'));
};

// === APP STATE PERSISTENCE ===

export interface PersistedAppState {
  history: any[]; // HistoryItem[]
  lastUpdated: number;
}

export const getPersistedAppState = (): PersistedAppState | null => {
  try {
    const stored = localStorage.getItem(APP_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const saveAppState = (state: PersistedAppState) => {
  localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
};

// === CALCULATION HELPERS ===

export interface PayrollCalculationInput {
  employeeNumber: string;
  refereeName: string;
  scheduleName: string;
  categories: Record<string, number>;

  rates: Record<string, number>;
  extraPay: number;
  fines: number;
  globalSettings: GlobalPayrollSettings;
  refereeSettings: RefereePayrollSettings;
  lifetimeEarningsBefore?: number; // Prior cumulative earnings (gross+extra) from ALL history
}

export interface PayrollCalculationResult {
  games: number;
  grossPay: number;
  extraPay: number;
  fines: number;
  totalEarnings: number;
  adminFee: number;
  taxableIncome: number;
  haciendaTax: number;
  depositFee: number;
  netPay: number;
  usedFixedRate: boolean;
  fixedRate?: number;
}

export const calculateRefereePayroll = (input: PayrollCalculationInput): PayrollCalculationResult => {
  const { categories, rates, extraPay, fines = 0, globalSettings, refereeSettings, lifetimeEarningsBefore = 0 } = input;

  // Calculate total games
  let games = 0;
  Object.values(categories).forEach(count => {
    games += count;
  });

  // Calculate gross pay
  let grossPay = 0;

  if (refereeSettings.hasFixedRate && refereeSettings.fixedRate > 0) {
    // Fixed rate: same pay per game regardless of category
    grossPay = games * refereeSettings.fixedRate;
  } else {
    // Standard: pay based on category rates
    Object.entries(categories).forEach(([cat, count]) => {
      const rate = rates[cat] || 0;
      grossPay += count * rate;
    });
  }

  // Total earnings before deductions
  const totalEarnings = grossPay + extraPay;

  // Admin fee (if applicable)
  const adminFee = refereeSettings.hasAdminFee ? games * ADMIN_FEE_PER_GAME : 0;

  // Taxable income (after admin fee) - this is the amount technically subject to tax consideration
  // However, the user clarified that tax should be based on GROSS income (Total Earnings) exceeding 500.
  // So we use totalEarnings as the base for the threshold check.
  const baseForTax = totalEarnings;

  // Lifetime/YTD Tax Logic: First $500 earned LIFETIME is exempt.
  // Calculate how much of the $500 deductible is remaining based on history.
  const remainingDeductible = Math.max(0, 500 - lifetimeEarningsBefore);

  // The amount of THIS batch that is subject to tax is the amount that exceeds the remaining deductible.
  const taxableAmount = Math.max(0, baseForTax - remainingDeductible);

  const haciendaTax = taxableAmount > 0 ? taxableAmount * globalSettings.haciendaTaxRate : 0;

  // Deposit fee
  const depositFee = globalSettings.depositFee;

  // Net pay = Total - Admin - Tax - Deposit - Fines
  const netPay = totalEarnings - adminFee - haciendaTax - depositFee - fines;

  return {
    games,
    grossPay,
    extraPay,
    fines,
    totalEarnings,
    adminFee,
    taxableIncome: taxableAmount, // Updating this to reflect the ACTUAL taxed amount for clarity
    haciendaTax,
    depositFee,
    netPay,
    usedFixedRate: refereeSettings.hasFixedRate,
    fixedRate: refereeSettings.hasFixedRate ? refereeSettings.fixedRate : undefined,
  };
};

// === MONTHLY SUMMARY HELPERS ===

export interface MonthlySummary {
  month: string;  // "2024-01" format
  monthLabel: string;  // "January 2024"
  totalGross: number;
  totalExtra: number;
  totalAdminFees: number;
  totalTax: number;
  totalDeposits: number;
  totalNet: number;
  totalGames: number;
  refereeCount: number;
  batches: PayrollBatchRecord[];
}

export interface RefereeMonthlySummary {
  employeeNumber: string;
  refereeName: string;
  months: Record<string, {
    grossPay: number;
    extraPay: number;
    adminFee: number;
    tax: number;
    deposit: number;
    netPay: number;
    games: number;
  }>;
  totals: {
    grossPay: number;
    extraPay: number;
    adminFee: number;
    tax: number;
    deposit: number;
    netPay: number;
    games: number;
  };
}

export const getMonthKey = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getMonthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const getMonthlySummaries = (): MonthlySummary[] => {
  const history = getPayrollHistory();
  const monthMap: Record<string, MonthlySummary> = {};

  history.forEach(batch => {
    const monthKey = getMonthKey(batch.dateRange.start);

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        month: monthKey,
        monthLabel: getMonthLabel(monthKey),
        totalGross: 0,
        totalExtra: 0,
        totalAdminFees: 0,
        totalTax: 0,
        totalDeposits: 0,
        totalNet: 0,
        totalGames: 0,
        refereeCount: 0,
        batches: [],
      };
    }

    monthMap[monthKey].totalGross += batch.totals.grossPay;
    monthMap[monthKey].totalExtra += batch.totals.totalExtraPay;
    monthMap[monthKey].totalAdminFees += batch.totals.totalAdminFees;
    monthMap[monthKey].totalTax += batch.totals.totalTax;
    monthMap[monthKey].totalDeposits += batch.totals.totalDeposit;
    monthMap[monthKey].totalNet += batch.totals.netPay;
    monthMap[monthKey].totalGames += batch.totals.totalGames;
    monthMap[monthKey].refereeCount = new Set([
      ...monthMap[monthKey].batches.flatMap(b => b.referees.map(r => r.employeeNumber)),
      ...batch.referees.map(r => r.employeeNumber)
    ]).size;
    monthMap[monthKey].batches.push(batch);
  });

  return Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));
};

export const getRefereeMonthlySummaries = (): RefereeMonthlySummary[] => {
  const history = getPayrollHistory();
  const refereeMap: Record<string, RefereeMonthlySummary> = {};

  history.forEach(batch => {
    const monthKey = getMonthKey(batch.dateRange.start);

    batch.referees.forEach(ref => {
      if (!refereeMap[ref.employeeNumber]) {
        refereeMap[ref.employeeNumber] = {
          employeeNumber: ref.employeeNumber,
          refereeName: ref.refereeName,
          months: {},
          totals: {
            grossPay: 0,
            extraPay: 0,
            adminFee: 0,
            tax: 0,
            deposit: 0,
            netPay: 0,
            games: 0,
          },
        };
      }

      if (!refereeMap[ref.employeeNumber].months[monthKey]) {
        refereeMap[ref.employeeNumber].months[monthKey] = {
          grossPay: 0,
          extraPay: 0,
          adminFee: 0,
          tax: 0,
          deposit: 0,
          netPay: 0,
          games: 0,
        };
      }

      const refData = refereeMap[ref.employeeNumber];
      const monthData = refData.months[monthKey];

      monthData.grossPay += ref.grossPay;
      monthData.extraPay += ref.extraPay;
      monthData.adminFee += ref.adminFee;
      monthData.tax += ref.haciendaTax;
      monthData.deposit += ref.depositFee;
      monthData.netPay += ref.netPay;
      monthData.games += ref.games;

      refData.totals.grossPay += ref.grossPay;
      refData.totals.extraPay += ref.extraPay;
      refData.totals.adminFee += ref.adminFee;
      refData.totals.tax += ref.haciendaTax;
      refData.totals.deposit += ref.depositFee;
      refData.totals.netPay += ref.netPay;
      refData.totals.games += ref.games;
    });
  });

  return Object.values(refereeMap).sort((a, b) =>
    a.refereeName.localeCompare(b.refereeName)
  );
};

