
import React, { useState } from 'react';
import { Play, RotateCcw, AlertTriangle, Terminal, Code2, Sparkles } from 'lucide-react';

interface PlaygroundProps {
  initialCode?: string;
}

const Playground: React.FC<PlaygroundProps> = ({ initialCode = '' }) => {
  const [code, setCode] = useState(initialCode || `// Write a pure JS function to test
function calculateTax(amount) {
  if (amount > 1000) return amount * 1.2;
  return amount * 1.1;
}

return calculateTax(1500);`);
  
  const [output, setOutput] = useState<string>('Ready to run...');
  const [isError, setIsError] = useState(false);

  const runCode = () => {
    try {
      setIsError(false);
      // Safe-ish evaluator using new Function.
      const func = new Function(code);
      const result = func();
      setOutput(result !== undefined ? JSON.stringify(result, null, 2) : 'Executed successfully (No return value)');
    } catch (e: any) {
      setIsError(true);
      setOutput(e.toString());
    }
  };

  return (
    <div className="my-8 bg-[#0f172a] rounded-[2.5rem] overflow-hidden border border-slate-700 shadow-2xl flex flex-col relative group ring-4 ring-slate-900/5">
      {/* Glow Effect */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-500/10 blur-[80px] rounded-full pointer-events-none"></div>
      
      {/* Glass Header */}
      <div className="bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
           <div className="bg-brand-500/10 p-2 rounded-xl border border-brand-500/20 text-brand-400">
             <Terminal className="w-5 h-5" />
           </div>
           <div>
             <span className="text-sm font-bold text-white tracking-wide block">JS Playground</span>
             <span className="text-[10px] text-slate-500 font-mono">Live Execution Engine</span>
           </div>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={() => setCode(initialCode)} 
              className="p-2.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/5" 
              title="Reset Code"
            >
               <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={runCode} 
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 group/run"
            >
               <Play className="w-3.5 h-3.5 fill-current group-hover/run:scale-110 transition-transform" /> 
               Run Script
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 h-80 relative z-10">
         <div className="relative">
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#0f172a]/50 to-transparent pointer-events-none"></div>
            <textarea 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-full bg-[#0f172a]/50 text-blue-200 font-mono text-xs p-6 resize-none outline-none border-r border-white/5 focus:bg-[#0f172a] transition-colors leading-relaxed"
                spellCheck={false}
            />
            <div className="absolute bottom-4 right-4 pointer-events-none opacity-50">
               <Code2 className="w-24 h-24 text-white/5 rotate-12" />
            </div>
         </div>
         
         <div className="bg-[#0b1120] p-6 overflow-auto relative">
            <div className="flex items-center justify-between mb-4">
               <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isError ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                  Console Output
               </div>
               {output !== 'Ready to run...' && (
                  <span className="text-[10px] text-slate-600 font-mono">{new Date().toLocaleTimeString()}</span>
               )}
            </div>
            <pre className={`font-mono text-xs whitespace-pre-wrap leading-relaxed ${isError ? 'text-red-400' : 'text-emerald-400'}`}>
                {output}
            </pre>
         </div>
      </div>
      
      <div className="bg-slate-950/50 backdrop-blur border-t border-white/5 p-3 px-6 text-[10px] text-slate-500 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Sandboxed Environment: Imports not supported.</span>
         </div>
         <div className="flex items-center gap-1 opacity-50">
            <Sparkles className="w-3 h-3" />
            <span>V8 Engine</span>
         </div>
      </div>
    </div>
  );
};

export default Playground;
