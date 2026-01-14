import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { HistoryItem } from '../App';
import type { 
  PayrollBatchRecord, 
  StoredSettings
} from '../utils/payrollSettings';

// Collection References
const USERS_COLLECTION = 'users';

// === APP HISTORY (Session State) ===

export const saveHistoryToFirestore = async (userId: string, history: HistoryItem[]) => {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(userDocRef, { history, lastUpdated: Date.now() }, { merge: true });
  } catch (error) {
    console.error("Error saving history to Firestore:", error);
  }
};

export const loadHistoryFromFirestore = async (userId: string): Promise<HistoryItem[]> => {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.history || [];
    }
    return [];
  } catch (error) {
    console.error("Error loading history from Firestore:", error);
    return [];
  }
};

// === PAYROLL HISTORY (Permanent Records) ===

export const savePayrollHistoryToFirestore = async (userId: string, payrollHistory: PayrollBatchRecord[]) => {
    try {
        const docRef = doc(db, USERS_COLLECTION, userId, 'data', 'payroll_history');
        await setDoc(docRef, { batches: payrollHistory, lastUpdated: Date.now() });
    } catch (error) {
        console.error("Error saving payroll history:", error);
    }
};

export const loadPayrollHistoryFromFirestore = async (userId: string): Promise<PayrollBatchRecord[]> => {
    try {
        const docRef = doc(db, USERS_COLLECTION, userId, 'data', 'payroll_history');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().batches || [];
        }
        return [];
    } catch (error) {
        console.error("Error loading payroll history:", error);
        return [];
    }
};

// === SETTINGS ===

export const loadSettingsFromFirestore = async (userId: string): Promise<StoredSettings | null> => {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId, 'config', 'settings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data() as StoredSettings;
    }
    return null;
  } catch (e) {
      console.error("Error loading settings", e);
      return null;
  }
}

export const saveSettingsToFirestore = async (userId: string, settings: StoredSettings) => {
    try {
        const docRef = doc(db, USERS_COLLECTION, userId, 'config', 'settings');
        await setDoc(docRef, settings);
    } catch (e) {
        console.error("Error saving settings", e);
    }
}
