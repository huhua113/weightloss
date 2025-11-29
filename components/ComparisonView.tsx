import React, { useState, useMemo } from 'react';
import { Study, DoseData } from '../types';

interface Props {
  studies: Study[];
  onClear: () => void;
}

const SortIcon: React.FC<{ direction: 'asc' | 'desc' }> = ({ direction }) => (
  <svg className="w-3 h-3 ml-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    {direction === 'asc' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>}
  </svg>
);


const ComparisonCard: React.FC<{ study: Study }> = ({ study }) => {
  const [sortConfig, setSortConfig] = useState<{ key: keyof DoseData, direction: 'asc' | 'desc' } | null>(null);

  const sortedDoses = useMemo(() => {
    let sortableDoses = [...study.doses];
    if (sortConfig !== null) {
      sortableDoses.sort((a, b) => {
        const aValue = a[sortConfig.key] || 0;
        const bValue = b[sortConfig.key] || 0;

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableDoses;
  }, [study.doses, sortConfig]);

  const requestSort = (key: keyof DoseData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      setSortConfig(null); // Third click resets sorting
      return;
    }
    setSortConfig({ key, direction });
  };
  
  const getSortButtonClass = (key: keyof DoseData) => {
    return `text-xs font-medium transition-colors ${sortConfig?.key === key ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`;
  };

  return (
    <div className="w-[85vw] max-w-sm sm:w-80 flex-shrink-0 bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-900">{study.drugName}</h3>
        <p className="text-sm text-slate-500">{study.company}</p>
      </div>
      <div className="p-4 space-y-4">
        {study.summary && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">关键结论</h4>
            <p className="mt-1 text-sm text-slate-600 bg-slate-50 p-2 rounded-md">{study.summary}</p>
          </div>
        )}

        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">试验设计</h4>
          <ul className="mt-2 text-sm space-y-1">
            <li className="flex justify-between"><span>试验名称:</span> <span className="font-medium text-primary text-right truncate">{study.trialName}</span></li>
            <li className="flex justify-between"><span>药物种类:</span> <span className="font-medium text-slate-700">{study.drugClass}</span></li>
            <li className="flex justify-between"><span>分期:</span> <span className="font-medium text-slate-700">{study.phase}</span></li>
            <li className="flex justify-between"><span>周期:</span> <span className="font-medium text-slate-700">{study.durationWeeks} 周</span></li>
            <li className="flex justify-between"><span>入组人群:</span> 
              <span className={`font-medium ${study.hasT2D ? 'text-orange' : 'text-primary'}`}>
                {study.hasT2D ? '包含 T2D' : '不含 T2D'}
              </span>
            </li>
          </ul>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">疗效与安全性</h4>
             <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-400">排序:</span>
              <button onClick={() => requestSort('nauseaPercent')} className={getSortButtonClass('nauseaPercent')}>
                恶心
                {sortConfig?.key === 'nauseaPercent' && <SortIcon direction={sortConfig.direction} />}
              </button>
               <button onClick={() => requestSort('vomitingPercent')} className={getSortButtonClass('vomitingPercent')}>
                呕吐
                {sortConfig?.key === 'vomitingPercent' && <SortIcon direction={sortConfig.direction} />}
              </button>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            {sortedDoses.map((dose, idx) => (
              <div key={idx} className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-1 border-t border-slate-100 pt-1.5 first:border-t-0 first:pt-0">
                <p className="text-sm font-mono font-medium text-slate-800">{dose.dose}</p>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span className="font-semibold text-emerald-700" title="减重百分比">↓{dose.weightLossPercent}%</span>
                  <span className="font-semibold text-amber-700" title="恶心发生率">🤢{dose.nauseaPercent}%</span>
                  <span className="font-semibold text-red-700" title="呕吐发生率">🤮{dose.vomitingPercent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ComparisonView: React.FC<Props> = ({ studies, onClear }) => {
  return (
    <div className="animate-fade-in">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">药物对比分析</h2>
          <p className="text-slate-500">已选择 {studies.length} 个研究进行对比。可横向滚动查看更多。</p>
        </div>
        <button
          onClick={onClear}
          className="px-4 py-2 bg-white text-primary text-sm font-medium rounded-lg hover:bg-primary/5 transition-colors border border-primary"
        >
          清空并返回
        </button>
      </div>

      <div className="flex gap-6 pb-6 overflow-x-auto">
        {studies.map(study => (
          <ComparisonCard key={study.id} study={study} />
        ))}
      </div>
    </div>
  );
};

export default ComparisonView;