import React, { useState, useEffect, useRef, useMemo } from 'react';
import IsometricGraph from './components/IsometricGraph';
import MiniRelationshipGraph from './components/MiniRelationshipGraph';
import { GraphData, NodeData, LayerType } from './types';
import { INITIAL_DATA } from './constants';
import { generateCurriculumData } from './services/geminiService';

const App: React.FC = () => {
  const [data, setData] = useState<GraphData>(INITIAL_DATA);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [majorInput, setMajorInput] = useState<string>("计算机科学与技术");
  const [isLoading, setIsLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleGenerate = async () => {
    if (!majorInput) return;
    setIsLoading(true);
    try {
      const newData = await generateCurriculumData(majorInput);
      setData(newData);
      setSelectedNode(null); 
    } catch (error) {
      alert("生成失败，请重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const getLayerName = (layer: number) => {
      switch(layer) {
          case 0: return "培养目标 (Objective)";
          case 1: return "毕业要求 (Requirement)";
          case 2: return "课程体系 (Course)";
          case 3: return "知识点 (Knowledge)";
          default: return "未知";
      }
  };

  const getLayerColor = (layer: number) => {
      const colors = ['#fbbf24', '#38bdf8', '#2dd4bf', '#a78bfa'];
      return colors[layer] || '#fff';
  };

  // --- Statistics Logic ---

  // 1. Global Counts
  const globalStats = useMemo(() => {
      const counts = [0, 0, 0, 0];
      data.nodes.forEach(n => {
          if (n.layer >= 0 && n.layer <= 3) counts[n.layer]++;
      });
      return counts;
  }, [data]);

  // 2. Direct Neighbors (for Mini Graph & Lists)
  const directRelations = useMemo(() => {
      if (!selectedNode) return { upstream: [], downstream: [], links: [] };
      
      const upstream: NodeData[] = [];
      const downstream: NodeData[] = [];
      const relevantLinks: any[] = [];

      data.links.forEach(l => {
          const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
          
          let otherId: string | null = null;
          if (tId === selectedNode.id) otherId = sId;
          else if (sId === selectedNode.id) otherId = tId;
          
          if (otherId) {
             const otherNode = data.nodes.find(n => n.id === otherId);
             if (otherNode) {
                 if (otherNode.layer < selectedNode.layer) upstream.push(otherNode);
                 else if (otherNode.layer > selectedNode.layer) downstream.push(otherNode);
                 relevantLinks.push(l);
             }
          }
      });
      return { upstream, downstream, links: relevantLinks };
  }, [selectedNode, data]);

  // 3. Deep Impact Counts (Transitive Closure Downwards)
  // How many nodes of each layer effectively support this node?
  const deepImpact = useMemo(() => {
      if (!selectedNode) return [0, 0, 0, 0];
      
      const counts = [0, 0, 0, 0];
      const visited = new Set<string>();
      const queue = [selectedNode.id];
      
      // Build adjacency map for fast lookup (Child -> Parent, Parent -> Child)
      // We want "Downwards" traversal: Node -> Children -> Grandchildren
      const childrenMap: Record<string, string[]> = {};
      data.links.forEach(l => {
          const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
          const sNode = data.nodes.find(n => n.id === sId);
          const tNode = data.nodes.find(n => n.id === tId);
          
          if (!sNode || !tNode) return;
          
          let parent, child;
          if (sNode.layer < tNode.layer) { parent = sId; child = tId; }
          else if (tNode.layer < sNode.layer) { parent = tId; child = sId; }
          
          if (parent && child) {
              if (!childrenMap[parent]) childrenMap[parent] = [];
              childrenMap[parent].push(child);
          }
      });

      while(queue.length > 0) {
          const currId = queue.shift()!;
          if (visited.has(currId)) continue;
          visited.add(currId);
          
          const node = data.nodes.find(n => n.id === currId);
          if (node && node.id !== selectedNode.id) {
              counts[node.layer]++;
          }

          const children = childrenMap[currId] || [];
          children.forEach(c => queue.push(c));
      }
      return counts;
  }, [selectedNode, data]);

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-cyan-500/30">
      
      {/* --- LEFT SIDEBAR (DASHBOARD) --- */}
      <div className="w-80 flex-shrink-0 bg-[#0f172a]/95 backdrop-blur-xl border-r border-cyan-900/30 flex flex-col z-30 shadow-[4px_0_30px_rgba(0,0,0,0.5)]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-gradient-to-r from-transparent to-cyan-900/10">
          <h1 className="text-2xl font-black italic tracking-tighter text-white">
            EDU<span className="text-cyan-400">MATRIX</span> <span className="text-xs align-top opacity-50 font-normal not-italic ml-1">V5.1 PRO</span>
          </h1>
          <p className="text-[10px] text-cyan-200/60 mt-1 uppercase tracking-widest font-mono">OBE 教学体系三维全景溯源</p>
        </div>

        {/* System Dashboard */}
        <div className="p-6 border-b border-white/5 space-y-4">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Overview</h3>
                 <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">LIVE</span>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                 {/* Stat Cards */}
                 <div className="bg-slate-900/50 p-3 rounded border border-amber-500/20 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                         <div className="w-8 h-8 bg-amber-500 rounded-full blur-xl"></div>
                     </div>
                     <div className="text-2xl font-mono text-white font-bold">{globalStats[0]}</div>
                     <div className="text-[9px] text-amber-500 uppercase font-bold mt-1">Objectives</div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded border border-sky-500/20 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                         <div className="w-8 h-8 bg-sky-500 rounded-full blur-xl"></div>
                     </div>
                     <div className="text-2xl font-mono text-white font-bold">{globalStats[1]}</div>
                     <div className="text-[9px] text-sky-500 uppercase font-bold mt-1">Requirements</div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded border border-teal-500/20 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                         <div className="w-8 h-8 bg-teal-500 rounded-full blur-xl"></div>
                     </div>
                     <div className="text-2xl font-mono text-white font-bold">{globalStats[2]}</div>
                     <div className="text-[9px] text-teal-500 uppercase font-bold mt-1">Courses</div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded border border-violet-500/20 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                         <div className="w-8 h-8 bg-violet-500 rounded-full blur-xl"></div>
                     </div>
                     <div className="text-2xl font-mono text-white font-bold">{globalStats[3]}</div>
                     <div className="text-[9px] text-violet-500 uppercase font-bold mt-1">Knowledge Pts</div>
                 </div>
             </div>

             <div className="mt-4 pt-4 border-t border-white/5">
                 <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                     <span>Matrix Density</span>
                     <span>{(data.links.length / Math.max(1, data.nodes.length)).toFixed(2)} Links/Node</span>
                 </div>
                 <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 w-3/4"></div>
                 </div>
             </div>
        </div>

        {/* Input & Generate */}
        <div className="p-6 border-b border-white/5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-cyan-500 mb-2 uppercase tracking-widest">Re-Generate System</label>
            <div className="relative group">
                <input 
                    type="text" 
                    value={majorInput}
                    onChange={(e) => setMajorInput(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-white placeholder-slate-600 font-mono"
                    placeholder="Enter Major..."
                />
            </div>
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={isLoading}
            className={`w-full py-3 rounded-md font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2
            ${isLoading 
                ? 'bg-slate-800 text-slate-500 cursor-wait' 
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)]'}`}
          >
            {isLoading ? <span>Computing...</span> : <span>Generate Matrix →</span>}
          </button>
        </div>

        {/* Footer/Legend */}
        <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Visual Legend</h3>
            <div className="space-y-3">
                {[0,1,2,3].map(layer => (
                    <div key={layer} className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: getLayerColor(layer), boxShadow: `0 0 8px ${getLayerColor(layer)}` }}></div>
                         <div className="text-[10px] text-slate-400">{getLayerName(layer).split(' (')[0]}</div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* --- MAIN VISUALIZATION --- */}
      <div className="flex-1 relative bg-gradient-to-b from-[#020617] to-[#0f172a]" ref={containerRef}>
        <IsometricGraph 
            data={data} 
            width={dimensions.width} 
            height={dimensions.height} 
            selectedNodeId={selectedNode?.id || null}
            onNodeClick={setSelectedNode}
        />
        
        {/* Floating Reset Button */}
        {selectedNode && (
            <div className="absolute top-6 left-6 z-20 animate-fade-in-up">
                <button 
                    onClick={() => setSelectedNode(null)}
                    className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md transition-all group"
                >
                    <span className="group-hover:rotate-180 transition-transform duration-500">✕</span>
                    Reset View
                </button>
            </div>
        )}
      </div>

      {/* --- RIGHT DRAWER (DEEP ANALYTICS) --- */}
      <div 
        className={`fixed inset-y-0 right-0 w-80 bg-[#0f172a]/95 backdrop-blur-2xl border-l border-cyan-900/30 shadow-2xl z-40 transform transition-transform duration-500 ease-out flex flex-col
        ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedNode ? (
            <>
                {/* Close Button */}
                <button 
                    onClick={() => setSelectedNode(null)}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors z-50"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                {/* Header */}
                <div className="p-8 pb-4 border-b border-white/5 relative bg-gradient-to-b from-white/5 to-transparent">
                    <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getLayerColor(selectedNode.layer) }}></span>
                        {getLayerName(selectedNode.layer).split(' (')[1].replace(')', '')} Node
                    </div>
                    <h2 className="text-xl font-bold text-white leading-tight mb-2 pr-6">{selectedNode.label}</h2>
                    <div className="flex gap-2 mb-4">
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono border border-slate-700">ID: {selectedNode.id}</span>
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono border border-slate-700">Type: {selectedNode.type}</span>
                    </div>
                    
                    {/* Mini Graph Visualization */}
                    <div className="mb-2">
                        <MiniRelationshipGraph 
                            centerNode={selectedNode} 
                            neighbors={[...directRelations.upstream, ...directRelations.downstream]}
                            links={directRelations.links}
                        />
                    </div>
                </div>

                {/* Impact Analytics */}
                <div className="p-6 border-b border-white/5 bg-slate-900/30">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <svg className="w-3 h-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        Deep Support Analysis
                     </h4>
                     
                     <div className="space-y-2">
                        {deepImpact.map((count, idx) => (
                             idx > selectedNode.layer && count > 0 && (
                                <div key={idx} className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-white/5">
                                    <span className="text-xs text-slate-400">Supported by <span style={{ color: getLayerColor(idx)}}>{getLayerName(idx).split(' (')[0]}</span></span>
                                    <span className="text-sm font-bold text-white font-mono">{count}</span>
                                </div>
                             )
                        ))}
                        {deepImpact.every(c => c === 0) && (
                            <div className="text-[10px] text-slate-500 italic">No downstream dependencies found.</div>
                        )}
                     </div>
                </div>

                {/* Relations List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Upstream */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-l-2 border-cyan-500 pl-2">
                            Direct Upstream
                        </h4>
                        {directRelations.upstream.length > 0 ? (
                            <div className="space-y-1">
                                {directRelations.upstream.map(n => (
                                    <div key={n.id} onClick={() => setSelectedNode(n)} className="p-2 bg-slate-800/30 hover:bg-slate-700/50 rounded cursor-pointer transition-colors flex justify-between group">
                                        <span className="text-xs text-slate-300">{n.label}</span>
                                        <span className="text-[9px] text-slate-600 group-hover:text-cyan-400">L{n.layer}</span>
                                    </div>
                                ))}
                            </div>
                        ) : <div className="text-[10px] text-slate-600 italic">None (Top Level)</div>}
                    </div>

                    {/* Downstream */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-l-2 border-purple-500 pl-2">
                            Direct Downstream
                        </h4>
                        {directRelations.downstream.length > 0 ? (
                            <div className="space-y-1">
                                {directRelations.downstream.map(n => (
                                    <div key={n.id} onClick={() => setSelectedNode(n)} className="p-2 bg-slate-800/30 hover:bg-slate-700/50 rounded cursor-pointer transition-colors flex justify-between group">
                                        <span className="text-xs text-slate-300">{n.label}</span>
                                        <span className="text-[9px] text-slate-600 group-hover:text-purple-400">L{n.layer}</span>
                                    </div>
                                ))}
                            </div>
                        ) : <div className="text-[10px] text-slate-600 italic">None (Bottom Level)</div>}
                    </div>
                </div>
            </>
        ) : (
            <div className="h-full flex items-center justify-center text-slate-600">
                <span>Select a node</span>
            </div>
        )}
      </div>

    </div>
  );
};

export default App;
