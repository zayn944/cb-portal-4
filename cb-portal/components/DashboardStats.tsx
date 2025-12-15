
import React, { useMemo } from 'react';
import { DollarSign, BarChart3, AlertCircle } from 'lucide-react';
import { DisputeRecord } from '../types';

interface DashboardStatsProps {
  data: DisputeRecord[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ data }) => {
  const stats = useMemo(() => {
    let totalTrans = 0;
    const reasonCounts: Record<string, number> = {};

    data.forEach(row => {
      // clean currency string to number
      const tAmt = Number(String(row.transactionAmount).replace(/[^0-9.-]+/g, ""));
      
      if (!isNaN(tAmt)) totalTrans += tAmt;

      const reason = row.reasonCode || 'Unknown';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    // Find top reason
    let topReason = 'N/A';
    let maxCount = 0;
    Object.entries(reasonCounts).forEach(([reason, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topReason = reason;
      }
    });

    return {
      totalTrans,
      topReason,
      count: data.length
    };
  }, [data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
      {/* Card 1: Total Impact */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg shadow-gray-200/50 flex flex-col relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-orange-400"></div>
        <div className="flex items-start justify-between mb-4">
           <div className="p-3 bg-red-50 text-red-500 rounded-xl group-hover:scale-110 transition-transform duration-300">
             <DollarSign size={24} />
           </div>
           <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full">{stats.count} cases</span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Exposure</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">
            {stats.totalTrans.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
          </h3>
        </div>
      </div>

      {/* Card 2: Top Reason */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg shadow-gray-200/50 flex flex-col relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-violet-400"></div>
        <div className="flex items-start justify-between mb-4">
           <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl group-hover:scale-110 transition-transform duration-300">
             <AlertCircle size={24} />
           </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Primary Cause</p>
          <h3 className="text-xl font-bold text-gray-900 mt-2 truncate leading-tight" title={stats.topReason}>
            {stats.topReason}
          </h3>
          <p className="text-xs text-indigo-500 mt-1 font-medium">Most frequent reason code</p>
        </div>
      </div>

      {/* Card 3: Avg Transaction */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg shadow-gray-200/50 flex flex-col relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400"></div>
        <div className="flex items-start justify-between mb-4">
           <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl group-hover:scale-110 transition-transform duration-300">
             <BarChart3 size={24} />
           </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Avg. Dispute Value</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-1 tracking-tight">
            {(stats.count > 0 ? stats.totalTrans / stats.count : 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
          </h3>
        </div>
      </div>
    </div>
  );
};
