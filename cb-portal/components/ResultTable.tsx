
import React, { useState, useMemo } from 'react';
import { DisputeRecord } from '../types';
import { AlertTriangle, Copy, Check, Download, ArrowUpDown, ArrowUp, ArrowDown, Calendar, FileText, CheckCircle, XCircle, Link as LinkIcon } from 'lucide-react';

// Access the global XLSX variable
declare const XLSX: any;

interface ResultTableProps {
  data: DisputeRecord[];
}

type SortKey = keyof DisputeRecord | 'importDate' | 'sourceReport';
type SortDirection = 'asc' | 'desc';

export const ResultTable: React.FC<ResultTableProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  // Detect if this is a history view (has importDate)
  const isHistoryView = data.length > 0 && 'importDate' in data[0];

  if (!data || data.length === 0) return null;

  // Sorting Logic
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof DisputeRecord];
      const bValue = b[sortConfig.key as keyof DisputeRecord];

      // Handle numbers
      if (sortConfig.key === 'transactionAmount' || sortConfig.key === 'disputeAmount') {
        const aNum = Number(String(aValue).replace(/[^0-9.-]+/g, ""));
        const bNum = Number(String(bValue).replace(/[^0-9.-]+/g, ""));
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Default string comparison
      const strA = String(aValue || '');
      const strB = String(bValue || '');
      
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleCopy = async () => {
    try {
      const coreHeaders = [
        'Cycle', 'Merchant', 'Due Date', 'Case Reference', 'Last 4', 
        'Reason Code', 'Reason Category', 'Transaction Date', 'Date Post', 'Transaction Amount', 'Dispute Amount', 
        'Opayo Match', 'Link Ref', 'Booking Address', 'Trans. Address',
        'Folder Number', 'Travel Date', 'Origin', 'Destination', 'Airline Code', 'Invoice date', 'Return Date', 'Email ID'
      ];
      // Prepend history headers if needed
      const headers = isHistoryView 
        ? ['Import Date', 'Source File', ...coreHeaders]
        : coreHeaders;
      
      const rows = sortedData.map(row => {
        const coreCells = [
          row.cycle,
          row.merchant,
          row.dueDate,
          row.caseReference,
          row.cardLast4,
          row.reasonCode, 
          row.reasonCategory,
          row.transactionDate,
          row.datePost || '',
          row.transactionAmount,
          row.disputeAmount || '',
          row.opayoMatch,
          row.opayoReference || '', // Link Ref
          row.bookingAddress || '',
          row.transAddress || '',
          row.folderNumber || '',
          row.travelDate || '',
          row.origin || '',
          row.destination || '',
          row.airlineCode || '',
          row.invoiceDate || '',
          row.returnDate || '',
          row.emailId || ''
        ];
        return isHistoryView 
          ? [row.importDate, row.sourceReport, ...coreCells].join('\t') 
          : coreCells.join('\t');
      }).join('\n');

      await navigator.clipboard.writeText(`${headers.join('\t')}\n${rows}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadExcel = () => {
    if (typeof XLSX === 'undefined') {
      alert('Excel library not loaded.');
      return;
    }
    
    const wsData = sortedData.map(row => {
      const base = {
        'Cycle': row.cycle,
        'Merchant': row.merchant,
        'Due Date': row.dueDate,
        'Case Reference': row.caseReference,
        'Card Last 4': row.cardLast4,
        'Reason Code': row.reasonCode,
        'Reason Category': row.reasonCategory,
        'Transaction Date': row.transactionDate,
        'Date Post': row.datePost || '',
        'Transaction Amount': row.transactionAmount,
        'Dispute Amount': row.disputeAmount || '',
        'Opayo Status': row.opayoMatch,
        'Link Ref': row.opayoReference || '',
        'Booking Address': row.bookingAddress || '',
        'Trans. Address': row.transAddress || '',
        'Folder Number': row.folderNumber || '',
        'Travel Date': row.travelDate || '',
        'Origin': row.origin || '',
        'Destination': row.destination || '',
        'Airline Code': row.airlineCode || '',
        'Invoice date': row.invoiceDate || '',
        'Return Date': row.returnDate || '',
        'Email ID': row.emailId || ''
      };
      
      if (isHistoryView) {
        return {
          'Import Date': row.importDate,
          'Source File': row.sourceReport,
          ...base
        };
      }
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anomalies");
    
    const dateStr = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `Dispute_Anomalies_${dateStr}.xlsx`);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown size={12} className="text-gray-300 opacity-0 group-hover/th:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={12} className="text-indigo-600" /> 
      : <ArrowDown size={12} className="text-indigo-600" />;
  };

  const renderHeader = (label: string, key: SortKey, align: 'left' | 'right' = 'left') => (
    <th 
      scope="col" 
      className={`px-6 py-4 text-${align} text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hover:text-indigo-600 transition-colors group/th select-none whitespace-nowrap bg-gray-50/95 backdrop-blur-sm border-b border-gray-200`}
      onClick={() => handleSort(key)}
    >
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {label}
        <SortIcon column={key} />
      </div>
    </th>
  );

  return (
    <div className={`bg-white ${!isHistoryView ? 'rounded-2xl shadow-xl shadow-slate-200/50 border border-white' : ''} overflow-hidden animate-fade-in-up flex flex-col`}>
      {!isHistoryView && (
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="bg-red-50 p-2.5 rounded-xl text-red-500 shrink-0 border border-red-100">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Unique Anomalies Detected</h2>
              <p className="text-sm text-gray-500">
                Found {sortedData.length} records in updated sheet not present in master.
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm"
            >
              <Download size={16} />
              Export
            </button>
            
            <button
              onClick={handleCopy}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all shadow-sm
                ${copied 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-indigo-600 border-transparent text-white hover:bg-indigo-700 hover:shadow-indigo-100'
                }
              `}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy Data'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto max-h-[70vh] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <table className="min-w-full divide-y divide-gray-100 relative">
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr>
              {isHistoryView && renderHeader('Import Date', 'importDate')}
              {isHistoryView && renderHeader('Source File', 'sourceReport')}
              {renderHeader('Cycle', 'cycle')}
              {renderHeader('Merchant', 'merchant')}
              {renderHeader('Due Date', 'dueDate')}
              {renderHeader('Case Ref', 'caseReference')}
              {renderHeader('Last 4', 'cardLast4')}
              {renderHeader('Reason Code', 'reasonCode')}
              {renderHeader('Reason Category', 'reasonCategory')}
              {renderHeader('Trans. Date', 'transactionDate')}
              {renderHeader('Date Post', 'datePost')}
              {renderHeader('Trans. Amt', 'transactionAmount', 'right')}
              {renderHeader('Dispute Amt', 'disputeAmount', 'right')}
              {renderHeader('Opayo Check', 'opayoMatch', 'right')}
              {renderHeader('Link Ref', 'opayoReference')}
              {renderHeader('Booking Address', 'bookingAddress')}
              {renderHeader('Trans. Address', 'transAddress')}
              {/* Penair Headers */}
              {renderHeader('Folder Number', 'folderNumber')}
              {renderHeader('Travel Date', 'travelDate')}
              {renderHeader('Origin', 'origin')}
              {renderHeader('Destination', 'destination')}
              {renderHeader('Airline Code', 'airlineCode')}
              {renderHeader('Invoice date', 'invoiceDate')}
              {renderHeader('Return Date', 'returnDate')}
              {renderHeader('Email ID', 'emailId')}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sortedData.map((row, idx) => (
              <tr key={`${row.caseReference}-${idx}`} className="hover:bg-slate-50 transition-colors group">
                {isHistoryView && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Calendar size={12} className="text-gray-400"/>
                        {row.importDate}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-indigo-600 font-medium">
                      <div className="flex items-center gap-1.5 max-w-[150px] truncate" title={row.sourceReport}>
                        <FileText size={12} />
                        {row.sourceReport}
                      </div>
                    </td>
                  </>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-600">
                  {row.cycle}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                  {row.merchant}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500 font-medium">
                  {row.dueDate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600 group-hover:text-indigo-700 font-mono tracking-tight">
                  {row.caseReference}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono bg-gray-50/50 rounded">
                  •••• {row.cardLast4}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 group-hover:bg-indigo-50 group-hover:text-indigo-700 group-hover:border-indigo-100 transition-colors">
                    {row.reasonCode}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 max-w-[180px] truncate" title={row.reasonCategory}>
                  {row.reasonCategory}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                  {row.transactionDate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                  {row.datePost}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono font-medium">
                  {Number(String(row.transactionAmount).replace(/[^0-9.-]+/g,"")).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-mono font-bold bg-red-50/30">
                  {row.disputeAmount ? Number(String(row.disputeAmount).replace(/[^0-9.-]+/g,"")).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }) : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  {row.opayoMatch === 'MATCH' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                      <CheckCircle size={10} strokeWidth={3} /> Verified
                    </span>
                  )}
                  {row.opayoMatch === 'NO_MATCH' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">
                      <XCircle size={10} strokeWidth={3} /> Missing
                    </span>
                  )}
                  {row.opayoMatch === 'N/A' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold text-gray-400 bg-gray-100">
                      N/A
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-center">
                  {row.opayoReference ? (
                    <span className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      <LinkIcon size={10} />
                      Ref: {row.opayoReference}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 max-w-[150px] truncate" title={row.bookingAddress}>
                  {row.bookingAddress}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 max-w-[150px] truncate" title={row.transAddress}>
                  {row.transAddress}
                </td>
                {/* Penair Data Cells */}
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">{row.folderNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{row.travelDate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900 font-bold">{row.origin}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900 font-bold">{row.destination}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{row.airlineCode}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{row.invoiceDate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{row.returnDate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 max-w-[150px] truncate" title={row.emailId}>{row.emailId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
