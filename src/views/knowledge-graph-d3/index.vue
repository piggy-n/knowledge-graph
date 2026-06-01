<script setup lang="ts">
import * as d3 from 'd3';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import KnowledgeGraphDetailPanel from '../../components/KnowledgeGraphDetailPanel.vue';
import KnowledgeGraphToolbar from '../../components/KnowledgeGraphToolbar.vue';
import rawGraphData from '../../data/landSeaKnowledgeGraph3.json';
import { formatNodeName, shortLabel, transformKnowledgeGraph, type KnowledgeEdge, type KnowledgeNode, type KnowledgeNodeType, type RawKnowledgeGraph } from '../../utils/graphDataTransform';
import { GraphExpandManager } from '../../utils/graphExpandManager';

type D3Node = KnowledgeNode & d3.SimulationNodeDatum & { fx?: number | null; fy?: number | null };
type D3Link = KnowledgeEdge & d3.SimulationLinkDatum<D3Node>;
type LegendItem = { id: string; type: KnowledgeNodeType; levelName?: string; label: string; color: string };

const router = useRouter();
const svgRef = ref<SVGSVGElement | null>(null);
const stageRef = ref<HTMLDivElement | null>(null);
const selectedNode = ref<KnowledgeNode>();
const message = ref('');
const tooltip = ref({
  visible: false,
  left: 0,
  top: 0,
  rows: [] as Array<[string, string]>,
});
const activeLegendId = ref('');
const hoveredLegendId = ref('');
const overviewItems = ref<Array<[string, string]>>([]);
const legendCollapsed = ref(false);
const overviewCollapsed = ref(false);
const relationLabelsVisible = ref(true);

let manager: GraphExpandManager;
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
let viewport: d3.Selection<SVGGElement, unknown, null, undefined>;
let linkLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
let linkLabelLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
let nodeLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
let simulation: d3.Simulation<D3Node, D3Link>;
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown>;
let resizeObserver: ResizeObserver | undefined;
const positionCache = new Map<string, Pick<D3Node, 'x' | 'y' | 'fx' | 'fy'>>();

const legendItems: LegendItem[] = [
  { id: 'root', type: 'root', label: '中心主题', color: '#38bdf8' },
  { id: 'system', type: 'system', label: '分类体系', color: '#8b5cf6' },
  { id: 'survey-first', type: 'survey-category', levelName: '一级类', label: '国土调查一级类', color: '#fb7185' },
  { id: 'survey-second', type: 'survey-detail', levelName: '二级类', label: '国土调查二级类', color: '#f59e0b' },
  { id: 'planning-first', type: 'planning-category', levelName: '一级类', label: '用地用海一级类', color: '#2dd4bf' },
  { id: 'planning-second', type: 'planning-detail', levelName: '二级类', label: '用地用海二级类', color: '#2563eb' },
  { id: 'planning-third', type: 'planning-detail', levelName: '三级类', label: '用地用海三级类', color: '#14b8a6' },
];

const activeLegendLabel = computed(() => {
  return legendItems.find((item) => item.id === activeLegendId.value)?.label;
});

try {
  const dataset = transformKnowledgeGraph(rawGraphData as RawKnowledgeGraph);
  manager = new GraphExpandManager(dataset);
  selectedNode.value = manager.getNode(dataset.rootId);
} catch (error) {
  message.value = error instanceof Error ? error.message : 'JSON 数据加载失败';
}

onMounted(async () => {
  await nextTick();
  if (!manager || !svgRef.value || !stageRef.value) return;
  initSvg();
  updateGraph();
  resizeObserver = new ResizeObserver(() => resetView());
  resizeObserver.observe(stageRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  simulation?.stop();
  svg?.on('.zoom', null);
});

function initSvg() {
  svg = d3.select(svgRef.value!);
  viewport = svg.append('g').attr('class', 'd3-viewport');
  linkLayer = viewport.append('g').attr('class', 'd3-links');
  linkLabelLayer = viewport.append('g').attr('class', 'd3-link-labels');
  nodeLayer = viewport.append('g').attr('class', 'd3-nodes');

  zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.22, 3.2])
    .on('zoom', (event) => viewport.attr('transform', event.transform.toString()));

  svg
    .call(zoomBehavior)
    .on('dblclick.zoom', null)
    .on('click', (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target === svgRef.value || target?.classList.contains('d3-viewport')) {
        clearSelectedNode();
      }
    });
  simulation = d3
    .forceSimulation<D3Node>()
    .force(
      'link',
      d3
        .forceLink<D3Node, D3Link>()
        .id((node) => node.id)
        .distance((link) => (link.relationType === 'mapping' ? 220 : 118))
        .strength((link) => (link.relationType === 'mapping' ? 0.08 : 0.38)),
    )
    .force(
      'charge',
      d3.forceManyBody<D3Node>().strength((node) => {
        if (node.type === 'root') return -820;
        if (node.type === 'system') return -540;
        if (node.level === 2) return -320;
        return -150;
      }),
    )
    .force('collide', d3.forceCollide<D3Node>().radius((node) => node.size / 2 + 28))
    .force('center', d3.forceCenter(0, 0))
    .force('x', d3.forceX<D3Node>((node) => node.x || 0).strength(0.045))
    .force('y', d3.forceY<D3Node>((node) => node.y || 0).strength(0.045))
    .on('tick', ticked);

  resetView();
}

function updateGraph(focusId?: string) {
  const data = manager.getVisibleGraph();
  const nodes = data.nodes.map((node) => toD3Node(node));
  const links = data.edges.map((edge) => ({ ...edge })) as D3Link[];
  updateOverview(data.nodes, data.edges);

  const linkSelection = linkLayer
    .selectAll<SVGLineElement, D3Link>('line')
    .data(links, (link: any) => link.id);

  linkSelection
    .exit()
    .transition()
    .duration(260)
    .style('opacity', 0)
    .remove();

  linkSelection
    .enter()
    .append('line')
    .attr('class', (link) => `d3-link d3-link--${link.relationType}`)
    .style('opacity', 0)
    .on('mouseenter', (_event, link) => applyEdgeHover(link.id))
    .on('mouseleave', () => clearHover())
    .transition()
    .duration(420)
    .style('opacity', (link) => (link.relationType === 'mapping' ? 0.52 : 0.62));

  const linkLabelSelection = linkLabelLayer
    .selectAll<SVGTextElement, D3Link>('text')
    .data(links, (link: any) => link.id);

  linkLabelSelection
    .exit()
    .transition()
    .duration(220)
    .style('opacity', 0)
    .remove();

  linkLabelSelection
    .enter()
    .append('text')
    .attr('class', (link) => `d3-link-label d3-link-label--${link.relationType}`)
    .classed('is-default-visible', (link) => isDefaultVisibleLabel(link))
    .style('opacity', 0)
    .text((link) => shortLabel(simplifyEdgeLabel(link), link.relationType === 'mapping' ? 10 : 8))
    .transition()
    .duration(420)
    .style('opacity', (link) => (isDefaultVisibleLabel(link) ? 0.92 : 0));

  const nodeSelection = nodeLayer
    .selectAll<SVGGElement, D3Node>('g')
    .data(nodes, (node: any) => node.id);

  nodeSelection
    .exit()
    .transition()
    .duration(320)
    .style('opacity', 0)
    .attr('transform', (node: any) => {
      const parent = node.parentId ? positionCache.get(node.parentId) : undefined;
      return `translate(${parent?.x || node.x || 0},${parent?.y || node.y || 0}) scale(0.25)`;
    })
    .remove();

  const nodeEnter = nodeSelection
    .enter()
    .append('g')
    .attr('class', (node) => `d3-node d3-node--${node.type}`)
    .attr('transform', (node) => {
      const parent = node.parentId ? positionCache.get(node.parentId) : undefined;
      return `translate(${parent?.x || node.x || 0},${parent?.y || node.y || 0}) scale(0.35)`;
    })
    .style('opacity', 0)
    .call(createDragBehavior());

  nodeEnter
    .append('circle')
    .attr('class', 'd3-node-halo')
    .attr('r', (node) => node.size / 2 + 7);

  nodeEnter
    .append('circle')
    .attr('r', (node) => node.size / 2)
    .attr('fill', (node) => node.color);

  nodeEnter
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .each(function renderText(node) {
      renderNodeText(d3.select(this), node);
    });

  nodeEnter
    .on('click', (event, node) => handleNodeClick(event, node))
    .on('dblclick', (event, node) => {
      event.stopPropagation();
      focusNode(node.id);
    })
    .on('mouseenter', (event, node) => {
      applyHover(node.id);
      showNodeTooltip(event, node);
    })
    .on('mousemove', (event) => moveTooltip(event))
    .on('mouseleave', () => {
      clearHover();
      hideTooltip();
    });

  nodeEnter
    .transition()
    .duration(420)
    .style('opacity', 1)
    .attr('transform', (node) => `translate(${node.x || 0},${node.y || 0}) scale(1)`);

  nodeLayer
    .selectAll<SVGGElement, D3Node>('g')
    .classed('is-expanded', (node) => Boolean(node.expanded))
    .classed('is-fixed', (node) => Boolean(node.fx != null || node.fy != null));

  applySelectedState();
  applyLegendState();

  simulation.nodes(nodes);
  const linkForce = simulation.force<d3.ForceLink<D3Node, D3Link>>('link');
  linkForce?.links(links);
  simulation.alpha(0.76).restart();

  if (focusId) {
    window.setTimeout(() => focusNode(focusId), 120);
  }
}

function toD3Node(node: KnowledgeNode): D3Node {
  const cached = positionCache.get(node.id);
  if (cached) {
    return { ...node, x: cached.x, y: cached.y, fx: cached.fx, fy: cached.fy };
  }
  const parent = node.parentId ? positionCache.get(node.parentId) : undefined;
  return {
    ...node,
    x: parent?.x ?? node.x,
    y: parent?.y ?? node.y,
  };
}

function ticked() {
  linkLayer
    .selectAll<SVGLineElement, D3Link>('line')
    .attr('x1', (link) => sourceNode(link).x || 0)
    .attr('y1', (link) => sourceNode(link).y || 0)
    .attr('x2', (link) => targetNode(link).x || 0)
    .attr('y2', (link) => targetNode(link).y || 0);

  linkLabelLayer
    .selectAll<SVGTextElement, D3Link>('text')
    .attr('x', (link) => ((sourceNode(link).x || 0) + (targetNode(link).x || 0)) / 2)
    .attr('y', (link) => ((sourceNode(link).y || 0) + (targetNode(link).y || 0)) / 2);

  nodeLayer
    .selectAll<SVGGElement, D3Node>('g')
    .attr('transform', (node) => {
      positionCache.set(node.id, { x: node.x, y: node.y, fx: node.fx, fy: node.fy });
      return `translate(${node.x || 0},${node.y || 0})`;
    });
}

function handleNodeClick(event: MouseEvent, node: D3Node) {
  event.stopPropagation();
  selectedNode.value = manager.getNode(node.id);
  if (manager.hasChildren(node.id)) {
    manager.toggle(node.id);
    updateGraph(node.id);
  } else {
    toggleFixed(node);
    updateGraph(node.id);
  }
}

function toggleFixed(node: D3Node) {
  const fixed = node.fx != null || node.fy != null;
  const next = positionCache.get(node.id) || node;
  positionCache.set(node.id, {
    x: next.x,
    y: next.y,
    fx: fixed ? null : next.x,
    fy: fixed ? null : next.y,
  });
}

function createDragBehavior() {
  return d3
    .drag<SVGGElement, D3Node>()
    .on('start', (event, node) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      node.fx = node.x;
      node.fy = node.y;
    })
    .on('drag', (event, node) => {
      node.fx = event.x;
      node.fy = event.y;
      positionCache.set(node.id, { x: event.x, y: event.y, fx: event.x, fy: event.y });
    })
    .on('end', (event) => {
      if (!event.active) simulation.alphaTarget(0);
    });
}

function applyHover(id: string) {
  const related = manager.getConnectedIds(id);
  nodeLayer
    .selectAll<SVGGElement, D3Node>('g')
    .classed('is-hot', (node) => node.id === id)
    .classed('is-dim', (node) => !related.has(node.id));
  linkLayer
    .selectAll<SVGLineElement, D3Link>('line')
    .classed('is-hot', (link) => sourceId(link) === id || targetId(link) === id)
    .classed('is-dim', (link) => sourceId(link) !== id && targetId(link) !== id);
  linkLabelLayer
    .selectAll<SVGTextElement, D3Link>('text')
    .classed('is-hot', (link) => sourceId(link) === id || targetId(link) === id)
    .classed('is-dim', (link) => sourceId(link) !== id && targetId(link) !== id);
}

function applyEdgeHover(edgeId: string) {
  linkLayer
    .selectAll<SVGLineElement, D3Link>('line')
    .classed('is-hot', (link) => link.id === edgeId)
    .classed('is-dim', (link) => link.id !== edgeId);
  linkLabelLayer
    .selectAll<SVGTextElement, D3Link>('text')
    .classed('is-hot', (link) => link.id === edgeId)
    .classed('is-dim', (link) => link.id !== edgeId);
  const targetLink = linkLayer.selectAll<SVGLineElement, D3Link>('line').filter((link) => link.id === edgeId).datum();
  if (!targetLink) return;
  const ids = new Set([sourceId(targetLink), targetId(targetLink)]);
  nodeLayer
    .selectAll<SVGGElement, D3Node>('g')
    .classed('is-hot', (node) => ids.has(node.id))
    .classed('is-dim', (node) => !ids.has(node.id));
}

function clearHover() {
  nodeLayer.selectAll('g').classed('is-hot', false).classed('is-dim', false);
  linkLayer.selectAll('line').classed('is-hot', false).classed('is-dim', false);
  linkLabelLayer.selectAll('text').classed('is-hot', false).classed('is-dim', false);
  applyLegendState();
  applySelectedState();
}

function applySelectedState() {
  if (!nodeLayer || !linkLayer || !linkLabelLayer) return;
  const id = selectedNode.value?.id;
  const related = id ? manager.getConnectedIds(id) : new Set<string>();
  nodeLayer
    .selectAll<SVGGElement, D3Node>('g')
    .classed('is-selected', (node) => node.id === id)
    .classed('is-selected-related', (node) => Boolean(id && related.has(node.id) && node.id !== id))
    .classed('is-selected-dim', (node) => Boolean(id && !related.has(node.id)));
  linkLayer
    .selectAll<SVGLineElement, D3Link>('line')
    .classed('is-selected-link', (link) => Boolean(id && (sourceId(link) === id || targetId(link) === id)))
    .classed('is-selected-dim', (link) => Boolean(id && sourceId(link) !== id && targetId(link) !== id));
  linkLabelLayer
    .selectAll<SVGTextElement, D3Link>('text')
    .classed('is-selected-link', (link) => Boolean(id && (sourceId(link) === id || targetId(link) === id)))
    .classed('is-selected-dim', (link) => Boolean(id && sourceId(link) !== id && targetId(link) !== id));
}

function clearSelectedNode() {
  selectedNode.value = undefined;
  clearHover();
  applySelectedState();
}

function renderNodeText(selection: d3.Selection<SVGTextElement, D3Node, null, undefined>, node: D3Node) {
  const { lines, fontSize, lineHeight } = getNodeTextSpec(node);
  const startY = -((lines.length - 1) * lineHeight) / 2;
  selection.selectAll('tspan').remove();
  lines.forEach((line, index) => {
    selection
      .append('tspan')
      .attr('x', 0)
      .attr('y', startY + index * lineHeight)
      .attr('font-size', fontSize)
      .text(line);
  });
}

function getNodeTextSpec(node: D3Node) {
  const name = node.displayName || node.name || node.label;
  const length = [...name].length;
  const radius = node.size / 2;
  const maxLines = node.type === 'root' || node.type === 'system' ? 3 : 2;
  let fontSize = 10;

  if (length <= 2) fontSize = Math.min(18, radius * 0.58);
  else if (length <= 3) fontSize = Math.min(16, radius * 0.52);
  else if (length <= 5) fontSize = Math.min(12, radius * 0.4);
  else if (length <= 8) fontSize = Math.min(10, radius * 0.34);
  else fontSize = Math.max(8, Math.min(10, radius * 0.28));

  const maxCharsPerLine = Math.max(2, Math.floor((radius * 1.52) / fontSize));
  const lines = wrapText(name, maxCharsPerLine, maxLines);
  const maxTextHeight = radius * 1.35;
  const rawLineHeight = fontSize * 1.18;
  const totalHeight = rawLineHeight * lines.length;

  if (totalHeight > maxTextHeight) {
    fontSize = Math.max(8, fontSize * (maxTextHeight / totalHeight));
  }

  fontSize = toEvenFontSize(fontSize);

  return {
    lines,
    fontSize,
    lineHeight: Number((fontSize * 1.18).toFixed(1)),
  };
}

function toEvenFontSize(size: number) {
  const rounded = Math.max(8, Math.round(size));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number) {
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

function showNodeTooltip(event: MouseEvent, node: D3Node) {
  tooltip.value = {
    visible: true,
    left: 0,
    top: 0,
    rows: buildTooltipRows(node),
  };
  moveTooltip(event);
}

function moveTooltip(event: MouseEvent) {
  const stageRect = stageRef.value?.getBoundingClientRect();
  const tooltipWidth = 280;
  const tooltipHeight = 220;
  const gap = 22;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const preferLeft = event.clientX + gap + tooltipWidth > viewportWidth;
  const preferTop = event.clientY + gap + tooltipHeight > viewportHeight;
  let left = preferLeft ? event.clientX - tooltipWidth - gap : event.clientX + gap;
  let top = preferTop ? event.clientY - tooltipHeight - gap : event.clientY + gap;
  if (stageRect) {
    left = Math.max(stageRect.left + 12, Math.min(left, stageRect.right - tooltipWidth - 12));
    top = Math.max(stageRect.top + 12, Math.min(top, stageRect.bottom - tooltipHeight - 12));
  }
  tooltip.value.left = Math.round(left);
  tooltip.value.top = Math.round(top);
}

function hideTooltip() {
  tooltip.value.visible = false;
}

function buildTooltipRows(node: KnowledgeNode): Array<[string, string]> {
  return [
    ['节点名称', formatNodeName(node)],
    ['节点编码', node.code || ''],
    ['分类层级', node.levelName || ''],
    ['所属分类', node.parentLabel || node.system || ''],
    ['对应关系', node.mapping || ''],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

function simplifyEdgeLabel(edge: KnowledgeEdge): string {
  if (edge.label === '对应分类') return '对应';
  if (edge.label && edge.label !== '对应' && edge.label.includes('对应')) return '';
  if (edge.label === '左侧分类体系' || edge.label === '右侧分类体系') return '分类体系';
  if (edge.label === '包含') return '包含';
  return edge.label || '';
}

function isDefaultVisibleLabel(edge: KnowledgeEdge): boolean {
  return Boolean(simplifyEdgeLabel(edge) && (edge.relationType === 'hierarchy' || isDashedRelation(edge)));
}

function isDashedRelation(edge: KnowledgeEdge): boolean {
  return edge.relationType === 'mapping';
}

function setLegendHover(id: string) {
  hoveredLegendId.value = id;
  applyLegendState();
}

function toggleLegend(id: string) {
  activeLegendId.value = activeLegendId.value === id ? '' : id;
  applyLegendState();
}

function applyLegendState() {
  if (!nodeLayer) return;
  const legend = legendItems.find((item) => item.id === (activeLegendId.value || hoveredLegendId.value));
  nodeLayer
    .selectAll<SVGGElement, D3Node>('g')
    .classed('is-legend-dim', (node) => Boolean(legend && !matchesLegend(node, legend)));
}

function matchesLegend(node: D3Node, legend: LegendItem): boolean {
  if (node.type !== legend.type) return false;
  return !legend.levelName || node.levelName === legend.levelName;
}

function toggleRelationLabels() {
  relationLabelsVisible.value = !relationLabelsVisible.value;
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
    ['对应关系', String(edges.filter((edge) => edge.relationType === 'mapping' || edge.label === '对应').length)],
  ];
}

function resetView() {
  if (!svgRef.value || !stageRef.value || !zoomBehavior) return;
  const { width, height } = stageRef.value.getBoundingClientRect();
  svg
    .transition()
    .duration(460)
    .call(zoomBehavior.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.9));
}

function focusNode(id: string) {
  const cached = positionCache.get(id);
  if (!cached || !stageRef.value) return;
  const { width, height } = stageRef.value.getBoundingClientRect();
  const scale = 1.42;
  svg
    .transition()
    .duration(560)
    .call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(width / 2 - (cached.x || 0) * scale, height / 2 - (cached.y || 0) * scale).scale(scale),
    );
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
  updateGraph(target.id);
}

function expandAll() {
  manager.expandAll();
  updateGraph(selectedNode.value?.id);
}

function collapseAll() {
  manager.collapseAll();
  selectedNode.value = manager.getVisibleGraph().nodes[0];
  updateGraph(selectedNode.value?.id);
  resetView();
}

function relayout() {
  positionCache.forEach((value) => {
    value.fx = null;
    value.fy = null;
  });
  simulation.nodes().forEach((node) => {
    node.fx = null;
    node.fy = null;
  });
  simulation.alpha(0.95).restart();
}

function switchVersion() {
  router.push('/knowledge-graph-g6');
}

function sourceNode(link: D3Link): D3Node {
  return typeof link.source === 'string' ? ({ x: 0, y: 0 } as D3Node) : link.source;
}

function targetNode(link: D3Link): D3Node {
  return typeof link.target === 'string' ? ({ x: 0, y: 0 } as D3Node) : link.target;
}

function sourceId(link: D3Link): string {
  const source = link.source as string | D3Node;
  return typeof source === 'string' ? source : source.id;
}

function targetId(link: D3Link): string {
  const target = link.target as string | D3Node;
  return typeof target === 'string' ? target : target.id;
}
</script>

<template>
  <section class="kg-page kg-page--d3">
    <KnowledgeGraphToolbar
      title="D3 知识图谱"
      subtitle="力导向动态开花展示"
      switch-text="切换 G6 版本"
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
      <div ref="stageRef" class="kg-stage kg-stage--light" :class="{ 'is-link-label-hidden': !relationLabelsVisible }">
        <div v-if="message" class="kg-message kg-message--light">{{ message }}</div>
        <svg ref="svgRef" class="kg-d3-svg" role="img" aria-label="D3 用地用海分类知识图谱"></svg>
        <div class="kg-legend kg-floating-panel" :class="{ 'is-collapsed': legendCollapsed }">
          <button type="button" class="kg-panel-header" @click="legendCollapsed = !legendCollapsed">
            <span class="kg-floating-title">图例</span>
            <span class="kg-panel-toggle">{{ legendCollapsed ? '展开' : '收起' }}</span>
          </button>
          <div class="kg-panel-body kg-legend__body">
            <button
              v-for="item in legendItems"
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
