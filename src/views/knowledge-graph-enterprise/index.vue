<script setup>
import G6 from '@antv/g6';
import * as d3 from 'd3';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import 'element-plus/dist/index.css';
import LeftPanel from './left-panel.vue';
import RightPanel from './right-panel.vue';
import rawGraphData from '../../data/data.json';
import { formatNodeName, transformKnowledgeGraph } from './graph-data';
import { GraphExpandManager } from './graph-expand-manager';

const containerRef = ref(null);
const selectedNode = ref();
const message = ref('');
const relationLabelsVisible = ref(true);
const searchResults = ref([]);
const searchKeyword = ref('');
const searchFocusActive = ref(false);
const locatedNodeId = ref('');
const overviewItems = ref([]);
const activeLegendId = ref('');
const hoveredLegendId = ref('');
let graph;
let manager;
let graphRendered = false;
let resizeFrame = 0;
let graphWidth = 0;
let graphHeight = 0;
let locateTimer = 0;
let locateBlinkTimer = 0;
const layoutCache = new Map();

const legendItems = [
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
  const dataset = transformKnowledgeGraph(rawGraphData);
  manager = new GraphExpandManager(dataset);
  manager.expandAll();
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

  graph.on('node:click', (event) => {
    const id = event.item?.getModel()?.id;
    if (!id) return;
    selectedNode.value = manager.getNode(id);
    applyHover(id);
  });

  graph.on('node:dblclick', (event) => {
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

  graph.on('node:mouseenter', (event) => {
    const id = event.item?.getModel()?.id;
    if (!id) return;
    applyHover(id);
  });

  graph.on('node:mouseleave', () => {
    clearHover();
  });

  graph.on('edge:mouseenter', (event) => {
    if (event.item) applyEdgeHover(event.item);
  });

  graph.on('edge:mouseleave', (event) => {
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
    window.requestAnimationFrame(() => fitFullGraphView());
    return;
  }
  if (retryCount < 10) {
    window.requestAnimationFrame(() => mountGraphWhenReady(retryCount + 1));
  } else {
    message.value = 'G6 容器尺寸异常，无法初始化图谱';
  }
}

function renderGraph() {
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
  graph.getNodes().forEach((item) => graph.clearItemStates(item));
  graph.getEdges().forEach((item) => graph.clearItemStates(item));

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

function getG6NodeTextSpec(node) {
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

function wrapG6Text(text, maxCharsPerLine, maxLines) {
  const chars = [...text.replace(/\s+/g, '')];
  const lines = [];
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

function toEvenFontSize(size) {
  const rounded = Math.max(10, Math.round(size));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function toG6Edge(edge) {
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

function buildForceLayout(nodes, edges) {
  if (nodes.length <= 1) {
    const singleMap = new Map();
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
        .forceLink(links)
        .id((node) => node.id)
        .distance((link) => (link.relationType === 'mapping' ? 300 : 190))
        .strength((link) => (link.relationType === 'mapping' ? 0.08 : 0.45)),
    )
    .force(
      'charge',
      d3.forceManyBody().strength((node) => {
        if (node.type === 'root') return -1200;
        if (node.type === 'system') return -760;
        if (node.level === 2) return -520;
        return -300;
      }),
    )
    .force('collide', d3.forceCollide().radius((node) => node.size / 2 + 40).iterations(2))
    .force('x', d3.forceX((node) => node.x || 0).strength(0.06))
    .force('y', d3.forceY((node) => node.y || 0).strength(0.06))
    .stop();

  for (let index = 0; index < 110; index += 1) {
    simulation.tick();
  }

  const result = new Map();
  simulationNodes.forEach((node) => {
    const x = Number.isFinite(node.x) ? node.x || 0 : 0;
    const y = Number.isFinite(node.y) ? node.y || 0 : 0;
    const position = { x, y };
    result.set(node.id, position);
    layoutCache.set(node.id, position);
  });
  return result;
}

function simplifyEdgeLabel(edge) {
  if (!edge.label || edge.label.includes('无对应') || edge.label.includes('暂无对应')) return '';
  if (edge.label === '对应分类') return '对应';
  if (edge.label !== '对应' && edge.label.includes('对应')) return '对应';
  if (edge.label === '包含') return '包含';
  if (edge.label === '左侧分类体系' || edge.label === '右侧分类体系') return '分类体系';
  return edge.label;
}

function isDefaultVisibleLabel(edge) {
  return Boolean(simplifyEdgeLabel(edge) && (edge.relationType === 'hierarchy' || edge.relationType === 'mapping'));
}

function edgeLineWidth(edge) {
  if (edge.relationType === 'mapping') return 1.8;
  const source = manager.getNode(edge.source);
  if (source?.type === 'root') return 4.2;
  if (source?.type === 'system') return 3.4;
  if (source?.levelName === '一级类') return 2.6;
  return 1.6;
}

function setEdgeTextState(item, active, forceHidden = false) {
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

function updateEdgeVisual(item, active = false) {
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

function applyHover(id) {
  const relatedIds = manager.getConnectedIds(id);
  const relatedEdgeIds = manager.getContextEdgeIds(id);
  graph.getNodes().forEach((item) => {
    const itemId = item.getModel().id;
    const related = relatedIds.has(itemId);
    updateNodeVisual(item, {
      hot: itemId === id,
      dim: itemId !== id && !related,
      opacity: itemId === id ? 1 : related ? 0.96 : 0.14,
    });
  });
  graph.getEdges().forEach((item) => {
    const model = item.getModel();
    const active = relatedEdgeIds.has(model.id);
    setEdgeTextState(item, active, !active);
    graph.setItemState(item, 'inactive', !active);
  });
}

function applyEdgeHover(edgeItem) {
  const edgeId = edgeItem.getModel().id;
  const model = edgeItem.getModel();
  const relatedIds = new Set([model.source, model.target]);
  graph.getNodes().forEach((item) => {
    const related = relatedIds.has(item.getModel().id);
    const itemId = item.getModel().id;
    updateNodeVisual(item, {
      hot: related,
      dim: !related,
      opacity: related ? 0.96 : 0.14,
    });
  });
  graph.getEdges().forEach((item) => {
    const active = item.getModel().id === edgeId;
    setEdgeTextState(item, active, !active);
    graph.setItemState(item, 'inactive', !active);
  });
}

function clearHover() {
  graph.getNodes().forEach((item) => {
    updateNodeVisual(item);
  });
  graph.getEdges().forEach((item) => {
    setEdgeTextState(item, false);
    graph.setItemState(item, 'inactive', false);
  });
  applyLocatedState();
  applyLegendState();
}

function applyLocatedState() {
  if (!graph) return;
  graph.getNodes().forEach((item) => {
    const itemId = item.getModel().id;
    updateNodeVisual(item, { hot: itemId === locatedNodeId.value });
  });
  graph.getEdges().forEach((item) => {
    graph.setItemState(item, 'inactive', false);
  });
}

function updateNodeVisual(item, options = {}) {
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

function setLegendHover(id) {
  if (id && !legendItems.find((item) => item.id === id)?.type) return;
  hoveredLegendId.value = id;
  applyLegendState();
}

function toggleLegend(id) {
  if (!legendItems.find((item) => item.id === id)?.type) return;
  activeLegendId.value = activeLegendId.value === id ? '' : id;
  applyLegendState();
}

function applyLegendState() {
  if (!graph) return;
  const legend = legendItems.find((item) => item.id === (activeLegendId.value || hoveredLegendId.value));
  graph.getNodes().forEach((item) => {
    const node = item.getModel().origin ;
    const dim = Boolean(legend && node && !matchesLegend(node, legend));
    updateNodeVisual(item, { dim, opacity: dim ? 0.14 : 0.92 });
  });
}

function matchesLegend(node, legend) {
  if (!legend.type) return false;
  if (node.type !== legend.type) return false;
  return !legend.levelName || node.levelName === legend.levelName;
}

function updateOverview(nodes, edges) {
  const typeCount = (type) => nodes.filter((node) => node.type === type).length;
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

function fitContextView(contextIds, focusId) {
  if (!graph || !containerRef.value) return;
  const items = [...contextIds].map((id) => graph.findById(id)).filter(Boolean);
  if (!items.length) {
    resetView();
    return;
  }

  if (items.length === 1 && focusId) {
    const focusItem = graph.findById(focusId);
    graph.zoomTo(1.12);
    if (focusItem) graph.focusItem(focusItem, true);
    return;
  }

  graph.fitView(58);
  const zoom = graph.getZoom ? graph.getZoom() : 1;
  const minZoom = items.length <= 6 ? 0.9 : items.length <= 12 ? 0.78 : 0.68;
  const maxZoom = items.length <= 6 ? 1.18 : 1.08;
  if (zoom < minZoom) graph.zoomTo(minZoom);
  if (zoom > maxZoom) graph.zoomTo(maxZoom);
  graph.fitCenter();
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

function searchNode(keyword) {
  searchKeyword.value = keyword.trim();
  searchResults.value = manager.search(keyword);
  if (!searchResults.value.length) {
    message.value = '';
    ElMessage.warning(keyword.trim() ? '未搜索到匹配节点' : '请输入搜索关键词');
    return;
  }
  message.value = '';
}

function selectSearchResult(target) {
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

function flashLocatedNode(id) {
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
    if (blinkCount >= 8) {
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
  }, 2800);
}

function searchResultPath(node) {
  return manager
    .getPathNodes(node.id)
    .filter((item) => item.type !== 'root')
    .map((item) => formatNodeName(item))
    .join(' / ');
}

function searchResultSystem(node) {
  if (node.type === 'root') return '中心主题';
  if (node.type === 'system') return '分类体系';
  if (node.system?.includes('国土调查')) return '国土调查工作分类';
  if (node.system?.includes('国土空间')) return '国土空间用地用海分类';
  return node.parentLabel || '未分组';
}
</script>

<template>
  <section class="kg-page kg-page--g6 kg-enterprise-page">
    <LeftPanel
      :node="selectedNode"
      :children="selectedChildren"
      :overview-items="overviewItems"
      :node-legend-items="nodeLegendItems"
      :relation-legend-items="relationLegendItems"
      :active-legend-id="activeLegendId"
      :active-legend-label="activeLegendLabel"
      @legend-hover="setLegendHover"
      @legend-toggle="toggleLegend"
    />
    <RightPanel
      :search-keyword="searchKeyword"
      :search-results="searchResults"
      :relation-labels-visible="relationLabelsVisible"
      :message="message"
      :search-focus-active="searchFocusActive"
      :search-result-path="searchResultPath"
      @search="searchNode"
      @expand-all="expandAll"
      @collapse-all="collapseAll"
      @toggle-relation-labels="toggleRelationLabels"
      @relayout="relayout"
      @select-result="selectSearchResult"
      @restore-full-graph="restoreFullGraph"
    >
      <template #canvas>
        <div ref="containerRef" class="kg-canvas"></div>
      </template>
    </RightPanel>
  </section>
</template>

<style scoped>
.kg-enterprise-page {
  display: flex;
  flex-direction: row;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  contain: layout paint size;
}

</style>
