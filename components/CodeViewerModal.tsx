import React from 'react';
import { X, FileCode2 } from 'lucide-react';

interface CodeViewerModalProps {
  isOpen: boolean;
  filePath: string;
  content: string;
  initialLine?: number;
  onClose: () => void;
}

const CodeViewerModal: React.FC<CodeViewerModalProps> = ({ isOpen, filePath, content, initialLine, onClose }) => {
  if (!isOpen) return null;

  const lines = content.split('\n');

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" dir="ltr">
      <div className="w-full max-w-6xl h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="h-14 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700 min-w-0">
            <FileCode2 className="w-4 h-4 shrink-0" />
            <code className="text-xs font-mono truncate">{filePath}</code>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-[calc(85vh-56px)] overflow-auto bg-slate-900 text-slate-200 font-mono text-xs">
          {lines.map((line, idx) => {
            const lineNo = idx + 1;
            const highlight = initialLine && Math.abs(lineNo - initialLine) <= 1;
            return (
              <div key={lineNo} className={`grid grid-cols-[64px_1fr] ${highlight ? 'bg-brand-500/20' : ''}`}>
                <div className="text-right px-3 py-0.5 text-slate-500 select-none border-r border-slate-800">{lineNo}</div>
                <pre className="px-3 py-0.5 whitespace-pre-wrap break-words">{line || ' '}</pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CodeViewerModal;
