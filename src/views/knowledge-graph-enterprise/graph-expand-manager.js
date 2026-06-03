export class GraphExpandManager {
  // 当前图谱中实际可见的节点 ID 集合。
  visibleIds = new Set();
  // 当前已展开的节点 ID 集合，用于恢复展开标记和详情状态。
  expandedIds = new Set();

  constructor(dataset) {
    this.dataset = dataset;
    if (dataset.rootId) this.visibleIds.add(dataset.rootId);
  }

  getVisibleGraph() {
    // 只返回 visibleIds 内的节点和两端都可见的边。
    const nodes = [...this.visibleIds]
      .map((id) => this.dataset.nodeMap.get(id))
      .filter((node) => Boolean(node))
      .map((node) => ({
        ...node,
        expanded: this.expandedIds.has(node.id),
        childrenCount: this.dataset.childrenMap.get(node.id)?.length || 0,
      }));

    const edges = this.dataset.edges.filter(
      (edge) => this.visibleIds.has(edge.source) && this.visibleIds.has(edge.target),
    );

    return { nodes, edges };
  }

  getNode(id) {
    // 返回带展开状态和子节点数量的节点快照。
    const node = this.dataset.nodeMap.get(id);
    if (!node) return undefined;
    return {
      ...node,
      expanded: this.expandedIds.has(id),
      childrenCount: this.dataset.childrenMap.get(id)?.length || 0,
    };
  }

  getChildren(id) {
    // 子节点统一通过 childrenMap 读取，供详情面板和图谱逻辑复用。
    return (this.dataset.childrenMap.get(id) || [])
      .map((childId) => this.getNode(childId))
      .filter((node) => Boolean(node));
  }

  getConnectedIds(id) {
    return this.getContextIds(id);
  }

  getContextIds(id) {
    // 节点上下文包含自身路径、直接子级和对应关系节点上下文。
    const related = new Set();
    this.addNodeContext(id, related);

    this.dataset.edges.forEach((edge) => {
      if (edge.relationType !== 'mapping') return;
      const mappingTarget = edge.source === id ? edge.target : edge.target === id ? edge.source : '';
      if (!mappingTarget) return;
      this.addNodeContext(mappingTarget, related);
    });

    return related;
  }

  getContextEdgeIds(id) {
    // 上下文边只保留两端都在上下文节点集合内的关系。
    const contextIds = this.getContextIds(id);
    const edgeIds = new Set();
    this.dataset.edges.forEach((edge) => {
      if (contextIds.has(edge.source) && contextIds.has(edge.target)) edgeIds.add(edge.id);
    });
    return edgeIds;
  }

  hasChildren(id) {
    return Boolean(this.dataset.childrenMap.get(id)?.length);
  }

  isVisible(id) {
    return this.visibleIds.has(id);
  }

  toggle(id) {
    if (!this.hasChildren(id)) return;
    if (this.expandedIds.has(id)) {
      this.collapse(id);
    } else {
      this.expand(id);
    }
  }

  expand(id) {
    // 单节点展开只追加直接子级，不递归展开孙级。
    const children = this.dataset.childrenMap.get(id) || [];
    children.forEach((childId) => this.visibleIds.add(childId));
    if (children.length) this.expandedIds.add(id);
  }

  collapse(id) {
    // 单节点收起会递归移除所有下级可见节点。
    const children = this.dataset.childrenMap.get(id) || [];
    children.forEach((childId) => {
      this.collapse(childId);
      this.visibleIds.delete(childId);
    });
    this.expandedIds.delete(id);
  }

  // 搜索局部图内双击展开 / 收起，避免把全图子级带入局部视图。
  toggleInContext(id, contextId) {
    if (!this.hasChildren(id)) return;
    const contextIds = this.getContextIds(contextId);
    if (this.expandedIds.has(id)) {
      this.collapseWithinContext(id, contextIds);
    } else {
      this.expandWithinContext(id, contextIds);
    }
  }

  expandWithinContext(id, contextIds) {
    const children = (this.dataset.childrenMap.get(id) || []).filter((childId) => contextIds.has(childId));
    children.forEach((childId) => this.visibleIds.add(childId));
    if (children.length) this.expandedIds.add(id);
  }

  collapseWithinContext(id, contextIds) {
    const children = (this.dataset.childrenMap.get(id) || []).filter((childId) => contextIds.has(childId));
    children.forEach((childId) => {
      this.collapseWithinContext(childId, contextIds);
      this.visibleIds.delete(childId);
    });
    this.expandedIds.delete(id);
  }

  expandAll() {
    // 全量展开会显示所有节点，并标记所有存在子级的节点为展开。
    this.dataset.nodeMap.forEach((_node, id) => this.visibleIds.add(id));
    this.dataset.childrenMap.forEach((children, id) => {
      if (children.length) this.expandedIds.add(id);
    });
  }

  collapseAll() {
    // 默认收起视图只保留根节点，后续展开从根节点重新开始。
    this.visibleIds.clear();
    this.expandedIds.clear();
    if (this.dataset.rootId) this.visibleIds.add(this.dataset.rootId);
  }

  focusContext(id) {
    // 搜索局部关系视图只展示目标节点上下文。
    const contextIds = this.getContextIds(id);
    this.visibleIds.clear();
    contextIds.forEach((nodeId) => this.visibleIds.add(nodeId));
    this.syncExpandedIdsWithinVisible(contextIds);
  }

  expandContext(id) {
    this.focusContext(id);
  }

  // 根据当前可见节点同步展开标记，避免局部视图状态错位。
  syncExpandedIdsWithinVisible(visibleIds) {
    this.expandedIds.clear();
    visibleIds.forEach((nodeId) => {
      const children = this.dataset.childrenMap.get(nodeId) || [];
      if (children.some((childId) => visibleIds.has(childId))) this.expandedIds.add(nodeId);
    });
  }

  getPathNodes(id) {
    return this.getPathToRoot(id)
      .map((nodeId) => this.getNode(nodeId))
      .filter((node) => Boolean(node));
  }

  search(keyword) {
    const text = keyword.trim().toLowerCase();
    if (!text) return [];
    return [...this.dataset.nodeMap.values()].filter((node) => {
      return [node.id, node.label, node.code, node.name, node.mapping]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(text));
    });
  }

  getPathToRoot(id) {
    const path = [id];
    let currentId = id;
    while (currentId) {
      const parentId = this.dataset.parentMap.get(currentId);
      if (!parentId) break;
      path.unshift(parentId);
      currentId = parentId;
    }
    return path;
  }

  addNodeContext(id, related) {
    this.getPathToRoot(id).forEach((nodeId) => related.add(nodeId));
    const children = this.dataset.childrenMap.get(id) || [];
    children.forEach((childId) => {
      related.add(childId);
      const child = this.dataset.nodeMap.get(childId);
      const current = this.dataset.nodeMap.get(id);
      // planning 一级类 hover 时补充二级类下的三级类，满足对应一级类的完整展示。
      if (current?.system?.includes('规划') && current.levelName === '一级类') {
        (this.dataset.childrenMap.get(childId) || []).forEach((grandChildId) => related.add(grandChildId));
      }
      if (child?.system?.includes('规划') && child.levelName === '一级类') {
        (this.dataset.childrenMap.get(childId) || []).forEach((grandChildId) => related.add(grandChildId));
      }
    });
    related.add(id);
  }
}
