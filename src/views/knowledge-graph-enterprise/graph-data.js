// 节点类型对应的基础颜色，图例和图谱节点保持一致。
const TYPE_COLORS= {
  root: '#38bdf8',
  system: '#64748b',
  'survey-category': '#fb7185',
  'planning-category': '#84cc16',
  'survey-detail': '#f59e0b',
  'planning-detail': '#a855f7',
};

// 节点类型对应的基础尺寸，层级细分由 resolveNodeSize 兜底。
const TYPE_SIZES= {
  root: 145,
  system: 115,
  'survey-category': 98,
  'planning-category': 98,
  'survey-detail': 77,
  'planning-detail': 77,
};

// 三级明细节点固定尺寸，避免缩放文字时继续叠加比例。
const DETAIL_NODE_SIZE = 57;

// 层级关系的原始边标签集合，用于区分包含关系和对应关系。
const HIERARCHY_LABELS = new Set(['左侧分类体系', '右侧分类体系', '分类体系', '包含']);

// 将原始 JSON 转换为图谱运行时需要的节点、边、父子索引。
export function transformKnowledgeGraph(raw) {
  // 节点 ID 到节点数据的索引。
  const nodeMap = new Map();
  // 父节点 ID 到子节点 ID 列表的索引。
  const childrenMap = new Map();
  // 子节点 ID 到父节点 ID 的索引。
  const parentMap = new Map();
  // 图谱关系边集合。
  const edges = [];

  raw.nodes.forEach((node) => {
    // 从标签中拆出编码和业务名称，供搜索、详情和节点文字复用。
    const codeMatch = node.label.match(/^(\d{2}H\d|[A-Z]?\d{2,6})\s+(.+)$/);
    // 原始业务名称，优先取节点 name。
    const nodeName = node.name || codeMatch?.[2] || node.label;
    // 清洗后用于图中展示的节点名称。
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
      size: resolveNodeSize(node.type, node.level, node.levelName),
      color: resolveNodeColor(node.type, node.level, node.levelName),
    });
  });

  raw.edges.forEach((edge, index) => {
    // 根据边类型和标签判断是否为层级包含关系。
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

  // 递归展开 children 字段中的补充分类节点。
  function appendRawChildren(parentId, children) {
    // 当前补充节点的父节点。
    const parent = nodeMap.get(parentId);
    if (!parent) return;

    children.forEach((child, index) => {
      // 补充节点生成的唯一 ID。
      const childId = `${parentId}-${child.code}-${index}`;
      // 补充节点类型，继承父级所属体系。
      const childType = child.type || inferChildType(parent);
      // 补充节点层级。
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
        size: resolveNodeSize(childType, childLevel, child.levelName),
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
    // 补齐父级、体系、子节点数量等派生字段。
    const parentId = parentMap.get(id);
    // 当前节点父级数据。
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

// 根据节点类型和层级解析节点颜色。
function resolveNodeColor(type, level, levelName) {
  // 空层级按根层级兜底。
  const normalizedLevel = level || 0;
  if (levelName === '三级类' || normalizedLevel >= 3) return '#ef4444';
  if (levelName === '二级类' || normalizedLevel === 2) {
    return type === 'survey-detail' ? '#f59e0b' : '#a855f7';
  }
  return TYPE_COLORS[type] || '#64748b';
}

// 根据层级返回固定节点尺寸，避免运行时按比例反复计算。
function resolveNodeSize(type, level, levelName) {
  if ((level || 0) >= 3 || levelName === '三级类') return DETAIL_NODE_SIZE;
  return TYPE_SIZES[type] || 38;
}

// 格式化节点完整名称，存在编码时拼接编码。
export function formatNodeName(node) {
  // 节点可展示名称。
  const name = node.displayName || node.name || node.label;
  return node.code ? `${node.code} ${name}` : name;
}

// 将节点名称拆成图谱节点中心显示的短行。
export function buildNodeLines(name) {
  // 去掉空白后的节点名称。
  const normalized = name.replace(/\s+/g, '');
  // 单行最大长度，长文本使用更短分行。
  const maxLength = normalized.length > 12 ? 5 : 6;
  // 按长度切出的全部行。
  const chunks = [];
  for (let index = 0; index < normalized.length; index += maxLength) {
    chunks.push(normalized.slice(index, index + maxLength));
  }
  // 实际展示的前两行。
  const mainLines = chunks.slice(0, 2);
  if (chunks.length > 2) {
    mainLines[1] = `${mainLines[1].slice(0, Math.max(2, maxLength - 1))}...`;
  }
  return mainLines;
}

// 清洗业务名称，去掉不需要重复展示的编码前缀。
function cleanBusinessName(name, id) {
  if (id === 'planning') return '国土空间用地用海分类';
  return name.replace(/^([A-Z]?\d{2,4})\s*/, '');
}

// 根据层级数字推断层级名称。
function inferLevelName(level) {
  if (level === null) return '分类体系';
  // 层级数字到展示名称的映射。
  const names= {
    0: '中心主题',
    1: '一级类',
    2: '二级类',
    3: '三级类',
  };
  return names[level] || `${level}级类`;
}

// 根据父节点所属体系推断补充子节点类型。
function inferChildType(parent) {
  if (parent.type === 'planning-category' || parent.type === 'planning-detail' || parent.id === 'planning') {
    return 'planning-detail';
  }
  return 'survey-detail';
}

// 写入父子索引，避免同一个子节点重复追加。
function appendChild(childrenMap, parentId, childId) {
  // 当前父节点已有子节点 ID 列表。
  const children = childrenMap.get(parentId) || [];
  if (!children.includes(childId)) {
    children.push(childId);
    childrenMap.set(parentId, children);
  }
}

// 沿父级链路解析节点所属体系标签。
function resolveSystemLabel(nodeId, parentMap, nodeMap) {
  // 当前向上追溯的节点 ID。
  let currentId = nodeId;
  while (currentId) {
    // 当前追溯节点。
    const current = nodeMap.get(currentId);
    if (current?.type === 'system') return current.label;
    currentId = parentMap.get(currentId);
  }
  return undefined;
}

// 为全量节点预设初始坐标，供后续力导布局使用。
function assignPositions(nodeMap, childrenMap) {
  // 根节点。
  const root = nodeMap.get('root');
  // 国土调查体系节点。
  const survey = nodeMap.get('survey');
  // 国土空间规划体系节点。
  const planning = nodeMap.get('planning');

  if (root) setPosition(root, 0, 0);
  if (survey) setPosition(survey, -390, 0);
  if (planning) setPosition(planning, 390, 0);

  placeAroundParent(nodeMap, childrenMap.get('survey') || [], -390, 0, 340, 112, 248);
  placeAroundParent(nodeMap, childrenMap.get('planning') || [], 390, 0, 360, -68, 68);

  nodeMap.forEach((node) => {
    // 当前节点直接子节点 ID 列表。
    const children = childrenMap.get(node.id) || [];
    if (!children.length || (node.level || 0) < 1) return;

    // 当前父节点位置。
    const parent = nodeMap.get(node.id);
    if (!parent) return;
    // 当前节点所属体系节点。
    const system = node.system?.includes('规划') ? planning : survey;
    // 扇形布局基准角度。
    const baseAngle = Math.atan2(parent.y - (system?.y || 0), parent.x - (system?.x || 0));
    // 扇形展开角度。
    const fan = Math.min(Math.PI * 1.18, Math.max(Math.PI / 2.2, children.length * 0.24));
    // 扇形起始角度。
    const start = baseAngle - fan / 2;

    children.forEach((childId, index) => {
      // 当前子节点。
      const child = nodeMap.get(childId);
      if (!child) return;
      // 当前子节点所在环层。
      const ring = Math.floor(index / 7);
      // 当前子节点在环层内的序号。
      const ringIndex = index % 7;
      // 当前环层内节点数量。
      const ringCount = Math.min(7, children.length - ring * 7);
      // 当前子节点角度。
      const angle = ringCount === 1 ? baseAngle : start + (fan * ringIndex) / (ringCount - 1);
      // 当前子节点半径。
      const radius = 170 + ring * 96;
      setPosition(child, parent.x + Math.cos(angle) * radius, parent.y + Math.sin(angle) * radius);
    });
  });
}

// 将一组节点按指定角度范围围绕父节点摆放。
function placeAroundParent(nodeMap, ids, centerX, centerY, radius, startDegree, endDegree) {
  ids.forEach((id, index) => {
    // 当前待摆放节点。
    const node = nodeMap.get(id);
    if (!node) return;
    // 当前节点角度。
    const degree =
      ids.length === 1 ? (startDegree + endDegree) / 2 : startDegree + ((endDegree - startDegree) * index) / (ids.length - 1);
    // 弧度制角度。
    const angle = (degree * Math.PI) / 180;
    setPosition(node, centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
  });
}

// 写入节点整数坐标。
function setPosition(node, x, y) {
  node.x = Math.round(x);
  node.y = Math.round(y);
}
