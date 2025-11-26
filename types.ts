export enum LayerType {
  OBJECTIVE = 'Objective',
  REQUIREMENT = 'Requirement',
  COURSE = 'Course',
  KNOWLEDGE = 'Knowledge',
}

export interface NodeData {
  id: string;
  label: string;
  layer: number; // 0 to 3 (0 is top)
  type: LayerType;
  value?: number; // Importance or weight
  description?: string;
}

export interface LinkData {
  source: string;
  target: string;
  value?: number; // Strength of relationship
}

export interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

export interface SimulationNode extends NodeData {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface SimulationLink {
  source: SimulationNode | string;
  target: SimulationNode | string;
  value?: number;
}
