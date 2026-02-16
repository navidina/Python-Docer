
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, Loader2, ZoomIn, ZoomOut, RefreshCcw, Download, RotateCcw } from 'lucide-react';
import mermaid from 'mermaid';

const cleanCodeForRender = (rawCode: string): string => {
  if (!rawCode) return '';
  let code = rawCode.replace(/```mermaid/gi, '').replace(/```/g, '').trim();
  code = code.replace(/\["([^"]*)"\]/g, (match, content) => `["${content.replace(/"/g, "'")}"]`);
  if (code.toLowerCase().includes('erdiagram')) {
      code = code.replace(/\bidentifying\b/gi, '');
      code = code.replace(/([a-zA-Z0-9_]+)\s+([|o}]+--[|o{]+)\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_" ]+)/g, '$1 $2 $3 : "$4"');
  }
  if (code.toLowerCase().includes('classdiagram')) {
      code = code.replace(/<([a-zA-Z0-9_]+)>/g, '~$1~');
  }
  return code;
};

const MermaidRenderer = React.memo(({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const renderId = useRef(`mermaid-${Math.random().toString(36).substring(2, 9)}`);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    try {
        mermaid.initialize({ 
            startOnLoad: false, 
            theme: 'base',
            maxTextSize: 500000, 
            securityLevel: 'loose',
            suppressErrorRendering: true,
            themeVariables: { 
              fontFamily: 'Vazirmatn', 
              fontSize: '14px',
              primaryColor: '#f8fafc',
              edgeLabelBackground: '#ffffff',
              tertiaryColor: '#f1f5f9'
            },
            er: { useMaxWidth: false },
            flowchart: { useMaxWidth: false, htmlLabels: true }
        });
    } catch(e) { console.warn("Mermaid init warning:", e); }
    return () => { mountedRef.current = false; };
  }, []);

  const handleSvgClick = (e: React.MouseEvent) => {
      if (isDragging) return;
      const target = e.target as HTMLElement;
      const nodeGroup = target.closest('.node');
      if (nodeGroup) {
          const text = (nodeGroup.querySelector('.nodeLabel') || nodeGroup.querySelector('text'))?.textContent?.trim();
          if (text) {
              const el = document.getElementById(text.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
              if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  el.classList.add('bg-yellow-100', 'transition-colors', 'duration-1000');
                  setTimeout(() => el.classList.remove('bg-yellow-100'), 2000);
              }
          }
      }
  };

  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 5));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.2));
  const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isError) return;
    e.preventDefault();
    setIsDragging(false);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    setIsDragging(true);
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => { setTimeout(() => setIsDragging(false), 50); };

  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(s => Math.min(Math.max(s + delta, 0.1), 5));
      }
  };

  const renderDiagram = useCallback(async (codeToRender: string) => {
    if (!codeToRender || !codeToRender.trim()) {
        if(mountedRef.current) setIsRendering(false);
        return;
    }
    
    if(mountedRef.current) {
        setIsRendering(true);
        setIsError(false);
        setErrorMsg('');
    }

    try {
      let cleanCode = cleanCodeForRender(codeToRender);
      if (!cleanCode.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/)) {
          cleanCode = `flowchart TB\n${cleanCode}`;
      }

      const existing = document.getElementById(renderId.current);
      if (existing) existing.remove();

      const renderPromise = mermaid.render(renderId.current, cleanCode);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000));

      // @ts-ignore
      const { svg } = await Promise.race([renderPromise, timeoutPromise]);
      
      if(mountedRef.current) {
          setSvg(svg);
          setIsRendering(false);
      }
    } catch (error: any) {
      if(mountedRef.current) {
          if (!codeToRender.includes(':::')) {
               setIsError(true);
               setErrorMsg(error.message || 'Syntax Error');
               setSvg('');
          } else {
               try {
                  const simplified = codeToRender
                    .replace(/:::[a-zA-Z0-9_\-]+/g, '')
                    .replace(/^classDef\s+.*$/gm, '')
                    .replace(/^style\s+.*$/gm, '');
                  const { svg: svg2 } = await mermaid.render(renderId.current + '-retry', simplified);
                  setSvg(svg2);
               } catch(e) {
                  setIsError(true);
                  setErrorMsg('Failed after retry');
               }
          }
          setIsRendering(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (code && code.trim()) renderDiagram(code);
        else setIsRendering(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [code, renderDiagram]);

  if (!code || !code.trim()) {
      return <div className="flex items-center justify-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200"><span className="text-xs text-slate-400">No Data</span></div>;
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 p-6 rounded-[2rem] text-left dir-ltr my-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
           <p className="text-red-600 text-sm font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Mermaid Syntax Error</p>
           <button onClick={() => renderDiagram(code)} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"><RotateCcw className="w-3 h-3" /> Retry</button>
        </div>
        <div className="text-red-500 text-[10px] mb-3 font-mono leading-relaxed bg-white/50 p-2 rounded max-h-20 overflow-auto">{errorMsg}</div>
        <details><summary className="text-[10px] text-slate-400 cursor-pointer">View Raw Code</summary><pre className="text-slate-500 text-[10px] font-mono overflow-auto whitespace-pre-wrap bg-slate-100 p-3 rounded-xl max-h-40 border border-slate-200 mt-2">{code}</pre></details>
      </div>
    );
  }

  return (
    <div className="relative group my-10">
      <div 
        className="bg-white rounded-[2.5rem] overflow-hidden shadow-soft border border-slate-100 select-none relative transition-all hover:shadow-lg ring-4 ring-slate-50/50" 
        dir="ltr"
        style={{ height: '600px' }}
      >
         {isRendering && (
             <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-300">
                 <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
                 <span className="text-sm text-slate-500 font-bold tracking-wide">Rendering Graph...</span>
             </div>
         )}
         
         <div className="absolute top-6 right-6 z-20 flex flex-col gap-1.5 bg-white/90 backdrop-blur-xl p-1.5 rounded-2xl shadow-xl border border-slate-100 transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-300">
            <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors" title="Zoom In"><ZoomIn className="w-5 h-5" /></button>
            <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors" title="Zoom Out"><ZoomOut className="w-5 h-5" /></button>
            <button onClick={handleReset} className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors" title="Reset"><RefreshCcw className="w-5 h-5" /></button>
            <div className="h-px bg-slate-100 mx-1 my-1"></div>
            <button onClick={handleDownload} className="p-2 hover:bg-slate-100 rounded-xl text-brand-600 transition-colors" title="Download SVG"><Download className="w-5 h-5" /></button>
         </div>

         <div 
           ref={containerRef}
           className={`w-full h-full flex items-center justify-center overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
           onMouseDown={handleMouseDown}
           onMouseMove={handleMouseMove}
           onMouseUp={handleMouseUp}
           onMouseLeave={handleMouseUp}
           onWheel={handleWheel}
           onClick={handleSvgClick}
         >
            {svg && (
                <div 
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
                    transformOrigin: 'center center'
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
                />
            )}
         </div>
      </div>
      <div className="flex justify-between items-center px-6 mt-3">
         <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Interactive Diagram</span>
         <span className="text-[10px] text-brand-300 font-mono">Mermaid v11</span>
      </div>
    </div>
  );
});

export default MermaidRenderer;
