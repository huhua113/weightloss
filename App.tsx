import React, { useState, useEffect } from 'react';
import { Study, DoseData } from './types';
import { subscribeToStudies, deleteStudy, deleteAllStudies, deleteSelectedStudies } from './services/firebaseService';
import ExtractionModal from './components/ExtractionModal';
import { SafetyAnalysisChart, DurationEfficacyScatterChart } from './components/Visualizations';
import ComparisonView from './components/ComparisonView';

const statCardStyles = [
  { bg: 'bg-orange-100', text: 'text-orange-500' },
  { bg: 'bg-accent/20', text: 'text-primary' },
  { bg: 'bg-yellow-100', text: 'text-yellow-500' },
];

const StatCard: React.FC<{ title: string; value: React.ReactNode; icon: React.ReactNode; styleIndex: number; }> = ({ title, value, icon, styleIndex }) => {
  const style = statCardStyles[styleIndex % statCardStyles.length];
  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${style.bg} ${style.text}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm font-medium text-slate-500 mt-1">{title}</p>
      </div>
    </div>
  );
};


const StudyCard: React.FC<{ 
  study: Study, 
  isSelected: boolean, 
  onSelect: (id: string) => void, 
  onInitiateDelete: (id: string, e: React.MouseEvent) => void,
  isPendingDelete: boolean,
  onConfirmDelete: (id: string) => void,
  onCancelDelete: () => void
}> = ({ study, isSelected, onSelect, onInitiateDelete, isPendingDelete, onConfirmDelete, onCancelDelete }) => (
  <div className="bg-white rounded-2xl shadow-lg p-4 animate-fade-in-up">
    <div className="flex justify-between items-start">
      <div>
        <h3 className="text-base font-bold text-slate-900">{study.drugName}</h3>
        <p className="text-xs text-slate-500">{study.company}</p>
      </div>
      <input
        type="checkbox"
        className="h-5 w-5 rounded-md border-gray-300 text-primary focus:ring-primary mt-1 flex-shrink-0"
        checked={isSelected}
        onChange={() => onSelect(study.id)}
      />
    </div>
    <div className="mt-3 text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-3">
      <p><span className="font-semibold text-primary">{study.trialName}</span> | {study.phase} | {study.durationWeeks} 周</p>
      <div className="flex gap-2 pt-1">
        <p className={`font-medium w-fit px-2 py-0.5 rounded-full ${study.hasT2D ? 'text-orange-600 bg-orange-100' : 'text-blue-600 bg-blue-100'}`}>
          {study.hasT2D ? '包含 T2D' : '不含 T2D'}
        </p>
         {study.isChineseCohort && (
          <p className="font-medium w-fit px-2 py-0.5 rounded-full text-red-600 bg-red-100">
            中国人
          </p>
        )}
      </div>
    </div>
    <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
      <h4 className="text-xs font-semibold text-slate-400">剂量详情</h4>
      {study.doses.map((dose: DoseData, idx: number) => (
        <div key={idx} className="flex items-center justify-between text-xs">
          <span className="font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{dose.dose}</span>
          <div className="flex items-center gap-3">
            <span className="text-emerald-600 font-bold" title="减重">↓ {dose.weightLossPercent}%</span>
            <span className="text-amber-600" title="恶心">🤢 {dose.nauseaPercent}%</span>
            <span className="text-red-600" title="呕吐">🤮 {dose.vomitingPercent}%</span>
          </div>
        </div>
      ))}
    </div>
     <div className="mt-3 border-t border-slate-100 pt-2 text-right">
       {isPendingDelete ? (
        <div className="flex items-center justify-end gap-2 animate-fade-in">
          <span className="text-sm text-red-600 font-medium">确定删除?</span>
          <button onClick={onCancelDelete} className="text-xs text-slate-500 hover:text-slate-700 font-medium">取消</button>
          <button onClick={() => onConfirmDelete(study.id)} className="text-xs px-2 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 font-bold">确认</button>
        </div>
        ) : (
          <button onClick={(e) => onInitiateDelete(study.id, e)} className="text-xs text-red-500 hover:text-red-700">删除</button>
        )}
    </div>
  </div>
);

type PopulationFilter = 'all' | 'nonT2D' | 't2d' | 'chinese';

const App: React.FC = () => {
  const [studies, setStudies] = useState<Study[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'comparison'>('dashboard');
  const [selectedStudyIds, setSelectedStudyIds] = useState<string[]>([]);
  const [populationFilter, setPopulationFilter] = useState<PopulationFilter>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToStudies(setStudies);
    return () => unsubscribe();
  }, []);

  const initiateDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    try {
      await deleteStudy(id);
    } catch (error: any) {
      console.error("Deletion failed:", error);
      alert(`删除失败: ${error.message || '请检查数据库权限或查看控制台日志。'}`);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setPendingDeleteId(null);
  };

  const handleClearAll = async () => {
    if (window.confirm(`确定要清空所有 ${studies.length} 条文献记录吗？此操作无法撤销。`)) {
      try {
        await deleteAllStudies();
      } catch (error) {
        console.error("Failed to clear all studies:", error);
        alert("清除失败，请检查控制台日志。");
      }
    }
  };
  
  const handleSelectStudy = (id: string) => setSelectedStudyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const handleClearComparison = () => { setSelectedStudyIds([]); setActiveTab('data'); };
  
  const handleDeleteSelected = async () => {
    if (window.confirm(`确定要删除选中的 ${selectedStudyIds.length} 条记录吗？此操作无法撤销。`)) {
        try {
            await deleteSelectedStudies(selectedStudyIds);
            setSelectedStudyIds([]); // Clear selection after successful deletion
        } catch (error) {
            console.error("Failed to delete selected studies:", error);
            alert("批量删除失败，请检查控制台日志。");
        }
    }
  };

  const selectedStudies = studies.filter(s => selectedStudyIds.includes(s.id));

  const filteredStudies = studies.filter(study => {
    if (populationFilter === 'all') return true;
    if (populationFilter === 't2d') return study.hasT2D;
    if (populationFilter === 'nonT2D') return !study.hasT2D;
    if (populationFilter === 'chinese') return study.isChineseCohort;
    return false;
  });

  return (
    <div className="min-h-screen pb-20">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">M</div>
                <span className="font-bold text-xl tracking-tight text-slate-900">MetaSlim AI</span>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
                {['dashboard', 'data'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab as any)} className={`capitalize transition-colors duration-200 relative text-sm font-medium h-full px-4 flex items-center ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-900'}`}>
                    {tab === 'dashboard' ? '可视分析' : `文献列表 (${studies.length})`}
                    {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center">
               {studies.length > 0 && (
                <button 
                  onClick={handleClearAll} 
                  className="hidden sm:inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors mr-4"
                >
                  清空所有数据
                </button>
              )}
              <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all shadow-md shadow-primary/30">
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="p 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                上传文献
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="sm:hidden mb-6 bg-white p-1 rounded-xl shadow-md flex">
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${activeTab === 'dashboard' ? 'bg-primary text-white' : 'text-slate-600'}`}>可视分析</button>
          <button onClick={() => setActiveTab('data')} className={`flex-1 py-2 text-sm font-medium rounded-lg ${activeTab === 'data' ? 'bg-primary text-white' : 'text-slate-600'}`}>文献列表</button>
        </div>

        {activeTab === 'comparison' ? (
          <ComparisonView studies={selectedStudies} onClear={handleClearComparison} />
        ) : studies.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg border border-slate-200/50">
            <div className="mx-auto h-24 w-24 text-slate-300"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
            <h3 className="mt-2 text-lg font-medium text-slate-900">暂无数据</h3>
            <p className="mt-1 text-sm text-slate-500">点击右上角“上传文献”按钮，使用AI开始分析您的第一篇PDF。</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                  <StatCard title="收录研究总数" value={studies.length} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} styleIndex={0} />
                  <StatCard title="涉及药物种类" value={new Set(studies.map(s => s.drugClass)).size} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v4.517a1 1 0 01-1.447.894L10 8v4.517A1 1 0 018.553 13.41l-1-1V4z" /></svg>} styleIndex={1} />
                  <StatCard title="最高减重记录" value={`${Math.max(0, ...studies.flatMap(s => s.doses.map(d => d.weightLossPercent))).toFixed(1)}%`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>} styleIndex={2} />
                </div>

                <div className="bg-white p-2 rounded-2xl shadow-lg">
                  <div className="flex items-center space-x-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {(['all', 'nonT2D', 't2d', 'chinese'] as PopulationFilter[]).map(filter => (
                      <button 
                        key={filter} 
                        onClick={() => setPopulationFilter(filter)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-shrink-0 ${populationFilter === filter ? 'bg-primary text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        {filter === 'all' ? '全部人群' : filter === 'nonT2D' ? '非糖尿病' : filter === 't2d' ? 'T2D' : '中国人'}
                      </button>
                    ))}
                  </div>
                </div>
                
                <DurationEfficacyScatterChart studies={filteredStudies} />
                <SafetyAnalysisChart studies={filteredStudies} />

              </div>
            )}
            {activeTab === 'data' && (
              <div className="animate-fade-in">
                 <div className="md:hidden space-y-4">{studies.map((study) => <StudyCard key={study.id} study={study} isSelected={selectedStudyIds.includes(study.id)} onSelect={handleSelectStudy} onInitiateDelete={initiateDelete} isPendingDelete={study.id === pendingDeleteId} onConfirmDelete={confirmDelete} onCancelDelete={cancelDelete} />)}</div>
                 <div className="hidden md:block bg-white shadow-lg rounded-2xl overflow-hidden"><table className="min-w-full divide-y divide-slate-100"><thead className="bg-slate-50"><tr><th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">选择</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">药物信息</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">试验设计</th><th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">剂量 / 效果 / 安全性</th><th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th></tr></thead><tbody className="bg-white divide-y divide-slate-100">{studies.map((study)=><tr key={study.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-4 py-4"><input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" checked={selectedStudyIds.includes(study.id)} onChange={()=>handleSelectStudy(study.id)}/></td><td className="px-6 py-4"><div className="flex flex-col"><span className="text-sm font-bold text-slate-900">{study.drugName}</span><span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full w-fit mt-1">{study.drugClass}</span><span className="text-xs text-slate-400 mt-0.5">{study.company}</span></div></td><td className="px-6 py-4"><div className="flex flex-col text-sm text-slate-600"><span className="font-medium text-primary">{study.trialName}</span><span>{study.phase} | {study.durationWeeks} 周</span><div className="flex gap-2 mt-1"><span className={`text-xs font-medium ${study.hasT2D ? 'text-orange-600' : 'text-blue-600'}`}>{study.hasT2D ?'T2D 患者':'非糖尿病'}</span>{study.isChineseCohort && <span className="text-xs font-medium text-red-600">中国人</span>}</div></div></td><td className="px-6 py-4"><div className="space-y-2">{study.doses.map((dose,idx)=><div key={idx} className="flex items-center text-xs space-x-3"><span className="w-12 font-medium text-slate-700 bg-slate-100 px-1 rounded">{dose.dose}</span><div className="flex items-center space-x-1 w-20"><span className="text-emerald-600 font-bold">↓ {dose.weightLossPercent}%</span></div><div className="flex items-center space-x-2 text-slate-400"><span title="恶心">🤢 {dose.nauseaPercent}%</span><span title="呕吐">🤮 {dose.vomitingPercent}%</span></div></div>)}</div></td><td className="px-6 py-4 text-right text-sm font-medium">{pendingDeleteId === study.id ? (<div className="flex items-center justify-end gap-2 animate-fade-in"><button onClick={cancelDelete} className="text-slate-500 hover:text-slate-700 font-medium">取消</button><button onClick={()=>confirmDelete(study.id)} className="px-3 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 font-bold">确认</button></div>) : (<button onClick={(e)=>initiateDelete(study.id, e)} className="text-red-400 hover:text-red-600 transition-colors">删除</button>)}</td></tr>)}</tbody></table></div>
              </div>
            )}
          </>
        )}
      </main>

      <ExtractionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} studies={studies} />
      
      {activeTab === 'data' && selectedStudyIds.length >= 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)] z-30 animate-fade-in-up">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">已选择 {selectedStudyIds.length} 项</span>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleDeleteSelected}
                  className="px-4 py-2 text-red-600 bg-red-50 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors"
                >
                  删除选中
                </button>
                {selectedStudyIds.length >= 2 && (
                  <button onClick={() => setActiveTab('comparison')} className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-colors shadow-md shadow-primary/30">
                    对比分析
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;