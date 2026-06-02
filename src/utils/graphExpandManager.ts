import type { KnowledgeGraphDataset, KnowledgeNode, VisibleGraphData } from './graphDataTransform';

export class GraphExpandManager {
  private readonly dataset: KnowledgeGraphDataset;
  private readonly visibleIds = new Set<string>();
  private readonly expandedIds = new Set<string>();

  constructor(dataset: KnowledgeGraphDataset) {
    this.dataset = dataset;
    if (dataset.rootId) this.visibleIds.add(dataset.rootId);
  }

  getVisibleGraph(): VisibleGraphData {
    const nodes = [...this.visibleIds]
      .map((id) => this.dataset.nodeMap.get(id))
      .filter((node): node is KnowledgeNode => Boolean(node))
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

  getNode(id: string): KnowledgeNode | undefined {
    const node = this.dataset.nodeMap.get(id);
    if (!node) return undefined;
    return {
      ...node,
      expanded: this.expandedIds.has(id),
      childrenCount: this.dataset.childrenMap.get(id)?.length || 0,
    };
  }

  getAllNodes(): KnowledgeNode[] {
    return [...this.dataset.nodeMap.values()];
  }

  getConnectedIds(id: string): Set<string> {
    return this.getContextIds(id);
  }

  getContextIds(id: string): Set<string> {
    const related = new Set<string>();
    this.addNodeContext(id, related);

    this.dataset.edges.forEach((edge) => {
      if (edge.relationType !== 'mapping') return;
      const mappingTarget = edge.source === id ? edge.target : edge.target === id ? edge.source : '';
      if (!mappingTarget) return;
      this.addNodeContext(mappingTarget, related);
    });

    return related;
  }

  getContextEdgeIds(id: string): Set<string> {
    const contextIds = this.getContextIds(id);
    const edgeIds = new Set<string>();
    this.dataset.edges.forEach((edge) => {
      if (contextIds.has(edge.source) && contextIds.has(edge.target)) edgeIds.add(edge.id);
    });
    return edgeIds;
  }

  hasChildren(id: string): boolean {
    return Boolean(this.dataset.childrenMap.get(id)?.length);
  }

  isVisible(id: string): boolean {
    return this.visibleIds.has(id);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
  }

  toggle(id: string) {
    if (!this.hasChildren(id)) return;
    if (this.expandedIds.has(id)) {
      this.collapse(id);
    } else {
      this.expand(id);
    }
  }

  expand(id: string) {
    const children = this.dataset.childrenMap.get(id) || [];
    children.forEach((childId) => this.visibleIds.add(childId));
    if (children.length) this.expandedIds.add(id);
  }

  collapse(id: string) {
    const children = this.dataset.childrenMap.get(id) || [];
    children.forEach((childId) => {
      this.collapse(childId);
      this.visibleIds.delete(childId);
    });
    this.expandedIds.delete(id);
  }

  expandAll() {
    this.dataset.nodeMap.forEach((_node, id) => this.visibleIds.add(id));
    this.dataset.childrenMap.forEach((children, id) => {
      if (children.length) this.expandedIds.add(id);
    });
  }

  collapseAll() {
    this.visibleIds.clear();
    this.expandedIds.clear();
    if (this.dataset.rootId) this.visibleIds.add(this.dataset.rootId);
  }

  revealNode(id: string) {
    const path = this.getPathToRoot(id);
    path.forEach((nodeId) => this.visibleIds.add(nodeId));
    path.slice(0, -1).forEach((nodeId) => {
      if (this.hasChildren(nodeId)) this.expandedIds.add(nodeId);
    });
  }

  focusContext(id: string) {
    const contextIds = this.getContextIds(id);
    this.visibleIds.clear();
    contextIds.forEach((nodeId) => this.visibleIds.add(nodeId));
    this.expandedIds.clear();
    contextIds.forEach((nodeId) => {
      const children = this.dataset.childrenMap.get(nodeId) || [];
      if (children.some((childId) => contextIds.has(childId))) this.expandedIds.add(nodeId);
    });
  }

  getPathNodes(id: string): KnowledgeNode[] {
    return this.getPathToRoot(id)
      .map((nodeId) => this.getNode(nodeId))
      .filter((node): node is KnowledgeNode => Boolean(node));
  }

  search(keyword: string): KnowledgeNode[] {
    const text = keyword.trim().toLowerCase();
    if (!text) return [];
    return [...this.dataset.nodeMap.values()].filter((node) => {
      return [node.id, node.label, node.code, node.name, node.mapping]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(text));
    });
  }

  searchFirst(keyword: string): KnowledgeNode | undefined {
    return this.search(keyword)[0];
  }

  private getPathToRoot(id: string): string[] {
    const path = [id];
    let currentId: string | undefined = id;
    while (currentId) {
      const parentId = this.dataset.parentMap.get(currentId);
      if (!parentId) break;
      path.unshift(parentId);
      currentId = parentId;
    }
    return path;
  }

  private addNodeContext(id: string, related: Set<string>) {
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
