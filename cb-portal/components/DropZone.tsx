
import React, { useCallback, useRef } from 'react';
import { FileSpreadsheet, Check, X, FilePlus } from 'lucide-react';

interface DropZoneProps {
  label: string;
  file: File | null;
  onFileSelect: (file: File) => void;
  onClear?: () => void;
  disabled?: boolean;
  isSecondary?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ label, file, onFileSelect, onClear, disabled, isSecondary }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    if (onClear) onClear();
  };

  // Styles based on state
  const baseClasses = "relative group rounded-xl transition-all duration-300 ease-out flex flex-col items-center justify-center cursor-pointer overflow-hidden";
  
  const activeClasses = file
    ? "bg-emerald-50/50 border-2 border-emerald-400"
    : disabled
      ? "bg-gray-50 border-2 border-dashed border-gray-200 opacity-60 cursor-not-allowed"
      : isSecondary
        ? "bg-white border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30"
        : "bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/30 hover:shadow-md";

  const sizeClasses = isSecondary ? "min-h-[140px] p-6" : "min-h-[200px] p-8";

  return (
    <div 
      className={`${baseClasses} ${activeClasses} ${sizeClasses}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      
      {file ? (
        <div className="flex flex-col items-center text-center animate-fade-in relative z-10 w-full">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-sm">
             <Check size={24} strokeWidth={3} />
          </div>
          <p className="font-bold text-gray-800 text-sm truncate max-w-[90%] px-2">
            {file.name}
          </p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Ready for analysis</p>
          
          {onClear && !disabled && (
            <button
              onClick={handleClear}
              className="mt-4 text-xs flex items-center gap-1 text-gray-400 hover:text-red-500 bg-white border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
              <X size={12} />
              Remove File
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center pointer-events-none">
          <div className={`
             rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-300
             ${isSecondary 
                ? 'w-10 h-10 bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500' 
                : 'w-16 h-16 bg-indigo-50 text-indigo-500 shadow-indigo-100 shadow-lg'
             }
          `}>
             {isSecondary ? <FilePlus size={20} /> : <FileSpreadsheet size={32} />}
          </div>
          
          <div>
            <p className={`font-semibold ${isSecondary ? 'text-sm text-gray-600' : 'text-lg text-gray-800'}`}>
              {label}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {isSecondary ? 'Drag & drop optional file' : 'Drag & drop Excel file here'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
