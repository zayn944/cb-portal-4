
import { DisputeRecord, OpayoRow, PenairRow } from '../types';

// Helper to normalize IDs (e.g. handles "123", "123.0", 123, " 123 ")
const cleanId = (val: any): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Remove .0 or .00 at the end (common Excel artifact) e.g. "12345.0" -> "12345"
  str = str.replace(/\.0+$/, ''); 
  // Lowercase for consistency
  return str.toLowerCase();
};

export const findAnomalies = (baseData: DisputeRecord[], newData: DisputeRecord[]): DisputeRecord[] => {
  // Create a Set of existing Case References for O(1) lookup complexity
  const existingRefs = new Set(baseData.map(r => r.caseReference.trim()));
  
  const anomalies: DisputeRecord[] = [];

  for (const record of newData) {
    const ref = record.caseReference.trim();
    
    // Skip if invalid reference or empty
    if (!ref || ref === 'N/A') continue;

    if (!existingRefs.has(ref)) {
      anomalies.push(record);
    }
  }

  return anomalies;
};

export const crossReferenceOpayo = (anomalies: DisputeRecord[], opayoData: OpayoRow[]): DisputeRecord[] => {
  // We want to find if the anomaly exists in Opayo
  // Match criteria: Amount AND Last 4
  
  return anomalies.map(record => {
    // Prepare record values
    const recAmt = Number(String(record.transactionAmount).replace(/[^0-9.-]+/g, ""));
    const recLast4 = String(record.cardLast4).trim();
    
    // Skip matching if data is missing
    if (isNaN(recAmt) || recLast4.length < 4 || recLast4 === 'N/A') {
      return { ...record, opayoMatch: 'N/A' };
    }

    // Check Opayo list
    // We use a loose match on amount (allowing for slight float differences if needed)
    const matchRecord = opayoData.find(op => {
      const amtDiff = Math.abs(op.amount - recAmt);
      const last4Match = op.last4 === recLast4;
      return last4Match && amtDiff < 0.05; 
    });

    if (matchRecord) {
      // Ensure we capture the reference cleanly
      const opayoRef = cleanId(matchRecord.reference);
      
      return {
        ...record,
        opayoMatch: 'MATCH',
        opayoReference: matchRecord.reference, // Store original format for display
        bookingAddress: matchRecord.bookingAddress,
        transAddress: matchRecord.transAddress
      };
    }

    return {
      ...record,
      opayoMatch: 'NO_MATCH'
    };
  });
};

export const crossReferencePenair = (anomalies: DisputeRecord[], penairData: PenairRow[]): DisputeRecord[] => {
  // Link Opayo Reference to Penair Inet Ref
  return anomalies.map(record => {
    // We can only check Penair if we found an Opayo match that gave us a reference
    // AND that reference is not empty
    if (record.opayoMatch !== 'MATCH' || !record.opayoReference) {
      return { ...record, penairMatch: 'N/A' };
    }

    // Normalized comparison: Opayo Reference vs Penair Inet Ref
    const opRef = cleanId(record.opayoReference);
    
    // Look for matching Inet Ref
    // We use the cleaned ID to ensure "123" matches "123.0"
    const matchRecord = penairData.find(p => cleanId(p.inetRef) === opRef);

    if (matchRecord) {
      return {
        ...record,
        penairMatch: 'MATCH',
        folderNumber: matchRecord.folderNumber,
        travelDate: matchRecord.travelDate,
        origin: matchRecord.origin,
        destination: matchRecord.destination,
        airlineCode: matchRecord.airlineCode,
        invoiceDate: matchRecord.invoiceDate,
        returnDate: matchRecord.returnDate,
        emailId: matchRecord.emailId
      };
    }

    return {
      ...record,
      penairMatch: 'NO_MATCH'
    };
  });
};
