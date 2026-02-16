import React, { useMemo, useState, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, MeshTransmissionMaterial, Float, Stars, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { CodeSymbol, ArchViolation } from '../types';
import { ShieldAlert, Skull, Activity, Info, X, Box, Network, Layers, ChevronRight } from 'lucide-react';

// Monkey-patch for missing R3F JSX types in current environment
// We augment 'react/jsx-runtime' or 'react' depending on setup.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
      spotLight: any;
      planeGeometry: any;
      gridHelper: any;
      lineSegments: any;
      edgesGeometry: any;
      lineBasicMaterial: any;
      sphereGeometry: any;
      color: any;
    }
  }
}

// Augment React namespace specifically for older TS/React setups or specific configurations
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      ambientLight: any;
      pointLight: any;
      spotLight: any;
      planeGeometry: any;
      gridHelper: any;
      lineSegments: any;
      edgesGeometry: any;
      lineBasicMaterial: any;
      sphereGeometry: any;
      color: any;
    }
  }
}

interface LiveVisualizationProps {
  knowledgeGraph: Record<string, CodeSymbol>;
  archViolations: ArchViolation[];
  zombieFiles: string[];
}

// --- 3D COMPONENTS (Unchanged logic, just keeping structure) ---
const Building = ({ position, size, color, isZombie, onClick, label, isSelected }: any) => {
  const mesh = useRef<THREE.Mesh>(null);
  const [hovered, setHover] = useState(false);
  useFrame((state, delta) => { if (mesh.current && isSelected) mesh.current.rotation.y += delta; });
  return (
    <group position={position}>
      <mesh ref={mesh} position={[0, size[1] / 2, 0]} onClick={(e) => { e.stopPropagation(); onClick(); }} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={isZombie ? '#475569' : (hovered || isSelected) ? '#f472b6' : color} transparent opacity={isZombie ? 0.8 : 1} roughness={isZombie ? 1 : 0.2} metalness={isZombie ? 0 : 0.6} />
      </mesh>
      {(hovered || isSelected) && <Text position={[0, size[1] + 1, 0]} fontSize={0.5} color="white" anchorX="center" anchorY="middle">{label}</Text>}
    </group>
  );
};

const CityScene = ({ data, onNodeClick, selectedNodeId }: any) => (
    <>
        <ambientLight intensity={0.5} />
        <pointLight position={[20, 30, 20]} intensity={1.5} />
        <spotLight position={[-10, 50, -10]} angle={0.3} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.2} />
            <gridHelper args={[200, 50, '#1e293b', '#0f172a']} rotation={[-Math.PI/2, 0, 0]} />
        </mesh>
        {data.map((node: any, idx: number) => (
            <Building key={idx} position={[node.x, 0, node.z]} size={[node.width, node.height, node.width]} color={node.color} isZombie={node.isZombie} label={node.name} onClick={() => onNodeClick(node)} isSelected={selectedNodeId === node.id} />
        ))}
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} maxPolarAngle={Math.PI / 2 - 0.1} />
    </>
);

const LayerPlate = ({ position, color, label, children }: any) => (
    <group position={position}>
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
             <Text position={[-7, 0.5, 0]} fontSize={0.8} color={color} anchorX="right" anchorY="middle" font="https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff">{label}</Text>
        </Float>
        <mesh receiveShadow castShadow>
            <boxGeometry args={[12, 0.5, 12]} />
            {/* @ts-ignore */}
            <MeshTransmissionMaterial backside samples={4} thickness={2} chromaticAberration={0.06} anisotropy={0.1} distortion={0.0} distortionScale={0.3} temporalDistortion={0.5} clearcoat={1} attenuationDistance={0.5} attenuationColor={color} color="#ffffff" background={new THREE.Color("#0f172a")} />
        </mesh>
        <lineSegments position={[0, 0, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(12, 0.5, 12)]} />
            <lineBasicMaterial color={color} transparent opacity={0.3} />
        </lineSegments>
        <group position={[0, 0.5, 0]}>{children}</group>
    </group>
);

const FileOrb = ({ position, color, label, onClick, isSelected }: any) => {
    const [hovered, setHover] = useState(false);
    const scale = hovered || isSelected ? 1.5 : 1;
    return (
        <group position={position}>
            <Float speed={5} rotationIntensity={0.5} floatIntensity={0.5}>
                <mesh onClick={(e) => { e.stopPropagation(); onClick(); }} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} scale={[scale, scale, scale]}>
                    <sphereGeometry args={[0.3, 32, 32]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered || isSelected ? 2 : 0.5} toneMapped={false} />
                </mesh>
            </Float>
            {(hovered || isSelected) && <Text position={[0, 0.8, 0]} fontSize={0.3} color="white" anchorX="center" anchorY="bottom" outlineWidth={0.02} outlineColor="#000">{label}</Text>}
        </group>
    );
};

const ArchitectureStackScene = ({ data, onNodeClick, selectedNodeId }: any) => (
    <>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 20, 10]} angle={0.5} penumbra={1} intensity={2} castShadow />
        <pointLight position={[-10, 10, -10]} intensity={2} color="#4c1d95" />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Sparkles count={50} scale={20} size={4} speed={0.4} opacity={0.5} color="#8b5cf6" />
        <group position={[0, -2, 0]}>
            {data.map((layer: any, i: number) => (
                <LayerPlate key={layer.id} position={[0, i * 4, 0]} color={layer.color} label={layer.label}>
                    {layer.nodes.map((node: any, j: number) => (
                        <FileOrb key={node.id} position={[node.x, 0, node.z]} color={node.color} label={node.name} onClick={() => onNodeClick(node)} isSelected={selectedNodeId === node.id} />
                    ))}
                </LayerPlate>
            ))}
        </group>
        <OrbitControls autoRotate={true} autoRotateSpeed={0.5} enablePan={true} enableZoom={true} maxPolarAngle={Math.PI / 1.5} />
    </>
);

const LiveVisualization: React.FC<LiveVisualizationProps> = ({ knowledgeGraph, archViolations, zombieFiles }) => {
  const [viewMode, setViewMode] = useState<'graph' | 'city' | 'layers'>('graph');
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    }
  }, []);

  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    const symbolList = Object.values(knowledgeGraph) as CodeSymbol[];
    symbolList.forEach(sym => {
      const isZombie = zombieFiles.includes(sym.filePath);
      const violation = archViolations.find(v => v.filePath === sym.filePath);
      const degree = (sym.relationships.calledBy.length || 0) + (sym.relationships.calls.length || 0);
      const val = 4 + (degree * 1.5);
      let group = 'normal';
      let color = '#8b5cf6'; 
      if (isZombie) { group = 'zombie'; color = '#94a3b8'; } 
      else if (violation?.severity === 'critical') { group = 'critical'; color = '#ef4444'; } 
      else if (violation) { group = 'warning'; color = '#f59e0b'; } 
      else if (degree > 10) { group = 'hub'; color = '#fbbf24'; }
      else if (sym.kind === 'class') { color = '#38bdf8'; } 
      else if (sym.kind === 'endpoint') { color = '#22c55e'; }
      nodes.push({ id: sym.id, name: sym.name, val, color, group, filePath: sym.filePath, snippet: sym.codeSnippet, kind: sym.kind, isZombie, violation, complexity: sym.complexityScore || 1, degree });
      sym.relationships.calls.forEach(targetId => { if (knowledgeGraph[targetId]) links.push({ source: sym.id, target: targetId, color: isZombie ? '#cbd5e1' : '#e2e8f0' }); });
    });
    return { nodes, links };
  }, [knowledgeGraph, archViolations, zombieFiles]);

  const cityData = useMemo(() => {
      const symbolList = Object.values(knowledgeGraph) as CodeSymbol[];
      symbolList.sort((a, b) => a.filePath.localeCompare(b.filePath));
      const buildings: any[] = [];
      const SPACING = 3;
      const GRID_SIZE = Math.ceil(Math.sqrt(symbolList.length));
      symbolList.forEach((sym, idx) => {
          const row = Math.floor(idx / GRID_SIZE);
          const col = idx % GRID_SIZE;
          let color = '#8b5cf6';
          if (sym.filePath.endsWith('.ts') || sym.filePath.endsWith('.tsx')) color = '#38bdf8'; 
          else if (sym.filePath.endsWith('.js')) color = '#facc15';
          else if (sym.filePath.endsWith('.css')) color = '#f472b6';
          else if (sym.filePath.endsWith('.py')) color = '#4ade80';
          buildings.push({ id: sym.id, name: sym.name, x: (col - GRID_SIZE/2) * SPACING, z: (row - GRID_SIZE/2) * SPACING, height: Math.max(1, (sym.complexityScore || 1) * 1.5), width: Math.max(1, Math.min(5, Math.sqrt(sym.codeSnippet.split('\n').length) * 0.5)), color, isZombie: zombieFiles.includes(sym.filePath), filePath: sym.filePath, snippet: sym.codeSnippet, kind: sym.kind, complexity: sym.complexityScore, violation: archViolations.find(v => v.filePath === sym.filePath) });
      });
      return buildings;
  }, [knowledgeGraph, archViolations, zombieFiles]);

  const layersData = useMemo(() => {
    const symbolList = Object.values(knowledgeGraph) as CodeSymbol[];
    const layersDefinition = [
        { id: 'ui', label: 'UI / Components', keywords: ['component', 'page', 'view', 'layout', 'ui'], color: '#38bdf8' },
        { id: 'logic', label: 'Business Logic / Hooks', keywords: ['hook', 'context', 'store', 'reducer', 'logic'], color: '#a78bfa' },
        { id: 'core', label: 'Services / API', keywords: ['service', 'api', 'controller', 'handler', 'route'], color: '#facc15' },
        { id: 'data', label: 'Utils / Types / Config', keywords: ['util', 'helper', 'type', 'interface', 'model', 'config', 'schema'], color: '#4ade80' }
    ];
    const layers: any[] = layersDefinition.map(l => ({ ...l, nodes: [] }));
    const miscLayer = { id: 'misc', label: 'Modules / Others', color: '#94a3b8', nodes: [] as any[] };
    symbolList.forEach(sym => {
        const path = sym.filePath.toLowerCase();
        let placed = false;
        for (const layer of layers) {
            if (layer.keywords.some((k: string) => path.includes(k))) {
                layer.nodes.push({ ...sym, x: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 10, color: layer.color });
                placed = true;
                break;
            }
        }
        if (!placed) miscLayer.nodes.push({ ...sym, x: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 10, color: '#94a3b8' });
    });
    const finalLayers = layers.filter(l => l.nodes.length > 0);
    if (miscLayer.nodes.length > 0) finalLayers.push(miscLayer);
    return finalLayers.reverse();
  }, [knowledgeGraph]);

  const handleNodeClick = (node: any) => setSelectedNode(node);

  return (
    <div className="flex h-full gap-4 relative">
      {/* View Switcher - Glass Pills */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-4">
          <div className="bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-[1.2rem] border border-white/10 shadow-2xl flex gap-1.5">
              {[
                { id: 'graph', icon: Network, label: 'Graph' },
                { id: 'layers', icon: Layers, label: 'Layers' },
                { id: 'city', icon: Box, label: 'City' }
              ].map(mode => (
                <button 
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as any)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                        viewMode === mode.id 
                        ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/30' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <mode.icon className="w-4 h-4" /> {mode.label}
                </button>
              ))}
          </div>

          <div className="bg-slate-900/80 backdrop-blur-xl text-white p-5 rounded-[1.5rem] border border-white/10 shadow-2xl max-w-xs animate-in slide-in-from-left duration-500">
            <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-brand-300">
                <Activity className="w-4 h-4" />
                {viewMode === 'graph' ? 'Live Ecosystem' : viewMode === 'layers' ? 'Modular Architecture' : 'Code City'}
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">
                {viewMode === 'graph' 
                    ? 'Visualizing dependency density. Larger nodes act as central hubs with higher coupling.'
                    : viewMode === 'layers' 
                    ? '3D architectural strata. Glass plates represent logical layers (UI, Logic, Data).'
                    : 'A metropolis where building height represents complexity and footprint represents line count.'
                }
            </p>
            
            <div className="space-y-2 text-[10px] font-mono">
               {viewMode === 'graph' && (
                 <>
                   <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div> Hub Node</div>
                   <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> Critical Violation</div>
                 </>
               )}
            </div>
          </div>
      </div>

      {/* Main Render Area */}
      <div ref={containerRef} className="flex-1 bg-[#0f172a] rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-inner relative group">
         <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity duration-1000"></div>
         
         {viewMode === 'graph' ? (
             <ForceGraph2D
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeLabel="name"
                nodeColor="color"
                nodeRelSize={1} 
                nodeVal="val"
                d3VelocityDecay={0.3}
                backgroundColor="rgba(0,0,0,0)"
                onNodeClick={handleNodeClick}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    const r = Math.sqrt(Math.max(0, node.val || 1)) * 4;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                    ctx.fillStyle = node.color;
                    ctx.fill();
                    if (node.group === 'critical' || node.degree > 10) {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI, false);
                        ctx.strokeStyle = node.color;
                        ctx.lineWidth = 1.5 / globalScale;
                        ctx.globalAlpha = 0.4;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                    if (globalScale > 1.5 || node.degree > 5 || node === selectedNode) {
                        ctx.font = `${12/globalScale}px Sans-Serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#fff';
                        ctx.fillText(node.name, node.x, node.y + r + 4);
                    }
                }}
             />
         ) : viewMode === 'layers' ? (
             <Canvas camera={{ position: [20, 10, 20], fov: 45 }}>
                 <ArchitectureStackScene data={layersData} onNodeClick={handleNodeClick} selectedNodeId={selectedNode?.id} />
             </Canvas>
         ) : (
             <Canvas camera={{ position: [20, 20, 20], fov: 50 }}>
                 <CityScene data={cityData} onNodeClick={handleNodeClick} selectedNodeId={selectedNode?.id} />
             </Canvas>
         )}
      </div>

      {/* Details Sidebar - Ultra Rounded & Glass */}
      {selectedNode && (
         <div className="w-96 bg-white/95 backdrop-blur-xl border-l border-white/50 shadow-2xl rounded-l-[2.5rem] p-8 overflow-y-auto animate-in slide-in-from-right duration-500 absolute right-0 top-0 bottom-0 z-20">
             <div className="flex justify-between items-start mb-8">
                <div>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${
                        selectedNode.isZombie ? 'bg-slate-100 text-slate-500 border-slate-200' : 
                        selectedNode.violation ? 'bg-red-50 text-red-600 border-red-100' : 
                        'bg-brand-50 text-brand-600 border-brand-100'
                    }`}>
                        {selectedNode.kind || 'Module'}
                    </span>
                    <h2 className="text-2xl font-black text-slate-800 mt-3 break-all leading-tight">{selectedNode.name}</h2>
                </div>
                <button onClick={() => setSelectedNode(null)} className="p-2.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                    <ChevronRight className="w-6 h-6" />
                </button>
             </div>

             <div className="space-y-6">
                 <div className="bg-slate-50/80 p-5 rounded-[1.5rem] space-y-3 text-xs text-slate-600 border border-slate-100">
                     <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                         <span className="text-slate-400 font-medium">Location</span>
                         <span className="font-mono dir-ltr truncate max-w-[150px] bg-white px-2 py-0.5 rounded text-[10px] border border-slate-200">{selectedNode.filePath.split('/').pop()}</span>
                     </div>
                     <div className="flex justify-between items-center">
                         <span className="text-slate-400 font-medium">Coupling</span>
                         <span className="font-black text-slate-700">{selectedNode.degree} <span className="text-[10px] font-normal text-slate-400">refs</span></span>
                     </div>
                     <div className="flex justify-between items-center">
                         <span className="text-slate-400 font-medium">Complexity</span>
                         <div className="flex items-center gap-2">
                             <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                 <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, (selectedNode.complexity || 1) * 5)}%` }}></div>
                             </div>
                             <span className="font-black text-slate-700">{Math.round(selectedNode.complexity || 1)}</span>
                         </div>
                     </div>
                 </div>

                 {selectedNode.isZombie && (
                     <div className="bg-slate-100/80 p-5 rounded-[1.5rem] flex items-start gap-3 text-slate-600 border border-slate-200">
                         <Skull className="w-5 h-5 shrink-0" />
                         <div>
                             <h4 className="font-bold text-sm">Zombie Code Detected</h4>
                             <p className="text-[11px] mt-1 leading-relaxed opacity-80">This module appears to be unused. Consider deprecating or removing it.</p>
                         </div>
                     </div>
                 )}

                 {selectedNode.violation && (
                     <div className="bg-red-50/80 p-5 rounded-[1.5rem] flex items-start gap-3 text-red-600 border border-red-100">
                         <ShieldAlert className="w-5 h-5 shrink-0" />
                         <div>
                             <h4 className="font-bold text-sm">Architecture Violation</h4>
                             <p className="text-[11px] mt-1 leading-relaxed opacity-80">{selectedNode.violation.description}</p>
                         </div>
                     </div>
                 )}

                 <div>
                     <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm ml-1">
                         <Info className="w-4 h-4 text-brand-500" /> Source Snippet
                     </h4>
                     <div className="relative group">
                        <div className="absolute inset-0 bg-brand-500/5 rounded-[1.5rem] blur-sm"></div>
                        <pre className="relative bg-[#1e293b] text-slate-300 p-5 rounded-[1.5rem] text-[10px] font-mono overflow-x-auto custom-scrollbar dir-ltr max-h-60 border border-slate-700 shadow-lg">
                            {selectedNode.snippet}
                        </pre>
                     </div>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default LiveVisualization;