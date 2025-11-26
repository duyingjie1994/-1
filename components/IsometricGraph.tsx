import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { GraphData, NodeData } from '../types';

interface IsometricGraphProps {
  data: GraphData;
  width: number;
  height: number;
  selectedNodeId: string | null;
  onNodeClick: (node: NodeData | null) => void;
}

// 3D Math Constants
const LAYER_GAP = 180; // Vertical distance between layers
const BASE_RADIUS_TOP = 80; // Top Pyramid Radius
const RADIUS_INCREMENT = 140; // How much it widens per layer
const FOCAL_LENGTH = 1200;

// Helper: 3D Point
interface Point3D { x: number, y: number, z: number }
interface Point2D { x: number, y: number, scale: number, zIndex: number }

const getLayerColor = (layer: number) => {
  const colors = ['#fbbf24', '#38bdf8', '#2dd4bf', '#a78bfa']; // Amber, Sky, Teal, Violet
  return colors[layer] || '#a78bfa';
};

const getLayerRadius = (layer: number) => BASE_RADIUS_TOP + (layer * RADIUS_INCREMENT);

const IsometricGraph: React.FC<IsometricGraphProps> = ({ data, width, height, selectedNodeId, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  
  const [focusChain, setFocusChain] = useState<Set<string>>(new Set());
  const [showAllKnowledge, setShowAllKnowledge] = useState(false);
  
  // Camera State
  const [rotation, setRotation] = useState(0);
  
  // Refs for Animation Loop
  const rotationRef = useRef(0); 
  const targetRotation = useRef<number | null>(null);
  const isDragging = useRef(false);
  const lastX = useRef(0);
  const animationRef = useRef<number>(0);

  // Zoom State Ref (Accessible in animation loop without re-render)
  const zoomTransform = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  useEffect(() => {
      rotationRef.current = rotation;
  }, [rotation]);

  // --- 1. Lineage / Focus Logic (Strict Ancestor/Descendant based on Layers) ---
  useEffect(() => {
    if (!selectedNodeId) {
        setFocusChain(new Set());
        targetRotation.current = null;
        return;
    }

    const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
    
    // Robust Map Building: Use Layer Index to determine Parent (Up) vs Child (Down)
    const parentsMap: Record<string, string[]> = {}; 
    const childrenMap: Record<string, string[]> = {}; 

    data.links.forEach(l => {
        const sId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        
        const sNode = nodeMap.get(sId);
        const tNode = nodeMap.get(tId);

        if (!sNode || !tNode) return;

        let parentId: string | null = null;
        let childId: string | null = null;

        if (sNode.layer < tNode.layer) {
             parentId = sId;
             childId = tId;
        } else if (tNode.layer < sNode.layer) {
             parentId = tId;
             childId = sId;
        }

        if (parentId && childId) {
            if (!parentsMap[childId]) parentsMap[childId] = [];
            parentsMap[childId].push(parentId);

            if (!childrenMap[parentId]) childrenMap[parentId] = [];
            childrenMap[parentId].push(childId);
        }
    });

    const lineage = new Set<string>();
    lineage.add(selectedNodeId);

    // 1. Traverse Up
    const queueUp = [selectedNodeId];
    const visitedUp = new Set<string>([selectedNodeId]);
    while (queueUp.length > 0) {
        const curr = queueUp.shift()!;
        const parents = parentsMap[curr] || [];
        for (const p of parents) {
            if (!visitedUp.has(p)) {
                visitedUp.add(p);
                lineage.add(p);
                queueUp.push(p);
            }
        }
    }

    // 2. Traverse Down
    const queueDown = [selectedNodeId];
    const visitedDown = new Set<string>([selectedNodeId]);
    while (queueDown.length > 0) {
        const curr = queueDown.shift()!;
        const children = childrenMap[curr] || [];
        for (const c of children) {
            if (!visitedDown.has(c)) {
                visitedDown.add(c);
                lineage.add(c);
                queueDown.push(c);
            }
        }
    }

    setFocusChain(lineage);

    // Calculate Target Rotation
    const targetNode = data.nodes.find(n => n.id === selectedNodeId);
    if (targetNode) {
        const layerNodes = data.nodes.filter(n => n.layer === targetNode.layer);
        const count = layerNodes.length;
        const layerIndex = targetNode.layer;
        
        let nodeIndex = layerNodes.indexOf(targetNode);
        if (nodeIndex === -1) nodeIndex = 0;

        let theta = 0;
        if (layerIndex === 3) {
             const phi = Math.PI * (3 - Math.sqrt(5)); 
             theta = nodeIndex * phi; 
        } else {
             const angleStep = (Math.PI * 2) / count;
             const angleOffset = layerIndex * (Math.PI / 4); 
             theta = nodeIndex * angleStep + angleOffset;
        }

        let targetR = (Math.PI / 2) - theta;
        const currentRot = rotationRef.current;
        const twoPi = Math.PI * 2;
        while (targetR - currentRot > Math.PI) targetR -= twoPi;
        while (targetR - currentRot < -Math.PI) targetR += twoPi;

        targetRotation.current = targetR;
    }
  }, [selectedNodeId, data]);

  // --- 2. Interaction & Animation Loop (Zoom + Rotation) ---
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // Define Drag Behavior (Rotation)
    // We only allow drag if it's NOT a right-click (which usually pans in some apps, but here we just keep left for rotate)
    const drag = d3.drag<SVGSVGElement, unknown>()
      .filter(event => !event.ctrlKey && !event.button) // Only left click, no ctrl
      .on("start", (event) => {
        isDragging.current = true;
        targetRotation.current = null;
        lastX.current = event.x;
      })
      .on("drag", (event) => {
        const delta = event.x - lastX.current;
        setRotation(r => r - delta * 0.005);
        lastX.current = event.x;
      })
      .on("end", () => {
        isDragging.current = false;
      });

    // Define Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 5]) // Min/Max zoom scale
        .on("zoom", (event) => {
            zoomTransform.current = event.transform;
            // Apply transform to the SVG Container Group
            d3.select(svgRef.current).select("#graph-container")
                .attr("transform", event.transform);
        });

    // Bind Drag to SVG
    svg.call(drag);
    
    // Bind Zoom to SVG, but prevent it from consuming the "mousedown" so drag still works.
    // We only want Zoom to work on Wheel and maybe Panning on Right Click or specific gesture.
    // By default d3.zoom consumes mousedown. We can unbind mousedown to let drag handle it,
    // effectively making zoom WHEEL-ONLY + Panning via standard d3 gestures if not conflicted.
    // Let's allow Wheel Zoom + Middle/Right Mouse Pan? 
    // Or just simple: Drag = Rotate. Wheel = Zoom. No Pan (unless we use modifier).
    // Let's stick to standard d3 zoom, but filter out left-click start.
    
    svg.call(zoom)
       .on("mousedown.zoom", null) // Disable zoom's mousedown listener so drag can take it
       .on("dblclick.zoom", null); 

    const loop = () => {
      if (!isDragging.current) {
         if (targetRotation.current !== null) {
             const current = rotationRef.current;
             let diff = targetRotation.current - current;
             while (diff < -Math.PI) diff += Math.PI * 2;
             while (diff > Math.PI) diff -= Math.PI * 2;
             
             if (Math.abs(diff) < 0.005) {
                 setRotation(targetRotation.current);
                 targetRotation.current = null;
             } else {
                 setRotation(r => r + diff * 0.08); 
             }
         } else {
             setRotation(r => r + 0.0005); 
         }
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  // --- 3. Filter & Project Nodes ---
  const displayNodes = useMemo(() => {
    const connectionCounts: Record<string, number> = {};
    data.links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
        connectionCounts[s] = (connectionCounts[s] || 0) + 1;
        connectionCounts[t] = (connectionCounts[t] || 0) + 1;
    });

    return data.nodes.filter(n => {
        if (selectedNodeId && focusChain.has(n.id)) return true;
        if (n.layer !== 3) return true;
        if (showAllKnowledge) return true;
        return (connectionCounts[n.id] || 0) > 1;
    });
  }, [data, showAllKnowledge, selectedNodeId, focusChain]);

  // Pre-calculate 3D positions
  const nodes3D = useMemo(() => {
    const layers: { [key: number]: NodeData[] } = { 0: [], 1: [], 2: [], 3: [] };
    displayNodes.forEach(n => layers[n.layer]?.push(n));

    const calculatedNodes: (NodeData & Point3D)[] = [];

    Object.entries(layers).forEach(([layerStr, layerNodes]) => {
      const layerIndex = parseInt(layerStr);
      const count = layerNodes.length;
      const isRandomScatter = layerIndex === 3; 
      
      const y = (layerIndex - 1.5) * LAYER_GAP; 
      const radiusBase = getLayerRadius(layerIndex);

      layerNodes.forEach((node, i) => {
        let theta, radius;
        
        if (isRandomScatter) {
            const phi = Math.PI * (3 - Math.sqrt(5)); 
            theta = i * phi; 
            radius = radiusBase + (Math.sqrt(i / count) * 80); 
        } else {
            const angleStep = (Math.PI * 2) / count;
            const angleOffset = layerIndex * (Math.PI / 4); 
            theta = i * angleStep + angleOffset;
            radius = radiusBase;
        }

        calculatedNodes.push({
          ...node,
          x: radius * Math.cos(theta),
          y: y, 
          z: radius * Math.sin(theta)
        });
      });
    });

    return calculatedNodes;
  }, [displayNodes]);

  const project = (point: Point3D, angleY: number): Point2D => {
    const cos = Math.cos(angleY);
    const sin = Math.sin(angleY);
    const rx = point.x * cos - point.z * sin;
    const rz = point.z * cos + point.x * sin; 
    const ry = point.y;
    
    const cameraZ = rz + FOCAL_LENGTH; 
    const scale = FOCAL_LENGTH / Math.max(cameraZ, 10);

    return {
      x: width / 2 + rx * scale,
      y: height / 2 + ry * scale,
      scale: scale,
      zIndex: rz 
    };
  };

  // --- 4. Render (D3 & Canvas) ---
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Create Main Container Group for Zooming
    let gContainer = svg.select<SVGGElement>("#graph-container");
    if (gContainer.empty()) {
        gContainer = svg.append("g").attr("id", "graph-container");
    }

    // Group Structure: Planes (Bottom) -> Links -> Nodes (Top)
    let gPlanes = gContainer.select<SVGGElement>(".planes");
    if (gPlanes.empty()) gPlanes = gContainer.append("g").attr("class", "planes");

    let gContent = gContainer.select<SVGGElement>(".content");
    if (gContent.empty()) gContent = gContainer.append("g").attr("class", "content");

    const projectedNodes = nodes3D.map(n => ({ ...n, projected: project(n, rotation) }));
    const activeNodeIds = new Set(projectedNodes.map(n => n.id));

    // --- Render Layer Planes ---
    const planesData = [0, 1, 2, 3].map(layerIdx => {
        const y = (layerIdx - 1.5) * LAYER_GAP;
        const r = getLayerRadius(layerIdx) + 40; 
        const points: Point2D[] = [];
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const px = r * Math.cos(theta);
            const pz = r * Math.sin(theta);
            points.push(project({ x: px, y, z: pz }, rotation));
        }
        return { layer: layerIdx, points, zIndex: points.reduce((acc, p) => acc + p.zIndex, 0) / points.length };
    });

    const planePath = d3.line<Point2D>()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveBasisClosed);

    gPlanes.selectAll("path")
        .data(planesData)
        .join("path")
        .attr("d", d => planePath(d.points))
        .attr("fill", d => getLayerColor(d.layer))
        .attr("fill-opacity", 0.05) 
        .attr("stroke", d => getLayerColor(d.layer))
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.3)
        .style("pointer-events", "none");

    // --- Links ---
    const activeLinks = data.links.map((link) => {
        const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const tId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        
        if (!activeNodeIds.has(sId) || !activeNodeIds.has(tId)) return null;
        
        const sNode = projectedNodes.find(n => n.id === sId)!;
        const tNode = projectedNodes.find(n => n.id === tId)!;

        // Strict filtering for selection
        let isVisible = true;
        let isHighlighted = false;

        if (selectedNodeId) {
            if (focusChain.has(sId) && focusChain.has(tId)) {
                isHighlighted = true;
                isVisible = true;
            } else {
                isVisible = false;
            }
        }

        if (!isVisible) return null;

        return { 
            id: `${sId}-${tId}`, 
            sNode, tNode, 
            avgZ: (sNode.projected.zIndex + tNode.projected.zIndex) / 2,
            isHighlighted 
        };
    }).filter(Boolean) as any[];

    activeLinks.sort((a, b) => a.avgZ - b.avgZ);
    projectedNodes.sort((a, b) => a.projected.zIndex - b.projected.zIndex);

    const linkSel = gContent.selectAll<SVGLineElement, any>(".link")
        .data(activeLinks, d => d.id);

    linkSel.join(
        enter => enter.append("line")
            .attr("class", "link")
            .attr("stroke-linecap", "round"),
        update => update,
        exit => exit.remove()
    )
    .attr("x1", d => d.sNode.projected.x)
    .attr("y1", d => d.sNode.projected.y)
    .attr("x2", d => d.tNode.projected.x)
    .attr("y2", d => d.tNode.projected.y)
    .attr("stroke", d => {
        const colorLayer = Math.min(d.sNode.layer, d.tNode.layer); 
        return getLayerColor(colorLayer); 
    })
    .attr("stroke-width", d => d.isHighlighted ? 2 : 0.5)
    .attr("stroke-opacity", d => d.isHighlighted ? 0.8 : 0.15)
    .style("filter", d => d.isHighlighted ? `drop-shadow(0 0 5px ${getLayerColor(Math.min(d.sNode.layer, d.tNode.layer))})` : null);

    // --- Nodes ---
    const nodeSel = gContent.selectAll<SVGGElement, any>(".node")
        .data(projectedNodes, d => d.id);

    const nodeEnter = nodeSel.enter()
        .append("g")
        .attr("class", "node")
        .on("click", (e, d) => {
            e.stopPropagation();
            onNodeClick(d);
        })
        .style("cursor", "pointer");

    nodeEnter.append("circle").attr("class", "shape");
    nodeEnter.append("text").attr("class", "label");

    const nodeMerge = nodeSel.merge(nodeEnter)
        .sort((a, b) => {
             if(a.id === selectedNodeId) return 1;
             if(b.id === selectedNodeId) return -1;
             return a.projected.zIndex - b.projected.zIndex;
        });
        
    nodeMerge.transition().duration(0)
        .attr("transform", d => `translate(${d.projected.x}, ${d.projected.y})`);

    nodeMerge.select(".shape")
        .attr("r", d => {
            const base = (d.layer === 0 ? 8 : d.layer === 3 ? 2 : 4) * d.projected.scale;
            return d.id === selectedNodeId ? base * 2.5 : base;
        })
        .attr("fill", d => getLayerColor(d.layer))
        .attr("fill-opacity", d => {
             if (selectedNodeId && !focusChain.has(d.id)) return 0.05; 
             return 0.9;
        })
        .attr("stroke", d => d.id === selectedNodeId ? "#fff" : getLayerColor(d.layer))
        .attr("stroke-width", d => d.id === selectedNodeId ? 2 : 0)
        .style("filter", d => {
             if (d.id === selectedNodeId) return `drop-shadow(0 0 15px ${getLayerColor(d.layer)})`;
             if (selectedNodeId && focusChain.has(d.id)) return `drop-shadow(0 0 4px ${getLayerColor(d.layer)})`;
             return null;
        });

    // --- Label Truncation Logic ---
    nodeMerge.select(".label")
        .text(d => {
            // Logic: Show full text if selected. Otherwise truncate.
            if (d.id === selectedNodeId) return d.label;
            
            // For lower layers, truncate more aggressively
            const maxLen = d.layer <= 1 ? 6 : 4; 
            return d.label.length > maxLen ? d.label.slice(0, maxLen) + '..' : d.label;
        })
        .attr("dy", -15)
        .attr("text-anchor", "middle")
        .attr("fill", d => d.id === selectedNodeId ? "#fff" : getLayerColor(d.layer))
        .attr("font-size", d => Math.max(9, 14 * d.projected.scale) + "px")
        .attr("font-weight", d => d.id === selectedNodeId ? "bold" : "normal")
        .attr("opacity", d => {
             if (selectedNodeId && !focusChain.has(d.id)) return 0;
             if (selectedNodeId && focusChain.has(d.id)) return 1;
             if (d.layer === 3) return 0; // Hide labels for bottom layer by default unless focused
             return Math.min(1, d.projected.scale - 0.2);
        })
        .style("pointer-events", "none")
        .style("text-shadow", d => `0 2px 4px rgba(0,0,0,0.9)`);

    nodeSel.exit().remove();

    // --- Particle Animation (Synced with Zoom) ---
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && width > 0 && height > 0) {
        
        // Clear entire canvas
        // Note: We need to use "setTransform" to reset/apply zoom, 
        // so we must clear with the identity transform first or clear based on bounds.
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.restore();
        
        // Apply the same zoom transform as SVG
        const t = zoomTransform.current;
        ctx.setTransform(t.k, 0, 0, t.k, t.x, t.y);

        if (selectedNodeId && activeLinks.length > 0) {
             const time = Date.now() * 0.002;
             
             activeLinks.forEach(link => {
                 if (!link.isHighlighted) return;
                 
                 // Flow Logic: Lower Layer Index -> Higher Layer Index
                 let s = link.sNode;
                 let t = link.tNode;
                 
                 if (s.layer > t.layer) {
                     [s, t] = [t, s];
                 }

                 const x1 = s.projected.x;
                 const y1 = s.projected.y;
                 const x2 = t.projected.x;
                 const y2 = t.projected.y;
                 
                 const offset = (time + (s.id.charCodeAt(0) * 0.1)) % 1;
                 const px = x1 + (x2 - x1) * offset;
                 const py = y1 + (y2 - y1) * offset;
                 
                 const trailLen = 0.15; 
                 const tx = x1 + (x2 - x1) * Math.max(0, offset - trailLen);
                 const ty = y1 + (y2 - y1) * Math.max(0, offset - trailLen);

                 ctx.beginPath();
                 const gradient = ctx.createLinearGradient(tx, ty, px, py);
                 const color = getLayerColor(s.layer);
                 gradient.addColorStop(0, "transparent");
                 gradient.addColorStop(1, color);

                 ctx.strokeStyle = gradient;
                 ctx.lineWidth = 4 * s.projected.scale;
                 ctx.lineCap = "round";
                 ctx.moveTo(tx, ty);
                 ctx.lineTo(px, py);
                 ctx.stroke();

                 ctx.beginPath();
                 ctx.arc(px, py, 2 * s.projected.scale, 0, Math.PI * 2);
                 ctx.fillStyle = "#fff";
                 ctx.fill();
             });
        }
    }

  }, [nodes3D, width, height, rotation, selectedNodeId, focusChain, data]);

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      <svg 
        ref={svgRef}
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, cursor: 'grab' }}
        onClick={() => onNodeClick(null)} 
      />
      <canvas 
        ref={canvasRef}
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }}
      />
    </div>
  );
};

export default IsometricGraph;