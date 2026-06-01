<script setup lang="ts">
import G6 from '@antv/g6';
import * as d3 from 'd3';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import KnowledgeGraphDetailPanel from '../../components/KnowledgeGraphDetailPanel.vue';
import KnowledgeGraphToolbar from '../../components/KnowledgeGraphToolbar.vue';
import rawGraphData from '../../data/landSeaKnowledgeGraph2.json';
import { transformKnowledgeGraph, type KnowledgeEdge, type KnowledgeNode, type RawKnowledgeGraph } from '../../utils/graphDataTransform';
import { GraphExpandManager } from '../../utils/graphExpandManager';

const router = useRouter();
const containerRef = ref<HTMLDivElement | null>(null);
const selectedNode = ref<KnowledgeNode>();
const message = ref('');
const tooltip = ref({
  visible: false,
  left: 0,
  top: 0,
  rows: [] as Array<[string, string]>,
});

let graph: any;
let manager: GraphExpandManager;
let graphRendered = false;
let resizeFrame = 0;
let graphWidth = 0;
let graphHeight = 0;
const layoutCache = new Map<string, { x: number; y: number }>();

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
    nodeStateStyles: {
      active: {
        stroke: '#0f172a',
        lineWidth: 4,
        shadowColor: '#38bdf8',
        shadowBlur: 18,
      },
      inactive: {
        opacity: 0.18,
      },
      selected: {
        stroke: '#f59e0b',
        lineWidth: 4,
        shadowColor: '#f59e0b',
        shadowBlur: 22,
      },
    },
    edgeStateStyles: {
      active: {
        stroke: '#f59e0b',
        lineWidth: 2.8,
        opacity: 1,
      },
      inactive: {
        opacity: 0.08,
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

  graph.on('node:mouseenter', (event: any) => {
    const id = event.item?.getModel()?.id;
    if (!id) return;
    applyHover(id);
    showNodeTooltip(event, manager.getNode(id));
  });

  graph.on('node:mousemove', (event: any) => {
    moveTooltip(event);
  });

  graph.on('node:mouseleave', () => {
    clearHover();
    hideTooltip();
  });

  graph.on('edge:mouseenter', (event: any) => {
    if (event.item) setEdgeTextState(event.item, true);
  });

  graph.on('edge:mouseleave', (event: any) => {
    if (event.item) setEdgeTextState(event.item, false);
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

  const selectedId = focusId || selectedNode.value?.id;
  const selectedItem = selectedId ? graph.findById(selectedId) : undefined;
  if (selectedItem) {
    graph.setItemState(selectedItem, 'selected', true);
  }
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
      const position = layoutMap.get(node.id) || { x: node.x, y: node.y };
      return {
        id: node.id,
        label: node.displayLines.join('\n'),
        x: centerX + position.x,
        y: centerY + position.y,
        size: node.size,
        origin: node,
        style: {
          fill: isRoot ? 'l(90) 0:#38bdf8 1:#0ea5e9' : node.color,
          stroke: '#ffffff',
          lineWidth: isRoot ? 3 : 2,
          shadowColor: node.color,
          shadowBlur: isRoot ? 22 : 12,
          cursor: 'pointer',
          opacity: 0.92,
        },
        labelCfg: {
          position: 'center',
          offset: 0,
          style: {
            fill: '#ffffff',
            fontSize: isRoot ? 12 : node.level >= 3 ? 8 : 10,
            fontWeight: isRoot ? 700 : 600,
            lineHeight: isRoot ? 14 : 11,
            textAlign: 'center',
            textBaseline: 'middle',
          },
        },
      };
    }),
    edges: data.edges.map((edge) => toG6Edge(edge)),
  };
}

function toG6Edge(edge: KnowledgeEdge) {
  const mapping = edge.relationType === 'mapping';
  const label = simplifyEdgeLabel(edge);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label,
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
    style: {
      stroke: mapping ? 'rgba(245, 158, 11, 0.52)' : 'rgba(37, 99, 235, 0.25)',
      lineWidth: mapping ? 1.4 : 1.1,
      endArrow: !mapping,
      opacity: mapping ? 0.78 : 0.6,
      lineDash: mapping ? [5, 5] : undefined,
    },
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
        .distance((link) => (link.relationType === 'mapping' ? 260 : 165))
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
    .force('collide', d3.forceCollide<any>().radius((node) => node.size / 2 + 34).iterations(4))
    .force('x', d3.forceX<any>((node) => node.x || 0).strength(0.08))
    .force('y', d3.forceY<any>((node) => node.y || 0).strength(0.08))
    .stop();

  for (let index = 0; index < 180; index += 1) {
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
  if (edge.label === '对应分类') return '对应';
  if (edge.label === '包含' || edge.label === '左侧分类体系' || edge.label === '右侧分类体系') return '';
  return edge.label || '';
}

function setEdgeTextState(item: any, active: boolean) {
  const model = item.getModel();
  graph.setItemState(item, 'active', active);
  graph.updateItem(item, {
    labelCfg: {
      ...model.labelCfg,
      style: {
        ...model.labelCfg?.style,
        fill: '#ffffff',
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

function applyHover(id: string) {
  const relatedIds = manager.getConnectedIds(id);
  graph.getNodes().forEach((item: any) => {
    const itemId = item.getModel().id;
    graph.setItemState(item, 'active', itemId === id);
    graph.setItemState(item, 'inactive', !relatedIds.has(itemId));
  });
  graph.getEdges().forEach((item: any) => {
    const model = item.getModel();
    const active = model.source === id || model.target === id;
    graph.setItemState(item, 'active', active);
    graph.setItemState(item, 'inactive', !active);
  });
}

function clearHover() {
  graph.getNodes().forEach((item: any) => {
    graph.setItemState(item, 'active', false);
    graph.setItemState(item, 'inactive', false);
  });
  graph.getEdges().forEach((item: any) => {
    graph.setItemState(item, 'active', false);
    graph.setItemState(item, 'inactive', false);
  });
}

function showNodeTooltip(event: any, node?: KnowledgeNode) {
  if (!node) return;
  tooltip.value = {
    visible: true,
    left: 0,
    top: 0,
    rows: buildTooltipRows(node),
  };
  moveTooltip(event);
}

function moveTooltip(event: any) {
  const rawEvent = event.originalEvent || event;
  tooltip.value.left = (rawEvent.clientX || 0) + 14;
  tooltip.value.top = (rawEvent.clientY || 0) + 14;
}

function hideTooltip() {
  tooltip.value.visible = false;
}

function buildTooltipRows(node: KnowledgeNode): Array<[string, string]> {
  return [
    ['层级', node.levelName || ''],
    ['编号', node.code || ''],
    ['名称', node.displayName || node.name || node.label],
    ['所属分类', node.parentLabel || node.system || ''],
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

function expandAll() {
  manager.expandAll();
  renderGraph(selectedNode.value?.id);
  resetView();
}

function collapseAll() {
  manager.collapseAll();
  layoutCache.clear();
  selectedNode.value = manager.getVisibleGraph().nodes[0];
  renderGraph(selectedNode.value?.id);
  resetView();
}

function searchNode(keyword: string) {
  const target = manager.searchFirst(keyword);
  if (!target) {
    message.value = keyword.trim() ? '未搜索到匹配节点' : '请输入搜索关键词';
    return;
  }
  message.value = '';
  manager.revealNode(target.id);
  selectedNode.value = manager.getNode(target.id);
  renderGraph(target.id);
  const item = graph.findById(target.id);
  if (item) graph.focusItem(item, true);
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
      @relayout="resetView"
      @switch-version="switchVersion"
    />
    <main class="kg-shell">
      <div class="kg-stage kg-stage--dark">
        <div v-if="message" class="kg-message">{{ message }}</div>
        <div ref="containerRef" class="kg-canvas"></div>
        <div
          v-if="tooltip.visible"
          class="kg-node-tooltip"
          :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }"
        >
          <dl v-for="[label, value] in tooltip.rows" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </dl>
        </div>
      </div>
      <KnowledgeGraphDetailPanel :node="selectedNode" />
    </main>
  </section>
</template>
