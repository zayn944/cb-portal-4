

export interface RawRow {
  [key: string]: any;
}

export interface DisputeRecord {
  cycle: string;
  merchant: string;
  dueDate: string;
  caseReference: string;
  reasonCode: string;
  reasonCategory: string;
  transactionDate: string;
  transactionAmount: number | string;
  
  // New Fields
  datePost?: string;
  disputeAmount?: number | string;

  cardLast4: string;
  opayoMatch: 'MATCH' | 'NO_MATCH' | 'N/A';
  
  // Opayo enriched data
  opayoReference?: string; // Link to Penair
  bookingAddress?: string;
  transAddress?: string;

  // Penair enriched data
  penairMatch?: 'MATCH' | 'NO_MATCH' | 'N/A';
  folderNumber?: string;
  travelDate?: string;
  origin?: string;
  destination?: string;
  airlineCode?: string;
  invoiceDate?: string;
  returnDate?: string;
  emailId?: string;

  originalRow?: RawRow; // Keep reference to original for AI analysis if needed
  // History Aggregation Fields
  importDate?: string;
  sourceReport?: string;
  _ts?: number; // Internal sort key for master list
}

export interface OpayoRow {
  amount: number;
  last4: string;
  reference: string;
  bookingAddress: string;
  transAddress: string;
}

export interface PenairRow {
  inetRef: string;
  folderNumber: string;
  travelDate: string;
  origin: string;
  destination: string;
  airlineCode: string;
  invoiceDate: string;
  returnDate: string;
  emailId: string;
}

export interface FileData {
  name: string;
  data: RawRow[];
}

export interface SavedReport {
  id: string;
  timestamp: number;
  name: string;
  baseFileName: string;
  newFileName: string;
  anomalies: DisputeRecord[];
  aiAnalysis: string | null;
  summaryStats: {
    count: number;
    totalValue: number;
  };
  isTruncated?: boolean;
}

export interface CloudConfig {
  url: string;
  key: string;
  tableName: string;
  enabled: boolean;
}

export enum AnalysisStatus {
  IDLE,
  ANALYZING,
  COMPLETE,
  ERROR
}
