import React, { useState, useRef, useEffect } from 'react';
import { extractTextFromPDF, analyzeMedicalText } from '../services/geminiService';
import { addStudy } from '../services/firebaseService';
import { Study } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  studies: Study[];
}

interface UploadProgress {
  fileName: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  message: string;
}

const ProgressIcon: React.FC<{ status: UploadProgress['status'] }> = ({ status }) => {
  switch (status) {
    case 'processing':
      return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>;
    case 'success':
      return <div className="h-5 w-5 text-green-500"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>;
    case 'error':
      return <div className="h-5 w-5 text-red-500"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>;
    default:
      return <div className="h-5 w-5 text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>;
  }
};


const ExtractionModal: React.FC<Props> = ({ isOpen, onClose, studies }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Reset state on modal close
    if (!isOpen) {
      setTimeout(() => {
        setUploadProgress([]);
        setIsBatchProcessing(false);
      }, 300); // allow for closing animation
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const processFiles = async (files: File[]) => {
    setIsBatchProcessing(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const updateStatus = (status: UploadProgress['status'], message: string) => {
        setUploadProgress(prev => {
          const newProgress = [...prev];
          newProgress[i] = { ...newProgress[i], status, message };
          return newProgress;
        });
      };

      try {
        updateStatus('processing', '正在解析 PDF...');
        const text = await extractTextFromPDF(file);

        updateStatus('processing', 'AI 正在提取数据...');
        const studiesData = await analyzeMedicalText(text);

        if (!studiesData || studiesData.length === 0) {
          throw new Error("AI 未能从文献中提取任何队列");
        }

        updateStatus('processing', `发现 ${studiesData.length} 个队列，正在筛选并保存...`);
        let studiesAddedCount = 0;
        let studiesSkippedCount = 0;
        let studiesFilteredOutCount = 0;

        for (const studyData of studiesData) {
          const isValid = studyData && studyData.drugName && studyData.trialName && Array.isArray(studyData.doses) && studyData.doses.length > 0;
          if (!isValid) continue;

          // Phase filtering
          const phaseStr = studyData.phase || '';
          if (!phaseStr.includes('1') && !phaseStr.includes('2') && !phaseStr.includes('3')) {
              studiesFilteredOutCount++;
              continue;
          }

          // Deduplication check
          const isDuplicate = studies.some(existingStudy => 
              existingStudy.drugName.trim().toLowerCase() === studyData.drugName.trim().toLowerCase() &&
              existingStudy.trialName.trim().toLowerCase() === studyData.trialName.trim().toLowerCase() &&
              existingStudy.hasT2D === studyData.hasT2D &&
              existingStudy.isChineseCohort === studyData.isChineseCohort
          );

          if (isDuplicate) {
            studiesSkippedCount++;
            continue;
          }
          
          await addStudy(studyData);
          studiesAddedCount++;
        }
        
        let successMessage = "";
        if (studiesAddedCount > 0) successMessage += `成功新增 ${studiesAddedCount} 个队列。`;
        if (studiesSkippedCount > 0) successMessage += ` ${studiesSkippedCount} 个重复队列已跳过。`;
        if (studiesFilteredOutCount > 0) successMessage += ` ${studiesFilteredOutCount} 个非1-3期研究已忽略。`;
        
        if (successMessage.trim() === "") {
          if (studiesData.length > 0) {
            throw new Error("所有提取的队列均为非1-3期或重复项。");
          } else {
            throw new Error("未发现任何有效的新研究队列。");
          }
        }
        
        updateStatus('success', successMessage.trim());

      } catch (error: any) {
        let msg = error.message || '发生未知错误';
        if (msg.includes('permission-denied')) msg = '数据库权限不足';
        updateStatus('error', msg);
      }
    }
    setIsBatchProcessing(false);
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newProgress = Array.from(files).map(file => ({
      fileName: file.name,
      status: 'idle' as 'idle',
      message: '待处理'
    }));
    setUploadProgress(newProgress);
    processFiles(Array.from(files));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFilesSelected(e.target.files);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
      handleFilesSelected(pdfFiles as any);
    }
  };

  const allDone = uploadProgress.length > 0 && !isBatchProcessing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-2">上传文献提取数据</h2>
          <p className="text-slate-500 text-sm mb-6">
            支持批量上传 PDF 文献。AI 将自动分析并跳过数据不完整的文献。
          </p>

          {uploadProgress.length === 0 ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-primary mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-primary font-medium">点击或拖拽多个 PDF 文件</span>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" multiple />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
              {uploadProgress.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <ProgressIcon status={item.status} />
                    <div className="flex flex-col overflow-hidden">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.fileName}</p>
                      <p className={`text-xs ${item.status === 'error' ? 'text-red-500' : 'text-slate-500'}`}>{item.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="bg-slate-50 px-6 py-4 flex justify-end border-t border-slate-200">
          <button onClick={onClose} disabled={isBatchProcessing} className="px-4 py-2 text-slate-600 hover:text-slate-800 disabled:opacity-50 font-medium rounded-lg hover:bg-slate-200 transition-colors">
            {allDone ? '完成' : '关闭'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtractionModal;