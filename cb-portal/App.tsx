
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRightLeft, ShieldCheck, CheckCircle2, ArrowLeft, CreditCard, Sparkles, HardDrive, Wifi, Cloud } from 'lucide-react';
import { DropZone } from './components/DropZone';
import { ResultTable } from './components/ResultTable';
import { DashboardStats } from './components/DashboardStats';
import { StatusBubble } from './components/StatusBubble';
import { HistorySidebar } from './components/HistorySidebar';
import { parseFile, normalizeData, parseOpayoData, parsePenairData } from './utils/excel';
import { findAnomalies, crossReferenceOpayo, crossReferencePenair } from './utils/comparator';
import { saveReport, getSavedReports, deleteReport, renameReport, clearAllReports, restoreBackup, checkBackupExists, mergeExternalHistory, getCloudConfig } from './services/storageService';
import { DisputeRecord, SavedReport } from './types';

function App() {
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [opayoFile, setOpayoFile] = useState<File | null>(null); 
  const [penairFile, setPenairFile] = useState<File | null>(null); // New State
  const [isProcessing, setIsProcessing] = useState(false);
  const [anomalies, setAnomalies] = useState<DisputeRecord[]>([]);
  const [hasCompared, setHasCompared] = useState(false);
  const [showNoChange, setShowNoChange] = useState(false);
  
  // History State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [backupAvailable, setBackupAvailable] = useState(false);
  const [isCloudSync, setIsCloudSync] = useState(false);

  const mainContentRef = useRef<HTMLDivElement>(null);

  // Initial load and sync listeners
  useEffect(() => {
    const loadHistory = async () => {
      // Async fetch to support cloud
      const reports = await getSavedReports();
      setSavedReports(reports);
      setBackupAvailable(checkBackupExists());
      
      const config = getCloudConfig();
      setIsCloudSync(!!(config && config.enabled));
    };
    
    loadHistory();

    // Listen for storage events to sync across tabs/windows
    window.addEventListener('storage', loadHistory);
    
    // Listen for focus to ensure data is fresh if user comes back to tab
    window.addEventListener('focus', loadHistory);

    return () => {
      window.removeEventListener('storage', loadHistory);
      window.removeEventListener('focus', loadHistory);
    };
  }, []);

  // Scroll to top when a report is loaded
  useEffect(() => {
    if (currentReportId && mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentReportId]);

  const handleReset = () => {
    // Rolling update logic:
    if (hasCompared && newFile && !currentReportId) {
      setBaseFile(newFile);
    }

    // Clear the new file but KEEP Opayo/Penair files so they persist for next run
    setNewFile(null);
    // Note: We do NOT clear opayoFile or penairFile here anymore.
    
    setAnomalies([]);
    setHasCompared(false);
    setShowNoChange(false);
    setCurrentReportId(null);
  };

  const processFiles = async () => {
    if (!baseFile || !newFile) return;

    setIsProcessing(true);
    setHasCompared(false);
    setShowNoChange(false);
    setCurrentReportId(null);

    try {
      // 1. Parse Comparison files
      const [baseRaw, newRaw] = await Promise.all([
        parseFile(baseFile),
        parseFile(newFile)
      ]);

      // 2. Normalize comparison data
      const baseRecords = normalizeData(baseRaw);
      const newRecords = normalizeData(newRaw);

      // 3. Compare logic
      let foundAnomalies = findAnomalies(baseRecords, newRecords);

      // 4. Opayo Cross-Reference (If uploaded)
      if (opayoFile) {
        try {
          const opayoRaw = await parseFile(opayoFile);
          const opayoData = parseOpayoData(opayoRaw);
          foundAnomalies = crossReferenceOpayo(foundAnomalies, opayoData);

          // 5. Penair Cross-Reference (Only if Opayo was processed first, as we need the Ref)
          if (penairFile) {
            try {
               const penairRaw = await parseFile(penairFile);
               const penairData = parsePenairData(penairRaw);
               foundAnomalies = crossReferencePenair(foundAnomalies, penairData);
            } catch (penairErr) {
               console.error("Error processing Penair file", penairErr);
               alert("Penair file parsing failed. Proceeding without Penair data.");
            }
          }

        } catch (opayoErr) {
          console.error("Error processing Opayo file", opayoErr);
          alert("Opayo file could not be parsed properly. Proceeding without cross-reference.");
        }
      } else if (penairFile) {
         // Warn if Penair is uploaded but Opayo isn't
         alert("Warning: Penair Data requires Opayo Data to link records. Penair skipped.");
      }

      setAnomalies(foundAnomalies);
      setHasCompared(true);

      if (foundAnomalies.length === 0) {
        setShowNoChange(true);
      } else {
        // AUTO SAVE LOGIC
        try {
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const autoName = `Auto-Save: ${newFile.name} (${timestamp})`;
          
          await saveReport(
            autoName, 
            baseFile.name, 
            newFile.name, 
            foundAnomalies, 
            null
          );
          
          // Refresh list
          const freshReports = await getSavedReports();
          setSavedReports(freshReports);
          
        } catch (saveError) {
          console.error("Auto-save failed:", saveError);
          if (String(saveError).includes('Storage full')) {
             alert('History storage is full. Oldest reports are being cleared to make room.');
          }
        }
      }

    } catch (error) {
      console.error("Error processing files", error);
      alert("Error processing files. Please ensure they are valid Excel or CSV files.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadReport = (report: SavedReport) => {
    setAnomalies(report.anomalies);
    setHasCompared(true);
    setCurrentReportId(report.id);
    setBaseFile(null);
    setNewFile(null);
    setOpayoFile(null);
    setPenairFile(null);
    setIsSidebarOpen(false);
  };

  const handleDeleteReport = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this report?")) {
      const updated = await deleteReport(id);
      setSavedReports(updated);
      if (currentReportId === id) {
        handleReset();
      }
    }
  };

  const handleRenameReport = async (id: string, newName: string) => {
    const updated = await renameReport(id, newName);
    setSavedReports(updated);
  };

  const handleClearAll = async () => {
    await clearAllReports();
    setSavedReports([]);
    setBackupAvailable(checkBackupExists());
    handleReset();
  };

  const handleRestore = () => {
    const restored = restoreBackup();
    if (restored.length > 0) {
      setSavedReports(restored);
    }
  };

  const handleImportHistory = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const merged = mergeExternalHistory(json);
        setSavedReports(merged);
        alert(`Successfully imported history! You now have ${merged.length} reports.`);
      } catch (err) {
        alert("Failed to import history file. It may be corrupt or invalid.");
      }
    };
    reader.readAsText(file);
  };

  const activeReport = currentReportId ? savedReports.find(r => r.id === currentReportId) : null;

  return (
    <div className="flex min-h-screen bg-transparent font-sans overflow-hidden">
      <HistorySidebar 
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        reports={savedReports}
        currentReportId={currentReportId}
        onLoad={handleLoadReport}
        onDelete={handleDeleteReport}
        onRename={handleRenameReport}
        onClearAll={handleClearAll}
        canRestore={backupAvailable}
        onRestore={handleRestore}
        onImport={handleImportHistory}
      />

      <div 
        ref={mainContentRef}
        className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto ml-20 transition-all duration-300"
      >
        <header className="glass-panel border-b border-white/20 sticky top-0 z-30 shadow-sm shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleReset}>
                  Dispute Delta <span className="text-indigo-600">Portal</span>
                </h1>
                <p className="text-xs text-gray-500 font-medium">Financial Integrity System</p>
              </div>
            </div>

            {/* Sync Status Badge */}
            <div className="flex items-center gap-4">
              {hasCompared && !currentReportId && (
                 <div className="hidden md:flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-semibold border border-green-100">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Analysis Active
                 </div>
              )}
              
              <div className={`
                 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors
                 ${isCloudSync 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-gray-100 text-gray-500 border-gray-200'
                 }
              `} title={isCloudSync ? "Connected to Cloud Database" : "Local Storage Mode"}>
                 {isCloudSync ? <Wifi size={14} className="animate-pulse" /> : <HardDrive size={14} />}
                 <span className="text-xs font-medium">{isCloudSync ? 'Cloud Sync Active' : 'Local Storage'}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          
          {!currentReportId && (
            <>
              {!hasCompared && (
                <div className="text-center max-w-3xl mx-auto mb-12 animate-fade-in mt-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/40 border border-white/50 backdrop-blur-sm shadow-sm mb-6">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Automated Reconciliation</span>
                  </div>
                  <h2 className="text-4xl font-extrabold text-gray-900 sm:text-5xl tracking-tight mb-6 drop-shadow-sm">
                    Detect Anomalies.<br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Verify Disputes.</span>
                  </h2>
                  <p className="text-lg text-gray-600 leading-relaxed font-light">
                    Upload your master database and an updated sheet to instantly identify new chargebacks. Cross-reference with Opayo and Penair for enriched financial context.
                  </p>
                </div>
              )}

              <div className={`
                glass-panel rounded-3xl shadow-xl border border-white/50 p-6 sm:p-10 transition-all duration-500 relative
                ${hasCompared ? 'opacity-90 scale-95 hover:opacity-100 hover:scale-100 ring-2 ring-indigo-50' : 'ring-1 ring-gray-100'}
              `}>
                {/* Comparison Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative mb-10">
                  <DropZone 
                    label="Original Master DB" 
                    file={baseFile} 
                    onFileSelect={setBaseFile}
                    onClear={() => setBaseFile(null)}
                    disabled={isProcessing}
                  />
                  
                  <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-white p-3 rounded-full border border-indigo-100 text-indigo-500 shadow-md">
                    <ArrowRightLeft size={20} />
                  </div>

                  <DropZone 
                    label="Updated Batch Sheet" 
                    file={newFile} 
                    onFileSelect={setNewFile}
                    onClear={() => setNewFile(null)}
                    disabled={isProcessing}
                  />
                </div>

                {/* Optional Opayo & Penair Input */}
                <div className="pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <CreditCard size={14} />
                    Optional Data Enrichment
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DropZone 
                      label="Opayo Payment Data" 
                      file={opayoFile} 
                      onFileSelect={setOpayoFile}
                      onClear={() => setOpayoFile(null)}
                      disabled={isProcessing}
                      isSecondary
                    />
                    <DropZone 
                      label="Penair Travel Data" 
                      file={penairFile} 
                      onFileSelect={setPenairFile}
                      onClear={() => setPenairFile(null)}
                      disabled={isProcessing}
                      isSecondary
                    />
                  </div>
                </div>

                <div className="mt-10 flex justify-center gap-4">
                  {hasCompared ? (
                    <button
                      onClick={handleReset}
                      className="px-8 py-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm hover:shadow flex items-center gap-2 group"
                    >
                      <ArrowRightLeft size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                      Rotate: Make Updated the new Master
                    </button>
                  ) : (
                    <button
                      onClick={processFiles}
                      disabled={!baseFile || !newFile || isProcessing}
                      className={`
                        px-10 py-4 rounded-xl font-bold text-white shadow-xl shadow-indigo-200 transition-all flex items-center gap-3 text-lg
                        ${!baseFile || !newFile || isProcessing
                          ? 'bg-slate-300 cursor-not-allowed opacity-70'
                          : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:translate-y-[-2px] hover:shadow-indigo-300 active:translate-y-[1px]'
                        }
                      `}
                    >
                      {isProcessing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Processing Data...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={22} />
                          Run Dispute Analysis
                        </>
                      )}
                    </button>
                  )}
                </div>

                <StatusBubble 
                  show={showNoChange} 
                  onDismiss={() => setShowNoChange(false)} 
                />
              </div>
            </>
          )}

          {/* Results Section */}
          {(hasCompared || currentReportId) && (
             <div className="animate-fade-in space-y-8 pb-20">
               {/* Report Header for History View */}
               {currentReportId && activeReport && (
                 <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-lg shadow-slate-200/50 border border-white flex items-center justify-between">
                    <div>
                       <div className="flex items-center gap-2 mb-2">
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Historical Archive</span>
                          <span className="text-gray-400 text-xs">{new Date(activeReport.timestamp).toLocaleString()}</span>
                       </div>
                       <h2 className="text-2xl font-bold text-gray-900">{activeReport.name}</h2>
                       <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                          Compared <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">{activeReport.baseFileName}</span> vs <span className="font-mono bg-gray-100 px-1 rounded text-gray-700">{activeReport.newFileName}</span>
                       </p>
                    </div>
                    <button 
                      onClick={handleReset}
                      className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-indigo-600 font-medium transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <ArrowLeft size={16} />
                      Back to Dashboard
                    </button>
                 </div>
               )}

               <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Results Overview</h2>
                 {!currentReportId && (
                   <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                     <CheckCircle2 size={14} />
                     Automatically archived
                   </span>
                 )}
               </div>

               <DashboardStats data={anomalies} />
               
               <ResultTable data={anomalies} />
             </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
