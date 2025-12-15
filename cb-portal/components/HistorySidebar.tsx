
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  LayoutGrid, 
  Search, 
  X as XIcon, 
  History,
  Archive,
  List,
  Grid,
  CreditCard,
  Plane,
  Mail,
  FileText,
  Upload,
  Share2,
  Cloud,
  Wifi,
  WifiOff,
  Database,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { SavedReport, CloudConfig } from '../types';
import { ResultTable } from './ResultTable';
import { exportHistoryToJson, getCloudConfig, saveCloudConfig, clearCloudConfig } from '../services/storageService';

interface HistorySidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  reports: SavedReport[];
  currentReportId: string | null;
  onLoad: (report: SavedReport) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onClearAll: () => void;
  canRestore?: boolean;
  onRestore?: () => void;
  onImport?: (file: File) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  toggleSidebar,
  reports,
  onClearAll,
  onImport
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Cloud Config State
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudKey, setCloudKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isCloudActive, setIsCloudActive] = useState(false);

  useEffect(() => {
    const config = getCloudConfig();
    if (config && config.enabled) {
      setIsCloudActive(true);
      setCloudUrl(config.url);
      setCloudKey(config.key);
    }
  }, [isOpen]);

  const handleSaveCloud = () => {
    if (!cloudUrl || !cloudKey) {
      alert("Please enter both Supabase URL and Key");
      return;
    }
    
    // Clean URL
    const cleanUrl = cloudUrl.replace(/\/$/, "");

    const config: CloudConfig = {
      url: cleanUrl,
      key: cloudKey,
      tableName: 'disputes', // Hardcoded for simplicity
      enabled: true
    };
    saveCloudConfig(config);
    setIsCloudActive(true);
    setShowCloudConfig(false);
    alert("Cloud Sync Connected! Data will now be fetched from your central database.");
  };

  const handleDisconnectCloud = () => {
    clearCloudConfig();
    setIsCloudActive(false);
    setShowCloudConfig(false);
    setCloudUrl('');
    setCloudKey('');
    alert("Disconnected from Cloud. Showing local history.");
  };

  // 1. Flatten ALL anomalies
  const allMasterRecords = useMemo(() => {
    return reports.flatMap(report => 
      report.anomalies.map(record => ({
        ...record,
        importDate: new Date(report.timestamp).toLocaleDateString() + ' ' + new Date(report.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        sourceReport: report.name,
        _baseFile: report.baseFileName,
        _newFile: report.newFileName,
        _ts: report.timestamp 
      }))
    ).sort((a, b) => (b._ts || 0) - (a._ts || 0));
  }, [reports]);

  // 2. Filter records
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return allMasterRecords;
    const term = searchTerm.toLowerCase().trim();
    return allMasterRecords.filter(record => 
      record.caseReference.toLowerCase().includes(term) ||
      record.sourceReport.toLowerCase().includes(term) ||
      record.merchant.toLowerCase().includes(term)
    );
  }, [allMasterRecords, searchTerm]);

  // Unused but kept for structure if needed later
  // const handleClearClick = (e: React.MouseEvent) => {
  //   e.preventDefault();
  //   e.stopPropagation();
  //   onClearAll();
  // };

  const handleExport = () => {
    const jsonStr = exportHistoryToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispute_history_LOCAL_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onImport) {
      onImport(e.target.files[0]);
    }
    if (e.target) e.target.value = '';
  };

  const formatCurrency = (amount: any) => {
    const num = Number(String(amount).replace(/[^0-9.-]+/g, ""));
    return isNaN(num) ? '£0.00' : num.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
  };

  const DataPoint = ({ label, value, icon, className, truncate }: { label: string, value: React.ReactNode, icon?: React.ReactNode, className?: string, truncate?: boolean }) => (
    <div className={`flex flex-col ${className || ''}`}>
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">{label}</span>
      <div className={`flex items-center gap-1.5 text-xs font-medium text-gray-700 ${truncate ? 'overflow-hidden' : ''}`}>
        {icon}
        <span className={truncate ? 'truncate' : ''} title={typeof value === 'string' ? value : undefined}>{value || '-'}</span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. ALWAYS VISIBLE LEFT STRIP */}
      <div className="fixed top-0 left-0 h-full w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 z-50 shadow-sm">
        <div className="mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
            <LayoutGrid size={20} />
          </div>
        </div>

        <button 
          type="button"
          onClick={toggleSidebar}
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 mb-4
            ${isOpen 
              ? 'bg-indigo-100 text-indigo-700' 
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }
          `}
          title="Open History Dashboard"
        >
          <History size={24} />
        </button>

        {/* CLOUD CONNECT BUTTON */}
        <div className="mt-auto flex flex-col gap-3 mb-6 items-center w-full px-2">
           <button 
             onClick={() => setShowCloudConfig(!showCloudConfig)}
             className={`
               w-10 h-10 flex items-center justify-center rounded-lg transition-colors border relative
               ${isCloudActive 
                 ? 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' 
                 : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border-transparent hover:border-indigo-100'
               }
             `}
             title={isCloudActive ? "Cloud Sync Active" : "Connect to Cloud Database"}
           >
             {isCloudActive ? <Wifi size={18} /> : <Cloud size={18} />}
             {isCloudActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>}
           </button>

           <div className="w-full h-px bg-gray-100 my-1"></div>

           <button 
             onClick={handleExport}
             className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-100"
             title="Backup Local History"
           >
             <Share2 size={18} />
           </button>
           <button 
             onClick={handleImportClick}
             className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
             title="Import Local Backup"
           >
             <Upload size={18} />
           </button>
           <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* 2. CLOUD CONFIG MODAL - OUTSIDE CONDITIONAL, FIXED POSITIONING */}
      {showCloudConfig && (
        <div className="fixed bottom-24 left-24 w-[26rem] bg-white shadow-2xl border border-gray-200 rounded-2xl p-6 z-[60] animate-fade-in-up origin-bottom-left">
          <div className="flex justify-between items-start mb-4">
             <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
               <Database size={18} className="text-indigo-600" />
               Cloud Sync Setup
             </h3>
             <button onClick={() => setShowCloudConfig(false)} className="text-gray-400 hover:text-gray-600"><XIcon size={18}/></button>
          </div>
          
          <div className="space-y-5">
            {/* INSTRUCTIONS */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-3">
               <div className="flex items-start gap-2">
                 <div className="bg-indigo-100 text-indigo-600 p-1 rounded font-bold shrink-0 mt-0.5">1</div>
                 <div>
                    Create a free project at <a href="https://supabase.com" target="_blank" className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1">supabase.com <ExternalLink size={10}/></a>
                 </div>
               </div>
               <div className="flex items-start gap-2">
                 <div className="bg-indigo-100 text-indigo-600 p-1 rounded font-bold shrink-0 mt-0.5">2</div>
                 <div>
                    Go to <b>Project Settings</b> (cog icon) → <b>API</b>.
                    <br/>Copy the <b>Project URL</b> and <b>anon/public Key</b>.
                 </div>
               </div>
               <div className="flex items-start gap-2">
                 <div className="bg-indigo-100 text-indigo-600 p-1 rounded font-bold shrink-0 mt-0.5">3</div>
                 <div>
                    Go to <b>SQL Editor</b> and run this command:
                    <div className="mt-1 font-mono bg-white p-2 rounded border border-slate-200 select-all text-[10px] text-slate-500 overflow-x-auto whitespace-nowrap">
                      create table disputes (id text primary key, doc jsonb, created_at int8);
                    </div>
                 </div>
               </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project URL</label>
              <input 
                type="text" 
                placeholder="https://xyz.supabase.co"
                value={cloudUrl}
                onChange={e => setCloudUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API Key (anon/public)</label>
              <div className="relative">
                <input 
                  type={showKey ? "text" : "password"}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                  value={cloudKey}
                  onChange={e => setCloudKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none pr-10 transition-shadow"
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>

            <button 
              onClick={handleSaveCloud}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              <Wifi size={16} /> Connect Database
            </button>
            
            {isCloudActive && (
               <button 
                 onClick={handleDisconnectCloud}
                 className="w-full py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
               >
                 Disconnect
               </button>
            )}
          </div>
        </div>
      )}

      {/* 3. FULL SCREEN DASHBOARD OVERLAY */}
      {isOpen && (
        <div className="fixed inset-0 left-20 z-40 bg-slate-50 animate-fade-in overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                <Archive size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">History Archive</h1>
                <p className="text-gray-500 text-xs">
                  {filteredRecords.length} records • {isCloudActive ? 'Synced with Cloud' : 'Local Storage Only'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 mr-4 px-3 py-1.5 rounded-full border text-xs font-medium ${isCloudActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {isCloudActive ? <Wifi size={12} /> : <WifiOff size={12} />}
                <span>{isCloudActive ? 'Live Sync Active' : 'Offline / Local'}</span>
              </div>

              <div className="flex items-center bg-gray-100 rounded-lg p-1 mr-4">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                  <Grid size={16} />
                </button>
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                  <List size={16} />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search case ref..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 py-1.5 w-64 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:bg-gray-100 rounded-full">
                    <XIcon size={12} />
                  </button>
                )}
              </div>
              
              <button onClick={toggleSidebar} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg text-gray-600 transition-colors">
                <XIcon size={18} />
              </button>
            </div>
          </div>

          {/* CONTENT */}
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
             {filteredRecords.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Database size={64} className="mb-4 stroke-1 opacity-60 text-indigo-200" />
                  <p className="text-xl font-medium mb-2">No Records Found</p>
                  <p className="text-sm text-gray-400 max-w-sm text-center mb-6">
                    {isCloudActive 
                      ? "Connected to cloud, but no disputes found. Run an analysis to populate the database." 
                      : "Local storage is empty. Upload files to analyze or connect to Cloud Sync to see team history."}
                  </p>
                  {!isCloudActive && (
                    <button 
                      onClick={() => setShowCloudConfig(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl shadow-sm hover:border-indigo-400 transition-all"
                    >
                      <Cloud size={20} />
                      Setup Cloud Sync
                    </button>
                  )}
                </div>
             ) : (
               <div className="flex-1 overflow-auto p-6">
                  {viewMode === 'table' ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-w-[1000px]">
                        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between sticky top-0 z-20">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                              <History size={16} className="text-indigo-500"/>
                              Master Data Table
                            </h3>
                            <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded">
                              {filteredRecords.length} rows
                            </span>
                        </div>
                        <ResultTable data={filteredRecords} />
                    </div>
                  ) : (
                    // GRID VIEW
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-10">
                      {filteredRecords.map((record, idx) => (
                        <div key={`${record.caseReference}-${idx}`} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col overflow-hidden group">
                          
                          {/* Header */}
                          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex flex-col overflow-hidden pr-2">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">MERCHANT</span>
                                <span className="text-xs font-semibold text-gray-800 truncate" title={record.merchant}>{record.merchant}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">CYCLE</span>
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded border border-gray-200">{record.cycle}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-end mb-4">
                              <div>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">CASE REFERENCE</span>
                                <h3 className="text-lg font-bold text-indigo-600 font-mono tracking-tight group-hover:text-indigo-700">{record.caseReference}</h3>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">TRANS AMOUNT</span>
                                <span className="text-lg font-bold text-gray-900 leading-none">{formatCurrency(record.transactionAmount)}</span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between text-xs pt-3 border-t border-dotted border-gray-200">
                                <div>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">DISPUTE</span>
                                    <span className="text-red-600 font-bold font-mono">{record.disputeAmount ? formatCurrency(record.disputeAmount) : '-'}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase block mb-0.5">DATE</span>
                                    <span className="text-gray-600 font-medium">{record.datePost || 'N/A'}</span>
                                </div>
                            </div>
                          </div>

                          {/* Body */}
                          <div className="p-4 space-y-4 flex-1 bg-white">
                            <div className="flex justify-between border-b border-gray-50 pb-3 mb-1">
                                <DataPoint label="STATUS" value={
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${record.opayoMatch === 'MATCH' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                      {record.opayoMatch === 'MATCH' ? 'VERIFIED' : 'UNVERIFIED'}
                                    </span>
                                } />
                                <div className="text-right">
                                  <DataPoint className="items-end" label="LAST 4" icon={<CreditCard size={12}/>} value={<span className="font-mono">•••• {record.cardLast4}</span>} />
                                </div>
                            </div>

                            <DataPoint label="REASON" value={<span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-mono text-xs">{record.reasonCode}</span>} />
                            
                            {/* Enriched Data */}
                            {(record.penairMatch === 'MATCH' || record.emailId) && (
                              <div className="mt-2 pt-3 border-t border-dashed border-gray-200 bg-gray-50/50 -mx-4 px-4 pb-2">
                                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-2 block text-center">— Travel & Contact —</span>
                                {record.penairMatch === 'MATCH' && (
                                  <div className="grid grid-cols-2 gap-3 mb-2">
                                    <DataPoint label="AIRLINE" value={record.airlineCode} icon={<Plane size={12} />} />
                                    <DataPoint label="DESTINATION" value={record.destination} />
                                  </div>
                                )}
                                {record.emailId && <DataPoint label="EMAIL" icon={<Mail size={12}/>} truncate value={record.emailId} />}
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">SOURCE</span>
                                <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                                  {isCloudActive ? <Cloud size={10} className="text-emerald-500"/> : <FileText size={10} className="text-gray-400"/>}
                                  <span className="truncate text-[10px] text-gray-500" title={record.sourceReport}>{record.sourceReport}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">IMPORTED</span>
                                <span className="text-[10px] text-gray-500">{record.importDate.split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>
             )}
          </div>
        </div>
      )}
    </>
  );
};
