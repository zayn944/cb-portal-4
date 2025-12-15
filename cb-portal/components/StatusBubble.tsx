import React, { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';

interface StatusBubbleProps {
  show: boolean;
  onDismiss: () => void;
}

export const StatusBubble: React.FC<StatusBubbleProps> = ({ show, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50 animate-bounce-in">
      <div className="bg-emerald-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-4 max-w-md">
        <div className="p-2 bg-white/20 rounded-full">
          <CheckCircle size={24} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg">All Clear</h3>
          <p className="text-emerald-100 text-sm">
            No unique data or changes found between the two datasets.
          </p>
        </div>
        <button 
          onClick={onDismiss}
          className="p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};
