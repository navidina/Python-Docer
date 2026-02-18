
import React, { useState, useEffect } from 'react';
import { Settings, Github, Cpu, LayoutGrid, Sliders, Zap } from 'lucide-react';
import BrowserGenerator from './components/BrowserGenerator';
import SettingsView from './components/SettingsView';
import { AppMode, OllamaConfig } from './types';
import { DEFAULT_MODEL, DEFAULT_EMBEDDING_MODEL, OLLAMA_DEFAULT_URL } from './utils/constants';

const CONFIG_STORAGE_KEY = 'rayan_ollama_config';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.DASHBOARD);
  
  // Lifted Config State with Persistence
  const [config, setConfig] = useState<OllamaConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (savedConfig) {
          return JSON.parse(savedConfig);
        }
      } catch (error) {
        console.warn('Failed to load config from storage, using defaults.', error);
      }
    }
    return {
      baseUrl: OLLAMA_DEFAULT_URL,
      model: DEFAULT_MODEL,
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      persona: '' // Default empty persona
    };
  });

  // Save config to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#eef3f9] overflow-x-hidden selection:bg-brand-200 selection:text-brand-900" dir="rtl">
      {/* Background Decor */}
      <div className="fixed top-[-25%] right-[-12%] w-[700px] h-[700px] bg-brand-200/40 rounded-full blur-[120px] opacity-40 pointer-events-none"></div>
      <div className="fixed bottom-[-22%] left-[20%] w-[620px] h-[620px] bg-accent-blue/10 rounded-full blur-[100px] opacity-50 pointer-events-none"></div>

      {/* Top Header */}
      <header className="sticky top-0 z-50 px-6 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1700px] h-24 flex items-center justify-between">
          
          {/* Logo Section */}
          <div className="flex items-center gap-5">
            <div className="bg-gradient-to-br from-accent-orange to-orange-500 p-3.5 rounded-2xl shadow-lg shadow-orange-500/30 text-white transition-transform cursor-pointer hover:scale-105">
              <Cpu className="w-8 h-8" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-black tracking-tighter text-slate-800 flex items-center gap-2 leading-none">
                رایان <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand-700 to-brand-500">هم‌افزا</span>
              </h1>
              <p className="text-[11px] text-slate-500 font-bold tracking-widest opacity-80 mt-1 flex items-center gap-1">
                <Zap className="w-3 h-3 text-accent-orange" />
                Intelligent Documentation
              </p>
            </div>
          </div>
          
          {/* Navigation Capsules */}
          <nav className="flex items-center bg-slate-100 p-1.5 rounded-[1rem] border border-slate-200 shadow-inner">
            <button
              onClick={() => setMode(AppMode.DASHBOARD)}
              className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                mode === AppMode.DASHBOARD 
                  ? 'bg-white text-brand-700 shadow-md ring-1 ring-slate-200 scale-105' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              داشبورد
            </button>
            <button
              onClick={() => setMode(AppMode.SETTINGS)}
              className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                mode === AppMode.SETTINGS 
                  ? 'bg-white text-brand-700 shadow-md ring-1 ring-slate-200 scale-105' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              تنظیمات
            </button>
          </nav>

          {/* User/Social */}
          <div className="flex items-center gap-3">
             <div className="hidden md:flex h-12 px-6 rounded-2xl bg-white text-slate-700 shadow-sm border border-slate-200 items-center justify-center font-bold text-sm gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                پروژه فعال
             </div>
             <a 
               href="https://github.com" 
               target="_blank" 
               rel="noreferrer" 
               className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-accent-orange hover:border-orange-300 hover:shadow-md hover:scale-105 transition-all group"
               aria-label="View source on GitHub"
             >
                <Github className="w-5 h-5 group-hover:rotate-12 transition-transform" />
             </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-5 overflow-hidden z-10">
        <div className="max-w-[1600px] mx-auto h-full">
          {mode === AppMode.DASHBOARD ? (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
              <div className="flex-1 min-h-0">
                <BrowserGenerator config={config} />
              </div>
            </div>
          ) : (
             <div className="h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-8 duration-700 flex flex-col items-center custom-scrollbar pb-20">
               <div className="mb-10 text-center relative w-full pt-8">
                 <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[500px] h-40 bg-brand-400/20 blur-[90px] rounded-full -z-10"></div>
                <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight flex items-center justify-center gap-4">
                  <div className="p-3.5 bg-white rounded-2xl shadow-md rotate-3 border border-slate-100"><Sliders className="w-8 h-8 text-brand-600" /></div>
                  تنظیمات سیستم
                </h2>
                <p className="text-slate-500 max-w-lg mx-auto text-lg leading-relaxed font-medium">
                  پیکربندی پیشرفته موتور هوش مصنوعی و اتصال به شبکه عصبی محلی
                </p>
              </div>
               <SettingsView config={config} setConfig={setConfig} />
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
