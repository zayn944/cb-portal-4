
import { RawRow, DisputeRecord, OpayoRow, PenairRow } from '../types';

// Access the global XLSX variable loaded via script tag
declare const XLSX: any;

export const parseFile = async (file: File): Promise<RawRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // Ensure XLSX is available
        if (typeof XLSX === 'undefined') {
          reject(new Error("XLSX library not loaded"));
          return;
        }
        
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // CRITICAL FIX: raw: false ensures we get the formatted string (e.g. "12/05/2023")
        // instead of the excel serial number (e.g. 45321).
        const jsonData = XLSX.utils.sheet_to_json(sheet, { 
          raw: false,
          defval: "" 
        });
        
        resolve(jsonData as RawRow[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

// Helper to find a key in an object case-insensitively and loosely
const findKey = (row: RawRow, possibleKeys: string[]): string | undefined => {
  const keys = Object.keys(row);
  const normalizedKeys = keys.map(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  for (const target of possibleKeys) {
    const normalizedTarget = target.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // 1. Strict Exact Match (ignore case)
    const exactIndex = keys.findIndex(k => k.trim().toLowerCase() === target.trim().toLowerCase());
    if (exactIndex !== -1) return keys[exactIndex];

    // 2. Normalized Match
    const index = normalizedKeys.indexOf(normalizedTarget);
    if (index !== -1) return keys[index];
  }
  
  // 3. Partial match fallback (use sparingly)
  for (const target of possibleKeys) {
    const normalizedTarget = target.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const index = normalizedKeys.findIndex(k => k.includes(normalizedTarget));
     if (index !== -1) return keys[index];
  }
  
  return undefined;
};

// Fallback formatter: If raw:false fails or CSV sends a serial number, 
// this mathematically converts Excel Serial Date to JS Date.
const formatExcelDate = (val: any): string => {
    if (!val || val === 'N/A') return 'N/A';
    const str = String(val).trim();
    
    // Check if it looks like an Excel serial number (e.g. 44927 for 2023)
    // Valid range roughly 1980 (29221) to 2050 (54789)
    if (/^\d{5}(\.\d+)?$/.test(str)) {
       const num = parseFloat(str);
       if (num > 29000 && num < 60000) {
           // Excel base date correction (25569 is offset between 1970 and 1900)
           const date = new Date(Math.round((num - 25569) * 86400 * 1000));
           // Return as MM/DD/YYYY or locale specific
           return date.toLocaleDateString();
       }
    }
    return str;
};

export const normalizeData = (rows: RawRow[]): DisputeRecord[] => {
  if (rows.length === 0) return [];

  // Determine mapping based on the first row
  const sample = rows[0];
  
  // Updated mapping for specific requested headers
  const map = {
    cycle: findKey(sample, ['cycle', 'cycle no', 'bill cycle']),
    merchant: findKey(sample, ['merchant', 'merchant name', 'merchant descriptor']),
    dueDate: findKey(sample, ['due date', 'reply by', 'response date', 'date due']),
    caseReference: findKey(sample, ['case reference', 'case ref', 'caseid', 'reference', 'case no', 'case number']),
    reasonCode: findKey(sample, ['reason code', 'reason', 'code', 'dispute reason']),
    reasonCategory: findKey(sample, ['reason category', 'category', 'reason desc', 'description']),
    transactionDate: findKey(sample, ['transaction date', 'trans date', 'txn date', 'date']),
    transactionAmount: findKey(sample, ['transaction amount', 'trans amount', 'txn amount', 'amount']),
    // New Fields
    datePost: findKey(sample, ['date post', 'post date', 'posting date', 'process date']),
    disputeAmount: findKey(sample, ['dispute amount', 'disputed amount', 'claim amount', 'chargeback amount', 'cb amount']),
    
    cardLast4: findKey(sample, ['card last 4', 'last 4', 'account number', 'card number', 'last four', 'card no'])
  };

  return rows.map(row => ({
    cycle: map.cycle ? String(row[map.cycle]) : 'N/A',
    merchant: map.merchant ? String(row[map.merchant]) : 'N/A',
    dueDate: map.dueDate ? formatExcelDate(row[map.dueDate]) : 'N/A',
    caseReference: map.caseReference ? String(row[map.caseReference]) : 'N/A',
    reasonCode: map.reasonCode ? String(row[map.reasonCode]) : 'N/A',
    reasonCategory: map.reasonCategory ? String(row[map.reasonCategory]) : 'N/A',
    transactionDate: map.transactionDate ? formatExcelDate(row[map.transactionDate]) : 'N/A',
    transactionAmount: map.transactionAmount ? row[map.transactionAmount] : 0,
    // Map new fields
    datePost: map.datePost ? formatExcelDate(row[map.datePost]) : 'N/A',
    disputeAmount: map.disputeAmount ? row[map.disputeAmount] : 0,
    
    cardLast4: map.cardLast4 ? String(row[map.cardLast4]).slice(-4) : 'N/A',
    opayoMatch: 'N/A', // Default, updated later
    originalRow: row
  }));
};

export const parseOpayoData = (rows: RawRow[]): OpayoRow[] => {
  if (rows.length === 0) return [];

  const sample = rows[0];
  
  // Strict check for "Amount(Inc. Surcharge)" and "last 4 digits"
  // Explicitly check for "Reference" as requested
  const map = {
    amount: findKey(sample, ['Amount(Inc. Surcharge)', 'Amount (Inc. Surcharge)', 'Amount']),
    last4: findKey(sample, ['last 4 digits', 'last 4', 'card last 4']),
    reference: findKey(sample, ['Reference', 'Ref', 'Transaction ID', 'Txn Ref']), // Prioritize exact 'Reference'
    bookingAddress: findKey(sample, ['Booking Address', 'Billing Address']),
    transAddress: findKey(sample, ['Transaction Address', 'Delivery Address'])
  };

  if (!map.amount || !map.last4) {
    console.warn("Could not find required Opayo columns: Amount(Inc. Surcharge) or last 4 digits");
    return [];
  }

  return rows.map(row => {
    // clean amount
    const amtStr = String(row[map.amount!]).replace(/[^0-9.-]+/g, "");
    const amt = parseFloat(amtStr);
    
    // clean last 4
    const last4 = String(row[map.last4!]).replace(/[^0-9]/g, "").slice(-4);
    
    // clean reference - ensure it's a string, not a scientific number or Excel object
    const rawRef = map.reference ? row[map.reference] : '';
    const reference = rawRef !== undefined && rawRef !== null ? String(rawRef).trim() : '';

    return {
      amount: isNaN(amt) ? 0 : amt,
      last4: last4,
      reference: reference,
      bookingAddress: map.bookingAddress ? String(row[map.bookingAddress] || '') : '',
      transAddress: map.transAddress ? String(row[map.transAddress] || '') : ''
    };
  }).filter(r => r.amount !== 0 && r.last4.length === 4);
};

export const parsePenairData = (rows: RawRow[]): PenairRow[] => {
  if (rows.length === 0) return [];

  const sample = rows[0];

  // Penair specific columns - Prioritizing exact headers from prompt
  const map = {
    inetRef: findKey(sample, ['Inet Ref', 'InetRef', 'Inet Reference', 'inet', 'reference', 'ref no', 'ref']),
    folderNumber: findKey(sample, ['Folder Number', 'Folder No', 'Folder', 'folder', 'file no']),
    travelDate: findKey(sample, ['Travel Date', 'TravelDate', 'Trav Date', 'date of travel']),
    origin: findKey(sample, ['Origin', 'Org', 'From', 'Departure', 'Dep', 'Sector']),
    destination: findKey(sample, ['Destination', 'Dest', 'To', 'Arrival', 'Arr']),
    airlineCode: findKey(sample, ['Airline Code', 'Airline', 'Carrier', 'Air']),
    invoiceDate: findKey(sample, ['Invoice date', 'Invoice Date', 'Inv Date', 'InvDate', 'Bill Date', 'Doc Date']),
    returnDate: findKey(sample, ['Return Date', 'Ret Date', 'Return']),
    emailId: findKey(sample, ['Email ID', 'Email', 'Email Address', 'Mail', 'E-mail'])
  };

  if (!map.inetRef) {
    console.warn("Could not find required Penair column: Inet Ref");
    return [];
  }

  return rows.map(row => {
    // Clean inetRef immediately
    const rawRef = row[map.inetRef!];
    const inetRef = rawRef !== undefined && rawRef !== null ? String(rawRef).trim() : '';

    return {
      inetRef: inetRef,
      folderNumber: map.folderNumber ? String(row[map.folderNumber] || '') : '',
      travelDate: map.travelDate ? formatExcelDate(row[map.travelDate]) : '',
      origin: map.origin ? String(row[map.origin] || '') : '',
      destination: map.destination ? String(row[map.destination] || '') : '',
      airlineCode: map.airlineCode ? String(row[map.airlineCode] || '') : '',
      invoiceDate: map.invoiceDate ? formatExcelDate(row[map.invoiceDate]) : '',
      returnDate: map.returnDate ? formatExcelDate(row[map.returnDate]) : '',
      emailId: map.emailId ? String(row[map.emailId] || '') : ''
    };
  });
};