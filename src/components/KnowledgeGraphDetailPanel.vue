<script setup lang="ts">
import { computed } from 'vue';
import type { KnowledgeNode } from '../utils/graphDataTransform';
import { formatNodeName } from '../utils/graphDataTransform';

const props = defineProps<{
  node?: KnowledgeNode;
  children?: KnowledgeNode[];
}>();

const rows = computed(() => {
  if (!props.node) return [];
  const node = props.node;
  const systemLabel = node.system === 'survey' ? '国土调查工作分类' : node.system === 'planning' ? '国土空间用地用海分类' : node.system;
  return [
    ['节点名称', formatNodeName(node)],
    ['节点编码', node.code],
    ['分类层级', node.levelName],
    ['所属分类', node.parentLabel || systemLabel],
    ['对应关系', node.mapping],
    ['子节点数量', node.childrenCount ? String(node.childrenCount) : undefined],
  ].filter((row): row is [string, string] => Boolean(row[1]));
});

const childRows = computed(() => props.children || []);
</script>

<template>
  <aside class="kg-detail">
    <div class="kg-detail__header">
      <span>节点详情</span>
      <strong>{{ node ? formatNodeName(node) : '未选择节点' }}</strong>
    </div>
    <div v-if="node" class="kg-detail__body">
      <dl v-for="[label, value] in rows" :key="label">
        <dt>{{ label }}</dt>
        <dd>{{ value }}</dd>
      </dl>
      <section v-if="childRows.length" class="kg-detail-children">
        <div class="kg-detail-children__header">
          <span>子节点</span>
          <strong>{{ childRows.length }}</strong>
        </div>
        <div class="kg-detail-children__list">
          <article v-for="child in childRows" :key="child.id" class="kg-detail-children__item">
            <span>{{ child.code || '-' }}</span>
            <strong>{{ child.displayName || child.name || child.label }}</strong>
            <em>{{ child.levelName || '-' }}</em>
          </article>
        </div>
      </section>
    </div>
    <div v-else class="kg-detail__empty">暂无节点详情</div>
  </aside>
</template>
