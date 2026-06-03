import G6 from '@antv/g6';
import * as d3 from 'd3';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import rawGraphData from '../../data/data.json';
import { formatNodeName, transformKnowledgeGraph } from './graph-data';
import { GraphExpandManager } from './graph-expand-manager';

// 企业版图谱页面的组合式逻辑入口，集中维护图谱状态和交互方法。
export function useEnterpriseGraph() {
  // G6 渲染容器引用，由画布组件回传。
  const containerRef = ref(null);
  // 画布全屏外壳引用，用于进入和退出局部全屏。
  const canvasShellRef = ref(null);
  // 当前左侧详情面板展示的节点。
  const selectedNode = ref();
  // 图谱区域轻量提示文案。
  const message = ref('');
  // 关系文字显示开关状态。
  const relationLabelsVisible = ref(true);
  // 当前搜索命中的节点列表。
  const searchResults = ref([]);
  // 当前搜索关键词。
  const searchKeyword = ref('');
  // 图谱数据视图模式：fullGraph 为完整图谱，searchGraph 为搜索局部关系图。
  const graphViewMode = ref('fullGraph');
  // 搜索结果进入局部关系视图时的上下文节点，供展开、收起、重算布局复用。
  const searchContextId = ref('');
  // 搜索定位闪烁中的节点 ID。
  const locatedNodeId = ref('');
  // 单击产生的持久聚焦节点 ID。
  const selectedFocusId = ref('');
  // 左侧数据概览指标。
  const overviewItems = ref([]);
  // 当前点击选中的图例 ID。
  const activeLegendId = ref('');
  // 当前鼠标悬浮的图例 ID。
  const hoveredLegendId = ref('');
  // 图谱交互模式：选择、漫游、多选三者互斥。
  const graphMode = ref('select');
  // 当前图谱区域是否处于全屏状态。
  const isFullscreen = ref(false);
  // 多选节点 ID 集合，用于在重新渲染后恢复节点选中态。
  const selectedMultiNodeIds = ref(new Set());
  // G6 图实例。
  let graph;
  // 图谱展开收起状态管理器。
  let manager;
  // G6 是否已经完成首次 render。
  let graphRendered = false;
  // resize 的 requestAnimationFrame 句柄。
  let resizeFrame = 0;
  // 最近一次记录的画布宽度。
  let graphWidth = 0;
  // 最近一次记录的画布高度。
  let graphHeight = 0;
  // 搜索定位高亮结束定时器。
  let locateTimer = 0;
  // 搜索定位闪烁定时器。
  let locateBlinkTimer = 0;
  // 延迟单击聚焦，给双击展开留出取消单击的窗口。
  let nodeClickTimer = 0;
  // 布局坐标缓存，减少重复渲染时的位置抖动。
  const layoutCache = new Map();
  // 页面挂载状态，避免 ref 先后顺序导致重复初始化。
  let graphMounted = false;

  // 接收画布容器元素，供 G6 初始化和 resize 使用。
  function setContainerElement(element) {
    containerRef.value = element;
    if (element && graphMounted && manager && !graph) mountGraphWhenReady();
  }

  // 接收画布外壳元素，供全屏 API 使用。
  function setCanvasShellElement(element) {
    canvasShellRef.value = element;
  }

  // 图例配置同时驱动左侧图例和图例筛选逻辑。
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

  // 节点图例项，过滤掉关系线图例。
  const nodeLegendItems = computed(() => legendItems.filter((item) => item.type));
  // 关系图例项，过滤掉节点类型图例。
  const relationLegendItems = computed(() => legendItems.filter((item) => item.lineType));
  // 当前详情节点的下级节点列表。
  const selectedChildren = computed(() => (selectedNode.value && manager ? manager.getChildren(selectedNode.value.id) : []));
  // 当前多选节点快照，用于左侧列表和导出。
  const selectedMultiNodes = computed(() => {
    if (!manager) return [];
    return [...selectedMultiNodeIds.value]
      .map((id) => manager.getNode(id))
      .filter(Boolean);
  });


  // 统一组装展示组件 props，页面层只负责透传。
  const leftPanelProps = computed(() => ({
    node: selectedNode.value,
    children: selectedChildren.value,
    multiMode: graphMode.value === 'multi',
    multiSelectedNodes: selectedMultiNodes.value,
    multiNodePath: formatMultiNodePath,
    overviewItems: overviewItems.value,
    nodeLegendItems: nodeLegendItems.value,
    relationLegendItems: relationLegendItems.value,
    activeLegendId: activeLegendId.value,
  }));

  // 右侧内容组件 props，承接搜索、工具条和提示状态。
  const rightPanelContentProps = computed(() => ({
    searchKeyword: searchKeyword.value,
    searchResults: searchResults.value,
    relationLabelsVisible: relationLabelsVisible.value,
    message: message.value,
    searchFocusActive: graphViewMode.value === 'searchGraph',
    searchResultPath,
  }));

  // 画布组件 props，只包含工具栏和全屏展示状态。
  const canvasPanelProps = computed(() => ({
    graphMode: graphMode.value,
    isFullscreen: isFullscreen.value,
  }));

  try {
    // 原始 JSON 转换后的运行时数据集。
    const dataset = transformKnowledgeGraph(rawGraphData);
    manager = new GraphExpandManager(dataset);
    manager.expandAll();
    selectedNode.value = manager.getNode(dataset.rootId);
  } catch {
    message.value = 'JSON 数据加载失败';
  }

  // 页面挂载后等待 DOM 完成，再初始化 G6 和监听器。
  onMounted(async () => {
    graphMounted = true;
    await nextTick();
    window.addEventListener('resize', resizeGraph);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    if (!manager || !containerRef.value) return;
    mountGraphWhenReady();
  });

  // 页面卸载时清理 G6、定时器和全局监听。
  onBeforeUnmount(() => {
    graphMounted = false;
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    if (locateTimer) window.clearTimeout(locateTimer);
    if (locateBlinkTimer) window.clearInterval(locateBlinkTimer);
    clearPendingNodeClick();
    window.removeEventListener('resize', resizeGraph);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    graph?.destroy();
    graph = undefined;
    graphRendered = false;
  });

  // 初始化 G6 实例和事件，具体行为由当前图谱模式分流。
  function initGraph() {
    // 当前 G6 容器 DOM。
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
        default: [
          {
            type: 'drag-canvas',
            allowDragOnItem: { node: true, edge: false, combo: false },
            shouldBegin: (event) => {
              // 当前拖拽命中的节点 ID，空值表示拖动画布。
              const id = event.item?.getModel()?.id;
              if (!id) return true;
              return isFocusLimitedMode() && !canUseFocusedContextNode(id);
            },
          },
          'zoom-canvas',
          {
            type: 'drag-node',
            shouldBegin: (event) => {
              if (!['roam', 'multi'].includes(graphMode.value)) return true;
              // 漫游和多选模式下用于判断节点是否允许被拖动。
              const id = event.item?.getModel()?.id;
              return !id || canUseFocusedContextNode(id);
            },
          },
        ],
      },
      defaultNode: {
        type: 'circle',
        labelCfg: {
          position: 'center',
          style: {
            fill: '#0f172a',
            fontSize: 10,
            fontWeight: 500,
            lineHeight: 12,
            cursor: 'pointer',
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
          opacity: 0.05,
        },
      },
    });

    graph.on('node:click', (event) => {
      // 单击节点 ID，用于区分普通选择、漫游查看和多选。
      const id = event.item?.getModel()?.id;
      if (!id) return;
      if (graphMode.value === 'multi') {
        if (!canUseFocusedContextNode(id)) return;
        toggleMultiNode(id);
        return;
      }
      if (graphMode.value === 'roam') {
        if (!canUseFocusedContextNode(id)) return;
        selectedNode.value = manager.getNode(id);
        return;
      }
      if (graphMode.value !== 'select') return;
      clearPendingNodeClick();
      nodeClickTimer = window.setTimeout(() => {
        nodeClickTimer = 0;
        selectedNode.value = manager.getNode(id);
        selectedFocusId.value = id;
        applySelectedFocus();
      }, 260);
    });

    graph.on('node:dblclick', (event) => {
      // 双击节点 ID，只参与展开收起，不参与单击聚焦。
      const id = event.item?.getModel()?.id;
      if (!id) return;
      if (graphMode.value !== 'select') return;
      clearPendingNodeClick();
      // 搜索局部上下文 ID，存在时只在局部图内展开收起。
      const contextId = getActiveSearchContextId();
      if (contextId) {
        manager.toggleInContext(id, contextId);
        selectedNode.value = manager.getNode(id);
        clearFocusVisualState();
        renderGraph(id);
        clearFocusVisualState();
        window.requestAnimationFrame(() => fitVisibleSearchContextView(contextId));
        return;
      }
      manager.toggle(id);
      selectedNode.value = manager.getNode(id);
      clearFocusVisualState();
      renderGraph(id);
      clearFocusVisualState();
    });

    graph.on('canvas:click', () => {
      if (graphMode.value !== 'select') return;
      clearPendingNodeClick();
      selectedNode.value = undefined;
      selectedFocusId.value = '';
      stopLocatedFlash();
      resetGraphVisualState();
    });

    graph.on('node:mouseenter', (event) => {
      if (graphMode.value !== 'select') return;
      // hover 节点 ID，仅选择模式用于临时聚焦。
      const id = event.item?.getModel()?.id;
      if (!id) return;
      applyHover(id);
    });

    graph.on('node:mouseleave', () => {
      if (graphMode.value !== 'select') return;
      clearHover();
    });

    graph.on('edge:mouseenter', (event) => {
      if (graphMode.value !== 'select') return;
      if (event.item) applyEdgeHover(event.item);
    });

    graph.on('edge:mouseleave', (event) => {
      if (graphMode.value !== 'select') return;
      if (event.item) {
        clearHover();
      }
    });
  }

  // 清理延迟单击定时器，避免双击时残留单击聚焦。
  function clearPendingNodeClick() {
    if (!nodeClickTimer) return;
    window.clearTimeout(nodeClickTimer);
    nodeClickTimer = 0;
  }

  // 清理持久聚焦和由聚焦产生的节点、边视觉状态。
  function clearFocusVisualState() {
    selectedFocusId.value = '';
    if (graph) resetGraphVisualState();
  }

  // 等待画布容器有尺寸后再挂载 G6。
  function mountGraphWhenReady(retryCount = 0) {
    // 当前尝试挂载时的画布容器。
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

  // 渲染当前可见图谱，并恢复图例、聚焦、搜索定位视觉状态。
  function renderGraph() {
    if (!graph || !containerRef.value) return;
    // 当前可见节点和边。
    const visibleData = manager.getVisibleGraph();
    updateOverview(visibleData.nodes, visibleData.edges);
    // 转换后的 G6 数据。
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

    applyLegendState();
    applySelectedFocus();
    applyLocatedState();
  }

  // 将当前可见知识图谱转换为 G6 节点和边。
  function toG6Data() {
    // 当前画布宽度。
    const width = containerRef.value?.clientWidth || 1200;
    // 当前画布高度。
    const height = containerRef.value?.clientHeight || 760;
    // G6 坐标中心点 X。
    const centerX = width / 2;
    // G6 坐标中心点 Y。
    const centerY = height / 2;
    // 当前可见图谱数据。
    const data = manager.getVisibleGraph();
    // 力导向布局后的节点坐标。
    const layoutMap = buildForceLayout(data.nodes, data.edges);

    return {
      nodes: data.nodes.map((node) => {
        // 是否为根节点，根节点使用更强视觉样式。
        const isRoot = node.type === 'root';
        // 当前节点中心文字的分行和字号配置。
        const textSpec = getG6NodeTextSpec(node);
        // 当前节点布局坐标，优先使用缓存布局。
        const position = layoutMap.get(node.id) || { x: node.x, y: node.y };
        // 当前节点填充色，根节点使用渐变。
        const nodeFill = isRoot ? 'l(90) 0:#38bdf8 1:#0ea5e9' : node.color;
        // 当前节点描边宽度。
        const nodeLineWidth = isRoot ? 3 : 2;
        // 当前节点默认样式，后续 hover 和聚焦都以此为基准恢复。
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
              fontWeight: isRoot ? 700 : 500,
              lineHeight: textSpec.lineHeight,
              textAlign: 'center',
              textBaseline: 'middle',
              cursor: 'pointer',
            },
            style: {
              fill: '#ffffff',
              fontSize: textSpec.fontSize,
              fontWeight: isRoot ? 700 : 500,
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

  // 根据节点半径和名称长度计算中心文字分行和字号。
  function getG6NodeTextSpec(node) {
    // 节点展示名称，优先使用清洗后的业务名称。
    const name = node.displayName || node.name || node.label;
    // 节点名称字符长度，用于字号分档。
    const length = [...name].length;
    // 节点半径，用于约束文字最大宽高。
    const radius = node.size / 2;
    // 当前节点最多允许的文字行数。
    const maxLines = node.type === 'root' || node.type === 'system' ? 3 : 2;
    // 初始字号，后续按节点尺寸和文本长度调整。
    let fontSize = 10;

    if (length <= 2) fontSize = Math.min(24, radius * 0.68);
    else if (length <= 3) fontSize = Math.min(22, radius * 0.62);
    else if (length <= 5) fontSize = Math.min(20, radius * 0.56);
    else if (length <= 8) fontSize = Math.min(16, radius * 0.44);
    else fontSize = Math.max(10, Math.min(14, radius * 0.38));

    // 单行最多字符数，保证文字不溢出节点圆形区域。
    const maxCharsPerLine = Math.max(2, Math.floor((radius * 1.52) / fontSize));
    // 节点文字分行结果。
    const lines = wrapG6Text(name, maxCharsPerLine, maxLines);
    // 节点内文字允许占用的最大高度。
    const maxTextHeight = radius * 1.35;
    // 未压缩前的行高。
    const rawLineHeight = fontSize * 1.18;
    // 当前分行后的总文字高度。
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

  // 中文节点名称按固定字符数切分，超出行数时尾行省略。
  function wrapG6Text(text, maxCharsPerLine, maxLines) {
    // 去除空白后的字符数组。
    const chars = [...text.replace(/\s+/g, '')];
    // 分行后的文本数组。
    const lines = [];
    for (let index = 0; index < chars.length; index += maxCharsPerLine) {
      lines.push(chars.slice(index, index + maxCharsPerLine).join(''));
    }
    if (lines.length > maxLines) {
      // 可见行集合，超过行数后只保留前几行。
      const visible = lines.slice(0, maxLines);
      // 需要追加省略号的最后一行。
      const last = visible[visible.length - 1];
      visible[visible.length - 1] = `${last.slice(0, Math.max(1, maxCharsPerLine - 1))}...`;
      return visible;
    }
    return lines;
  }

  // 将字号修正为偶数字号，降低低缩放层级下的文字发糊感。
  function toEvenFontSize(size) {
    // 四舍五入后的最小字号。
    const rounded = Math.max(10, Math.round(size));
    return rounded % 2 === 0 ? rounded : rounded + 1;
  }

  // 将业务边转换为 G6 边模型。
  function toG6Edge(edge) {
    // 是否为对应关系边。
    const mapping = edge.relationType === 'mapping';
    // 简化后的关系文字。
    const labelText = simplifyEdgeLabel(edge);
    // 当前开关状态下实际显示的关系文字。
    const label = relationLabelsVisible.value && isDefaultVisibleLabel(edge) ? labelText : '';
    // 当前关系文字背景，文字隐藏时同步隐藏背景块。
    const labelBackground = edgeLabelBackground(false, Boolean(label));
    // 当前关系线宽。
    const lineWidth = edgeLineWidth(edge);
    // 当前关系线默认样式，聚焦后会基于该样式恢复。
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
          background: labelBackground,
        },
      },
      originStyle: { ...edgeStyle },
      style: { ...edgeStyle },
    };
  }

  // 基于当前可见节点和边计算力导布局坐标。
  function buildForceLayout(nodes, edges) {
    if (nodes.length <= 1) {
      // 单节点场景固定放在画布中心。
      const singleMap = new Map();
      nodes.forEach((node) => singleMap.set(node.id, { x: 0, y: 0 }));
      return singleMap;
    }

    // 参与 d3 力导模拟的节点副本。
    const simulationNodes = nodes.map((node) => {
      // 上一次布局缓存坐标。
      const cached = layoutCache.get(node.id);
      return {
        ...node,
        x: cached?.x ?? node.x,
        y: cached?.y ?? node.y,
        fx: node.type === 'root' ? 0 : undefined,
        fy: node.type === 'root' ? 0 : undefined,
      };
    });
    // 参与 d3 力导模拟的边副本。
    const links = edges.map((edge) => ({ ...edge }));

    // d3 力导模拟器，当前只用于同步计算布局。
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

    // 本轮布局计算结果。
    const result = new Map();
    simulationNodes.forEach((node) => {
      // 归一化后的 X 坐标。
      const x = Number.isFinite(node.x) ? node.x || 0 : 0;
      // 归一化后的 Y 坐标。
      const y = Number.isFinite(node.y) ? node.y || 0 : 0;
      // 当前节点最终坐标。
      const position = { x, y };
      result.set(node.id, position);
      layoutCache.set(node.id, position);
    });
    return result;
  }

  // 统一简化原始关系文字，减少图中重复长文案。
  function simplifyEdgeLabel(edge) {
    if (!edge.label || edge.label.includes('无对应') || edge.label.includes('暂无对应')) return '';
    if (edge.label === '对应分类') return '对应';
    if (edge.label !== '对应' && edge.label.includes('对应')) return '对应';
    if (edge.label === '包含') return '包含';
    if (edge.label === '左侧分类体系' || edge.label === '右侧分类体系') return '分类体系';
    return edge.label;
  }

  // 判断关系文字是否允许在默认状态下显示。
  function isDefaultVisibleLabel(edge) {
    return Boolean(simplifyEdgeLabel(edge) && (edge.relationType === 'hierarchy' || edge.relationType === 'mapping'));
  }

  // 根据关系类型和来源节点层级计算线宽。
  function edgeLineWidth(edge) {
    if (edge.relationType === 'mapping') return 1.8;
    // 关系源节点，用于判断根节点和体系节点。
    const source = manager.getNode(edge.source);
    if (source?.type === 'root') return 4.2;
    if (source?.type === 'system') return 3.4;
    if (source?.levelName === '一级类') return 2.6;
    return 1.6;
  }

  // 更新关系文字显示状态和激活样式。
  function setEdgeTextState(item, active, forceHidden = false, options = {}) {
    // G6 边模型。
    const model = item.getModel();
    updateEdgeVisual(item, active, options);
    // 默认关系文字，受“显示关系文字”开关控制。
    const defaultLabel = relationLabelsVisible.value && model.originLabel && (model.relationType === 'hierarchy' || model.relationType === 'mapping') ? model.originLabel : '';
    // 当前最终显示的关系文字。
    const nextLabel = forceHidden ? '' : active && relationLabelsVisible.value ? model.originLabel : defaultLabel;
    // 当前关系文字背景，文字为空时不保留底块。
    const nextBackground = edgeLabelBackground(active, Boolean(nextLabel));
    graph.updateItem(item, {
      label: nextLabel,
      labelCfg: {
        ...model.labelCfg,
        style: {
          ...model.labelCfg?.style,
          fill: active ? '#0f172a' : model.originLabelFill || model.labelCfg?.style?.fill,
          fontSize: active ? 12 : model.originFontSize || model.labelCfg?.style?.fontSize,
          fontWeight: active ? 800 : model.originFontWeight || model.labelCfg?.style?.fontWeight,
          background: nextBackground,
        },
      },
    });
  }

  // 根据关系文字可见性返回背景配置，隐藏文字时去掉可见底块和占位 padding。
  function edgeLabelBackground(active, visible) {
    if (!visible) {
      return {
        fill: 'rgba(255, 255, 255, 0)',
        padding: [0, 0, 0, 0],
        radius: 0,
      };
    }
    return {
      fill: active ? 'rgba(255, 247, 237, 0.96)' : 'rgba(255, 255, 255, 0.78)',
      padding: active ? [3, 6, 3, 6] : [2, 4, 2, 4],
      radius: active ? 5 : 4,
    };
  }

  // 更新关系线条、箭头和透明度。
  function updateEdgeVisual(item, active = false, options = {}) {
    // G6 边模型。
    const model = item.getModel();
    // 关系线原始样式。
    const baseStyle = model.originStyle || model.style || {};
    // 是否为对应关系。
    const mapping = model.relationType === 'mapping';
    // 原始线宽。
    const lineWidth = Number(baseStyle.lineWidth || 1.6);
    // 非激活关系是否隐藏箭头。
    const hideArrow = options.hideInactiveArrow && !active;
    graph.updateItem(item, {
      style: {
        ...baseStyle,
        stroke: active && mapping ? '#f59e0b' : baseStyle.stroke,
        lineWidth: active ? lineWidth + (mapping ? 1.4 : 1.8) : lineWidth,
        opacity: active ? 1 : baseStyle.opacity ?? 0.6,
        endArrow: hideArrow
          ? false
          : {
              ...(baseStyle.endArrow || {}),
              fill: active && mapping ? '#f59e0b' : baseStyle.endArrow?.fill,
            },
      },
    });
  }

  // 节点和边的 hover、聚焦、图例过滤视觉状态。
  function applyHover(id) {
    applyNodeFocus(id, {
      dimOpacity: 0.08,
      relatedOpacity: 0.96,
      hideDimLabels: shouldHideDimLabelsInFocus(),
    });
  }

  // 应用单击产生的持久聚焦状态。
  function applySelectedFocus() {
    if (!selectedFocusId.value || !manager?.isVisible(selectedFocusId.value)) {
      selectedFocusId.value = '';
      return;
    }

    applyNodeFocus(selectedFocusId.value, {
      dimOpacity: 0.06,
      relatedOpacity: 0.98,
      hideDimLabels: shouldHideDimLabelsInFocus(),
    });
  }

  // 选择模式下保留非聚焦节点名称，漫游和多选沿用隐藏策略。
  function shouldHideDimLabelsInFocus() {
    return graphMode.value !== 'select';
  }

  // 聚焦存在时，只允许当前聚焦上下文内节点参与漫游查看、多选和拖动。
  function canUseFocusedContextNode(id) {
    if (!selectedFocusId.value) return true;
    if (!manager?.isVisible(selectedFocusId.value)) return false;
    return manager.getConnectedIds(selectedFocusId.value).has(id);
  }

  // 按节点上下文更新节点、关系的聚焦和淡化样式。
  function applyNodeFocus(id, options = {}) {
    // 当前聚焦节点的上下文节点集合。
    const relatedIds = manager.getConnectedIds(id);
    // 当前聚焦节点的上下文关系集合。
    const relatedEdgeIds = manager.getContextEdgeIds(id);
    // 非上下文节点透明度。
    const dimOpacity = options.dimOpacity ?? 0.08;
    // 上下文节点透明度。
    const relatedOpacity = options.relatedOpacity ?? 0.96;
    // 非上下文节点标签透明度。
    const dimLabelOpacity = options.hideDimLabels ? undefined : 1;
    graph.getNodes().forEach((item) => {
      // 当前遍历节点 ID。
      const itemId = item.getModel().id;
      // 当前节点是否属于聚焦上下文。
      const related = relatedIds.has(itemId);
      updateNodeVisual(item, {
        hot: itemId === id,
        dim: itemId !== id && !related,
        opacity: itemId === id ? 1 : related ? relatedOpacity : dimOpacity,
        labelHidden: options.hideDimLabels && itemId !== id && !related,
        labelOpacity: itemId !== id && !related ? dimLabelOpacity : undefined,
      });
    });
    graph.getEdges().forEach((item) => {
      // 当前遍历关系模型。
      const model = item.getModel();
      // 当前关系是否属于聚焦上下文。
      const active = relatedEdgeIds.has(model.id);
      setEdgeTextState(item, active, !active, { hideInactiveArrow: true });
      graph.setItemState(item, 'inactive', !active);
    });
  }

  // 关系 hover 时只高亮该关系两端节点。
  function applyEdgeHover(edgeItem) {
    // 当前 hover 关系 ID。
    const edgeId = edgeItem.getModel().id;
    // 当前 hover 关系模型。
    const model = edgeItem.getModel();
    // 当前 hover 关系两端节点 ID。
    const relatedIds = new Set([model.source, model.target]);
    graph.getNodes().forEach((item) => {
      // 当前节点是否为关系端点。
      const related = relatedIds.has(item.getModel().id);
      // 当前遍历节点 ID。
      const itemId = item.getModel().id;
      updateNodeVisual(item, {
        hot: related,
        dim: !related,
        opacity: related ? 0.96 : 0.14,
        labelOpacity: graphMode.value === 'select' && !related ? 1 : undefined,
      });
    });
    graph.getEdges().forEach((item) => {
      // 当前关系是否为 hover 关系。
      const active = item.getModel().id === edgeId;
      setEdgeTextState(item, active, !active, { hideInactiveArrow: true });
      graph.setItemState(item, 'inactive', !active);
    });
  }

  // 清理 hover 产生的临时视觉状态。
  function clearHover() {
    if (selectedFocusId.value) {
      applyLegendState();
      applySelectedFocus();
      applyLocatedState();
      return;
    }

    resetGraphVisualState();
  }

  // 恢复所有节点和关系的默认视觉状态。
  function resetGraphVisualState() {
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

  // 应用搜索定位闪烁状态。
  function applyLocatedState() {
    if (!graph) return;
    if (!locatedNodeId.value) return;
    // 当前定位节点图元。
    const item = graph.findById(locatedNodeId.value);
    if (item) updateNodeVisual(item, { hot: true, opacity: 1 });
  }

  // 按传入状态更新单个节点图元的样式和事件捕获。
  function updateNodeVisual(item, options = {}) {
    // G6 节点模型。
    const model = item.getModel();
    // 节点原始样式。
    const baseStyle = model.originStyle || model.style || {};
    // 节点原始标签样式。
    const labelStyle = model.labelCfg?.originStyle || model.labelCfg?.style || {};
    // 节点原始描边宽度。
    const lineWidth = Number(baseStyle.lineWidth || 2);
    // 当前节点是否处于多选选中态。
    const multiSelected = selectedMultiNodeIds.value.has(model.id);
    // 聚焦限制模式下当前节点是否禁用交互。
    const disabledByFocusMode = isFocusLimitedMode() && !canUseFocusedContextNode(model.id);
    // 当前节点鼠标指针样式。
    const cursor = disabledByFocusMode ? 'default' : baseStyle.cursor || 'pointer';
    setNodeEventCapture(item, !disabledByFocusMode);
    // 当前节点主体样式。
    const style = {
      ...baseStyle,
      cursor,
      opacity: options.opacity ?? (options.dim ? 0.14 : baseStyle.opacity ?? 0.92),
    };
    // 当前节点标签样式。
    const labelCfg = {
      ...model.labelCfg,
      style: {
        ...labelStyle,
        cursor,
        opacity: options.labelHidden ? 0 : options.labelOpacity ?? (options.dim ? 0.18 : 1),
      },
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

    if (multiSelected) {
      Object.assign(style, {
        stroke: '#2563eb',
        lineWidth: Math.max(5, lineWidth + 2.4),
        shadowColor: '#2563eb',
        shadowBlur: 28,
        opacity: Math.max(Number(style.opacity ?? 0), 0.92),
      });
    }

    graph.updateItem(item, { style, labelCfg });
  }

  // 禁用非聚焦节点事件捕获，避免遮挡聚焦节点或画布拖动。
  function setNodeEventCapture(item, enabled) {
    // 当前节点容器图元。
    const container = item.getContainer?.();
    container?.set?.('capture', enabled);
    container?.get?.('children')?.forEach((shape) => {
      shape.set?.('capture', enabled);
    });
  }

  // 判断当前是否处于需要限制非聚焦节点交互的模式。
  function isFocusLimitedMode() {
    return Boolean(selectedFocusId.value && ['roam', 'multi'].includes(graphMode.value));
  }

  // 左侧图例交互只影响可视状态，不改动业务数据。
  function setLegendHover(id) {
    if (id && !legendItems.find((item) => item.id === id)?.type) return;
    hoveredLegendId.value = id;
    applyLegendState();
  }

  // 切换左侧图例选中态。
  function toggleLegend(id) {
    if (!legendItems.find((item) => item.id === id)?.type) return;
    activeLegendId.value = activeLegendId.value === id ? '' : id;
    applyLegendState();
  }

  // 按当前图例 hover 或选中状态更新节点淡化效果。
  function applyLegendState() {
    if (!graph) return;
    // 当前生效图例。
    const legend = legendItems.find((item) => item.id === (activeLegendId.value || hoveredLegendId.value));
    graph.getNodes().forEach((item) => {
      // 当前节点业务数据。
      const node = item.getModel().origin ;
      // 当前节点是否需要被图例淡化。
      const dim = Boolean(legend && node && !matchesLegend(node, legend));
      updateNodeVisual(item, { dim, opacity: dim ? 0.14 : 0.92 });
    });
  }

  // 判断节点是否匹配当前图例过滤条件。
  function matchesLegend(node, legend) {
    if (!legend.type) return false;
    if (node.type !== legend.type) return false;
    return !legend.levelName || node.levelName === legend.levelName;
  }

  // 更新左侧数据概览指标。
  function updateOverview(nodes, edges) {
    // 统计指定节点类型数量的快捷函数。
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

  // 画布尺寸变化时同步 G6 尺寸。
  function resizeGraph() {
    if (!graph || !containerRef.value) return;
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      if (!graph || !containerRef.value) return;
      // 最新画布宽度。
      const width = containerRef.value.clientWidth;
      // 最新画布高度。
      const height = containerRef.value.clientHeight;
      if (!width || !height || (width === graphWidth && height === graphHeight)) return;
      graphWidth = width;
      graphHeight = height;
      graph.changeSize(width, height);
      graph.fitCenter();
    });
  }

  // 重置视图缩放和中心点。
  function resetView() {
    if (!graph) return;
    graph.fitCenter();
    graph.zoomTo(1);
  }

  // 按当前画布中心缩放，不改变已有节点选中和搜索状态。
  function zoomGraph(ratio) {
    if (!graph || !containerRef.value) return;
    // 当前 G6 缩放比例。
    const currentZoom = graph.getZoom ? graph.getZoom() : 1;
    // 限制后的下一次缩放比例。
    const nextZoom = Math.min(2.6, Math.max(0.35, currentZoom * ratio));
    // 以画布中心作为缩放锚点。
    const center = {
      x: containerRef.value.clientWidth / 2,
      y: containerRef.value.clientHeight / 2,
    };
    graph.zoomTo(nextZoom, center);
  }

  // 切换互斥模式，并同步清理会冲突的临时视觉状态。
  function setGraphMode(mode) {
    if (graphMode.value === mode) return;
    clearPendingNodeClick();
    // 切换前是否处于多选模式，用于决定是否清空多选态。
    const wasMultiMode = graphMode.value === 'multi';
    graphMode.value = mode;
    if (mode === 'multi') {
      stopLocatedFlash();
      refreshCurrentVisualState();
      return;
    }
    if (wasMultiMode) clearMultiSelection();
    refreshCurrentVisualState();
  }

  // 切换图谱区域全屏状态。
  async function toggleFullscreen() {
    // 当前全屏外壳 DOM。
    const shell = canvasShellRef.value;
    if (!shell) return;
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen?.();
      } else {
        if (!shell.requestFullscreen) throw new Error('Fullscreen API unavailable');
        await shell.requestFullscreen();
      }
    } catch {
      ElMessage.warning('当前浏览器不支持图谱区域全屏');
    }
  }

  // 全屏状态变化后延迟 resize，等待浏览器完成容器尺寸更新。
  function handleFullscreenChange() {
    isFullscreen.value = document.fullscreenElement === canvasShellRef.value;
    window.setTimeout(() => {
      resizeGraph();
      graph?.fitCenter();
    }, 80);
  }

  // 点击节点切换多选状态，不触发普通详情和持久聚焦。
  function toggleMultiNode(id) {
    // 切换后的多选 ID 集合。
    const nextIds = new Set(selectedMultiNodeIds.value);
    if (nextIds.has(id)) nextIds.delete(id);
    else nextIds.add(id);
    selectedMultiNodeIds.value = nextIds;
    refreshCurrentVisualState();
  }

  // 从多选结果中移除单个节点。
  function removeMultiNode(id) {
    if (!selectedMultiNodeIds.value.has(id)) return;
    // 移除后的多选 ID 集合。
    const nextIds = new Set(selectedMultiNodeIds.value);
    nextIds.delete(id);
    selectedMultiNodeIds.value = nextIds;
    refreshCurrentVisualState();
  }

  // 清空多选节点集合。
  function clearMultiSelection() {
    if (!selectedMultiNodeIds.value.size) return;
    selectedMultiNodeIds.value = new Set();
    refreshCurrentVisualState();
  }

  // 全部收起后移除不可见多选节点，避免左侧列表和图谱状态错位。
  function pruneInvisibleMultiSelection() {
    if (!selectedMultiNodeIds.value.size || !manager) return;
    // 过滤后仍然可见的多选节点 ID 集合。
    const nextIds = new Set([...selectedMultiNodeIds.value].filter((id) => manager.isVisible(id)));
    if (nextIds.size !== selectedMultiNodeIds.value.size) selectedMultiNodeIds.value = nextIds;
  }

  // 根据当前聚焦状态刷新图谱视觉效果。
  function refreshCurrentVisualState() {
    if (!graph) return;
    if (selectedFocusId.value) {
      applyLegendState();
      applySelectedFocus();
      applyLocatedState();
      return;
    }
    resetGraphVisualState();
  }

  // 格式化多选节点所属路径。
  function formatMultiNodePath(node) {
    if (!manager || !node) return '';
    return manager
      .getPathNodes(node.id)
      .filter((item) => item.type !== 'root')
      .map((item) => formatNodeName(item))
      .join(' / ');
  }

  // 导出当前多选节点基础信息，独立于搜索结果数据。
  function downloadSelectedNodes() {
    if (!selectedMultiNodes.value.length) {
      ElMessage.warning('请先选择需要导出的节点');
      return;
    }
    // 导出的多选节点数据。
    const payload = selectedMultiNodes.value.map((node) => ({
      id: node.id,
      label: node.label,
      name: node.name,
      code: node.code,
      displayName: formatNodeName(node),
      categoryPath: formatMultiNodePath(node),
      system: searchResultSystem(node),
      levelName: node.levelName,
      parentLabel: node.parentLabel,
      mapping: node.mapping,
    }));
    // 下载文件 Blob。
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    // 临时下载 URL。
    const url = URL.createObjectURL(blob);
    // 临时下载链接。
    const link = document.createElement('a');
    link.href = url;
    link.download = `已选节点-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // 适配完整图谱视图。
  function fitFullGraphView() {
    if (!graph) return;
    graph.fitView(42);
  }

  // 适配指定上下文节点集合视图。
  function fitContextView(contextIds, focusId) {
    if (!graph || !containerRef.value) return;
    // 上下文内可定位的 G6 图元集合。
    const items = [...contextIds].map((id) => graph.findById(id)).filter(Boolean);
    if (!items.length) {
      resetView();
      return;
    }

    if (items.length === 1 && focusId) {
      // 单节点上下文中的焦点图元。
      const focusItem = graph.findById(focusId);
      graph.zoomTo(1.12);
      if (focusItem) graph.focusItem(focusItem, true);
      return;
    }

    graph.fitView(58);
    // fitView 后的当前缩放比例。
    const zoom = graph.getZoom ? graph.getZoom() : 1;
    // 上下文视图允许的最小缩放。
    const minZoom = items.length <= 6 ? 0.9 : items.length <= 12 ? 0.78 : 0.68;
    // 上下文视图允许的最大缩放。
    const maxZoom = items.length <= 6 ? 1.18 : 1.08;
    if (zoom < minZoom) graph.zoomTo(minZoom);
    if (zoom > maxZoom) graph.zoomTo(maxZoom);
    graph.fitCenter();
  }

  // 收起后聚焦根节点的默认起始视图。
  function focusRootStartView() {
    if (!graph) return;
    // 当前可见图中的根节点。
    const rootNode = manager.getVisibleGraph().nodes[0];
    // 根节点对应的 G6 图元。
    const rootItem = rootNode ? graph.findById(rootNode.id) : undefined;
    graph.zoomTo(1.35);
    if (rootItem) graph.focusItem(rootItem, true);
    else graph.fitCenter();
  }

  // 右侧工具栏动作：布局、展开收起、关系文字开关。
  function relayout() {
    // 当前搜索局部上下文 ID。
    const contextId = getActiveSearchContextId();
    layoutCache.clear();
    ensureSearchContextSelection(contextId);
    renderGraph();
    window.setTimeout(() => {
      if (contextId) fitVisibleSearchContextView(contextId);
      else fitFullGraphView();
    }, 180);
  }

  // 展开当前图谱视图，搜索态下只展开搜索上下文。
  function expandAll() {
    // 当前搜索局部上下文 ID。
    const contextId = getActiveSearchContextId();
    if (contextId) {
      layoutCache.clear();
      manager.expandContext(contextId);
      ensureSearchContextSelection(contextId);
      renderGraph(contextId);
      window.requestAnimationFrame(() => fitVisibleSearchContextView(contextId));
      return;
    }
    graphViewMode.value = 'fullGraph';
    searchContextId.value = '';
    manager.expandAll();
    renderGraph(selectedNode.value?.id);
    window.requestAnimationFrame(() => fitFullGraphView());
  }

  // 收起当前图谱视图，统一回到根节点默认收起视图。
  function collapseAll() {
    // 当前搜索局部上下文 ID。
    const contextId = getActiveSearchContextId();
    if (!contextId) {
      graphViewMode.value = 'fullGraph';
      searchContextId.value = '';
    }
    manager.collapseAll();
    pruneInvisibleMultiSelection();
    layoutCache.clear();
    selectedNode.value = manager.getVisibleGraph().nodes[0];
    clearFocusVisualState();
    renderGraph(selectedNode.value?.id);
    window.requestAnimationFrame(() => focusRootStartView());
  }

  // 切换关系文字显示状态。
  function toggleRelationLabels() {
    relationLabelsVisible.value = !relationLabelsVisible.value;
    renderGraph(selectedNode.value?.id);
  }

  // 搜索结果只负责定位和高亮，不和多选状态耦合。
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

  // 点击搜索结果后进入对应节点的局部关系视图。
  function selectSearchResult(target) {
    clearPendingNodeClick();
    graphViewMode.value = 'searchGraph';
    searchContextId.value = target.id;
    layoutCache.clear();
    stopLocatedFlash();
    manager.focusContext(target.id);
    selectedNode.value = manager.getNode(target.id);
    selectedFocusId.value = target.id;
    renderGraph(target.id);
    // 搜索目标节点的上下文节点集合。
    const contextIds = manager.getConnectedIds(target.id);
    window.setTimeout(() => fitContextView(contextIds, target.id), 180);
    flashLocatedNode(target.id);
  }

  // 退出搜索局部关系视图并恢复完整图谱。
  function restoreFullGraph() {
    graphViewMode.value = 'fullGraph';
    searchContextId.value = '';
    searchResults.value = [];
    selectedFocusId.value = '';
    stopLocatedFlash();
    manager.expandAll();
    renderGraph(selectedNode.value?.id);
    window.requestAnimationFrame(() => fitFullGraphView());
  }

  // 当前是否仍处于搜索局部关系视图。
  function getActiveSearchContextId() {
    if (graphViewMode.value !== 'searchGraph' || !searchContextId.value) return '';
    return manager?.getNode(searchContextId.value) ? searchContextId.value : '';
  }

  // 搜索局部操作后只校正详情节点，不强制制造视觉聚焦。
  function ensureSearchContextSelection(contextId) {
    if (!contextId) return;
    if (!manager.isVisible(selectedNode.value?.id)) selectedNode.value = manager.getNode(contextId);
    if (selectedFocusId.value && !manager.isVisible(selectedFocusId.value)) selectedFocusId.value = '';
  }

  // 搜索局部关系视图只适配当前可见节点，不恢复全量图谱。
  function fitVisibleSearchContextView(contextId) {
    // 当前可见节点 ID 集合。
    const visibleIds = new Set(manager.getVisibleGraph().nodes.map((node) => node.id));
    fitContextView(visibleIds, manager.isVisible(contextId) ? contextId : '');
  }

  // 停止搜索定位闪烁。
  function stopLocatedFlash() {
    if (locateTimer) window.clearTimeout(locateTimer);
    if (locateBlinkTimer) window.clearInterval(locateBlinkTimer);
    locateTimer = 0;
    locateBlinkTimer = 0;
    locatedNodeId.value = '';
  }

  // 触发搜索定位节点闪烁。
  function flashLocatedNode(id) {
    if (locateTimer) window.clearTimeout(locateTimer);
    if (locateBlinkTimer) window.clearInterval(locateBlinkTimer);
    locatedNodeId.value = id;
    applyLocatedState();
    // 当前闪烁轮次是否显示高亮。
    let visible = true;
    // 已执行的闪烁次数。
    let blinkCount = 0;
    locateBlinkTimer = window.setInterval(() => {
      visible = !visible;
      blinkCount += 1;
      // 当前闪烁节点图元。
      const current = graph?.findById(id);
      if (current) updateNodeVisual(current, { hot: visible, opacity: 1 });
      if (blinkCount >= 8) {
        if (locateBlinkTimer) window.clearInterval(locateBlinkTimer);
        locateBlinkTimer = 0;
        locatedNodeId.value = '';
        if (selectedFocusId.value) applySelectedFocus();
        else resetGraphVisualState();
      }
    }, 320);
    locateTimer = window.setTimeout(() => {
      if (locateBlinkTimer) window.clearInterval(locateBlinkTimer);
      locateBlinkTimer = 0;
      locatedNodeId.value = '';
      if (selectedFocusId.value) applySelectedFocus();
      else resetGraphVisualState();
    }, 2800);
  }

  // 格式化搜索结果节点路径。
  function searchResultPath(node) {
    return manager
      .getPathNodes(node.id)
      .filter((item) => item.type !== 'root')
      .map((item) => formatNodeName(item))
      .join(' / ');
  }

  // 格式化搜索结果节点所属体系。
  function searchResultSystem(node) {
    if (node.type === 'root') return '中心主题';
    if (node.type === 'system') return '分类体系';
    if (node.system?.includes('国土调查')) return '国土调查工作分类';
    if (node.system?.includes('国土空间')) return '国土空间用地用海分类';
    return node.parentLabel || '未分组';
  }
  return {
    leftPanelProps,
    rightPanelContentProps,
    canvasPanelProps,
    setContainerElement,
    setCanvasShellElement,
    setLegendHover,
    toggleLegend,
    removeMultiNode,
    clearMultiSelection,
    downloadSelectedNodes,
    searchNode,
    expandAll,
    collapseAll,
    toggleRelationLabels,
    relayout,
    selectSearchResult,
    restoreFullGraph,
    zoomGraph,
    setGraphMode,
    toggleFullscreen,
  };
}
