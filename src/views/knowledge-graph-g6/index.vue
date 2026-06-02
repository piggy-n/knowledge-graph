<script setup lang="ts">
import G6 from '@antv/g6';
import * as d3 from 'd3';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import KnowledgeGraphDetailPanel from '../../components/KnowledgeGraphDetailPanel.vue';
import KnowledgeGraphToolbar from '../../components/KnowledgeGraphToolbar.vue';
import rawGraphData from '../../data/data.json';
import { formatNodeName, transformKnowledgeGraph, type KnowledgeEdge, type KnowledgeNode, type KnowledgeNodeType, type RawKnowledgeGraph } from '../../utils/graphDataTransform';
import { GraphExpandManager } from '../../utils/graphExpandManager';

const router = useRouter();
const containerRef = ref<HTMLDivElement | null>(null);
const selectedNode = ref<KnowledgeNode>();
const message = ref('');
const relationLabelsVisible = ref(true);
const searchResults = ref<KnowledgeNode[]>([]);
const searchKeyword = ref('');
const searchFocusActive = ref(false);
const locatedNodeId = ref('');
const overviewItems = ref<Array<[string, string]>>([]);
const legendCollapsed = ref(false);
const overviewCollapsed = ref(false);
const activeLegendId = ref('');
const hoveredLegendId = ref('');
const tooltip = ref({
  visible: false,
  rows: [] as Array<[string, string]>,
});

let graph: any;
let manager: GraphExpandManager;
let graphRendered = false;
let resizeFrame = 0;
let graphWidth = 0;
let graphHeight = 0;
let locateTimer = 0;
let locateBlinkTimer = 0;
const layoutCache = new Map<string, { x: number; y: number }>();

type LegendItem = {
  id: string;
  label: string;
  color: string;
  type?: KnowledgeNodeType;
  levelName?: string;
  lineType?: 'solid' | 'dashed';
  lineWidth?: number;
};

const legendItems: LegendItem[] = [
  { id: 'root', type: 'root', label: '中心主题', color: '#38bdf8' },
  { id: 'system', type: 'system', label: '分类体系', color: '#64748b' },
  { id: 'survey-first', type: 'survey-category', levelName: '一级类', label: '国土调查一级类', color: '#fb7185' },
  { id: 'survey-second', type: 'survey-detail', levelName: '二级类', label: '国土调查二级类', color: '#f59e0b' },
  { id: 'planning-first', type: 'planning-category', levelName: '一级类', label: '用地用海一级类', color: '#84cc16' },
  { id: 'planning-second', type: 'planning-detail', levelName: '二级类', label: '用地用海二级类', color: '#a855f7' },
  { id: 'planning-third', type: 'planning-detail', levelName: '三级类', label: '用地用海三级类', color: '#ef4444' },
  { id: 'edge-mapping', label: '对应关系', color: '#f59e0b', lineType: 'dashed', lineWidth: 2.2 },
  { id: 'edge-hierarchy', label: '包含关系', color: '#2563eb', lineType: 'solid', lineWidth: 3 },
];

const activeLegendLabel = computed(() => {
  return legendItems.find((item) => item.id === activeLegendId.value)?.label;
});
const nodeLegendItems = computed(() => legendItems.filter((item) => item.type));
const relationLegendItems = computed(() => legendItems.filter((item) => item.lineType));
const selectedChildren = computed(() => (selectedNode.value && manager ? manager.getChildren(selectedNode.value.id) : []));

try {
  const dataset = transformKnowledgeGraph(rawGraphData as RawKnowledgeGraph);
  manager = new GraphExpandManager(dataset);
  selectedNode.value = manager.getNode(dataset.rootId);
} catch (error) {
  message.value = error instanceof Error ? error.message : 'JSON 数据加载失败';
}

onMounted(async () => {
  await nextTick();
  if (!manager || !containerRef.value) return;
  mountGraphWhenReady();
  window.addEventListener('resize', resizeGraph);
});

onBeforeUnmount(() => {
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
  if (locateTimer) window.clearTimeout(locateTimer);
  if (locateBlinkTimer) window.clearInterval(locateBlinkTimer);
  window.removeEventListener('resize', resizeGraph);
  graph?.destroy();
  graph = undefined;
  graphRendered = false;
});

function initGraph() {
  const container = containerRef.value;
  if (!container) return;
  if (graph) {
    graph.destroy();
    graph = undefined;
    graphRendered = false;
  }

  graphWidth = container.clientWidth;
  graphHeight = container.clientHeight;
  if (!graphWidth || !graphHeight) return;

  graph = new G6.Graph({
    container,
    width: graphWidth,
    height: graphHeight,
    animate: true,
    modes: {
      default: ['drag-canvas', 'zoom-canvas', 'drag-node'],
    },
    defaultNode: {
      type: 'circle',
      labelCfg: {
        position: 'center',
        style: {
          fill: '#0f172a',
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 12,
        },
      },
    },
    defaultEdge: {
      type: 'cubic',
      labelCfg: {
        autoRotate: true,
        style: {
          fill: '#64748b',
          fontSize: 10,
          fontWeight: 500,
        },
      },
    },
    edgeStateStyles: {
      inactive: {
        opacity: 0.1,
      },
    },
  });

  graph.on('node:click', (event: any) => {
    const id = event.item?.getModel()?.id;
    if (!id) return;
    manager.toggle(id);
    selectedNode.value = manager.getNode(id);
    renderGraph(id);
  });

  graph.on('canvas:click', () => {
    selectedNode.value = undefined;
    clearHover();
  });

  graph.on('node:mouseenter', (event: any) => {
    const id = event.item?.getModel()?.id;
    if (!id) return;
    selectedNode.value = manager.getNode(id);
    applyHover(id);
    showNodeTooltip(manager.getNode(id));
  });

  graph.on('node:mouseleave', () => {
    clearHover();
    hideTooltip();
  });

  graph.on('edge:mouseenter', (event: any) => {
    if (event.item) applyEdgeHover(event.item);
  });

  graph.on('edge:mouseleave', (event: any) => {
    if (event.item) {
      clearHover();
    }
  });
}

function mountGraphWhenReady(retryCount = 0) {
  const container = containerRef.value;
  if (!container) return;
  if (container.clientWidth && container.clientHeight) {
    initGraph();
    renderGraph();
    return;
  }
  if (retryCount < 10) {
    window.requestAnimationFrame(() => mountGraphWhenReady(retryCount + 1));
  } else {
    message.value = 'G6 容器尺寸异常，无法初始化图谱';
  }
}

function renderGraph(focusId?: string) {
  if (!graph || !containerRef.value) return;
  const visibleData = manager.getVisibleGraph();
  updateOverview(visibleData.nodes, visibleData.edges);
  const graphData = toG6Data();
  if (graphRendered) {
    graph.changeData(graphData);
  } else {
    graph.data(graphData);
    graph.render();
    graphRendered = true;
  }
  graph.getNodes().forEach((item: any) => graph.clearItemStates(item));
  graph.getEdges().forEach((item: any) => graph.clearItemStates(item));

  applyLocatedState();
  applyLegendState();
}

function toG6Data() {
  const width = containerRef.value?.clientWidth || 1200;
  const height = containerRef.value?.clientHeight || 760;
  const centerX = width / 2;
  const centerY = height / 2;
  const data = manager.getVisibleGraph();
  const layoutMap = buildForceLayout(data.nodes, data.edges);

  return {
    nodes: data.nodes.map((node) => {
      const isRoot = node.type === 'root';
      const textSpec = getG6NodeTextSpec(node);
      const position = layoutMap.get(node.id) || { x: node.x, y: node.y };
      const nodeFill = isRoot ? 'l(90) 0:#38bdf8 1:#0ea5e9' : node.color;
      const nodeLineWidth = isRoot ? 3 : 2;
      const nodeStyle = {
        fill: nodeFill,
        stroke: '#ffffff',
        lineWidth: nodeLineWidth,
        shadowColor: node.color,
        shadowBlur: isRoot ? 22 : 12,
        cursor: 'pointer',
        opacity: 0.92,
      };
      return {
        id: node.id,
        label: textSpec.lines.join('\n'),
        originLabel: textSpec.lines.join('\n'),
        x: centerX + position.x,
        y: centerY + position.y,
        size: node.size,
        origin: node,
        originStyle: { ...nodeStyle },
        style: { ...nodeStyle },
        labelCfg: {
          position: 'center',
          offset: 0,
          originStyle: {
            fill: '#ffffff',
            fontSize: textSpec.fontSize,
            fontWeight: isRoot ? 700 : 600,
            lineHeight: textSpec.lineHeight,
            textAlign: 'center',
            textBaseline: 'middle',
          },
          style: {
            fill: '#ffffff',
            fontSize: textSpec.fontSize,
            fontWeight: isRoot ? 700 : 600,
            lineHeight: textSpec.lineHeight,
            textAlign: 'center',
            textBaseline: 'middle',
          },
        },
      };
    }),
    edges: data.edges.map((edge) => toG6Edge(edge)),
  };
}

function getG6NodeTextSpec(node: KnowledgeNode) {
  const name = node.displayName || node.name || node.label;
  const length = [...name].length;
  const radius = node.size / 2;
  const maxLines = node.type === 'root' || node.type === 'system' ? 3 : 2;
  let fontSize = 10;

  if (length <= 2) fontSize = Math.min(22, radius * 0.62);
  else if (length <= 3) fontSize = Math.min(20, radius * 0.56);
  else if (length <= 5) fontSize = Math.min(16, radius * 0.44);
  else if (length <= 8) fontSize = Math.min(14, radius * 0.36);
  else fontSize = Math.max(10, Math.min(12, radius * 0.3));

  const maxCharsPerLine = Math.max(2, Math.floor((radius * 1.52) / fontSize));
  const lines = wrapG6Text(name, maxCharsPerLine, maxLines);
  const maxTextHeight = radius * 1.35;
  const rawLineHeight = fontSize * 1.18;
  const totalHeight = rawLineHeight * lines.length;

  if (totalHeight > maxTextHeight) {
    fontSize = Math.max(10, fontSize * (maxTextHeight / totalHeight));
  }

  fontSize = toEvenFontSize(fontSize);
  return {
    lines,
    fontSize,
    lineHeight: Math.round(fontSize * 1.2),
  };
}

function wrapG6Text(text: string, maxCharsPerLine: number, maxLines: number) {
  const chars = [...text.replace(/\s+/g, '')];
  const lines: string[] = [];
  for (let index = 0; index < chars.length; index += maxCharsPerLine) {
    lines.push(chars.slice(index, index + maxCharsPerLine).join(''));
  }
  if (lines.length > maxLines) {
    const visible = lines.slice(0, maxLines);
    const last = visible[visible.length - 1];
    visible[visible.length - 1] = `${last.slice(0, Math.max(1, maxCharsPerLine - 1))}...`;
    return visible;
  }
  return lines;
}

function toEvenFontSize(size: number) {
  const rounded = Math.max(10, Math.round(size));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function toG6Edge(edge: KnowledgeEdge) {
  const mapping = edge.relationType === 'mapping';
  const labelText = simplifyEdgeLabel(edge);
  const label = relationLabelsVisible.value && isDefaultVisibleLabel(edge) ? labelText : '';
  const lineWidth = edgeLineWidth(edge);
  const edgeStyle = {
    stroke: mapping ? 'rgba(245, 158, 11, 0.52)' : 'rgba(37, 99, 235, 0.25)',
    lineWidth,
    endArrow: {
      path: G6.Arrow.triangle(mapping ? 6 : 8, mapping ? 8 : 10, mapping ? 0 : 2),
      fill: mapping ? 'rgba(245, 158, 11, 0.6)' : 'rgba(37, 99, 235, 0.76)',
    },
    opacity: mapping ? 0.78 : 0.6,
    lineDash: mapping ? [5, 5] : undefined,
  };
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    relationType: edge.relationType,
    label,
    originLabel: labelText,
    originLabelFill: mapping ? '#b45309' : '#64748b',
    originFontSize: 10,
    originFontWeight: mapping ? 700 : 500,
    labelCfg: {
      autoRotate: true,
      style: {
        fill: mapping ? '#b45309' : '#64748b',
        fontSize: 10,
        fontWeight: mapping ? 700 : 500,
        background: {
          fill: 'rgba(255, 255, 255, 0.78)',
          padding: [2, 4, 2, 4],
          radius: 4,
        },
      },
    },
    originStyle: { ...edgeStyle },
    style: { ...edgeStyle },
  };
}

function buildForceLayout(nodes: KnowledgeNode[], edges: KnowledgeEdge[]) {
  if (nodes.length <= 1) {
    const singleMap = new Map<string, { x: number; y: number }>();
    nodes.forEach((node) => singleMap.set(node.id, { x: 0, y: 0 }));
    return singleMap;
  }

  const simulationNodes = nodes.map((node) => {
    const cached = layoutCache.get(node.id);
    return {
      ...node,
      x: cached?.x ?? node.x,
      y: cached?.y ?? node.y,
      fx: node.type === 'root' ? 0 : undefined,
      fy: node.type === 'root' ? 0 : undefined,
    };
  });
  const links = edges.map((edge) => ({ ...edge }));

  const simulation = d3
    .forceSimulation(simulationNodes)
    .force(
      'link',
      d3
        .forceLink<any, any>(links)
        .id((node) => node.id)
        .distance((link) => (link.relationType === 'mapping' ? 300 : 190))
        .strength((link) => (link.relationType === 'mapping' ? 0.08 : 0.45)),
    )
    .force(
      'charge',
      d3.forceManyBody<any>().strength((node) => {
        if (node.type === 'root') return -1200;
        if (node.type === 'system') return -760;
        if (node.level === 2) return -520;
        return -300;
      }),
    )
    .force('collide', d3.forceCollide<any>().radius((node) => node.size / 2 + 40).iterations(2))
    .force('x', d3.forceX<any>((node) => node.x || 0).strength(0.06))
    .force('y', d3.forceY<any>((node) => node.y || 0).strength(0.06))
    .stop();

  for (let index = 0; index < 110; index += 1) {
    simulation.tick();
  }

  const result = new Map<string, { x: number; y: number }>();
  simulationNodes.forEach((node) => {
    const x = Number.isFinite(node.x) ? node.x || 0 : 0;
    const y = Number.isFinite(node.y) ? node.y || 0 : 0;
    const position = { x, y };
    result.set(node.id, position);
    layoutCache.set(node.id, position);
  });
  return result;
}

function simplifyEdgeLabel(edge: KnowledgeEdge): string {
  if (!edge.label || edge.label.includes('无对应') || edge.label.includes('暂无对应')) return '';
  if (edge.label === '对应分类') return '对应';
  if (edge.label !== '对应' && edge.label.includes('对应')) return '对应';
  if (edge.label === '包含') return '包含';
  if (edge.label === '左侧分类体系' || edge.label === '右侧分类体系') return '分类体系';
  return edge.label;
}

function isDefaultVisibleLabel(edge: KnowledgeEdge): boolean {
  return Boolean(simplifyEdgeLabel(edge) && (edge.relationType === 'hierarchy' || edge.relationType === 'mapping'));
}

function edgeLineWidth(edge: KnowledgeEdge): number {
  if (edge.relationType === 'mapping') return 1.8;
  const source = manager.getNode(edge.source);
  if (source?.type === 'root') return 4.2;
  if (source?.type === 'system') return 3.4;
  if (source?.levelName === '一级类') return 2.6;
  return 1.6;
}

function setEdgeTextState(item: any, active: boolean, forceHidden = false) {
  const model = item.getModel();
  updateEdgeVisual(item, active);
  const defaultLabel = relationLabelsVisible.value && model.originLabel && (model.relationType === 'hierarchy' || model.relationType === 'mapping') ? model.originLabel : '';
  graph.updateItem(item, {
    label: forceHidden ? '' : active && relationLabelsVisible.value ? model.originLabel : defaultLabel,
    labelCfg: {
      ...model.labelCfg,
      style: {
        ...model.labelCfg?.style,
        fill: active ? '#0f172a' : model.originLabelFill || model.labelCfg?.style?.fill,
        fontSize: active ? 12 : model.originFontSize || model.labelCfg?.style?.fontSize,
        fontWeight: active ? 800 : model.originFontWeight || model.labelCfg?.style?.fontWeight,
        background: {
          fill: active ? 'rgba(255, 247, 237, 0.96)' : 'rgba(255, 255, 255, 0.78)',
          padding: [3, 6, 3, 6],
          radius: 5,
        },
      },
    },
  });
}

function updateEdgeVisual(item: any, active = false) {
  const model = item.getModel();
  const baseStyle = model.originStyle || model.style || {};
  const mapping = model.relationType === 'mapping';
  const lineWidth = Number(baseStyle.lineWidth || 1.6);
  graph.updateItem(item, {
    style: {
      ...baseStyle,
      stroke: active && mapping ? '#f59e0b' : baseStyle.stroke,
      lineWidth: active ? lineWidth + (mapping ? 1.4 : 1.8) : lineWidth,
      opacity: active ? 1 : baseStyle.opacity ?? 0.6,
      endArrow: {
        ...(baseStyle.endArrow || {}),
        fill: active && mapping ? '#f59e0b' : baseStyle.endArrow?.fill,
      },
    },
  });
}

function applyHover(id: string) {
  const relatedIds = manager.getConnectedIds(id);
  const relatedEdgeIds = manager.getContextEdgeIds(id);
  graph.getNodes().forEach((item: any) => {
    const itemId = item.getModel().id;
    const related = relatedIds.has(itemId);
    updateNodeVisual(item, {
      hot: itemId === id,
      dim: itemId !== id && !related,
      opacity: itemId === id ? 1 : related ? 0.96 : 0.14,
    });
  });
  graph.getEdges().forEach((item: any) => {
    const model = item.getModel();
    const active = relatedEdgeIds.has(model.id);
    setEdgeTextState(item, active, !active);
    graph.setItemState(item, 'inactive', !active);
  });
}

function applyEdgeHover(edgeItem: any) {
  const edgeId = edgeItem.getModel().id;
  const model = edgeItem.getModel();
  const relatedIds = new Set([model.source, model.target]);
  graph.getNodes().forEach((item: any) => {
    const related = relatedIds.has(item.getModel().id);
    const itemId = item.getModel().id;
    updateNodeVisual(item, {
      hot: related,
      dim: !related,
      opacity: related ? 0.96 : 0.14,
    });
  });
  graph.getEdges().forEach((item: any) => {
    const active = item.getModel().id === edgeId;
    setEdgeTextState(item, active, !active);
    graph.setItemState(item, 'inactive', !active);
  });
}

function clearHover() {
  graph.getNodes().forEach((item: any) => {
    updateNodeVisual(item);
  });
  graph.getEdges().forEach((item: any) => {
    setEdgeTextState(item, false);
    graph.setItemState(item, 'inactive', false);
  });
  applyLocatedState();
  applyLegendState();
}

function applyLocatedState() {
  if (!graph) return;
  graph.getNodes().forEach((item: any) => {
    const itemId = item.getModel().id;
    updateNodeVisual(item, { hot: itemId === locatedNodeId.value });
  });
  graph.getEdges().forEach((item: any) => {
    graph.setItemState(item, 'inactive', false);
  });
}

function updateNodeVisual(item: any, options: { hot?: boolean; dim?: boolean; opacity?: number } = {}) {
  const model = item.getModel();
  const baseStyle = model.originStyle || model.style || {};
  const lineWidth = Number(baseStyle.lineWidth || 2);
  const style = {
    ...baseStyle,
    opacity: options.opacity ?? (options.dim ? 0.14 : baseStyle.opacity ?? 0.92),
  };

  if (options.hot) {
    Object.assign(style, {
      stroke: '#f59e0b',
      lineWidth: Math.max(4, lineWidth + 1.8),
      shadowColor: '#f59e0b',
      shadowBlur: 24,
      opacity: 1,
    });
  }

  graph.updateItem(item, { style });
}

function setLegendHover(id: string) {
  if (id && !legendItems.find((item) => item.id === id)?.type) return;
  hoveredLegendId.value = id;
  applyLegendState();
}

function toggleLegend(id: string) {
  if (!legendItems.find((item) => item.id === id)?.type) return;
  activeLegendId.value = activeLegendId.value === id ? '' : id;
  applyLegendState();
}

function applyLegendState() {
  if (!graph) return;
  const legend = legendItems.find((item) => item.id === (activeLegendId.value || hoveredLegendId.value));
  graph.getNodes().forEach((item: any) => {
    const node = item.getModel().origin as KnowledgeNode | undefined;
    const dim = Boolean(legend && node && !matchesLegend(node, legend));
    updateNodeVisual(item, { dim, opacity: dim ? 0.14 : 0.92 });
  });
}

function matchesLegend(node: KnowledgeNode, legend: LegendItem): boolean {
  if (!legend.type) return false;
  if (node.type !== legend.type) return false;
  return !legend.levelName || node.levelName === legend.levelName;
}

function updateOverview(nodes: KnowledgeNode[], edges: KnowledgeEdge[]) {
  const typeCount = (type: KnowledgeNodeType) => nodes.filter((node) => node.type === type).length;
  overviewItems.value = [
    ['实体节点', String(nodes.length)],
    ['实体关系', String(edges.length)],
    ['国土调查节点', String(typeCount('survey-category') + typeCount('survey-detail'))],
    ['用地用海节点', String(typeCount('planning-category') + typeCount('planning-detail'))],
    ['一级类', String(nodes.filter((node) => node.levelName === '一级类').length)],
    ['二级类', String(nodes.filter((node) => node.levelName === '二级类').length)],
    ['三级类', String(nodes.filter((node) => node.levelName === '三级类').length)],
    ['对应关系', String(edges.filter((edge) => edge.relationType === 'mapping' && edge.label).length)],
  ];
}

function showNodeTooltip(node?: KnowledgeNode) {
  if (!node) return;
  tooltip.value = {
    visible: true,
    rows: buildTooltipRows(node),
  };
}

function hideTooltip() {
  tooltip.value.visible = false;
}

function buildTooltipRows(node: KnowledgeNode): Array<[string, string]> {
  return [
    ['节点名称', formatNodeName(node)],
    ['节点编码', node.code || ''],
    ['分类层级', node.levelName || ''],
    ['所属分类', node.parentLabel || searchResultSystem(node)],
    ['对应关系', node.mapping || ''],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

function resizeGraph() {
  if (!graph || !containerRef.value) return;
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    if (!graph || !containerRef.value) return;
    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;
    if (!width || !height || (width === graphWidth && height === graphHeight)) return;
    graphWidth = width;
    graphHeight = height;
    graph.changeSize(width, height);
    graph.fitCenter();
  });
}

function resetView() {
  if (!graph) return;
  graph.fitCenter();
  graph.zoomTo(1);
}

function fitFullGraphView() {
  if (!graph) return;
  graph.fitView(42);
}

function fitContextView(contextIds: Set<string>, focusId?: string) {
  if (!graph || !containerRef.value) return;
  const items = [...contextIds].map((id) => graph.findById(id)).filter(Boolean);
  if (!items.length) {
    resetView();
    return;
  }

  graph.fitView(72);
  if (focusId) {
    const focusItem = graph.findById(focusId);
    if (focusItem) graph.focusItem(focusItem, true);
  }
  const zoom = graph.getZoom ? graph.getZoom() : 1;
  if (zoom < 0.62) graph.zoomTo(0.62);
  if (zoom > 1.28) graph.zoomTo(1.28);
}

function focusRootStartView() {
  if (!graph) return;
  const rootNode = manager.getVisibleGraph().nodes[0];
  const rootItem = rootNode ? graph.findById(rootNode.id) : undefined;
  graph.zoomTo(1.35);
  if (rootItem) graph.focusItem(rootItem, true);
  else graph.fitCenter();
}

function relayout() {
  layoutCache.clear();
  renderGraph();
  window.setTimeout(() => fitFullGraphView(), 180);
}

function expandAll() {
  searchFocusActive.value = false;
  manager.expandAll();
  renderGraph(selectedNode.value?.id);
  window.requestAnimationFrame(() => fitFullGraphView());
}

function collapseAll() {
  searchFocusActive.value = false;
  manager.collapseAll();
  layoutCache.clear();
  selectedNode.value = manager.getVisibleGraph().nodes[0];
  renderGraph(selectedNode.value?.id);
  window.requestAnimationFrame(() => focusRootStartView());
}

function toggleRelationLabels() {
  relationLabelsVisible.value = !relationLabelsVisible.value;
  renderGraph(selectedNode.value?.id);
}

function searchNode(keyword: string) {
  searchKeyword.value = keyword.trim();
  searchResults.value = manager.search(keyword);
  if (!searchResults.value.length) {
    message.value = keyword.trim() ? '未搜索到匹配节点' : '请输入搜索关键词';
    return;
  }
  message.value = '';
}

function selectSearchResult(target: KnowledgeNode) {
  searchResults.value = [];
  searchFocusActive.value = true;
  manager.focusContext(target.id);
  selectedNode.value = manager.getNode(target.id);
  renderGraph(target.id);
  const contextIds = manager.getConnectedIds(target.id);
  window.setTimeout(() => fitContextView(contextIds, target.id), 180);
  flashLocatedNode(target.id);
}

function restoreFullGraph() {
  searchFocusActive.value = false;
  searchResults.value = [];
  manager.expandAll();
  renderGraph(selectedNode.value?.id);
  window.requestAnimationFrame(() => fitFullGraphView());
}

function flashLocatedNode(id: string) {
  if (locateTimer) window.clearTimeout(locateTimer);
  if (locateBlinkTimer) window.clearInterval(locateBlinkTimer);
  locatedNodeId.value = id;
  applyLocatedState();
  let visible = true;
  let blinkCount = 0;
  locateBlinkTimer = window.setInterval(() => {
    visible = !visible;
    blinkCount += 1;
    const current = graph?.findById(id);
    if (current) updateNodeVisual(current, { hot: visible, opacity: 1 });
    if (blinkCount >= 6) {
      if (locateBlinkTimer) window.clearInterval(locateBlinkTimer);
      locateBlinkTimer = 0;
      locatedNodeId.value = '';
      applyLocatedState();
    }
  }, 320);
  locateTimer = window.setTimeout(() => {
    if (locateBlinkTimer) window.clearInterval(locateBlinkTimer);
    locateBlinkTimer = 0;
    locatedNodeId.value = '';
    applyLocatedState();
  }, 2100);
}

function searchResultPath(node: KnowledgeNode): string {
  return manager
    .getPathNodes(node.id)
    .filter((item) => item.type !== 'root')
    .map((item) => formatNodeName(item))
    .join(' / ');
}

function searchResultSystem(node: KnowledgeNode): string {
  if (node.type === 'root') return '中心主题';
  if (node.type === 'system') return '分类体系';
  if (node.system?.includes('国土调查')) return '国土调查工作分类';
  if (node.system?.includes('国土空间')) return '国土空间用地用海分类';
  return node.parentLabel || '未分组';
}

function switchVersion() {
  router.push('/knowledge-graph-d3');
}
</script>

<template>
  <section class="kg-page kg-page--g6">
    <KnowledgeGraphToolbar
      title="G6 知识图谱"
      subtitle="企业级用地用海分类关系展示"
      switch-text="切换 D3 版本"
      @search="searchNode"
      @reset="resetView"
      @expand-all="expandAll"
      @collapse-all="collapseAll"
      @relayout="relayout"
      :relation-labels-visible="relationLabelsVisible"
      @toggle-relation-labels="toggleRelationLabels"
      @switch-version="switchVersion"
    />
    <main class="kg-shell">
      <div class="kg-stage kg-stage--light">
        <div v-if="message" class="kg-message">{{ message }}</div>
        <button v-if="searchFocusActive" type="button" class="kg-focus-exit" @click="restoreFullGraph">
          返回全部图谱
        </button>
        <div v-if="searchResults.length" class="kg-search-results">
          <div class="kg-search-results__header">
            <strong>搜索结果</strong>
            <span>{{ searchKeyword }} · {{ searchResults.length }} 个</span>
          </div>
          <button
            v-for="node in searchResults"
            :key="node.id"
            type="button"
            class="kg-search-results__item"
            @click="selectSearchResult(node)"
          >
            <span>{{ formatNodeName(node) }}</span>
            <em>{{ searchResultPath(node) }}</em>
          </button>
        </div>
        <div ref="containerRef" class="kg-canvas"></div>
        <div class="kg-legend kg-floating-panel" :class="{ 'is-collapsed': legendCollapsed }">
          <button type="button" class="kg-panel-header" @click="legendCollapsed = !legendCollapsed">
            <span class="kg-floating-title">图例</span>
            <span class="kg-panel-toggle">{{ legendCollapsed ? '展开' : '收起' }}</span>
          </button>
          <div class="kg-panel-body kg-legend__body">
            <div class="kg-legend__section">
              <h3>节点类别</h3>
              <button
                v-for="item in nodeLegendItems"
                :key="item.id"
                type="button"
                class="kg-legend__item"
                :class="{ 'is-active': activeLegendId === item.id }"
                @mouseenter="setLegendHover(item.id)"
                @mouseleave="setLegendHover('')"
                @click="toggleLegend(item.id)"
              >
                <span class="kg-legend__swatch" :style="{ backgroundColor: item.color }"></span>
                <span>{{ item.label }}</span>
              </button>
            </div>
            <div class="kg-legend__section">
              <h3>关系类型</h3>
              <button
                v-for="item in relationLegendItems"
                :key="item.id"
                type="button"
                class="kg-legend__item kg-legend__item--line"
              >
                <span
                  class="kg-legend__line"
                  :class="{ 'kg-legend__line--dashed': item.lineType === 'dashed' }"
                  :style="{ borderColor: item.color, borderWidth: `${item.lineWidth || 2}px` }"
                ></span>
                <span>{{ item.label }}</span>
              </button>
            </div>
            <div v-if="activeLegendLabel" class="kg-legend__hint">已筛选：{{ activeLegendLabel }}</div>
          </div>
        </div>
        <div class="kg-overview kg-floating-panel" :class="{ 'is-collapsed': overviewCollapsed }">
          <button type="button" class="kg-panel-header" @click="overviewCollapsed = !overviewCollapsed">
            <span class="kg-floating-title">数据概览</span>
            <span class="kg-panel-toggle">{{ overviewCollapsed ? '展开' : '收起' }}</span>
          </button>
          <div class="kg-panel-body">
            <dl v-for="[label, value] in overviewItems" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </dl>
          </div>
        </div>
        <div
          v-if="tooltip.visible"
          class="kg-node-tooltip"
        >
          <dl v-for="[label, value] in tooltip.rows" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </dl>
        </div>
      </div>
      <KnowledgeGraphDetailPanel :node="selectedNode" :children="selectedChildren" />
    </main>
  </section>
</template>
