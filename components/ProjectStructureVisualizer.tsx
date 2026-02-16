
import React, { useMemo, useRef, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ProcessedFile } from '../types';
import { Maximize2, Minimize2, Share2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ProjectStructureVisualizerProps {
  fileMap: Record<string, ProcessedFile>;
}

const ProjectStructureVisualizer: React.FC<ProjectStructureVisualizerProps> = ({ fileMap }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateDims = () => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.offsetWidth,
                height: isFullscreen ? window.innerHeight - 40 : 500
            });
        }
    };
    window.addEventListener('resize', updateDims);
    setTimeout(updateDims, 500);
    return () => window.removeEventListener('resize', updateDims);
  }, [isFullscreen]);

  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const paths = new Set<string>();
    
    nodes.push({ id: 'ROOT', name: 'Project Root', group: 'root', val: 20, color: '#facc15' });

    Object.values(fileMap).forEach((file: ProcessedFile) => {
        const parts = file.path.split('/');
        let currentPath = '';

        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            const parentPath = currentPath || 'ROOT';
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!paths.has(currentPath)) {
                paths.add(currentPath);
                let group = 'folder';
                let color = '#64748b'; 
                let val = 5;

                if (isFile) {
                    group = 'file';
                    val = 2; 
                    if (part.endsWith('.tsx') || part.endsWith('.ts')) color = '#38bdf8'; 
                    else if (part.endsWith('.css') || part.endsWith('.scss')) color = '#f472b6'; 
                    else if (part.endsWith('.json')) color = '#fbbf24'; 
                    else if (part.endsWith('.js') || part.endsWith('.jsx')) color = '#facc15'; 
                    else if (part.endsWith('.md')) color = '#fff'; 
                    else color = '#94a3b8'; 
                } else {
                    if (part === 'src') { color = '#ef4444'; val = 10; } 
                    else if (part === 'components') { color = '#f97316'; val = 8; } 
                    else if (part === 'hooks' || part === 'services') { color = '#8b5cf6'; val = 8; } 
                }

                nodes.push({ id: currentPath, name: part, group, val, color, fullPath: currentPath, lines: isFile ? file.lines : 0 });
                links.push({ source: parentPath, target: currentPath, color: '#334155' });
            }
        });
    });
    return { nodes, links };
  }, [fileMap]);

  const handleZoomIn = () => fgRef.current?.zoom(fgRef.current.zoom() * 1.2, 400);
  const handleZoomOut = () => fgRef.current?.zoom(fgRef.current.zoom() * 0.8, 400);
  const handleReset = () => fgRef.current?.zoomToFit(400);

  if (Object.keys(fileMap).length === 0) return null;

  return (
    <div className={`mt-8 bg-[#0f172a] rounded-[2.5rem] overflow-hidden border border-slate-700 shadow-2xl relative transition-all duration-500 group ring-4 ring-slate-900/5 ${isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : 'h-[500px]'}`} ref={containerRef}>
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none z-10 bg-gradient-to-b from-[#0f172a] to-transparent">
            <div>
                <h3 className="text-white font-black text-xl flex items-center gap-2 drop-shadow-md tracking-tight">
                    <Share2 className="w-5 h-5 text-brand-400" />
                    Project Galaxy
                </h3>
                <p className="text-slate-400 text-[10px] font-bold mt-1 pl-7 tracking-wider uppercase opacity-70">
                   Interactive File System • {graphData.nodes.length} Nodes
                </p>
            </div>
            
            <div className="flex flex-col gap-2 pointer-events-auto">
                <div className="flex gap-1.5 bg-slate-800/60 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-lg">
                    <button onClick={handleZoomIn} className="p-2 hover:bg-white/10 rounded-xl text-slate-300 transition-colors"><ZoomIn className="w-4 h-4"/></button>
                    <button onClick={handleZoomOut} className="p-2 hover:bg-white/10 rounded-xl text-slate-300 transition-colors"><ZoomOut className="w-4 h-4"/></button>
                    <button onClick={handleReset} className="p-2 hover:bg-white/10 rounded-xl text-slate-300 transition-colors"><RotateCcw className="w-4 h-4"/></button>
                </div>
                <button 
                    onClick={() => setIsFullscreen(!isFullscreen)} 
                    className="self-end p-3 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl shadow-lg shadow-brand-500/20 transition-all border border-brand-400/50 hover:scale-105 active:scale-95"
                >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
            </div>
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-6 pointer-events-none z-10 space-y-2">
             <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 p-4 rounded-[1.5rem] flex flex-col gap-2.5 text-[10px] text-slate-300 shadow-xl">
                 <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div> Root</div>
                 <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div> Folder</div>
                 <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-sky-400"></div> TypeScript</div>
                 <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-pink-400"></div> Styles</div>
             </div>
        </div>

        <div className="cursor-grab active:cursor-grabbing w-full h-full">
            <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                backgroundColor="#0f172a"
                nodeLabel="name"
                nodeColor="color"
                nodeRelSize={4}
                linkColor={() => '#334155'}
                linkWidth={1}
                d3VelocityDecay={0.1}
                cooldownTicks={100}
                onEngineStop={() => fgRef.current?.zoomToFit(400, 50)}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    const label = node.name;
                    const fontSize = 12/globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    
                    if (node.group === 'root' || node.val > 8) {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
                        ctx.fillStyle = node.color;
                        ctx.globalAlpha = 0.2;
                        ctx.fill();
                        ctx.globalAlpha = 1.0;
                    }

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
                    ctx.fillStyle = node.color;
                    ctx.fill();

                    if (globalScale > 1.2 || node.val > 5) {
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.fillText(label, node.x, node.y + node.val + 2);
                    }
                }}
            />
        </div>
    </div>
  );
};

export default ProjectStructureVisualizer;
