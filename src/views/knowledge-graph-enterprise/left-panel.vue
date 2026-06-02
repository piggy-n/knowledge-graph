<script setup>
import { computed } from 'vue';
import { ElEmpty } from 'element-plus';
import { formatNodeName } from './graph-data';

const props = defineProps({
  node: { type: Object, default: undefined },
  children: { type: Array, default: () => [] },
  overviewItems: { type: Array, default: () => [] },
  nodeLegendItems: { type: Array, default: () => [] },
  relationLegendItems: { type: Array, default: () => [] },
  activeLegendId: { type: String, default: '' },
  activeLegendLabel: { type: String, default: '' },
});

const emit = defineEmits(['legend-hover', 'legend-toggle']);

const rows = computed(() => {
  const node = props.node;
  if (!node) return [];
  const systemLabel = node.system === 'survey' ? '国土调查工作分类' : node.system === 'planning' ? '国土空间用地用海分类' : node.system;
  return [
    ['节点编码', node.code],
    ['分类名称', node.name || node.label],
    ['分类体系', systemLabel],
    ['层级', node.levelName],
    ['父级分类', node.parentLabel],
    ['对应关系', node.mapping],
  ].filter(([, value]) => value);
});
</script>

<template>
  <aside class="kg-enterprise-left">
    <section class="kg-detail kg-enterprise-panel">
      <div class="kg-detail__header">
        <span>节点详情</span>
        <strong>{{ node ? formatNodeName(node) : '未选择节点' }}</strong>
      </div>
      <div v-if="node" class="kg-detail__body">
        <dl v-for="[label, value] in rows" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </dl>
        <section v-if="children.length" class="kg-detail-children">
          <div class="kg-detail-children__header">
            <span>下级分类</span>
            <strong>{{ children.length }} 项</strong>
          </div>
          <div class="kg-detail-children__list">
            <article v-for="child in children" :key="child.id" class="kg-detail-children__item">
              <strong>{{ formatNodeName(child) }}</strong>
              <em>{{ child.levelName || '分类节点' }}</em>
            </article>
          </div>
        </section>
      </div>
      <ElEmpty v-else description="暂无节点详情" :image-size="72" />
    </section>

    <section class="kg-overview kg-floating-panel kg-enterprise-panel">
      <div class="kg-panel-header kg-enterprise-panel-header">
        <span class="kg-floating-title">数据概览</span>
      </div>
      <div class="kg-panel-body">
        <dl v-for="[label, value] in overviewItems" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </dl>
      </div>
    </section>

    <section class="kg-legend kg-floating-panel kg-enterprise-panel">
      <div class="kg-panel-header kg-enterprise-panel-header">
        <span class="kg-floating-title">图例</span>
      </div>
      <div class="kg-panel-body kg-legend__body">
        <div class="kg-legend__section">
          <h3>节点类别</h3>
          <button
            v-for="item in nodeLegendItems"
            :key="item.id"
            type="button"
            class="kg-legend__item"
            :class="{ 'is-active': activeLegendId === item.id }"
            @mouseenter="emit('legend-hover', item.id)"
            @mouseleave="emit('legend-hover', '')"
            @click="emit('legend-toggle', item.id)"
          >
            <span class="kg-legend__swatch" :style="{ backgroundColor: item.color }"></span>
            <span>{{ item.label }}</span>
          </button>
        </div>
        <div class="kg-legend__section">
          <h3>关系类型</h3>
          <button v-for="item in relationLegendItems" :key="item.id" type="button" class="kg-legend__item kg-legend__item--line">
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
    </section>
  </aside>
</template>

