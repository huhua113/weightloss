import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, LabelList, Cell
} from 'recharts';
import { Study } from '../types';

interface Props {
  studies: Study[];
}

const getSafetyData = (studies: Study[]) => {
  return studies.flatMap(study => 
    study.doses
      .filter(dose => dose.weightLossPercent > 0)
      .map(dose => ({
        name: study.drugName,
        dose: dose.dose,
        trial: study.trialName,
        weightLoss: dose.weightLossPercent,
        nausea: dose.nauseaPercent,
        vomiting: dose.vomitingPercent,
        diarrhea: dose.diarrheaPercent,
        constipation: dose.constipationPercent,
        hasT2D: study.hasT2D,
        fill: study.hasT2D ? '#F8763F' : '#2B98BA' // Orange for T2D, Blue for non-T2D
      }))
  );
};


const getDurationEfficacyData = (studies: Study[]) => {
  return studies.flatMap(study => 
    study.doses
      .filter(dose => dose.weightLossPercent > 0)
      .map(dose => ({
        name: study.drugName,
        dose: dose.dose,
        trial: study.trialName,
        x: study.durationWeeks,
        y: dose.weightLossPercent,
        hasT2D: study.hasT2D,
      }))
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/80 backdrop-blur-sm p-3 border border-slate-200 shadow-lg rounded-lg text-xs">
          <p className="font-bold text-slate-800">{data.name} ({data.dose})</p>
          <p className="text-slate-600">试验: {data.trial}</p>
          <div className="mt-2 space-y-1">
            {payload.map((pld: any) => (
               <p key={pld.dataKey} style={{ color: pld.color || pld.payload.fill }}>
                 {pld.name}: {pld.value}{pld.unit}
               </p>
            ))}
          </div>
      </div>
    );
  }
  return null;
};

type AdverseEventType = 'nausea' | 'vomiting' | 'diarrhea' | 'constipation';

const ADVERSE_EVENT_CONFIG: Record<AdverseEventType, { name: string; unit: string; }> = {
  nausea: { name: '恶心率', unit: '%' },
  vomiting: { name: '呕吐率', unit: '%' },
  diarrhea: { name: '腹泻率', unit: '%' },
  constipation: { name: '便秘率', unit: '%' },
};

export const SafetyAnalysisChart: React.FC<Props> = ({ studies }) => {
  const [activeTab, setActiveTab] = useState<AdverseEventType>('nausea');

  const data = useMemo(() => {
    const allData = getSafetyData(studies);
    // Filter out data points where the currently selected adverse event has a value of 0.
    return allData.filter(item => item[activeTab] > 0);
  }, [studies, activeTab]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg h-96">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900">疗效与安全性分析</h3>
        <div className="flex items-center bg-slate-100 p-1 rounded-lg self-end sm:self-center">
          {Object.keys(ADVERSE_EVENT_CONFIG).map((key) => (
            <button 
              key={key}
              onClick={() => setActiveTab(key as AdverseEventType)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab === key ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              {ADVERSE_EVENT_CONFIG[key as AdverseEventType].name.replace('率','')}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <ScatterChart margin={{ top: 20, right: 40, left: 5, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            dataKey="weightLoss" 
            name="减重幅度" 
            unit="%" 
            label={{ value: '减重 (%)', position: 'bottom', offset: 0, style: { fontSize: 12 } }} 
            tick={{ fontSize: 10 }} 
          />
          <YAxis 
            type="number" 
            dataKey={activeTab} 
            name={ADVERSE_EVENT_CONFIG[activeTab].name}
            unit="%" 
            label={{ value: `${ADVERSE_EVENT_CONFIG[activeTab].name.replace('率', '')} (%)`, position: 'insideTopLeft', dy: -10, style: { fontSize: 12 } }} 
            tick={{ fontSize: 10 }} 
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
          <Legend wrapperStyle={{ display: 'none' }} />
          <Scatter name="Doses" data={data} fillOpacity={0.7}>
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};


export const DurationEfficacyScatterChart: React.FC<Props> = ({ studies }) => {
  const data = getDurationEfficacyData(studies);
  const t2dData = data.filter(d => d.hasT2D);
  const nonT2dData = data.filter(d => !d.hasT2D);
  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg h-96">
      <h3 className="text-lg font-bold text-slate-900 mb-2">周期与减重幅度分析</h3>
      <p className="text-xs text-slate-500 mb-4">X轴: 周期 (周) | Y轴: 减重 (%)</p>
      <ResponsiveContainer width="100%" height="90%">
        <ScatterChart margin={{ top: 20, right: 40, left: 5, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name="研究周期" unit="周" domain={['dataMin - 4', 'dataMax + 4']} label={{ value: '周期 (周)', position: 'bottom', offset: 0, style: { fontSize: 12 } }} tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey="y" name="减重幅度" unit="%" label={{ value: '减重 (%)', position: 'insideTopLeft', dy: -10, style: { fontSize: 12 } }} tick={{ fontSize: 10 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
          <Legend wrapperStyle={{ display: 'none' }} />
          <Scatter name="非糖尿病人群" data={nonT2dData} fill="#2B98BA" fillOpacity={0.7} />
          <Scatter name="T2D 人群" data={t2dData} fill="#F8763F" fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};