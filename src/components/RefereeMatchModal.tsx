import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check, AlertTriangle, User, ChevronDown, ChevronUp } from 'lucide-react';
import {
  type MatchResult,
  type Referee,
  getRefereeDatabase,
  normalizeForComparison,
  storeManualMatch,
  storeAutoMatch,
  getRefereeDisplayName,
} from '../utils/refereeMatcher';

interface RefereeMatchModalProps {
  isOpen: boolean;
  matchResults: MatchResult[];
  dateProcessed: string;
  onConfirm: (confirmedMatches: Map<string, Referee>) => void;
  onCancel: () => void;
}

export const RefereeMatchModal: React.FC<RefereeMatchModalProps> = ({
  isOpen,
  matchResults,
  dateProcessed,
  onConfirm,
  onCancel,
}) => {
  const CONFIDENCE_THRESHOLD = 60; // Same as in refereeMatcher

  // Always get the best available selection (matchedReferee is always set now)
  const getDefaultSelection = (result: MatchResult): Referee | null => {
    return result.matchedReferee || result.suggestions[0]?.referee || null;
  };

  // Track user selections for each schedule name
  const [selections, setSelections] = useState<Map<string, Referee | null>>(new Map());

  // Sync selections with matchResults whenever matchResults changes
  useEffect(() => {
    if (matchResults.length > 0) {
      const newSelections = new Map<string, Referee | null>();
      matchResults.forEach(result => {
        // Always pre-select the best match (matchedReferee is always set)
        newSelections.set(result.scheduleName, getDefaultSelection(result));
      });
      setSelections(newSelections);
    }
  }, [matchResults]);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  // Get latest database on open
  const refereeDatabase = useMemo(() => getRefereeDatabase(), [isOpen]);

  // Filter referees based on search
  const filteredReferees = useMemo(() => {
    if (!searchQuery.trim()) return refereeDatabase;
    const query = normalizeForComparison(searchQuery);
    return refereeDatabase.filter(r => 
      normalizeForComparison(r.fullName).includes(query) ||
      r.employeeNumber.toLowerCase().includes(query)
    );
  }, [searchQuery, refereeDatabase]);

  // Categorize results by confidence level and match status
  // Unmatched: No matchedReferee at all (database might be empty or referee was deleted)
  const unmatchedResults = matchResults.filter(r => !r.matchedReferee);
  // Low confidence matches need review but still have a default selection
  const lowConfidenceResults = matchResults.filter(r => 
    r.matchedReferee && !r.isFromStorage && r.confidence < CONFIDENCE_THRESHOLD
  );
  // High confidence auto-matches
  const autoMatchedResults = matchResults.filter(r => 
    r.matchedReferee && !r.isFromStorage && r.confidence >= CONFIDENCE_THRESHOLD
  );
  // Previously stored matches
  const storedMatchResults = matchResults.filter(r => r.matchedReferee && r.isFromStorage);

  const handleSelect = (scheduleName: string, referee: Referee | null) => {
    setSelections(prev => new Map(prev).set(scheduleName, referee));
    setExpandedItem(null);
    setSearchQuery('');
  };

  const handleConfirm = () => {
    const confirmedMatches = new Map<string, Referee>();
    
    selections.forEach((referee, scheduleName) => {
      const originalResult = matchResults.find(r => r.scheduleName === scheduleName);
      const fallbackRef = referee || (originalResult ? getDefaultSelection(originalResult) : null);

      if (!fallbackRef) return;

      confirmedMatches.set(scheduleName, fallbackRef);
      
      if (originalResult) {
        if (originalResult.matchedReferee?.employeeNumber === fallbackRef.employeeNumber) {
          // Auto-match confirmed
          if (!originalResult.isFromStorage) {
            storeAutoMatch(scheduleName, fallbackRef, dateProcessed);
          }
        } else {
          // Manual match
          storeManualMatch(scheduleName, fallbackRef, dateProcessed);
        }
      }
    });
    
    onConfirm(confirmedMatches);
  };

  // All items now have a default selection (matchedReferee is always set to best fuzzy match)
  // Count items that still need review (low confidence)
  const needsReviewCount = lowConfidenceResults.length;
  
  // Count how many selections are missing (null or not in map)
  const missingSelectionsCount = matchResults.filter(r => {
    const selected = selections.get(r.scheduleName);
    return !selected;
  }).length;
  
  // All matches are valid if:
  // 1. We have matchResults
  // 2. Every selection has a referee assigned
  // 3. Selections map has all the matchResults
  const allMatched = matchResults.length > 0 && 
    selections.size === matchResults.length && 
    Array.from(selections.values()).every(v => v !== null);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-primary-50 to-white">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Match Referees</h2>
              <p className="text-sm text-slate-500 mt-1">
                Confirm or manually select referee matches from the database
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Summary Bar */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-slate-600">Confident Matches: {autoMatchedResults.length + storedMatchResults.length}</span>
            </span>
            {needsReviewCount > 0 && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-slate-600">Low Confidence: {needsReviewCount}</span>
              </span>
            )}
            {unmatchedResults.length > 0 && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-slate-600">Needs Manual Selection: {unmatchedResults.length}</span>
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Unmatched - requires manual selection */}
            {unmatchedResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Requires Manual Selection ({unmatchedResults.length})
                </h3>
                <p className="text-xs text-red-500 -mt-2">
                  These referees could not be matched. Please select from the database.
                </p>
                {unmatchedResults.map(result => (
                  <MatchItem
                    key={result.scheduleName}
                    result={result}
                    selected={selections.get(result.scheduleName) || null}
                    isExpanded={expandedItem === result.scheduleName}
                    onExpand={() => setExpandedItem(expandedItem === result.scheduleName ? null : result.scheduleName)}
                    onSelect={(ref) => handleSelect(result.scheduleName, ref)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filteredReferees={filteredReferees}
                    isLowConfidence={true}
                  />
                ))}
              </div>
            )}

            {/* Low confidence matches (needs review but has default selection) */}
            {lowConfidenceResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Low Confidence - Please Review ({lowConfidenceResults.length})
                </h3>
                <p className="text-xs text-amber-500 -mt-2">
                  These have been auto-matched to the best guess. Click to change if incorrect.
                </p>
                {lowConfidenceResults.map(result => (
                  <MatchItem
                    key={result.scheduleName}
                    result={result}
                    selected={selections.get(result.scheduleName) || null}
                    isExpanded={expandedItem === result.scheduleName}
                    onExpand={() => setExpandedItem(expandedItem === result.scheduleName ? null : result.scheduleName)}
                    onSelect={(ref) => handleSelect(result.scheduleName, ref)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filteredReferees={filteredReferees}
                    isLowConfidence={true}
                  />
                ))}
              </div>
            )}

            {/* Auto-matched (can be changed) */}
            {autoMatchedResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-green-600 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Auto-Matched ({autoMatchedResults.length})
                </h3>
                {autoMatchedResults.map(result => (
                  <MatchItem
                    key={result.scheduleName}
                    result={result}
                    selected={selections.get(result.scheduleName) || null}
                    isExpanded={expandedItem === result.scheduleName}
                    onExpand={() => setExpandedItem(expandedItem === result.scheduleName ? null : result.scheduleName)}
                    onSelect={(ref) => handleSelect(result.scheduleName, ref)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filteredReferees={filteredReferees}
                    isLowConfidence={false}
                  />
                ))}
              </div>
            )}

            {/* Previously stored matches */}
            {storedMatchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Previously Matched ({storedMatchResults.length})
                </h3>
                {storedMatchResults.map(result => (
                  <MatchItem
                    key={result.scheduleName}
                    result={result}
                    selected={selections.get(result.scheduleName) || null}
                    isExpanded={expandedItem === result.scheduleName}
                    onExpand={() => setExpandedItem(expandedItem === result.scheduleName ? null : result.scheduleName)}
                    onSelect={(ref) => handleSelect(result.scheduleName, ref)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filteredReferees={filteredReferees}
                    isLowConfidence={false}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
            <div className="text-sm text-slate-500">
              {missingSelectionsCount > 0 ? (
                <span className="text-red-600 font-medium">
                  {missingSelectionsCount} referee{missingSelectionsCount > 1 ? 's' : ''} could not be matched - expand to select manually
                </span>
              ) : needsReviewCount > 0 ? (
                <span className="text-amber-600 font-medium">
                  {needsReviewCount} low-confidence match{needsReviewCount > 1 ? 'es' : ''} - please review before confirming
                </span>
              ) : (
                <span className="text-green-600 font-medium">
                  All referees matched with high confidence ✓
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!allMatched}
                className={`px-6 py-2.5 rounded-xl font-semibold shadow-lg transition-all flex items-center gap-2 ${
                  allMatched
                    ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-600/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Check className="w-4 h-4" />
                Confirm Matches
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Individual match item component
interface MatchItemProps {
  result: MatchResult;
  selected: Referee | null;
  isExpanded: boolean;
  onExpand: () => void;
  onSelect: (referee: Referee | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredReferees: Referee[];
  isLowConfidence: boolean;
}

const MatchItem: React.FC<MatchItemProps> = ({
  result,
  selected,
  isExpanded,
  onExpand,
  onSelect,
  searchQuery,
  onSearchChange,
  filteredReferees,
  isLowConfidence,
}) => {
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isLowConfidence
        ? 'border-amber-300 bg-amber-50' 
        : 'border-slate-200 bg-white'
    }`}>
      {/* Collapsed View */}
      <div
        onClick={onExpand}
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 truncate">
              {result.scheduleName}
            </p>
            {selected ? (
              <p className={`text-sm truncate ${isLowConfidence ? 'text-amber-600' : 'text-green-600'}`}>
                → {getRefereeDisplayName(selected)}
                {result.isFromStorage && <span className="text-blue-500 ml-2">(saved)</span>}
                {isLowConfidence && <span className="text-amber-500 ml-2">(review)</span>}
              </p>
            ) : (
              <p className="text-sm text-red-600">
                Error: No referee in database
              </p>
            )}
          </div>
          
          {result.matchedReferee && (
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                result.confidence >= 80 
                  ? 'bg-green-100 text-green-700' 
                  : result.confidence >= 60 
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-orange-100 text-orange-700'
              }`}>
                {Math.round(result.confidence)}% match
              </span>
            </div>
          )}
        </div>
        
        <div className="ml-4">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 bg-slate-50"
          >
            <div className="p-4 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search referees..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              {/* Suggestions */}
              {result.suggestions.length > 0 && !searchQuery && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase">Suggested Matches</p>
                  <div className="flex flex-wrap gap-2">
                    {result.suggestions.map(({ referee, confidence }) => (
                      <button
                        key={referee.employeeNumber}
                        onClick={() => onSelect(referee)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                          selected?.employeeNumber === referee.employeeNumber
                            ? 'bg-primary-100 border-primary-300 text-primary-700'
                            : 'bg-white border-slate-200 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        {referee.fullName} 
                        <span className="text-slate-400 ml-1">({referee.employeeNumber})</span>
                        <span className={`ml-2 text-xs ${
                          confidence >= 70 ? 'text-green-600' : 'text-amber-600'
                        }`}>
                          {Math.round(confidence)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Full list */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase">
                  {searchQuery ? 'Search Results' : 'All Referees'}
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 rounded-lg bg-white">
                  {filteredReferees.length === 0 ? (
                    <p className="p-4 text-center text-slate-400 text-sm">No referees found</p>
                  ) : (
                    filteredReferees.map(referee => (
                      <button
                        key={referee.employeeNumber}
                        onClick={() => onSelect(referee)}
                        className={`w-full px-4 py-2 text-left text-sm transition-all flex justify-between items-center ${
                          selected?.employeeNumber === referee.employeeNumber
                            ? 'bg-primary-100 text-primary-700'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <span>{referee.fullName}</span>
                        <span className="text-slate-400">{referee.employeeNumber}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

