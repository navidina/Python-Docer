import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import MermaidRenderer from './MermaidRenderer';
import { CodeSymbol } from '../types';
import { ExternalLink, Terminal, FileCode2, Copy } from 'lucide-react';

interface OnFileClick {
  (path: string, line?: number): void;
}

const ApiJsonBlock = ({ jsonText, onFileClick }: { jsonText: string; onFileClick?: OnFileClick }) => {
  try {
    const parsed = JSON.parse(jsonText);
    const endpoints = Array.isArray(parsed?.endpoints) ? parsed.endpoints : [];
    if (!endpoints.length) return null;

    const renderSourceLink = (source: string) => {
      const match = source.match(/\[\[([^:]+):([^:]+):(\d+)\]\]/);

      if (match && onFileClick) {
        const [, name, path, lineStr] = match;
        const line = parseInt(lineStr, 10);

        return (
          <button
            onClick={() => onFileClick(path, line)}
            className="text-[10px] text-brand-600 font-mono bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 hover:bg-brand-100 cursor-pointer inline-flex items-center gap-1 transition-colors"
            title={`View Source: ${path}:${line}`}
          >
            <FileCode2 className="w-3 h-3" />
            {name}
          </button>
        );
      }

      return <span className="text-[10px] text-brand-600 font-mono">{source}</span>;
    };

    return (
      <div className="my-6 border border-slate-200 rounded-[1.5rem] bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <h4 className="text-sm font-black text-slate-700">خلاصه تعاملی API</h4>
        </div>
        <div className="p-5 space-y-5" dir="ltr">
          {endpoints.map((ep: any, i: number) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 hover:border-brand-200 transition-colors">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span
                  className={`px-2 py-1 text-[10px] rounded-md font-bold text-white ${
                    ep.method === 'GET'
                      ? 'bg-blue-600'
                      : ep.method === 'POST'
                      ? 'bg-emerald-600'
                      : ep.method === 'DELETE'
                      ? 'bg-red-600'
                      : 'bg-slate-700'
                  }`}
                >
                  {ep.method || 'METHOD'}
                </span>
                <code className="text-xs text-slate-700 font-bold bg-slate-100 px-2 py-1 rounded">{ep.path}</code>
                {ep.source && renderSourceLink(ep.source)}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <div className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Request</div>
                  <pre className="text-xs text-slate-700 overflow-x-auto">{JSON.stringify(ep.request || {}, null, 2)}</pre>
                </div>
                <div className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Response</div>
                  <pre className="text-xs text-slate-700 overflow-x-auto">{JSON.stringify(ep.response || {}, null, 2)}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } catch {
    return null;
  }
};

const CodeBlock = ({ inline, className, children, onFileClick, ...props }: any) => {
  const codeText = String(children).replace(/\n$/, '');
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1].toLowerCase() : '';
  const isMermaid = lang === 'mermaid';

  if (!inline && isMermaid) {
    return <MermaidRenderer code={codeText} />;
  }

  const isJsonLike = lang === 'json' || codeText.trim().startsWith('{');
  if (!inline && isJsonLike) {
    try {
      const parsed = JSON.parse(codeText);
      if (Array.isArray(parsed?.endpoints)) {
        return <ApiJsonBlock jsonText={codeText} onFileClick={onFileClick} />;
      }
    } catch {
      // fall through
    }
  }

  return (
    <div className="my-6 dir-ltr border border-slate-200 rounded-xl overflow-hidden bg-[#1E293B]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0F172A] border-b border-slate-700">
        <span className="text-xs text-slate-400 font-mono uppercase">{lang || 'TEXT'}</span>
        <button onClick={() => navigator.clipboard.writeText(codeText)} className="text-slate-400 hover:text-white">
          <Copy className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <code className="text-sm font-mono text-slate-300" {...props}>
          {children}
        </code>
      </div>
    </div>
  );
};

interface MarkdownRendererProps {
  content: string;
  knowledgeGraph?: Record<string, CodeSymbol>;
  onFileClick?: OnFileClick;
  // backward compatibility with existing callers in BrowserGenerator
  sectionId?: string;
  onSave?: (newContent: string) => void;
  isEditable?: boolean;
  onAskAI?: (prompt: string) => void;
  showTOC?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onFileClick }) => {
  const processedContent = content.replace(/\[\[([^:\]]+):([^:\]]+):(\d+)\]\]/g, (_m, name, filePath, line) => {
    return `[${name}](code://${filePath}#L${line})`;
  });

  return (
    <div className="w-full text-right" dir="rtl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ href, children }) => {
            if (href && href.startsWith('code://')) {
              const pathInfo = href.replace('code://', '');
              const [filePath, linePart] = pathInfo.split('#L');
              const line = linePart ? parseInt(linePart, 10) : undefined;

              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (onFileClick) onFileClick(filePath, line);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-brand-600 bg-brand-50 border border-brand-100 text-xs font-mono hover:bg-brand-100 cursor-pointer mx-1"
                  title={`View source: ${filePath}`}
                >
                  {children}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </button>
              );
            }
            return (
              <a href={href} className="text-blue-600 underline" target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          code: (props) => <CodeBlock {...props} onFileClick={onFileClick} />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
