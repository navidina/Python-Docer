import React, { useEffect, useRef } from 'react';
import { X, Copy, Check, FileCode2 } from 'lucide-react';

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  content: string;
  highlightLine?: number;
}

const CodeViewerModal: React.FC<CodeViewerModalProps> = ({ isOpen, onClose, fileName, content, highlightLine }) => {
  const [copied, setCopied] = React.useState(false);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && highlightLine && lineRef.current) {
      setTimeout(() => {
        lineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isOpen, highlightLine]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = content.split('\n');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1E293B] w-full max-w-5xl h-[85vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-[#0F172A]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200 font-mono">{fileName}</h3>
              <span className="text-xs text-slate-500">{lines.length} lines</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
              {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar relative bg-[#0F172A]">
          <div className="flex min-w-max text-sm font-mono leading-6">
            <div className="flex flex-col items-end px-4 py-6 text-slate-600 select-none bg-[#0F172A] border-r border-slate-800/50 sticky left-0 z-10">
              {lines.map((_, i) => (
                <span
                  key={i}
                  className={`h-6 ${i + 1 === highlightLine ? 'text-blue-400 font-bold' : ''}`}
                >
                  {i + 1}
                </span>
              ))}
            </div>

            <div className="flex flex-col px-6 py-6 text-slate-300 w-full">
              {lines.map((line, i) => (
                <div
                  key={i}
                  ref={i + 1 === highlightLine ? lineRef : null}
                  className={`h-6 whitespace-pre w-full ${i + 1 === highlightLine ? 'bg-blue-500/20 -mx-6 px-6 border-l-2 border-blue-500' : ''}`}
                >
                  {line || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeViewerModal;
