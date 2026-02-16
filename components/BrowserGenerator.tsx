
import React, { useState, useRef, useEffect } from 'react';
import { File as FileIcon, Folder, Loader2, Download, Code, Sparkles, LayoutDashboard, Minimize2, Maximize2, Skull, RotateCw, ChevronRight, ChevronLeft, Layers, Database, ListChecks, GitMerge, CheckCircle2, FileText, Check, Github } from 'lucide-react';
import { OllamaConfig } from '../types';
import { LocalVectorStore } from '../services/vectorStore';
import { useRepoProcessor } from '../hooks/useRepoProcessor';
import { useChat } from '../hooks/useChat';
import MarkdownRenderer from './MarkdownRenderer';

interface BrowserGeneratorProps {
  config: OllamaConfig;
}

const BentoDashboard = ({ stats, docParts, knowledgeGraph, archViolations, fileMap }: any) => {
    const docKeys = ['root', 'arch', 'api', 'erd', 'sequence'];
    const generatedCount = docKeys.filter(k => docParts[k]).length;
    const progress = Math.round((generatedCount / docKeys.length) * 100);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="md:col-span-2 bg-gradient-to-br from-brand-600 to-brand-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-brand-900/20 group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000"></div>
                <div className="relative z-10">
                    <h3 className="text-3xl font-black mb-2">داشبورد وضعیت پروژه</h3>
                    <p className="text-brand-100 mb-8 opacity-90 font-medium">گزارش لحظه‌ای از تحلیل کد توسط موتور پایتون</p>
                    
                    <div className="flex items-center gap-4 mb-2">
                        <span className="text-xs font-bold uppercase tracking-widest opacity-70">پیشرفت مستندات</span>
                        <span className="text-2xl font-black">{progress}%</span>
                    </div>
                    <div className="w-full bg-black/20 h-4 rounded-full overflow-hidden backdrop-blur-sm border border-white/10 p-0.5">
                        <div className="h-full rounded-full bg-gradient-to-r from-white to-brand-100 transition-all duration-1000 ease-out relative shadow-[0_0_20px_rgba(255,255,255,0.5)]" style={{ width: `${progress}%` }}>
                            <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white flex flex-col justify-center">
                 <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-100 text-center hover:scale-105 transition-transform col-span-2">
                         <div className="text-emerald-400 text-[10px] font-bold uppercase mb-1">ماژول‌های تکمیل شده</div>
                         <div className="text-3xl font-black text-emerald-600">{generatedCount} / {docKeys.length}</div>
                     </div>
                 </div>
            </div>

            <div className="md:col-span-3 bg-white rounded-[2.5rem] p-8 shadow-soft border border-white">
                <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-500" />
                    وضعیت ماژول‌های مستندات
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {docKeys.map((key) => {
                        const isDone = !!docParts[key];
                        return (
                            <div key={key} className={`p-4 rounded-2xl border ${isDone ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'} transition-all hover:scale-105`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>}
                                    <span className={`text-xs font-bold uppercase ${isDone ? 'text-emerald-700' : 'text-slate-500'}`}>{key}</span>
                                </div>
                                <div className={`h-1.5 rounded-full ${isDone ? 'bg-emerald-200' : 'bg-slate-200'}`}></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const BrowserGenerator: React.FC<BrowserGeneratorProps> = ({ config }) => {
  const [inputType, setInputType] = useState<'local' | 'github'>('local');
  const [repoPath, setRepoPath] = useState(''); // Text input for local path
  const [githubUrl, setGithubUrl] = useState('');
  
  const [docLevels, setDocLevels] = useState({
    root: true, arch: true, api: true, erd: true, sequence: true
  });

  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(true);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const vectorStoreRef = useRef<LocalVectorStore | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const { logs, isProcessing, error, dismissError, progress, generatedDoc, hasContext, processRepository, stats, knowledgeGraph, docParts, businessRules, archViolations, zombieFiles, currentFile, saveManualOverride, fileMap } = useRepoProcessor();
  
  const { chatMessages, chatInput, setChatInput, isChatLoading, isRetrieving, handleSendMessage } = useChat(
      config, vectorStoreRef, hasContext, knowledgeGraph, docParts
  );

  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    if (isProcessing) setIsHudOpen(true);
  }, [isProcessing]);

  const handleStartProcessing = async () => {
    // Pass repoPath instead of files
    await processRepository({ config, inputType, files: null, repoPath, githubUrl, docLevels, vectorStoreRef });
    setActiveSection('dashboard');
  };

  const handleAskAI = (text: string) => { setChatInput(text); setIsChatOpen(true); };

  const downloadMarkdown = () => {
    const order = ['root', 'arch', 'api', 'erd', 'sequence'];
    let combinedMarkdown = '';
    order.forEach(key => {
        if (docParts[key]) {
            let title = key.toUpperCase();
            if (key === 'root') title = "INTRODUCTION";
            combinedMarkdown += `\n\n# ${title}\n\n${docParts[key]}\n\n---\n`;
        }
    });
    const blob = new Blob([combinedMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DOCUMENTATION.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sidebar Nav Item
  const NavItem = ({ icon: Icon, label, active, onClick, collapsed, alert, isPrimary }: any) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-300 group relative my-1.5 border border-transparent ${
        active 
          ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/30' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-100'
      } ${isPrimary ? 'mb-6 py-4' : ''}`}
      title={collapsed ? label : ''}
    >
      <div className={`p-2 rounded-xl transition-colors ${
          active 
          ? 'bg-white/20 text-white' 
          : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-brand-600 group-hover:shadow-sm'
      }`}>
         <Icon className={`w-5 h-5`} />
      </div>
      {!collapsed && (
          <div className="flex-1 flex items-center justify-between">
            <span className={`font-bold text-sm tracking-wide ${active ? 'text-white' : ''}`}>{label}</span>
             {alert && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>}
          </div>
      )}
    </button>
  );

  // Status HUD
  const ProcessingHUD = () => (
    <div className={`fixed bottom-6 left-6 z-[50] transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) bg-slate-900 text-white rounded-[2rem] border border-slate-700/50 shadow-2xl overflow-hidden flex flex-col ${isHudOpen ? 'w-[400px]' : 'w-72'} ${error ? 'border-red-500/50 shadow-red-900/20' : 'shadow-black/40'}`}>
       <div 
         className={`p-4 flex items-center justify-between cursor-pointer ${isHudOpen ? 'bg-slate-800/50 border-b border-slate-700/50' : 'bg-transparent'}`}
         onClick={() => setIsHudOpen(!isHudOpen)}
       >
          <div className="flex items-center gap-3">
             {error ? (
                 <Skull className="w-5 h-5 text-red-500 animate-pulse" />
             ) : (
                 <div className="relative">
                    <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                 </div>
             )}
             <div className="flex flex-col text-left dir-ltr">
                 <span className={`text-xs font-bold font-mono ${error ? 'text-red-400' : 'text-white'}`}>
                     {error ? 'Process Failed' : `Processing... ${Math.round(progress)}%`}
                 </span>
             </div>
          </div>
          <button className="text-slate-500 hover:text-white transition-colors">
              {isHudOpen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
       </div>
       {isHudOpen && (
          <div className="p-5 bg-slate-900/95 backdrop-blur text-left dir-ltr">
             {error ? (
                <div className="space-y-4">
                   <div className="text-red-400 text-xs leading-relaxed bg-red-950/30 p-3 rounded-xl border border-red-900/50">
                     {error}
                   </div>
                   <button onClick={dismissError} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors border border-slate-700 flex items-center justify-center gap-2">
                     <RotateCw className="w-3 h-3" /> Dismiss & Continue
                   </button>
                </div>
             ) : (
                <div className="space-y-4">
                   <div>
                       <div className="flex justify-between text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider font-bold">
                          <span>Current Action</span>
                          <span>{Math.round(progress)}%</span>
                       </div>
                       <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/50">
                          <div className="h-full bg-gradient-to-r from-brand-600 to-cyan-400 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                       </div>
                   </div>
                   <div className="bg-black/40 rounded-xl border border-slate-800 h-32 flex flex-col relative overflow-hidden">
                       <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar flex flex-col-reverse">
                           {logs.slice().reverse().map((log, i) => (
                             <div key={i} className={`flex gap-2 text-[10px] font-mono ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                <span>{'>'}</span> <span className="break-all">{log.message}</span>
                             </div>
                           ))}
                       </div>
                   </div>
                </div>
             )}
          </div>
       )}
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-100/50 overflow-hidden rounded-[2.5rem] shadow-glass border border-white/60 relative mx-4 mb-4 backdrop-blur-xl">
        <input type="file" ref={importInputRef} style={{ display: 'none' }} accept=".json" onChange={(e) => {}} />

        {/* Sidebar */}
        <aside className={`${isSidebarOpen ? 'w-80' : 'w-24'} bg-white border-l border-slate-100 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col z-20 shadow-2xl shadow-slate-200/50 relative h-full`}>
            <div className="px-6 pt-8 pb-4">
                <div className="flex items-center justify-between mb-4">
                    {isSidebarOpen && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h2 className="font-black text-xl text-slate-800">تحلیل سیستم (Python)</h2>
                        </div>
                    )}
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all border border-slate-100">
                        {isSidebarOpen ? <ChevronRight className="w-4 h-4"/> : <ChevronLeft className="w-4 h-4"/>}
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar space-y-1">
                <NavItem icon={LayoutDashboard} label="داشبورد وضعیت" active={activeSection === 'dashboard'} onClick={() => setActiveSection('dashboard')} collapsed={!isSidebarOpen} isPrimary={true} />
                {docParts.root && <NavItem icon={FileIcon} label="معرفی (README)" active={activeSection === 'root'} onClick={() => setActiveSection('root')} collapsed={!isSidebarOpen} />}
                
                {isSidebarOpen && <div className="text-[10px] font-bold text-slate-400 mt-6 mb-3 px-2 flex items-center gap-2"><span>معماری و داده</span><div className="h-px bg-slate-100 flex-1"></div></div>}
                
                {docParts.arch && <NavItem icon={Layers} label="معماری سیستم" active={activeSection === 'arch'} onClick={() => setActiveSection('arch')} collapsed={!isSidebarOpen} />}
                {docParts.erd && <NavItem icon={Database} label="دیتابیس (ERD)" active={activeSection === 'erd'} onClick={() => setActiveSection('erd')} collapsed={!isSidebarOpen} />}
                {docParts.api && <NavItem icon={ListChecks} label="مستندات API" active={activeSection === 'api'} onClick={() => setActiveSection('api')} collapsed={!isSidebarOpen} />}
                {docParts.sequence && <NavItem icon={GitMerge} label="نمودار توالی" active={activeSection === 'sequence'} onClick={() => setActiveSection('sequence')} collapsed={!isSidebarOpen} />}
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-white space-y-3">
               {generatedDoc && (
                   <button onClick={downloadMarkdown} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 group active:scale-95">
                      <Download className="w-4 h-4 group-hover:animate-bounce" /> 
                      {isSidebarOpen && <span>دانلود Markdown</span>}
                   </button>
               )}
            </div>
        </aside>

        <main className="flex-1 relative overflow-hidden flex flex-col">
            <header className="h-20 bg-white/40 backdrop-blur-md flex items-center px-8 justify-between z-10 border-b border-white/50">
                <div>
                   <h2 className="font-extrabold text-slate-800 text-xl flex items-center gap-2 capitalize">
                     {activeSection === 'dashboard' ? 'نمای کلی' : activeSection}
                   </h2>
                   <p className="text-xs text-slate-400 font-medium mt-1">نسخه قدرت گرفته از موتور پایتون</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
                {(isProcessing || error) && <ProcessingHUD />}
                
                {!generatedDoc && !hasContext && !isProcessing && !error ? (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-3xl mx-auto space-y-10 animate-in zoom-in-95 duration-500 pb-20">
                        {/* LANDING STATE */}
                        <div>
                            <h2 className="text-5xl font-black text-slate-800 mb-6 tracking-tight leading-tight">تحلیل کد با <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-pink">موتور پایتون</span></h2>
                            <p className="text-slate-500 leading-relaxed text-lg font-medium max-w-xl mx-auto">ارتباط مستقیم با Local Backend برای تحلیل عمیق و سریع</p>
                        </div>
                        
                        {/* INPUT MODE TOGGLE */}
                        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex gap-1 mb-6">
                            <button 
                                onClick={() => setInputType('local')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${inputType === 'local' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                پوشه محلی (Local)
                            </button>
                            <button 
                                onClick={() => setInputType('github')}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${inputType === 'github' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                گیت‌هاب (GitHub)
                            </button>
                        </div>

                        <div className="w-full grid grid-cols-1 md:grid-cols-1 gap-6 max-w-lg">
                            {inputType === 'local' ? (
                                <div className={`group bg-white p-8 rounded-[2.5rem] border-2 transition-all duration-300 relative overflow-hidden border-brand-500 shadow-xl shadow-brand-500/10 scale-[1.02]`}>
                                    <div className="relative z-10 text-right">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors bg-brand-500 text-white shadow-lg shadow-brand-500/30`}>
                                            <Folder className="w-7 h-7" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">آدرس پروژه (Local Path)</h3>
                                        <p className="text-sm text-slate-400 font-medium mb-6">مسیر کامل پوشه پروژه را وارد کنید (Backend نیاز دارد)</p>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={repoPath} 
                                                onChange={(e) => setRepoPath(e.target.value)} 
                                                placeholder="e.g. C:\Projects\MyReactApp or /home/user/code" 
                                                className="w-full py-4 px-4 bg-slate-50 rounded-xl text-left dir-ltr outline-none border-2 border-slate-200 focus:border-brand-400 focus:bg-white transition-all font-mono text-sm placeholder:text-slate-300 text-slate-600"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className={`group bg-white p-8 rounded-[2.5rem] border-2 transition-all duration-300 relative overflow-hidden border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md`}>
                                    <div className="relative z-10 text-right">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors bg-slate-900 text-white shadow-lg`}>
                                            <Github className="w-7 h-7" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">لینک ریپازیتوری (GitHub)</h3>
                                        <p className="text-sm text-slate-400 font-medium mb-6">لینک عمومی پروژه در گیت‌هاب را وارد کنید</p>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={githubUrl} 
                                                onChange={(e) => setGithubUrl(e.target.value)} 
                                                placeholder="https://github.com/username/repo" 
                                                className="w-full py-4 px-4 bg-slate-50 rounded-xl text-left dir-ltr outline-none border-2 border-slate-200 focus:border-slate-900 focus:bg-white transition-all font-mono text-sm placeholder:text-slate-300 text-slate-600"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 w-full max-w-md mx-auto">
                            <button 
                                onClick={handleStartProcessing} 
                                disabled={isProcessing || (inputType === 'local' ? !repoPath : !githubUrl)} 
                                className="flex-1 py-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                            >
                                <Sparkles className="w-5 h-5" />
                                ارسال به موتور پایتون
                            </button>
                        </div>
                    </div>
                ) : (
                    // MAIN CONTENT AREA (AFTER PROCESSING)
                    <div className="max-w-[1400px] mx-auto pb-32">
                        {activeSection === 'dashboard' ? (
                            <BentoDashboard 
                                stats={stats} 
                                docParts={docParts} 
                                knowledgeGraph={knowledgeGraph} 
                                archViolations={archViolations} 
                                fileMap={fileMap} 
                            />
                        ) : (
                             <div className="bg-white rounded-[2.5rem] p-12 shadow-soft border border-white prose prose-slate max-w-none dir-rtl prose-headings:font-extrabold prose-p:text-slate-600 prose-img:rounded-3xl">
                                 {docParts[activeSection] ? (
                                     <MarkdownRenderer 
                                        content={docParts[activeSection]} 
                                        knowledgeGraph={knowledgeGraph}
                                        sectionId={activeSection}
                                        onSave={saveManualOverride}
                                        isEditable={true}
                                        onAskAI={handleAskAI}
                                        showTOC={true} 
                                     />
                                 ) : <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                                     <Loader2 className="w-10 h-10 animate-spin opacity-50"/>
                                     در حال آماده‌سازی محتوا...
                                 </div>}
                             </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    </div>
  );
};

export default BrowserGenerator;
