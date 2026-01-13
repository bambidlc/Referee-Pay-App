import { read, utils } from 'xlsx';

export interface ArbitratorStats {
    name: string;
    categories: Record<string, number>;
    total: number;
}

export interface ParseResult {
    arbitrators: ArbitratorStats[];
    allCategories: string[];
}

export const parseSchedule = async (file: File): Promise<ParseResult> => {
    const arrayBuffer = await file.arrayBuffer();
    const wb = read(arrayBuffer);
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const data: any[][] = utils.sheet_to_json(sheet, { header: 1 });

    const counts: Record<string, Record<string, number>> = {};
    const categories = new Set<string>();

    data.forEach((row) => {
        // Updated logic:
        // Column E is row[4] (Category)
        // Referees are in Column B (row[1]), Column C (row[2]), and Column D (row[3])
        if (row.length >= 5 && row[0] !== 'TORNEO' && row[1] && row[4]) {
            const category = String(row[4]).trim();
            categories.add(category);

            const processArbitrators = (cellValue: any) => {
                if (!cellValue) return;
                const arbs = String(cellValue).split('/');
                arbs.forEach((arb) => {
                    const name = arb.trim();
                    if (!name) return;

                    if (!counts[name]) {
                        counts[name] = {};
                    }
                    if (!counts[name][category]) {
                        counts[name][category] = 0;
                    }
                    counts[name][category]++;
                });
            };

            processArbitrators(row[1]); // Column B
            processArbitrators(row[2]); // Column C
            processArbitrators(row[3]); // Column D
        }
    });

    // Sort categories based on python logic
    // if cat.endswith('u'): return int(cat[:-1])
    // elif cat.endswith('uF'): return int(cat[:-2]) + 0.5
    const sortCategories = (a: string, b: string) => {
        const getVal = (cat: string) => {
            const lower = cat.toLowerCase();
            if (lower.includes('mini')) return 100;
            if (lower.includes('infantil')) return 101;
            if (lower.includes('juvenil')) return 102;
            if (lower.includes('junior')) return 103;
            if (lower.includes('femenino')) return 104;
            if (lower.includes('senior')) return 105;

            if (cat.endsWith('u')) return parseInt(cat.slice(0, -1));
            if (cat.endsWith('uF')) return parseInt(cat.slice(0, -2)) + 0.5;
            return 0;
        };
        return getVal(a) - getVal(b);
    };

    const sortedCategories = Array.from(categories).sort(sortCategories);

    const arbitrators: ArbitratorStats[] = Object.keys(counts).sort().map((name) => {
        let total = 0;
        sortedCategories.forEach(cat => {
            total += counts[name][cat] || 0;
        });
        return {
            name,
            categories: counts[name],
            total
        };
    });

    return {
        arbitrators,
        allCategories: sortedCategories,
    };
};
