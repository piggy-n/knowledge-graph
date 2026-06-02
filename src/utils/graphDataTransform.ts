export type KnowledgeNodeType =
  | 'root'
  | 'system'
  | 'survey-category'
  | 'planning-category'
  | 'survey-detail'
  | 'planning-detail';

export interface RawKnowledgeNode {
  id: string;
  label: string;
  type: KnowledgeNodeType;
  level: number | null;
  code?: string;
  name?: string;
  levelName?: string;
  system?: string;
  parentId?: string | null;
  mapping?: string;
  remarks?: string;
}

export interface RawKnowledgeEdge {
  source: string;
  target: string;
  label?: string;
  type?: 'contains' | 'mapping';
  lineType?: 'solid' | 'dashed';
}

export interface RawKnowledgeChild {
  code: string;
  name: string;
  target?: string;
  levelName?: string;
  type?: KnowledgeNodeType;
  relationLabel?: string;
  children?: RawKnowledgeChild[];
}

export interface RawKnowledgeGraph {
  title: string;
  description?: string;
  source?: string;
  nodes: RawKnowledgeNode[];
  edges: RawKnowledgeEdge[];
  children?: Record<string, RawKnowledgeChild[]>;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  type: KnowledgeNodeType;
  level: number | null;
  code?: string;
  name?: string;
  parentId?: string;
  parentLabel?: string;
  system?: string;
  mapping?: string;
  levelName?: string;
  displayName: string;
  displayLines: string[];
  childrenCount: number;
  expanded?: boolean;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  relationType: 'hierarchy' | 'mapping';
  type?: 'contains' | 'mapping';
  lineType?: 'solid' | 'dashed';
}

export interface KnowledgeGraphDataset {
  title: string;
  description?: string;
  source?: string;
  rootId: string;
  nodeMap: Map<string, KnowledgeNode>;
  edges: KnowledgeEdge[];
  childrenMap: Map<string, string[]>;
  parentMap: Map<string, string>;
}

export interface VisibleGraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

const TYPE_COLORS: Record<KnowledgeNodeType, string> = {
  root: '#38bdf8',
  system: '#64748b',
  'survey-category': '#fb7185',
  'planning-category': '#84cc16',
  'survey-detail': '#f59e0b',
  'planning-detail': '#a855f7',
};

const TYPE_SIZES: Record<KnowledgeNodeType, number> = {
  root: 116,
  system: 92,
  'survey-category': 78,
  'planning-category': 78,
  'survey-detail': 62,
  'planning-detail': 62,
};

const HIERARCHY_LABELS = new Set(['左侧分类体系', '右侧分类体系', '分类体系', '包含']);

export function transformKnowledgeGraph(raw: RawKnowledgeGraph): KnowledgeGraphDataset {
  const nodeMap = new Map<string, KnowledgeNode>();
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  const edges: KnowledgeEdge[] = [];

  raw.nodes.forEach((node) => {
    const codeMatch = node.label.match(/^(\d{2}H\d|[A-Z]?\d{2,6})\s+(.+)$/);
    const nodeName = node.name || codeMatch?.[2] || node.label;
    const displayName = cleanBusinessName(nodeName, node.id);
    nodeMap.set(node.id, {
      ...node,
      code: node.code || codeMatch?.[1],
      name: nodeName,
      parentId: node.parentId || undefined,
      levelName: node.levelName || inferLevelName(node.level),
      displayName,
      displayLines: buildNodeLines(displayName),
      childrenCount: 0,
      x: 0,
      y: 0,
      size: (node.level || 0) >= 3 ? 52 : TYPE_SIZES[node.type] || 38,
      color: resolveNodeColor(node.type, node.level, node.levelName),
    });
  });

  raw.edges.forEach((edge, index) => {
    const isHierarchy = edge.type === 'contains' || (!edge.type && HIERARCHY_LABELS.has(edge.label || ''));
    edges.push({
      ...edge,
      id: `${edge.source}->${edge.target}:${index}`,
      relationType: isHierarchy ? 'hierarchy' : 'mapping',
    });

    if (isHierarchy) {
      appendChild(childrenMap, edge.source, edge.target);
      parentMap.set(edge.target, edge.source);
    }
  });

  function appendRawChildren(parentId: string, children: RawKnowledgeChild[]) {
    const parent = nodeMap.get(parentId);
    if (!parent) return;

    children.forEach((child, index) => {
      const childId = `${parentId}-${child.code}-${index}`;
      const childType = child.type || inferChildType(parent);
      const childLevel = (parent.level || 0) + 1;

      nodeMap.set(childId, {
        id: childId,
        label: `${child.code} ${child.name}`,
        type: childType,
        level: childLevel,
        code: child.code,
        name: child.name,
        levelName: child.levelName || inferLevelName(childLevel),
        displayName: child.name,
        displayLines: buildNodeLines(child.name),
        parentId,
        parentLabel: parent.label,
        system: resolveSystemLabel(parentId, parentMap, nodeMap),
        mapping: child.target,
        childrenCount: 0,
        x: parent.x,
        y: parent.y,
        size: childLevel >= 4 ? 52 : TYPE_SIZES[childType],
        color: resolveNodeColor(childType, childLevel, child.levelName),
      });
      appendChild(childrenMap, parentId, childId);
      parentMap.set(childId, parentId);
      edges.push({
        id: `${parentId}->${childId}:detail`,
        source: parentId,
        target: childId,
        label: child.relationLabel || (child.target ? '对应' : '包含'),
        relationType: 'hierarchy',
      });
      if (child.children?.length) appendRawChildren(childId, child.children);
    });
  }

  Object.entries(raw.children || {}).forEach(([parentId, children]) => {
    appendRawChildren(parentId, children);
  });

  nodeMap.forEach((node, id) => {
    const parentId = parentMap.get(id);
    const parent = parentId ? nodeMap.get(parentId) : undefined;
    node.parentId = parentId;
    node.parentLabel = parent?.label;
    node.system = resolveSystemLabel(id, parentMap, nodeMap);
    node.childrenCount = childrenMap.get(id)?.length || 0;
    node.levelName = node.levelName || inferLevelName(node.level);
    node.displayName = node.displayName || node.name || node.label;
    node.displayLines = node.displayLines?.length
      ? node.displayLines
      : buildNodeLines(node.displayName);
  });

  assignPositions(nodeMap, childrenMap);

  return {
    title: raw.title,
    description: raw.description,
    source: raw.source,
    rootId: nodeMap.has('root') ? 'root' : raw.nodes[0]?.id || '',
    nodeMap,
    edges,
    childrenMap,
    parentMap,
  };
}

export function nodeTypeText(type: KnowledgeNodeType): string {
  const map: Record<KnowledgeNodeType, string> = {
    root: '中心主题',
    system: '分类体系',
    'survey-category': '国土调查一级分类',
    'planning-category': '国土空间一级分类',
    'survey-detail': '国土调查明细分类',
    'planning-detail': '国土空间明细分类',
  };
  return map[type] || type;
}

function resolveNodeColor(type: KnowledgeNodeType, level: number | null, levelName?: string): string {
  const normalizedLevel = level || 0;
  if (levelName === '三级类' || normalizedLevel >= 3) return '#ef4444';
  if (levelName === '二级类' || normalizedLevel === 2) {
    return type === 'survey-detail' ? '#f59e0b' : '#a855f7';
  }
  return TYPE_COLORS[type] || '#64748b';
}

export function shortLabel(label: string, max = 12): string {
  return label.length > max ? `${label.slice(0, max)}...` : label;
}

export function formatNodeName(node: KnowledgeNode): string {
  const name = node.displayName || node.name || node.label;
  return node.code ? `${node.code} ${name}` : name;
}

export function buildNodeLines(name: string): string[] {
  const normalized = name.replace(/\s+/g, '');
  const maxLength = normalized.length > 12 ? 5 : 6;
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += maxLength) {
    chunks.push(normalized.slice(index, index + maxLength));
  }
  const mainLines = chunks.slice(0, 2);
  if (chunks.length > 2) {
    mainLines[1] = `${mainLines[1].slice(0, Math.max(2, maxLength - 1))}...`;
  }
  return mainLines;
}

function cleanBusinessName(name: string, id: string): string {
  if (id === 'planning') return '国土空间用地用海分类';
  return name.replace(/^([A-Z]?\d{2,4})\s*/, '');
}

function inferLevelName(level: number | null): string {
  if (level === null) return '分类体系';
  const names: Record<number, string> = {
    0: '中心主题',
    1: '一级类',
    2: '二级类',
    3: '三级类',
  };
  return names[level] || `${level}级类`;
}

function inferChildType(parent: KnowledgeNode): KnowledgeNodeType {
  if (parent.type === 'planning-category' || parent.type === 'planning-detail' || parent.id === 'planning') {
    return 'planning-detail';
  }
  return 'survey-detail';
}

function appendChild(childrenMap: Map<string, string[]>, parentId: string, childId: string) {
  const children = childrenMap.get(parentId) || [];
  if (!children.includes(childId)) {
    children.push(childId);
    childrenMap.set(parentId, children);
  }
}

function resolveSystemLabel(
  nodeId: string,
  parentMap: Map<string, string>,
  nodeMap: Map<string, KnowledgeNode>,
): string | undefined {
  let currentId: string | undefined = nodeId;
  while (currentId) {
    const current = nodeMap.get(currentId);
    if (current?.type === 'system') return current.label;
    currentId = parentMap.get(currentId);
  }
  return undefined;
}

function assignPositions(nodeMap: Map<string, KnowledgeNode>, childrenMap: Map<string, string[]>) {
  const root = nodeMap.get('root');
  const survey = nodeMap.get('survey');
  const planning = nodeMap.get('planning');

  if (root) setPosition(root, 0, 0);
  if (survey) setPosition(survey, -390, 0);
  if (planning) setPosition(planning, 390, 0);

  placeAroundParent(nodeMap, childrenMap.get('survey') || [], -390, 0, 340, 112, 248);
  placeAroundParent(nodeMap, childrenMap.get('planning') || [], 390, 0, 360, -68, 68);

  nodeMap.forEach((node) => {
    const children = childrenMap.get(node.id) || [];
    if (!children.length || (node.level || 0) < 1) return;

    const parent = nodeMap.get(node.id);
    if (!parent) return;
    const system = node.system?.includes('规划') ? planning : survey;
    const baseAngle = Math.atan2(parent.y - (system?.y || 0), parent.x - (system?.x || 0));
    const fan = Math.min(Math.PI * 1.18, Math.max(Math.PI / 2.2, children.length * 0.24));
    const start = baseAngle - fan / 2;

    children.forEach((childId, index) => {
      const child = nodeMap.get(childId);
      if (!child) return;
      const ring = Math.floor(index / 7);
      const ringIndex = index % 7;
      const ringCount = Math.min(7, children.length - ring * 7);
      const angle = ringCount === 1 ? baseAngle : start + (fan * ringIndex) / (ringCount - 1);
      const radius = 170 + ring * 96;
      setPosition(child, parent.x + Math.cos(angle) * radius, parent.y + Math.sin(angle) * radius);
    });
  });
}

function placeAroundParent(
  nodeMap: Map<string, KnowledgeNode>,
  ids: string[],
  centerX: number,
  centerY: number,
  radius: number,
  startDegree: number,
  endDegree: number,
) {
  ids.forEach((id, index) => {
    const node = nodeMap.get(id);
    if (!node) return;
    const degree =
      ids.length === 1 ? (startDegree + endDegree) / 2 : startDegree + ((endDegree - startDegree) * index) / (ids.length - 1);
    const angle = (degree * Math.PI) / 180;
    setPosition(node, centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
  });
}

function setPosition(node: KnowledgeNode, x: number, y: number) {
  node.x = Math.round(x);
  node.y = Math.round(y);
}
