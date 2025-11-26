import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { NodeData, LinkData } from '../types';

interface MiniGraphProps {
  centerNode: NodeData;
  neighbors: NodeData[];
  links: LinkData[];
}

const LAYER_COLORS = ['#fbbf24', '#38bdf8', '#2dd4bf', '#a78bfa'];

const MiniRelationshipGraph: React.FC<MiniGraphProps> = ({ centerNode, neighbors, links }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    
    const width = svgRef.current.clientWidth;
    const height = 200; // Fixed height
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Radar Background
    const gBg = svg.append("g").attr("transform", `translate(${width/2},${height/2})`);
    [40, 80].forEach(r => {
        gBg.append("circle")
           .attr("r", r)
           .attr("fill", "none")
           .attr("stroke", "#ffffff")
           .attr("stroke-opacity", 0.05)
           .attr("stroke-dasharray", "4 4");
    });

    // Prepare Simulation Data
    const simNodes = [centerNode, ...neighbors].map(n => ({ ...n }));
    const simLinks = links.map(l => ({ 
        source: typeof l.source === 'object' ? (l.source as any).id : l.source, 
        target: typeof l.target === 'object' ? (l.target as any).id : l.target 
    })).filter(l => {
        const hasSource = simNodes.find(n => n.id === l.source);
        const hasTarget = simNodes.find(n => n.id === l.target);
        return hasSource && hasTarget;
    });

    // Force Simulation
    const simulation = d3.forceSimulation(simNodes as any)
        .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(60))
        .force("charge", d3.forceManyBody().strength(-100))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide(15));

    // Render Elements
    const link = svg.append("g")
        .selectAll("line")
        .data(simLinks)
        .join("line")
        .attr("stroke", "#475569")
        .attr("stroke-width", 1);

    const node = svg.append("g")
        .selectAll("g")
        .data(simNodes)
        .join("g");

    node.append("circle")
        .attr("r", (d: any) => d.id === centerNode.id ? 8 : 5)
        .attr("fill", (d: any) => d.id === centerNode.id ? "#fff" : LAYER_COLORS[d.layer] || '#fff')
        .attr("stroke", (d: any) => d.id === centerNode.id ? LAYER_COLORS[d.layer] : "none")
        .attr("stroke-width", 2);
    
    // Add pulsing effect to center node
    const centerCircle = node.filter((d:any) => d.id === centerNode.id).select("circle");
    
    // Simple text labels
    node.append("text")
        .text((d: any) => d.label.length > 6 ? d.label.slice(0,5)+".." : d.label)
        .attr("dy", 15)
        .attr("text-anchor", "middle")
        .attr("fill", "#94a3b8")
        .attr("font-size", "8px")
        .style("pointer-events", "none");

    simulation.on("tick", () => {
        link
            .attr("x1", (d: any) => d.source.x)
            .attr("y1", (d: any) => d.source.y)
            .attr("x2", (d: any) => d.target.x)
            .attr("y2", (d: any) => d.target.y);

        node
            .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
        simulation.stop();
    };
  }, [centerNode, neighbors, links]);

  return (
    <div className="w-full h-48 bg-slate-900/50 rounded-lg border border-slate-700/50 relative overflow-hidden">
        <div className="absolute top-2 left-2 text-[9px] text-slate-500 uppercase tracking-widest font-mono">Radial View</div>
        <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default MiniRelationshipGraph;