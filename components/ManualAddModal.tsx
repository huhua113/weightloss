import React, { useState, useEffect } from 'react';
import { Study, DoseData } from '../types';
import { addStudy } from '../services/firebaseService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const emptyDose: DoseData = { dose: '', weightLossPercent: 0, nauseaPercent: 0, vomitingPercent: 0, diarrheaPercent: 0, constipationPercent: 0 };
const initialState: Omit<Study, 'id' | 'createdAt'> = {
    drugName: '',
    company: '',
    drugClass: '',
    trialName: '',
    phase: '',
    durationWeeks: 0,
    hasT2D: false,
    isChineseCohort: false,
    doses: [emptyDose],
    summary: '',
};

const ManualAddModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState(initialState);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Reset form when modal is closed
    if (!isOpen) {
      setTimeout(() => setFormData(initialState), 200); // Delay reset to allow closing animation
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    }
    if (type === 'number') {
      finalValue = value === '' ? 0 : parseFloat(value);
    }
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleDoseChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') {
      finalValue = value === '' ? 0 : parseFloat(value);
    }

    const newDoses = [...formData.doses];
    newDoses[index] = { ...newDoses[index], [name]: finalValue };
    setFormData(prev => ({ ...prev, doses: newDoses }));
  };

  const addDose = () => {
    setFormData(prev => ({ ...prev, doses: [...prev.doses, { ...emptyDose }] }));
  };

  const removeDose = (index: number) => {
    setFormData(prev => ({ ...prev, doses: prev.doses.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.drugName || !formData.trialName) {
        alert("请填写药物名称和试验名称。");
        return;
    }
    setIsSaving(true);
    try {
      const cleanedData = {
          ...formData,
          drugName: formData.drugName.charAt(0).toUpperCase() + formData.drugName.slice(1).toLowerCase(),
      };
      await addStudy(cleanedData);
      onClose(); // Close modal on success
    } catch (error) {
      console.error("Failed to add study:", error);
      alert("添加失败，请稍后再试。");
    } finally {
      setIsSaving(false);
    }
  };

  const formInputStyle = "mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm";
  const formLabelStyle = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden transform transition-all flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-slate-900">手动录入文献数据</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow contents">
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div><label className={formLabelStyle}>药物名称</label><input type="text" name="drugName" value={formData.drugName} onChange={handleChange} className={formInputStyle} required placeholder="例如: Semaglutide" /></div>
              <div><label className={formLabelStyle}>公司</label><input type="text" name="company" value={formData.company} onChange={handleChange} className={formInputStyle} placeholder="例如: Novo Nordisk" /></div>
              <div><label className={formLabelStyle}>药物种类</label><input type="text" name="drugClass" value={formData.drugClass} onChange={handleChange} className={formInputStyle} placeholder="例如: GLP-1 RA" /></div>
              <div><label className={formLabelStyle}>试验名称</label><input type="text" name="trialName" value={formData.trialName} onChange={handleChange} className={formInputStyle} required placeholder="例如: STEP-1" /></div>
              
              <div>
                <label htmlFor="manual_phase" className={formLabelStyle}>分期</label>
                <select id="manual_phase" name="phase" value={formData.phase} onChange={handleChange} className={formInputStyle}>
                  <option value="">请选择分期</option>
                  <option value="Phase 1">Phase 1</option>
                  <option value="Phase 2">Phase 2</option>
                  <option value="Phase 3">Phase 3</option>
                </select>
              </div>
              
              <div><label className={formLabelStyle}>周期 (周)</label><input type="number" name="durationWeeks" value={formData.durationWeeks} onChange={handleChange} className={formInputStyle} placeholder="例如: 68" /></div>
              
              <div className="col-span-1 md:col-span-2 flex items-center gap-6 mt-2">
                 <div className="flex items-center gap-2"><input type="checkbox" id="manual_hasT2D" name="hasT2D" checked={formData.hasT2D} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" /><label htmlFor="manual_hasT2D" className="text-sm font-medium text-slate-700">包含T2D患者</label></div>
                 <div className="flex items-center gap-2"><input type="checkbox" id="manual_isChineseCohort" name="isChineseCohort" checked={formData.isChineseCohort} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" /><label htmlFor="manual_isChineseCohort" className="text-sm font-medium text-slate-700">中国人队列</label></div>
              </div>

              <div className="col-span-1 md:col-span-2 mt-2">
                <h3 className="text-base font-semibold text-slate-800 border-b pb-2 mb-3">剂量详情</h3>
                <div className="space-y-3">
                  {formData.doses.map((dose, index) => (
                    <div key={index} className="grid grid-cols-12 gap-x-3 items-center">
                        <div className="col-span-12 sm:col-span-3"><input type="text" name="dose" placeholder="剂量 (例如: 2.4mg)" value={dose.dose} onChange={e => handleDoseChange(index, e)} className={formInputStyle + " mt-0"} required/></div>
                        <div className="col-span-6 sm:col-span-2 relative"><label className="sm:hidden text-xs text-slate-500">减重%</label><input type="number" name="weightLossPercent" placeholder="减重%" step="0.1" value={dose.weightLossPercent} onChange={e => handleDoseChange(index, e)} className={formInputStyle + " mt-0"} /></div>
                        <div className="col-span-6 sm:col-span-2 relative"><label className="sm:hidden text-xs text-slate-500">恶心%</label><input type="number" name="nauseaPercent" placeholder="恶心%" step="0.1" value={dose.nauseaPercent} onChange={e => handleDoseChange(index, e)} className={formInputStyle + " mt-0"} /></div>
                        <div className="col-span-6 sm:col-span-2 relative"><label className="sm:hidden text-xs text-slate-500">呕吐%</label><input type="number" name="vomitingPercent" placeholder="呕吐%" step="0.1" value={dose.vomitingPercent} onChange={e => handleDoseChange(index, e)} className={formInputStyle + " mt-0"} /></div>
                        <div className="col-span-6 sm:col-span-2"></div>
                        <div className="col-span-12 sm:col-span-1 flex justify-end"><button type="button" onClick={() => removeDose(index)} className="text-red-500 hover:text-red-700 p-2 rounded-full flex items-center justify-center w-6 h-6 leading-none">×</button></div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addDose} className="mt-3 text-sm font-medium text-primary hover:text-primary/80">+ 添加剂量</button>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-medium rounded-lg hover:bg-slate-200 transition-colors">取消</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/30">
              {isSaving ? '保存中...' : '确认添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default ManualAddModal;
