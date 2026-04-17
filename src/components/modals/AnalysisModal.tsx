import React from 'react';
import type { Website } from '../../types';
import { CloseIcon, CommandLineIcon, DocumentTextIcon, CubeIcon, CogIcon, BuildingOfficeIcon, EnvelopeIcon } from '../Icons';

interface AnalysisModalProps {
  isOpen: boolean;
  website: Website;
  onClose: () => void;
}

const AnalysisSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
    <h4 className="font-bold text-[var(--theme-color)] text-lg mb-3 flex items-center gap-3">
        {icon}
        <span>{title}</span>
    </h4>
    <div className="text-slate-300 space-y-2 text-base pl-1">
        {children}
    </div>
  </div>
);

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, website, onClose }) => {
  const analysis = website.analysis;
  if (!analysis) return null;

  const renderListAsTags = (items: string[] | undefined) => {
    if (!items || items.length === 0) return <p className="text-slate-500 italic text-sm">无可用信息</p>;
    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
                <span key={index} className="bg-slate-700 text-slate-200 text-sm font-medium px-3 py-1 rounded-full">
                    {item}
                </span>
            ))}
        </div>
    );
  }
  
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div 
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center font-sans p-4"
      onClick={onClose}
    >
      <div 
        onClick={stopPropagation}
        className={`relative w-full max-w-2xl bg-slate-800/80 backdrop-blur-lg border border-slate-700 rounded-2xl shadow-2xl m-4 overflow-hidden ${isOpen ? 'animate-fade-in-down' : 'animate-fade-out-up'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-title"
      >
        <div className="p-6 sm:p-8 border-b border-slate-700">
            <h3 id="analysis-title" className="text-2xl font-bold text-white flex items-center">
                <CommandLineIcon className="mr-3 text-[var(--theme-color)] h-7 w-7" />
                <span>智能分析: {website.name}</span>
            </h3>
        </div>

        <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto space-y-6">
          <AnalysisSection title="业务总结" icon={<DocumentTextIcon />}>
            <p className="leading-relaxed text-slate-200">{analysis.summary || <span className="text-slate-500 italic text-sm">无可用信息</span>}</p>
          </AnalysisSection>

          <AnalysisSection title="详细产品/服务" icon={<CubeIcon />}>
            {renderListAsTags(analysis.detailedProducts)}
          </AnalysisSection>

          <AnalysisSection title="关键技术" icon={<CogIcon />}>
            {renderListAsTags(analysis.keyTechnologies)}
          </AnalysisSection>

          <AnalysisSection title="目标行业" icon={<BuildingOfficeIcon />}>
            {renderListAsTags(analysis.targetIndustries)}
          </AnalysisSection>
          
          {analysis.contactEmail && analysis.contactEmail !== 'null' && (
            <AnalysisSection title="联系邮箱" icon={<EnvelopeIcon />}>
                <a href={`mailto:${analysis.contactEmail}`} className="text-[var(--theme-color)] hover:underline break-all">
                    {analysis.contactEmail}
                </a>
            </AnalysisSection>
          )}

        </div>
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-10 p-2 rounded-full hover:bg-slate-700/50"
          aria-label="关闭分析"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};

export default AnalysisModal;