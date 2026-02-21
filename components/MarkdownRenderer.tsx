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

const unwrapMarkdownFences = (input: string): string => {
  if (!input) return '';

  // If the whole answer is wrapped in a markdown fence, unwrap it.
  const fullFence = input.match(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fullFence) {
    return fullFence[1];
  }

  // Also unwrap embedded markdown fences that appear inside long sections.
  return input.replace(/```(?:markdown|md)\s*\n([\s\S]*?)\n```/gi, '$1');
};

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


const looksLikeMarkdownContent = (value: string): boolean => {
  const text = value.trim();
  if (!text) return false;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return false;

  const markdownSignals = lines.filter((line) =>
    /^#{1,6}\s/.test(line) ||
    /^[-*+]\s/.test(line) ||
    /^\d+\.\s/.test(line) ||
    /^\|.*\|$/.test(line) ||
    /^\*\*.+\*\*/.test(line) ||
    /^```/.test(line)
  ).length;

  const commentSignals = lines.filter((line) => /^\/\//.test(line)).length;
  const codeSignals = lines.filter((line) =>
    /(import\s+.+from|export\s+|const\s+\w+\s*=|function\s+\w+|class\s+\w+|=>|<\w+[^>]*>|return\s+|;\s*$)/.test(line)
  ).length;

  return (markdownSignals >= 2 || commentSignals >= Math.max(3, Math.floor(lines.length * 0.4))) && codeSignals <= Math.max(3, Math.floor(lines.length * 0.6));
};

const convertCommentedCodeToMixedMarkdown = (value: string, lang: string): string => {
  const lines = value.split('\n');
  const out: string[] = [];
  let codeBucket: string[] = [];

  const flushCode = () => {
    if (!codeBucket.length) return;
    out.push(`\n\`\`\`${lang || 'ts'}`);
    out.push(...codeBucket);
    out.push('\`\`\`\n');
    codeBucket = [];
  };

  for (const raw of lines) {
    const line = raw || '';
    const commentMatch = line.match(/^\s*\/\/\s?(.*)$/);
    if (commentMatch) {
      flushCode();
      out.push(commentMatch[1]);
    } else if (!line.trim()) {
      if (codeBucket.length) codeBucket.push('');
      else out.push('');
    } else {
      codeBucket.push(line);
    }
  }

  flushCode();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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

  // Many model outputs wrap prose in ```markdown ... ```; make that visually light instead of dark code.
  if (!inline && (lang === 'markdown' || lang === 'md')) {
    return <div className="my-5 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 whitespace-pre-wrap">{codeText}</div>;
  }

  // Some responses incorrectly label markdown prose as TS/TSX and prefix narrative lines with //.
  // Convert those blocks into mixed markdown + real fenced code so prose renders normally.
  const codeLikeLang = ['ts', 'tsx', 'typescript', 'js', 'jsx', 'javascript'];
  if (!inline && codeLikeLang.includes(lang) && looksLikeMarkdownContent(codeText)) {
    const mixedMarkdown = convertCommentedCodeToMixedMarkdown(codeText, lang);
    return (
      <div className="my-5 p-5 bg-white border border-slate-200 rounded-xl" dir="rtl">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          h1: ({ children }) => <h1 className="text-2xl font-black text-slate-800 mb-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-extrabold text-slate-800 mb-2 mt-4">{children}</h2>,
          p: ({ children }) => <p className="text-slate-700 mb-3 leading-8">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pr-6 space-y-1.5 mb-3">{children}</ul>,
          li: ({ children }) => <li className="text-slate-700">{children}</li>,
          table: ({ children }) => <div className="overflow-x-auto border border-slate-200 rounded-lg my-3"><table className="min-w-full bg-white">{children}</table></div>,
          th: ({ children }) => <th className="bg-slate-50 p-2 text-xs font-bold border-b border-slate-200">{children}</th>,
          td: ({ children }) => <td className="p-2 text-xs border-b border-slate-100">{children}</td>,
          code: (props) => <CodeBlock {...props} onFileClick={onFileClick} />,
        }}>{mixedMarkdown}</ReactMarkdown>
      </div>
    );
  }

  // Compact single-line snippets (package names, ids, short commands) should not consume full-width cards.
  const trimmed = codeText.trim();
  const isSingleLine = !trimmed.includes('\n');
  const isShortSnippet = trimmed.length > 0 && trimmed.length <= 80;
  const isMostlyToken = /^[a-zA-Z0-9@._\-/]+$/.test(trimmed);
  if (!inline && isSingleLine && isShortSnippet && (lang === '' || lang === 'text' || isMostlyToken)) {
    return (
      <div className="my-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dir-ltr align-middle">
        <code className="text-xs font-mono text-slate-700 break-all">{trimmed}</code>
        <button onClick={() => navigator.clipboard.writeText(trimmed)} className="text-slate-400 hover:text-slate-700 shrink-0">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="my-6 dir-ltr border border-slate-200 rounded-xl overflow-hidden bg-[#1E293B] max-w-full">
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
  const normalizedContent = unwrapMarkdownFences(content);
  const processedContent = normalizedContent.replace(/\[\[([^:\]]+):([^:\]]+):(\d+)\]\]/g, (_m, name, filePath, line) => {
    return `[${name}](code://${filePath}#L${line})`;
  });

  return (
    <div className="w-full text-right leading-8 text-slate-700" dir="rtl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => <h1 className="text-3xl font-black text-slate-900 mb-4 mt-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-extrabold text-slate-800 mt-8 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-bold text-slate-700 mt-6 mb-2">{children}</h3>,
          p: ({ children }) => <p className="mb-4 text-[17px] leading-8 text-slate-600">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pr-6 mb-4 space-y-2 marker:text-brand-500">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pr-6 mb-4 space-y-2 marker:text-brand-500">{children}</ol>,
          li: ({ children }) => <li className="text-slate-700">{children}</li>,
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-full bg-white">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="bg-slate-50 text-slate-700 text-sm font-bold p-3 border-b border-slate-200">{children}</th>,
          td: ({ children }) => <td className="text-sm text-slate-700 p-3 border-b border-slate-100">{children}</td>,
          a: ({ href, children }) => {
            const rawHref = href || '';
            const isCodeScheme = rawHref.startsWith('code://');
            const pathInfo = isCodeScheme ? rawHref.replace('code://', '') : rawHref;
            const [filePath, linePart] = pathInfo.split('#L');
            const line = linePart ? parseInt(linePart, 10) : undefined;

            const looksLikeLocalFile = !!filePath && (
              /\.(ts|tsx|js|jsx|py|java|go|rs|json|md|yml|yaml)$/i.test(filePath) ||
              filePath.includes('/') ||
              filePath.includes('\\')
            ) && !/^https?:\/\//i.test(filePath);

            if ((isCodeScheme || looksLikeLocalFile) && onFileClick) {
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onFileClick(filePath, Number.isNaN(line) ? undefined : line);
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
