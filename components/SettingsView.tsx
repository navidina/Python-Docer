
import React, { useState } from 'react';
import { OllamaConfig } from '../types';
import { Server, Cpu, Database, CheckCircle2, XCircle, RotateCcw, Zap, UserCog, Briefcase, Trash2, ShieldAlert, Globe2, Save, Sparkles } from 'lucide-react';
import { checkOllamaConnection } from '../services/ollamaService';
import { PERSONA_BLOCKCHAIN_ARCHITECT, DEFAULT_MODEL, DEFAULT_EMBEDDING_MODEL, OLLAMA_DEFAULT_URL } from '../utils/constants';
import { deleteDB } from 'idb';

interface SettingsViewProps {
  config: OllamaConfig;
  setConfig: (config: OllamaConfig) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ config, setConfig }) => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');

  const handleCheckConnection = async () => {
    setStatus('checking');
    const isConnected = await checkOllamaConnection(config);
    if (isConnected) {
      setStatus('connected');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
    }
  };

  const handleReset = () => {
    setConfig({
      baseUrl: OLLAMA_DEFAULT_URL,
      model: DEFAULT_MODEL,
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      persona: ''
    });
    setStatus('idle');
  };

  const handleClearData = async () => {
    if (window.confirm('آیا مطمئن هستید؟ تمام مستندات ذخیره شده، کش فایل‌ها و تغییرات دستی پاک خواهند شد.')) {
        try {
            localStorage.removeItem('rayan_docs_session');
            localStorage.removeItem('rayan_manual_overrides');
            localStorage.removeItem('rayan_chat_history');
            localStorage.removeItem('rayan_file_cache');
            
            await deleteDB('rayan-meta-db');
            await deleteDB('rayan-vector-store');
            
            alert('تمامی داده‌ها با موفقیت پاک شدند. برای مشاهده تغییرات به داشبورد برگردید.');
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert('خطا در پاکسازی داده‌ها.');
        }
    }
  };

  return (
    <div className="w-full max-w-5xl space-y-6 pb-12">
      
      {/* 1. Connection Card (Hero) */}
      <div className="bg-white rounded-[2.5rem] p-10 shadow-soft border border-white relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-64 h-64 bg-brand-50 rounded-br-[6rem] -z-0 transition-transform group-hover:scale-105 duration-700"></div>
        <div className="absolute top-4 left-4 opacity-10">
            <Globe2 className="w-32 h-32 text-brand-500" />
        </div>
        
        <div className="flex flex-col md:flex-row gap-8 relative z-10">
          <div className="flex-1">
             <div className="flex items-center gap-4 mb-6">
                <div className="bg-gradient-to-br from-brand-100 to-brand-50 p-4 rounded-2xl text-brand-600 shadow-sm border border-brand-100">
                    <Server className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-800">اتصال به LM Studio</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">تنظیمات سرور محلی و پورت ارتباطی</p>
                </div>
             </div>

             <div className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3 mr-1">آدرس سرور (Base URL)</label>
                    <div className="relative group">
                    <input 
                        type="text" 
                        value={config.baseUrl} 
                        onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 pl-14 text-slate-600 font-mono text-left dir-ltr focus:ring-4 focus:ring-brand-500/10 focus:border-brand-400 transition-all outline-none font-bold text-lg"
                        placeholder="e.g., http://192.168.167.18:1234"
                    />
                    <div className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-300 pointer-events-none">
                        <Globe2 className="w-6 h-6" />
                    </div>
                    </div>
                </div>

                {status === 'error' && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-4 animate-in slide-in-from-top-2">
                        <div className="bg-white p-2 rounded-xl text-red-500 shadow-sm"><ShieldAlert className="w-6 h-6" /></div>
                        <div className="text-sm text-red-700 leading-relaxed">
                        <p className="font-bold mb-1">خطا در برقراری ارتباط!</p>
                        <p className="opacity-80">لطفاً مطمئن شوید LM Studio اجرا شده و تنظیمات CORS فعال هستند. پورت پیش‌فرض 1234 می‌باشد.</p>
                        </div>
                    </div>
                )}
             </div>
          </div>

          <div className="flex flex-col justify-end gap-4 min-w-[200px]">
             <button 
                onClick={handleCheckConnection}
                disabled={status === 'checking'}
                className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 ${
                    status === 'connected' ? 'bg-emerald-500 text-white shadow-emerald-500/30' :
                    status === 'error' ? 'bg-red-500 text-white shadow-red-500/30' :
                    'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-brand-500/30'
                }`}
                >
                {status === 'checking' && <RotateCcw className="w-5 h-5 animate-spin" />}
                {status === 'connected' && <CheckCircle2 className="w-5 h-5" />}
                {status === 'error' && <XCircle className="w-5 h-5" />}
                
                {status === 'checking' ? 'بررسی...' : 
                status === 'connected' ? 'اتصال موفق' : 
                status === 'error' ? 'تلاش مجدد' : 'تست اتصال'}
            </button>
            <button 
                onClick={handleReset}
                className="w-full py-4 rounded-2xl font-bold text-sm bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
            >
                <RotateCcw className="w-4 h-4" />
                بازنشانی تنظیمات
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 2. Models Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white flex flex-col h-full">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-accent-pink/10 p-3 rounded-2xl text-accent-pink border border-accent-pink/20">
                    <Cpu className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">مدل‌های هوش مصنوعی</h3>
                    <p className="text-sm text-slate-400">موتور پردازش متن و وکتور</p>
                </div>
            </div>

            <div className="space-y-6 flex-1">
                <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                        <Zap className="w-4 h-4 text-brand-500" /> مدل اصلی (Generation)
                    </label>
                    <input 
                        type="text" 
                        value={config.model} 
                        onChange={(e) => setConfig({...config, model: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-600 font-mono text-left dir-ltr focus:ring-2 focus:ring-brand-200 outline-none transition-all font-medium"
                    />
                </div>
                <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                        <Database className="w-4 h-4 text-accent-blue" /> مدل امبدینگ (Embedding)
                    </label>
                    <input 
                        type="text" 
                        value={config.embeddingModel} 
                        onChange={(e) => setConfig({...config, embeddingModel: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-600 font-mono text-left dir-ltr focus:ring-2 focus:ring-brand-200 outline-none transition-all font-medium"
                    />
                </div>
            </div>
        </div>

        {/* 3. Persona Card */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white flex flex-col h-full">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-brand-100 p-3 rounded-2xl text-brand-600 border border-brand-200">
                    <UserCog className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">پرسونا (شخصیت)</h3>
                    <p className="text-sm text-slate-400">تخصص و لحن دستیار</p>
                </div>
            </div>

            <div className="space-y-4 flex-1 flex flex-col">
                <textarea 
                    value={config.persona}
                    onChange={(e) => setConfig({...config, persona: e.target.value})}
                    placeholder="دستورالعمل سیستم (System Prompt)..."
                    className="w-full flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-700 text-sm focus:ring-2 focus:ring-brand-200 outline-none transition-all resize-none min-h-[120px]"
                />
                <div className="flex gap-2">
                    <button 
                        onClick={() => setConfig({...config, persona: ''})}
                        className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                        پیش‌فرض
                    </button>
                    <button 
                        onClick={() => setConfig({...config, persona: PERSONA_BLOCKCHAIN_ARCHITECT})}
                        className="px-4 py-2 rounded-xl bg-brand-50 text-xs font-bold text-brand-600 border border-brand-100 hover:bg-brand-100 transition-colors flex items-center gap-1"
                    >
                        <Briefcase className="w-3 h-3"/> معمار بلاکچین
                    </button>
                </div>
            </div>
        </div>
      </div>

       {/* 4. Danger Zone */}
       <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white border-r-4 border-r-red-400 overflow-hidden relative">
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-red-50 to-transparent pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
                <div className="bg-red-100 p-4 rounded-2xl text-red-500 shadow-inner">
                    <Trash2 className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">منطقه خطر</h3>
                    <p className="text-sm text-slate-400 mt-1">پاکسازی کامل دیتابیس، کش فایل‌ها و تاریخچه چت‌ها</p>
                </div>
            </div>
            
            <button 
                onClick={handleClearData}
                className="whitespace-nowrap px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
            >
                <Trash2 className="w-4 h-4" />
                حذف تمام داده‌ها
            </button>
        </div>
      </div>

    </div>
  );
};

export default SettingsView;
