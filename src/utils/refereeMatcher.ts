// Referee database
export interface Referee {
  employeeNumber: string;
  fullName: string;
}

// Embedded referee data from Referees.csv (Default Fallback)
const DEFAULT_REFEREE_DATABASE: Referee[] = [
  { employeeNumber: "346", fullName: "PAMELA L PEREZ MENDEZ" },
  { employeeNumber: "442", fullName: "JOEL F MADERA" },
  { employeeNumber: "1421", fullName: "JOEL SANCHEZ" },
  { employeeNumber: "1865", fullName: "JUAN M MELENDEZ" },
  { employeeNumber: "2073", fullName: "LUIS JAVIER FIGUEROA" },
  { employeeNumber: "2410", fullName: "ISMAEL BENITEZ" },
  { employeeNumber: "2594", fullName: "CARMELO DE LA ROSA" },
  { employeeNumber: "2788", fullName: "WILLREY CARMONA SANTIAGO" },
  { employeeNumber: "2906", fullName: "TURIANO MALDONADO" },
  { employeeNumber: "2953", fullName: "JOSE R RIVERA BENITEZ" },
  { employeeNumber: "3610", fullName: "GABRIEL R RODRIGUEZ" },
  { employeeNumber: "3804", fullName: "HECTOR M LANDRAU" },
  { employeeNumber: "4169", fullName: "LUIS A MELENDEZ" },
  { employeeNumber: "5192", fullName: "RAFAEL QUIÑONES" },
  { employeeNumber: "5234", fullName: "HECTOR R LOPEZ" },
  { employeeNumber: "5379", fullName: "LUIS JOEL CURBELO MELENDEZ" },
  { employeeNumber: "5486", fullName: "ANDRES ORTIZ" },
  { employeeNumber: "6222", fullName: "HUGO MANUEL TEJEDA-DE LA ROSA" },
  { employeeNumber: "6476", fullName: "VILMARIE MORALES" },
  { employeeNumber: "6833", fullName: "RAMON E FALU" },
  { employeeNumber: "9230", fullName: "SAMUEL NIEVES" },
  { employeeNumber: "9475", fullName: "AXEL COLL" },
  { employeeNumber: "9791", fullName: "JONATHAN A HERNANDEZ" },
  { employeeNumber: "O602", fullName: "CESAR O. QUIÑOENES" },
  { employeeNumber: "5025", fullName: "EDWIN X MILLET" },
  { employeeNumber: "4073", fullName: "GLORYVEE PEREZ" },
  { employeeNumber: "4697", fullName: "LUIS GOMEZ" },
  { employeeNumber: "3008", fullName: "JOSE QUIÑONES" },
  { employeeNumber: "2325", fullName: "CARLOS A. CARRERO" },
  { employeeNumber: "2455", fullName: "JOHNNY BATISTA" },
  { employeeNumber: "8347", fullName: "EDWIN PIZARRO" },
  { employeeNumber: "4006", fullName: "WILLIAM FIGUEROA" },
  { employeeNumber: "3474", fullName: "JOEL A. CRUZ" },
  { employeeNumber: "3792", fullName: "ANGEL M. RIVERA" },
  { employeeNumber: "O629", fullName: "AMANDA PEREZ" },
  { employeeNumber: "2845", fullName: "ALEXIS MERCADO" },
  { employeeNumber: "7669", fullName: "CARMEN SANTIAGO" },
  { employeeNumber: "9800", fullName: "ZERIMAR MERCADO" },
  { employeeNumber: "9801", fullName: "PEPE MILAN" },
  { employeeNumber: "9802", fullName: "ROBERTO RAMIREZ" },
];

const DB_STORAGE_KEY = 'referee_database_v1';

// Get referee database (from storage or default)
export const getRefereeDatabase = (): Referee[] => {
  try {
    const stored = localStorage.getItem(DB_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate that it's a non-empty array
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      // If empty or invalid, fall back to default
      console.warn("Referee database was empty or invalid, using defaults");
    }
  } catch (e) {
    console.error("Failed to load referee database", e);
  }
  return DEFAULT_REFEREE_DATABASE;
};

// Save referee database
export const saveRefereeDatabase = (referees: Referee[]) => {
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(referees));
  // Dispatch event for reactivity
  window.dispatchEvent(new Event('referee-db-updated'));
};

// Add a new referee
export const addRefereeToDatabase = (referee: Referee) => {
  const current = getRefereeDatabase();
  // Check for duplicate employee number
  if (current.some(r => r.employeeNumber === referee.employeeNumber)) {
    throw new Error(`Referee with ID ${referee.employeeNumber} already exists.`);
  }
  const updated = [...current, referee].sort((a, b) => a.fullName.localeCompare(b.fullName));
  saveRefereeDatabase(updated);
};

// Update an existing referee
export const updateRefereeInDatabase = (oldEmployeeNumber: string, updatedReferee: Referee) => {
  const current = getRefereeDatabase();
  const index = current.findIndex(r => r.employeeNumber === oldEmployeeNumber);
  if (index === -1) {
    throw new Error(`Referee with ID ${oldEmployeeNumber} not found.`);
  }
  
  // If changing employee number, check for collision
  if (oldEmployeeNumber !== updatedReferee.employeeNumber && 
      current.some(r => r.employeeNumber === updatedReferee.employeeNumber)) {
    throw new Error(`Referee with ID ${updatedReferee.employeeNumber} already exists.`);
  }

  const updated = [...current];
  updated[index] = updatedReferee;
  updated.sort((a, b) => a.fullName.localeCompare(b.fullName));
  saveRefereeDatabase(updated);
};

// Delete a referee
export const deleteRefereeFromDatabase = (employeeNumber: string) => {
  const current = getRefereeDatabase();
  const updated = current.filter(r => r.employeeNumber !== employeeNumber);
  saveRefereeDatabase(updated);
};

// Deprecated: Expose REFEREE_DATABASE for backward compatibility (it will be static at load time)
// We should migrate away from this.
export const REFEREE_DATABASE = getRefereeDatabase();

// Stored match mappings (schedule name -> referee employee number)
const STORAGE_KEY = 'referee_match_mappings';
const HISTORY_KEY = 'referee_match_history';

export interface MatchMapping {
  scheduleName: string;  // Original name from schedule
  employeeNumber: string;
  matchedAt: number;     // Timestamp
  dateProcessed: string; // Date range when processed
  isManual: boolean;     // Whether this was a manual match
}

export interface MatchHistory {
  employeeNumber: string;
  refereeName: string;
  scheduleName: string;
  dateProcessed: string;
  processedAt: number;
  gamesCount: number;
}

// Get stored mappings
export const getStoredMappings = (): MatchMapping[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save mappings
export const saveMappings = (mappings: MatchMapping[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
};

// Add a single mapping
export const addMapping = (mapping: MatchMapping) => {
  const current = getStoredMappings();
  // Remove any existing mapping for this schedule name
  const filtered = current.filter(m => 
    normalizeForComparison(m.scheduleName) !== normalizeForComparison(mapping.scheduleName)
  );
  filtered.push(mapping);
  saveMappings(filtered);
};

// Get match history
export const getMatchHistory = (): MatchHistory[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Add to match history
export const addToMatchHistory = (history: MatchHistory) => {
  const current = getMatchHistory();
  current.push(history);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(current));
};

// Normalize name for comparison - very lenient
export const normalizeForComparison = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
    .replace(/[^a-z0-9\s]/g, ' ')    // Replace special chars with space
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();
};

// Extract name parts for matching
const getNameParts = (name: string): string[] => {
  return normalizeForComparison(name).split(' ').filter(p => p.length > 0);
};

// Calculate similarity score (0-100)
// Uses multiple strategies for lenient matching
export const calculateSimilarity = (scheduleName: string, refereeName: string): number => {
  const schedNorm = normalizeForComparison(scheduleName);
  const refNorm = normalizeForComparison(refereeName);
  
  // Exact match
  if (schedNorm === refNorm) return 100;
  
  // One contains the other
  if (schedNorm.includes(refNorm) || refNorm.includes(schedNorm)) {
    return 90;
  }
  
  const schedParts = getNameParts(scheduleName);
  const refParts = getNameParts(refereeName);
  
  // Check how many parts match
  let matchedParts = 0;
  let partialMatches = 0;
  
  for (const sp of schedParts) {
    for (const rp of refParts) {
      if (sp === rp) {
        matchedParts++;
        break;
      } else if (sp.includes(rp) || rp.includes(sp)) {
        partialMatches++;
        break;
      } else if (sp.length > 2 && rp.length > 2) {
        // Check for Levenshtein-like similarity
        if (levenshteinSimilarity(sp, rp) > 0.8) {
          partialMatches++;
          break;
        }
      }
    }
  }
  
  // Score based on matched parts
  const totalParts = Math.max(schedParts.length, refParts.length);
  if (totalParts === 0) return 0;
  
  const matchScore = (matchedParts / totalParts) * 80;
  const partialScore = (partialMatches / totalParts) * 50;
  
  // If first parts match (usually last name), give bonus
  if (schedParts.length > 0 && refParts.length > 0) {
    const firstSchedWord = schedParts[0];
    const firstRefWord = refParts[0];
    if (firstSchedWord === firstRefWord) {
      return Math.min(100, matchScore + partialScore + 20);
    }
    // Check if last name appears anywhere
    for (const rp of refParts) {
      if (rp === firstSchedWord && rp.length > 3) {
        return Math.min(100, matchScore + partialScore + 15);
      }
    }
  }
  
  return Math.min(100, matchScore + partialScore);
};

// Simple Levenshtein similarity (0-1)
const levenshteinSimilarity = (a: string, b: string): number => {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
};

export interface MatchResult {
  scheduleName: string;
  matchedReferee: Referee | null;
  confidence: number;
  isFromStorage: boolean;
  suggestions: Array<{ referee: Referee; confidence: number }>;
}

// Find best match for a schedule name
// ALWAYS returns a matched referee (defaults to highest fuzzy match if no confident match)
export const findMatch = (scheduleName: string, _dateProcessed: string): MatchResult => {
  const storedMappings = getStoredMappings();
  const currentDatabase = getRefereeDatabase(); // USE DYNAMIC DB
  
  // If database is empty, we can't match
  if (currentDatabase.length === 0) {
    return {
      scheduleName,
      matchedReferee: null,
      confidence: 0,
      isFromStorage: false,
      suggestions: []
    };
  }
  
  // First check stored mappings
  const storedMatch = storedMappings.find(m => 
    normalizeForComparison(m.scheduleName) === normalizeForComparison(scheduleName)
  );
  
  if (storedMatch) {
    const referee = currentDatabase.find(r => r.employeeNumber === storedMatch.employeeNumber);
    if (referee) {
      return {
        scheduleName,
        matchedReferee: referee,
        confidence: 100,
        isFromStorage: true,
        suggestions: []
      };
    }
  }
  
  // Calculate similarity with all referees
  const matches = currentDatabase.map(referee => ({
    referee,
    confidence: calculateSimilarity(scheduleName, referee.fullName)
  })).sort((a, b) => b.confidence - a.confidence);
  
  const bestMatch = matches[0];
  const CONFIDENCE_THRESHOLD = 60; // Threshold for "confident" match
  const isConfident = bestMatch && bestMatch.confidence >= CONFIDENCE_THRESHOLD;
  
  // ALWAYS return the best match as matchedReferee
  // The confidence score indicates how sure we are
  // Low confidence matches will be flagged for review in the UI
  return {
    scheduleName,
    matchedReferee: bestMatch?.referee || null,
    confidence: bestMatch?.confidence || 0,
    isFromStorage: false,
    // Include suggestions for alternatives
    suggestions: isConfident 
      ? matches.slice(0, 5).filter(m => m.confidence >= 30)
      : matches.slice(0, 8)
  };
};

// Match all schedule names
export const matchAllReferees = (
  scheduleNames: string[],
  dateProcessed: string
): { matched: MatchResult[]; unmatched: MatchResult[] } => {
  const results = scheduleNames.map(name => findMatch(name, dateProcessed));
  
  return {
    matched: results.filter(r => r.matchedReferee !== null),
    unmatched: results.filter(r => r.matchedReferee === null)
  };
};

// Store a manual match
export const storeManualMatch = (
  scheduleName: string,
  referee: Referee,
  dateProcessed: string
) => {
  addMapping({
    scheduleName,
    employeeNumber: referee.employeeNumber,
    matchedAt: Date.now(),
    dateProcessed,
    isManual: true
  });
};

// Store an auto match
export const storeAutoMatch = (
  scheduleName: string,
  referee: Referee,
  dateProcessed: string
) => {
  addMapping({
    scheduleName,
    employeeNumber: referee.employeeNumber,
    matchedAt: Date.now(),
    dateProcessed,
    isManual: false
  });
};

// Get referee by employee number
export const getRefereeByEmployeeNumber = (empNum: string): Referee | undefined => {
  return getRefereeDatabase().find(r => r.employeeNumber === empNum);
};

// Get referee display name (with employee number)
export const getRefereeDisplayName = (referee: Referee): string => {
  return `${referee.fullName} (${referee.employeeNumber})`;
};
