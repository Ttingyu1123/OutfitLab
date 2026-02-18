import React from 'react';
import Button from './Button';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: string | null;
  isLoading: boolean;
  lang: Language;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, result, isLoading, lang }) => {
  if (!isOpen) return null;

  const t = TRANSLATIONS[lang];

  const displayContent = result ? result.replace(/```json[\s\S]*?```/g, '').trim() : '';

  const renderLine = (line: string, i: number) => {
    if (!line.trim()) {
      return <div key={`sp-${i}`} className="h-2" />;
    }

    if (line.startsWith('##') || line.startsWith('###') || line.startsWith('**')) {
      return (
        <p key={`h-${i}`} className="font-bold text-brand-800 text-lg mt-4 mb-2">
          {line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()}
        </p>
      );
    }

    if (line.trim().startsWith('-')) {
      return (
        <li key={`li-${i}`} className="ml-5 list-disc mb-1">
          {line.replace(/^\s*-\s*/, '')}
        </li>
      );
    }

    return (
      <p key={`p-${i}`} className="mb-2">
        {line}
      </p>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-brand-50 to-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{t.modal_title}</h2>
              <p className="text-sm text-slate-500">{t.modal_subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-brand-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl">✨</span>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-slate-700">{t.modal_loading}</h3>
                <p className="text-slate-400 text-base mt-1">{t.modal_loading_desc}</p>
              </div>
            </div>
          ) : result ? (
            <div className="prose prose-slate prose-sm md:prose-base max-w-none">
              <div className="bg-brand-50/50 p-6 rounded-2xl border border-brand-100 text-slate-700 leading-relaxed whitespace-pre-wrap font-medium text-base">
                {displayContent.split('\n').map((line, i) => renderLine(line, i))}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 py-12">No result.</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex flex-col gap-3">
          {!isLoading && result && (
            <div className="bg-gradient-to-r from-purple-50 to-brand-50 border border-brand-100 rounded-xl p-3 flex items-start gap-3">
              <div className="mt-0.5 text-brand-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-base text-slate-600">
                <p className="font-bold text-brand-700 mb-0.5">{t.modal_next_step}</p>
                <p className="text-sm opacity-90">{t.modal_next_desc}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              {t.modal_btn}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
