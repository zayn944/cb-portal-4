
import { SavedReport, DisputeRecord, CloudConfig } from '../types';

const STORAGE_KEY = 'dispute_delta_history_v1';
const BACKUP_KEY = 'dispute_delta_history_backup_v1';
const CLOUD_CONFIG_KEY = 'dispute_delta_cloud_config';

// Helper to generate ID if crypto is not available
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// --- CLOUD CONFIGURATION ---

export const getCloudConfig = (): CloudConfig | null => {
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const saveCloudConfig = (config: CloudConfig) => {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
  // Trigger a storage event manually so the app updates immediately
  window.dispatchEvent(new Event('storage'));
};

export const clearCloudConfig = () => {
  localStorage.removeItem(CLOUD_CONFIG_KEY);
  window.dispatchEvent(new Event('storage'));
};

// --- CORE DATA OPERATIONS ---

// Helper to perform Supabase fetch operations
const supabaseFetch = async (endpoint: string, method: string, body?: any) => {
  const config = getCloudConfig();
  if (!config || !config.enabled) throw new Error("Cloud disabled");

  // Ensure URL doesn't have trailing slash
  const cleanUrl = config.url.replace(/\/$/, "");
  const url = `${cleanUrl}/rest/v1/${config.tableName}${endpoint}`;

  const headers = {
    'apikey': config.key,
    'Authorization': `Bearer ${config.key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal' // Default preference
  };

  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Supabase Error: ${res.status} ${res.statusText}`);
  }
  return res.json ? res.json() : null;
};

export const saveReport = async (
  name: string,
  baseFileName: string,
  newFileName: string,
  anomalies: DisputeRecord[],
  aiAnalysis: string | null
): Promise<SavedReport | null> => {
  
  // Calculate basic stats
  const totalValue = anomalies.reduce((acc, curr) => {
    const val = Number(String(curr.transactionAmount).replace(/[^0-9.-]+/g, ""));
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // SANITIZATION
  const cleanAnomalies = anomalies.map(record => ({
    cycle: String(record.cycle || ''),
    merchant: String(record.merchant || ''),
    dueDate: String(record.dueDate || ''),
    caseReference: String(record.caseReference || ''),
    reasonCode: String(record.reasonCode || ''),
    reasonCategory: String(record.reasonCategory || ''),
    transactionDate: String(record.transactionDate || ''),
    transactionAmount: record.transactionAmount,
    datePost: String(record.datePost || ''),
    disputeAmount: record.disputeAmount,
    cardLast4: String(record.cardLast4 || ''),
    opayoMatch: record.opayoMatch || 'N/A',
    opayoReference: String(record.opayoReference || ''),
    bookingAddress: String(record.bookingAddress || ''),
    transAddress: String(record.transAddress || ''),
    penairMatch: record.penairMatch || 'N/A',
    folderNumber: String(record.folderNumber || ''),
    travelDate: String(record.travelDate || ''),
    origin: String(record.origin || ''),
    destination: String(record.destination || ''),
    airlineCode: String(record.airlineCode || ''),
    invoiceDate: String(record.invoiceDate || ''),
    returnDate: String(record.returnDate || ''),
    emailId: String(record.emailId || '')
  }));

  const newReport: SavedReport = {
    id: generateId(),
    timestamp: Date.now(),
    name: name || `Analysis ${new Date().toLocaleDateString()}`,
    baseFileName,
    newFileName,
    anomalies: cleanAnomalies,
    aiAnalysis: null, 
    summaryStats: {
      count: cleanAnomalies.length,
      totalValue
    }
  };

  const config = getCloudConfig();

  // CLOUD SAVE
  if (config && config.enabled) {
    try {
      // Supabase Insert (Upsert)
      // We map our SavedReport to the table structure. 
      // Expected Table: id (text), doc (jsonb), created_at (int8)
      await supabaseFetch('', 'POST', {
        id: newReport.id,
        doc: newReport,
        created_at: newReport.timestamp
      });
      return newReport;
    } catch (e) {
      console.error("Cloud save failed, falling back to local", e);
      // Fallback to local storage if cloud fails
    }
  }

  // LOCAL SAVE (Classic)
  let existing = getSavedLocalReports();
  let currentList = [newReport, ...existing];
  
  // Pruning logic
  const MAX_ITEMS = 50;
  if (currentList.length > MAX_ITEMS) {
    currentList = currentList.slice(0, MAX_ITEMS);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentList));
    return newReport;
  } catch (e) {
    console.warn("Local storage full", e);
    return null;
  }
};

// Internal local getter
const getSavedLocalReports = (): SavedReport[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
};

export const getSavedReports = async (): Promise<SavedReport[]> => {
  const config = getCloudConfig();
  
  // CLOUD FETCH
  if (config && config.enabled) {
    try {
      // Supabase Select: order by created_at descending
      const res = await fetch(`${config.url}/rest/v1/${config.tableName}?select=doc&order=created_at.desc`, {
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`
        }
      });
      
      if (res.ok) {
        const rows = await res.json();
        // Unwrap the 'doc' column
        return rows.map((r: any) => r.doc);
      }
    } catch (e) {
      console.error("Cloud fetch failed", e);
    }
  }

  // LOCAL FETCH
  return getSavedLocalReports();
};

export const deleteReport = async (id: string): Promise<SavedReport[]> => {
  const config = getCloudConfig();

  if (config && config.enabled) {
    try {
      // Supabase Delete: ID match
      await fetch(`${config.url}/rest/v1/${config.tableName}?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
           'apikey': config.key,
           'Authorization': `Bearer ${config.key}`
        }
      });
      // Return fresh list
      return getSavedReports();
    } catch (e) {
      console.error("Cloud delete failed", e);
    }
  }

  const reports = getSavedLocalReports();
  const updated = reports.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const renameReport = async (id: string, newName: string): Promise<SavedReport[]> => {
  // Complex operation for Cloud (requires fetch, update doc, push back). 
  // For simplicity, we just do Local for now or implement full fetch-modify-save logic.
  // Note: This is a simplified implementation for the demo.
  
  const reports = await getSavedReports(); // This gets Cloud if enabled
  const report = reports.find(r => r.id === id);
  if (report) {
    report.name = newName;
    // We re-save (Upsert)
    // For Cloud, we need to overwrite. 
    // Since saveReport generates a NEW ID usually, we need a specific 'updateReport' function.
    // But we can just use the internal logic:
    
    const config = getCloudConfig();
    if (config && config.enabled) {
       await supabaseFetch(`?id=eq.${id}`, 'PATCH', {
          doc: report
       });
       return getSavedReports();
    } else {
       // Local
       const localReports = getSavedLocalReports();
       const updated = localReports.map(r => r.id === id ? { ...r, name: newName } : r);
       localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
       return updated;
    }
  }
  return reports;
};

export const clearAllReports = async (): Promise<SavedReport[]> => {
  const config = getCloudConfig();
  if (config && config.enabled) {
     // Safety: Maybe don't allow clearing ALL cloud data easily?
     // Or just delete all
     // await supabaseFetch('', 'DELETE'); // DANGEROUS
     return [];
  }

  // Backup Local
  try {
    const currentData = localStorage.getItem(STORAGE_KEY);
    if (currentData) {
      localStorage.setItem(BACKUP_KEY, currentData);
    }
  } catch (e) {}

  localStorage.removeItem(STORAGE_KEY);
  return [];
};

export const restoreBackup = (): SavedReport[] => {
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) {
      localStorage.setItem(STORAGE_KEY, backup);
      return JSON.parse(backup);
    }
  } catch (e) {}
  return [];
};

export const checkBackupExists = (): boolean => {
  return !!localStorage.getItem(BACKUP_KEY);
};

export const exportHistoryToJson = (): string => {
  const data = getSavedLocalReports(); // Export only local for safety
  return JSON.stringify(data, null, 2);
};

export const mergeExternalHistory = (jsonStr: string): SavedReport[] => {
  try {
    const imported: SavedReport[] = JSON.parse(jsonStr);
    if (!Array.isArray(imported)) throw new Error("Invalid format");

    const current = getSavedLocalReports();
    const currentIds = new Set(current.map(r => r.id));
    
    const merged = [...current];
    imported.forEach(report => {
      if (report.id && report.anomalies && !currentIds.has(report.id)) {
        merged.push(report);
      }
    });
    merged.sort((a, b) => b.timestamp - a.timestamp);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    throw e;
  }
};
