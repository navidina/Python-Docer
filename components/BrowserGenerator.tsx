import React, { useState, useRef, useEffect } from 'react';
import { File as FileIcon, Folder, Loader2, Download, Code, Sparkles, LayoutDashboard, Minimize2, Maximize2, Skull, RotateCw, ChevronRight, ChevronLeft, Layers, Database, ListChecks, GitMerge, CheckCircle2, FileText, Check, Github, Component, ServerCog, Terminal, Play, MessageSquare, Network } from 'lucide-react';
import { OllamaConfig, AppMode } from '../types';
import { LocalVectorStore } from '../services/vectorStore';
import { useRepoProcessor } from '../hooks/useRepoProcessor';
import { useChat } from '../hooks/useChat';
import MarkdownRenderer from './MarkdownRenderer';
import LiveVisualization from './LiveVisualization';
import ProjectStructureVisualizer from './ProjectStructureVisualizer';
import Playground from './Playground';
import ApiExplorerView from './ApiExplorerView';
import CodeViewerModal from './CodeViewerModal';

interface BrowserGeneratorProps {
  config: OllamaConfig;
}

const BentoDashboard = ({ stats, docParts, knowledgeGraph, archViolations, fileMap, codeHealth }: any) => {
    // Added 'setup' to tracked doc keys
    const docKeys = ['root', 'setup', 'arch', 'erd', 'sequence', 'api', 'components', 'api_ref'];
    const completedDocs = docKeys.filter(k => docParts[k] && docParts[k].length > 50).length;
    const progress = (completedDocs / docKeys.length) * 100;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-5 h-[500px] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 1. Main Stats (Large) */}
            <div className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-brand-700 to-brand-500 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                
                <div className="flex justify-between items-start mb-12 relative z-10">
                    <div>
                        <h3 className="text-3xl font-black tracking-tight mb-1">Overview</h3>
                        <p className="text-brand-100 font-medium opacity-80">Project Pulse</p>
                    </div>
                    <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                       <ActivityGraph data={[40, 65, 50, 80, 55, 90, 70]} color="white" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 relative z-10">
                    {stats.map((stat: any, i: number) => (
                        <div key={i}>
                            <p className="text-brand-100/80 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                            <p className="text-4xl font-black">{stat.value}</p>
                        </div>
                    ))}
                    <div>
                        <p className="text-brand-100/80 text-xs font-bold uppercase tracking-widest mb-1">Doc Progress</p>
                        <div className="flex items-baseline gap-2">
                             <p className="text-4xl font-black">{Math.round(progress)}%</p>
                             <span className="text-sm opacity-60">complete</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Architecture Health */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2.5 rounded-2xl ${archViolations.length > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                        {archViolations.length > 0 ? <Skull className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <span className="font-bold text-slate-700">System Health</span>
                </div>
                <div>
                    <div className="text-3xl font-black text-slate-800 mb-1">
                        {archViolations.length > 0 ? `${archViolations.length} Issues` : 'Clean'}
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                        {archViolations.length > 0 ? 'Architecture violations detected' : 'No architecture violations'}
                    </p>
                    {codeHealth?.length > 0 && (
                        <p className="text-[10px] text-amber-600 mt-2 font-bold">Hotspots: {codeHealth.length}</p>
                    )}
                </div>
            </div>

            {/* 3. Knowledge Graph Stats */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-500">
                        <Network className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-700">Code Graph</span>
                </div>
                <div>
                    <div className="text-3xl font-black text-slate-800 mb-1">
                        {Object.keys(knowledgeGraph).length}
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Symbols Indexed</p>
                </div>
            </div>

            {/* 4. Generation Status (Wide) */}
            <div className="md:col-span-2 bg-slate-50 rounded-[2.5rem] p-6 border border-slate-200/60 flex items-center justify-between">
                <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 w-full">
                    {docKeys.map(key => (
                        <div key={key} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border shrink-0 transition-all ${
                            docParts[key] 
                            ? 'bg-white border-brand-200 text-brand-700 shadow-sm' 
                            : 'bg-slate-100 border-transparent text-slate-400 opacity-50'
                        }`}>
                            {docParts[key] ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span className="uppercase">{key.replace('_', ' ')}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ProjectOverviewRenderer = ({ content, knowledgeGraph, onFileClick }: { content: string; knowledgeGraph: any; onFileClick?: (path: string, line?: number) => void }) => {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines.find(l => l.startsWith('#'))?.replace(/^#+\s*/, '') || 'معرفی پروژه';
    const firstParagraph = lines.find(l => !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('*') && !l.startsWith('|') && !l.startsWith('```')) || 'این بخش خلاصه‌ای از هدف، دامنه و ارزش پروژه را نمایش می‌دهد.';
    const bullets = lines.filter(l => l.startsWith('- ') || l.startsWith('* ')).slice(0, 6).map(l => l.replace(/^[-*]\s*/, ''));

    const extractBulletParts = (bullet: string) => {
        const sourceMatch = bullet.match(/\[\[[^\]]+\]\]$/);
        const source = sourceMatch ? sourceMatch[0] : '';
        const withoutSource = source ? bullet.replace(source, '').trim() : bullet;

        const strongMatch = withoutSource.match(/^\*\*(.+?)\*\*[:：]?\s*(.*)$/);
        if (strongMatch) {
            return {
                title: strongMatch[1].trim(),
                description: strongMatch[2].trim(),
                source
            };
        }

        return {
            title: withoutSource,
            description: '',
            source
        };
    };

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-brand-100 bg-gradient-to-l from-brand-50/70 to-white p-6">
                <h2 className="text-2xl font-black text-slate-800 mb-3">{title}</h2>
                <p className="text-slate-600 leading-8">{firstParagraph}</p>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-white border border-slate-100 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">نوع محتوا</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">شناخت سریع پروژه</p>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-100 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">تمرکز</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">دامنه، قابلیت‌ها، راه‌اندازی</p>
                    </div>
                    <div className="rounded-2xl bg-white border border-slate-100 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">منبع</p>
                        <p className="text-sm font-bold text-slate-700 mt-1">خلاصه مستند تولیدشده</p>
                    </div>
                </div>
            </div>

            {bullets.length > 0 && (
                <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/60 p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-xl font-extrabold text-slate-800">نکات کلیدی پروژه</h3>
                        <span className="text-[11px] text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full font-bold">{bullets.length} نکته</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {bullets.map((b, i) => {
                            const item = extractBulletParts(b);
                            return (
                                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-brand-200 transition-all">
                                    <div className="flex items-start gap-3">
                                        <div className="w-7 h-7 shrink-0 rounded-full bg-brand-600 text-white text-xs font-black flex items-center justify-center">{i + 1}</div>
                                        <div className="min-w-0">
                                            <p className="text-slate-800 font-extrabold leading-7 text-[15px]">{item.title}</p>
                                            {item.description && (
                                                <p className="text-slate-600 text-sm leading-7 mt-1">{item.description}</p>
                                            )}
                                            {item.source && (
                                                <div className="mt-2 text-[11px] text-brand-700 font-mono bg-brand-50 border border-brand-100 px-2 py-1 rounded-lg inline-block">
                                                    {item.source}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="rounded-3xl border border-slate-100 bg-white p-6">
                <h3 className="text-lg font-extrabold text-slate-800 mb-4">جزئیات کامل</h3>
                <MarkdownRenderer content={content} knowledgeGraph={knowledgeGraph} isEditable={true} sectionId="root" showTOC={true} onFileClick={onFileClick} />
            </div>
        </div>
    );
};

// Mini Component for Sparkline
const ApiJsonRenderer = ({ content, onFileClick }: { content: string; onFileClick?: (path: string, line?: number) => void }) => {
    const parseApiJson = (raw: string) => {
        const direct = raw.trim();
        const candidates: string[] = [direct];

        const fenceMatch = direct.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

        const firstObj = direct.indexOf('{');
        const lastObj = direct.lastIndexOf('}');
        if (firstObj >= 0 && lastObj > firstObj) {
            candidates.push(direct.slice(firstObj, lastObj + 1));
        }

        // Some model outputs start from "endpoints": [...] without outer braces.
        if (/^"?endpoints"?\s*:/i.test(direct)) {
            candidates.push(`{${direct}}`);
        }

        for (const candidate of candidates) {
            try {
                return JSON.parse(candidate);
            } catch {
                // try next
            }
        }

        return null;
    };

    const parsed = parseApiJson(content);
    if (!parsed) return <MarkdownRenderer content={content} onFileClick={onFileClick} />;

    try {
        const endpoints = Array.isArray(parsed?.endpoints) ? parsed.endpoints : [];
        if (!endpoints.length) return <MarkdownRenderer content={content} onFileClick={onFileClick} />;

        return (
            <div className="space-y-6" dir="ltr">
                {endpoints.map((ep: any, i: number) => (
                    <div key={`${ep.method}-${ep.path}-${i}`} className="border border-slate-200 rounded-2xl p-5 bg-white">
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <span className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white">{ep.method || 'METHOD'}</span>
                            <code className="text-sm font-mono text-slate-700">{ep.path || '/'}</code>
                            {ep.source && <span className="text-[11px] text-brand-600 font-mono">{ep.source}</span>}
                        </div>
                        {ep.summary && <p className="text-sm text-slate-600 mb-4">{ep.summary}</p>}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-bold text-slate-700 mb-2 text-sm">Request Body</h4>
                                <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                                    <thead className="bg-slate-50 text-slate-600">
                                        <tr><th className="p-2 text-left">Field</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Req</th><th className="p-2 text-left">Desc</th></tr>
                                    </thead>
                                    <tbody>
                                        {(ep.requestBody?.fields || []).map((f: any, fi: number) => (
                                            <tr key={fi} className="border-t border-slate-100">
                                                <td className="p-2 font-mono">{f.name}</td><td className="p-2">{f.type}</td><td className="p-2">{String(!!f.required)}</td><td className="p-2">{f.desc || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-700 mb-2 text-sm">Response</h4>
                                <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                                    <thead className="bg-slate-50 text-slate-600">
                                        <tr><th className="p-2 text-left">Field</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Req</th><th className="p-2 text-left">Desc</th></tr>
                                    </thead>
                                    <tbody>
                                        {(ep.response?.fields || []).map((f: any, fi: number) => (
                                            <tr key={fi} className="border-t border-slate-100">
                                                <td className="p-2 font-mono">{f.name}</td><td className="p-2">{f.type}</td><td className="p-2">{String(!!f.required)}</td><td className="p-2">{f.desc || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    } catch {
        return <MarkdownRenderer content={content} onFileClick={onFileClick} />;
    }
};

const ActivityGraph = ({ data, color }: any) => (
    <div className="flex items-end gap-1 h-8">
        {data.map((h: number, i: number) => (
            <div key={i} className="w-1.5 rounded-full opacity-60" style={{ height: `${h}%`, backgroundColor: color }}></div>
        ))}
    </div>
);

const BrowserGenerator: React.FC<BrowserGeneratorProps> = ({ config }) => {
  const [inputType, setInputType] = useState<'local' | 'github'>('local');
  const [repoPath, setRepoPath] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  
  // Updated docLevels to include 'setup'
  const [docLevels, setDocLevels] = useState({
    root: true,
    setup: true,
    arch: true,
    erd: true,
    sequence: true,
    api: true,
    components: true,
    api_ref: true,
    examples: true,
    testing: true,
    smart_audit: false
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'docs' | 'chat' | 'diagrams' | 'code' | 'api_explorer'>('dashboard');
  const [selectedDocSection, setSelectedDocSection] = useState<string>('root');

  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeModalPath, setCodeModalPath] = useState('');
  const [codeModalContent, setCodeModalContent] = useState('');
  const [codeModalLine, setCodeModalLine] = useState<number | undefined>(undefined);

  const docSections = [
    { id: 'root', label: 'نمای کلی پروژه' },
    { id: 'setup', label: 'راهنمای راه‌اندازی' },
    { id: 'arch', label: 'معماری' },
    { id: 'api_ref', label: 'مرجع API' },
    { id: 'components', label: 'کامپوننت‌ها' },
    { id: 'examples', label: 'مثال‌های کد' },
    { id: 'testing', label: 'راهنمای تست' },
    { id: 'erd', label: 'پایگاه داده' },
  ];
  
  const vectorStoreRef = useRef<LocalVectorStore | null>(null);

  const {
    isProcessing,
    progress,
    logs,
    error,
    dismissError,
    generatedDoc,
    docParts,
    hasContext,
    stats,
    knowledgeGraph,
    codeHealth,
    archViolations,
    zombieFiles,
    fileMap,
    processRepository,
    saveManualOverride,
    reanalyzeFile
  } = useRepoProcessor();

  const { chatMessages, chatInput, setChatInput, isChatLoading, isRetrieving, handleSendMessage } = useChat(
      config, 
      vectorStoreRef, 
      hasContext,
      knowledgeGraph,
      docParts
  );


  const resolveCandidatePaths = (clickedPath: string) => {
    const normalized = clickedPath.replace(/^\.\//, '').trim();
    const base = normalized.split('/').pop() || normalized;
    const candidates = new Set<string>([clickedPath, normalized, base]);

    Object.values(knowledgeGraph || {}).forEach((sym: any) => {
      const fp = sym?.filePath;
      if (!fp || typeof fp !== 'string') return;
      if (fp === normalized || fp.endsWith('/' + normalized) || fp.endsWith('/' + base) || fp === base) {
        candidates.add(fp);
      }
    });

    return Array.from(candidates).filter(Boolean);
  };

  const handleFileClick = async (path: string, line?: number) => {
    const candidates = resolveCandidatePaths(path);
    for (const candidate of candidates) {
      try {
        const resp = await fetch('http://localhost:8000/get-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: candidate })
        });

        if (!resp.ok) continue;
        const data = await resp.json();
        if (data?.content) {
          setCodeModalPath(data.path || candidate);
          setCodeModalContent(String(data.content));
          setCodeModalLine(line);
          setIsCodeModalOpen(true);
          return;
        }
      } catch {
        // try next candidate
      }
    }

    alert(`File not found in backend index: ${path}`);
  };

  const handleStart = () => {
    processRepository({
        config,
        inputType,
        repoPath,
        githubUrl,
        docLevels,
        vectorStoreRef
    });
  };

  const handleDownload = () => {
      // Reconstruct full doc from current parts to include edits
      let fullContent = "";
      const order = ['root', 'setup', 'arch', 'erd', 'sequence', 'api', 'components', 'examples', 'testing', 'api_ref', 'smart_audit'];
      
      order.forEach(key => {
          if (docParts[key]) {
              fullContent += docParts[key] + "\n\n---\n\n";
          }
      });

      if (!fullContent) {
          if (generatedDoc) {
             fullContent = generatedDoc; // Fallback
          } else {
             alert("هنوز مستنداتی تولید نشده است.");
             return;
          }
      }

      const blob = new Blob([fullContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documentation-${new Date().toISOString().slice(0,10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  // --- RENDER HELPERS ---

  const renderSidebar = () => (
    <div className="w-20 lg:w-64 bg-white border-l border-slate-200 shadow-sm rounded-[2rem] flex flex-col py-8 shrink-0 h-[calc(100vh-140px)] sticky top-24 ml-6 transition-all duration-500">
        
        {/* Mobile/Tablet Icon Mode vs Desktop Text Mode */}
        <div className="flex flex-col gap-2 px-3 lg:px-6">
            {[
                { id: 'dashboard', icon: LayoutDashboard, label: 'داشبورد' },
                { id: 'docs', icon: FileText, label: 'مستندات' },
                { id: 'diagrams', icon: GitMerge, label: 'دیاگرام‌ها' },
                { id: 'code', icon: Code, label: 'تحلیل کد' },
                { id: 'chat', icon: MessageSquare, label: 'چت هوشمند' },
                { id: 'api_explorer', icon: ServerCog, label: 'کاوشگر API' },
            ].map(item => (
                <div key={item.id}>
                    <button
                        onClick={() => setActiveTab(item.id as any)}
                        className={`w-full flex items-center gap-3 p-3 lg:px-5 lg:py-4 rounded-2xl transition-all duration-300 group relative ${
                            activeTab === item.id 
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30 scale-105' 
                            : 'text-slate-500 hover:bg-slate-100 hover:text-brand-600'
                        }`}
                    >
                        <item.icon className={`w-6 h-6 ${activeTab === item.id ? 'animate-pulse' : ''}`} />
                        <span className="hidden lg:block font-bold text-sm tracking-wide">{item.label}</span>
                        {activeTab === item.id && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full"></div>}
                    </button>

                    {item.id === 'docs' && (
                        <div className="hidden lg:block mt-2 mr-8 space-y-1">
                            {docSections.map(sec => (
                                <button
                                    key={sec.id}
                                    onClick={() => { setActiveTab('docs'); setSelectedDocSection(sec.id); }}
                                    className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                        activeTab === 'docs' && selectedDocSection === sec.id
                                        ? 'bg-brand-50 text-brand-700 border border-brand-100'
                                        : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    {sec.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>

    </div>
  );

  const renderConfiguration = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-10">
            <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tighter">آنالیز پروژه جدید</h2>
            <p className="text-slate-500 text-lg font-medium">مسیر پروژه را وارد کنید تا هوش مصنوعی آن را تحلیل کند</p>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-bl-[4rem] transition-transform group-hover:scale-110"></div>
            
            <div className="flex gap-4 mb-6 relative z-10">
                <button 
                    onClick={() => setInputType('local')}
                    className={`flex-1 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${inputType === 'local' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                    <Folder className="w-4 h-4" /> Local Folder
                </button>
                <button 
                    onClick={() => setInputType('github')}
                    className={`flex-1 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${inputType === 'github' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                    <Github className="w-4 h-4" /> GitHub Repo
                </button>
            </div>

            <div className="relative z-10">
                {inputType === 'local' ? (
                    <div className="flex gap-2">
                        <div className="bg-slate-100 p-4 rounded-2xl text-slate-400"><Terminal className="w-6 h-6" /></div>
                        <input 
                            type="text" 
                            value={repoPath}
                            onChange={(e) => setRepoPath(e.target.value)}
                            placeholder="Absolute path to your project (e.g., C:\Projects\MyApp)"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 font-mono text-sm text-slate-700 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all dir-ltr text-left"
                        />
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <div className="bg-slate-100 p-4 rounded-2xl text-slate-400"><Github className="w-6 h-6" /></div>
                        <input 
                            type="text" 
                            value={githubUrl}
                            onChange={(e) => setGithubUrl(e.target.value)}
                            placeholder="username/repository"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 font-mono text-sm text-slate-700 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all dir-ltr text-left"
                        />
                    </div>
                )}
            </div>
        </div>

        {/* Modules Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
                { id: 'root', label: 'Readme & Intro', icon: FileText },
                { id: 'setup', label: 'Setup Guide', icon: Terminal }, // NEW
                { id: 'arch', label: 'Architecture', icon: Layers },
                { id: 'erd', label: 'Database ERD', icon: Database },
                { id: 'sequence', label: 'Flows', icon: GitMerge },
                { id: 'api', label: 'API Graph', icon: ServerCog },
                { id: 'components', label: 'Components', icon: Component },
                { id: 'api_ref', label: 'API Reference', icon: ListChecks },
            ].map(mod => (
                <button
                    key={mod.id}
                    onClick={() => setDocLevels(prev => ({ ...prev, [mod.id]: !prev[mod.id as keyof typeof docLevels] }))}
                    className={`p-4 rounded-[2rem] border text-right transition-all duration-300 flex flex-col justify-between h-32 group ${
                        docLevels[mod.id as keyof typeof docLevels] 
                        ? 'bg-white border-brand-500 shadow-lg shadow-brand-500/10 ring-4 ring-brand-500/5' 
                        : 'bg-white border-slate-100 opacity-60 hover:opacity-100 hover:border-slate-300'
                    }`}
                >
                    <div className={`p-2.5 w-fit rounded-xl mb-3 transition-colors ${docLevels[mod.id as keyof typeof docLevels] ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <mod.icon className="w-5 h-5" />
                    </div>
                    <span className={`font-bold text-xs ${docLevels[mod.id as keyof typeof docLevels] ? 'text-slate-800' : 'text-slate-400'}`}>
                        {mod.label}
                    </span>
                </button>
            ))}
        </div>

        <button 
            onClick={handleStart}
            disabled={isProcessing}
            className="w-full py-6 bg-gradient-to-r from-accent-orange to-orange-500 text-white rounded-[2rem] font-bold text-lg shadow-2xl shadow-slate-900/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {isProcessing ? (
                <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="font-mono">{progress}% Processing...</span>
                </>
            ) : (
                <>
                    <Sparkles className="w-6 h-6 text-brand-400" />
                    شروع تحلیل هوشمند
                </>
            )}
        </button>

        {logs.length > 0 && (
            <div className="bg-black/90 rounded-3xl p-6 font-mono text-[10px] text-green-400 h-48 overflow-y-auto custom-scrollbar shadow-inner border border-white/10 dir-ltr text-left">
                {logs.map((log, i) => (
                    <div key={i} className="mb-1 opacity-80">
                        <span className="text-slate-500 mr-2">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                        <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-brand-400' : ''}>
                            {log.message}
                        </span>
                    </div>
                ))}
            </div>
        )}

        {error && (
             <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4">
                 <div className="flex items-center gap-3">
                     <Skull className="w-5 h-5" />
                     <span className="font-bold text-sm">{error}</span>
                 </div>
                 <button onClick={dismissError}><Check className="w-5 h-5" /></button>
             </div>
        )}
    </div>
  );

  // --- MAIN RENDER ---

  if (!hasContext) {
      return (
          <div className="min-h-full flex items-center justify-center p-6">
              {renderConfiguration()}
          </div>
      );
  }

  return (
    <div className="flex h-full gap-6 relative bg-slate-50/70 rounded-[2rem] p-4 border border-slate-200">
        {renderSidebar()}
        
        <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pb-20 pt-2 px-3">
            
            {activeTab === 'dashboard' && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between mb-8">
                         <div>
                            <h2 className="text-3xl font-black text-slate-800">داشبورد پروژه</h2>
                            <p className="text-slate-500 font-medium">نمای کلی وضعیت کد و مستندات</p>
                         </div>
                         <button 
                            onClick={handleStart} 
                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 hover:border-brand-200 transition-all flex items-center gap-2"
                         >
                             <RotateCw className="w-4 h-4" /> تحلیل مجدد
                         </button>
                    </div>

                    <BentoDashboard 
                        stats={stats} 
                        docParts={docParts} 
                        knowledgeGraph={knowledgeGraph} 
                        archViolations={archViolations} 
                        fileMap={fileMap} 
                        codeHealth={codeHealth} 
                    />

                    {/* Quick Access to Main Docs */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
                             <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                 <FileText className="w-5 h-5 text-brand-500" /> پیش‌نمایش معرفی
                             </h3>
                             <div className="h-64 overflow-y-auto custom-scrollbar opacity-80 text-sm">
                                 <MarkdownRenderer content={docParts['root'] || 'Generating...'} onFileClick={handleFileClick} />
                             </div>
                         </div>
                         <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-200">
                             <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                 <Network className="w-5 h-5 text-blue-500" /> گراف دانش
                             </h3>
                             <div className="h-64 rounded-2xl overflow-hidden relative">
                                  <LiveVisualization knowledgeGraph={knowledgeGraph} archViolations={archViolations} zombieFiles={zombieFiles} />
                             </div>
                         </div>
                    </div>
                </div>
            )}

            {activeTab === 'docs' && (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-4">
                    <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div>
                            <p className="text-xs text-slate-400 font-bold">بخش انتخاب‌شده</p>
                            <p className="text-sm font-extrabold text-slate-700">{docSections.find(s => s.id === selectedDocSection)?.label || 'مستندات'}</p>
                        </div>
                        <button 
                            onClick={handleDownload}
                            className="py-2.5 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 hover:scale-[1.02] transition-transform"
                        >
                            <Download className="w-4 h-4" /> خروجی مستند
                        </button>
                    </div>

                    <div className="bg-white rounded-[2rem] p-6 lg:p-10 shadow-sm border border-slate-200 min-h-[800px]">
                        {docParts[selectedDocSection] ? (
                            selectedDocSection === 'api_ref'
                                ? <ApiJsonRenderer content={docParts[selectedDocSection]} onFileClick={handleFileClick} />
                                : selectedDocSection === 'root'
                                    ? <ProjectOverviewRenderer content={docParts[selectedDocSection]} knowledgeGraph={knowledgeGraph} onFileClick={handleFileClick} />
                                    : <MarkdownRenderer 
                                        content={docParts[selectedDocSection]} 
                                        knowledgeGraph={knowledgeGraph} 
                                        isEditable={true}
                                        sectionId={selectedDocSection}
                                        onSave={saveManualOverride}
                                        showTOC={true}
                                        onFileClick={handleFileClick}
                                    />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4">
                                <Loader2 className="w-12 h-12 animate-spin" />
                                <span className="font-bold">در حال تولید بخش {docSections.find(s => s.id === selectedDocSection)?.label || selectedDocSection} ...</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'diagrams' && (
                <div className="animate-in fade-in zoom-in-95 duration-500 space-y-8">
                     <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
                        <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                            <Layers className="w-6 h-6 text-brand-500" /> 3D Architecture
                        </h2>
                        <div className="h-[600px] rounded-[2rem] overflow-hidden border border-slate-100">
                             <LiveVisualization knowledgeGraph={knowledgeGraph} archViolations={archViolations} zombieFiles={zombieFiles} />
                        </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {['erd', 'sequence', 'api', 'arch'].map(key => (
                            docParts[key] && docParts[key].includes('```mermaid') && (
                                <div key={key} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                                     <div className="flex justify-between items-center mb-6">
                                         <h3 className="font-bold text-lg capitalize">{key} Diagram</h3>
                                         <span className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-mono">Mermaid</span>
                                     </div>
                                     <MarkdownRenderer content={docParts[key]} onFileClick={handleFileClick} />
                                </div>
                            )
                        ))}
                     </div>
                </div>
            )}

            {activeTab === 'code' && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 mb-8">
                         <h2 className="text-2xl font-black text-slate-800 mb-2">Project Structure</h2>
                         <ProjectStructureVisualizer fileMap={fileMap} />
                    </div>
                    
                    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
                         <h2 className="text-2xl font-black text-slate-800 mb-6">Playground</h2>
                         <Playground />
                    </div>
                </div>
            )}


            {activeTab === 'api_explorer' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"> 
                    <ApiExplorerView content={docParts['api_ref'] || ''} />
                </div>
            )}

            {activeTab === 'chat' && (
                 <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                     <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex justify-between items-center backdrop-blur-md">
                         <div>
                             <h3 className="font-bold text-lg text-slate-800">دستیار هوشمند پروژه</h3>
                             <p className="text-xs text-slate-400">چت پروژه‌محور با زمینه کد و مستندات</p>
                         </div>
                         <div className="flex gap-2">
                             <span className="text-[10px] bg-brand-50 text-brand-600 px-3 py-1.5 rounded-full font-bold border border-brand-100">
                                 {config.model}
                             </span>
                         </div>
                     </div>

                     <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
                         {chatMessages.map((msg, idx) => (
                             <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-brand-600 text-white'}`}>
                                     {msg.role === 'user' ? <Terminal className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                                 </div>
                                 <div className={`p-5 rounded-[1.5rem] max-w-[80%] shadow-sm text-sm leading-relaxed ${
                                     msg.role === 'user' 
                                     ? 'bg-white text-slate-700 rounded-tr-none border border-slate-100' 
                                     : 'bg-brand-50 text-brand-900 rounded-tl-none border border-brand-100'
                                 }`}>
                                     <MarkdownRenderer content={msg.content} onFileClick={handleFileClick} />
                                 </div>
                             </div>
                         ))}
                         {isChatLoading && (
                             <div className="flex gap-4">
                                 <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-lg">
                                     <Sparkles className="w-5 h-5" />
                                 </div>
                                 <div className="bg-brand-50 p-5 rounded-[1.5rem] rounded-tl-none border border-brand-100 flex items-center gap-2 text-brand-400 font-bold text-xs">
                                     <Loader2 className="w-4 h-4 animate-spin" />
                                     Thinking...
                                 </div>
                             </div>
                         )}
                     </div>

                     <div className="p-6 bg-white border-t border-slate-100">
                         <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
                             <input 
                                type="text" 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Ask about your code (e.g., 'How does auth work?')"
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 pr-14 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                             />
                             <button 
                                onClick={handleSendMessage}
                                disabled={!chatInput.trim() || isChatLoading}
                                className="absolute right-2 p-2.5 bg-brand-600 text-white rounded-xl shadow-lg shadow-brand-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                             >
                                 <ChevronLeft className="w-5 h-5" />
                             </button>
                         </div>
                         <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">
                             Powered by {config.model} • RAG Context Active
                         </p>
                     </div>
                 </div>
            )}
            
        </div>
    
      <CodeViewerModal
        isOpen={isCodeModalOpen}
        filePath={codeModalPath}
        content={codeModalContent}
        initialLine={codeModalLine}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </div>
  );
};

export default BrowserGenerator;
