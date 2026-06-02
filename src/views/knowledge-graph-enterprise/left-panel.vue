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
        <span class="kg-enterprise-card-title">节点详情</span>
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
        <span class="kg-floating-title kg-enterprise-card-title">数据概览</span>
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
        <span class="kg-floating-title kg-enterprise-card-title">图例说明</span>
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

<style scoped>
.kg-enterprise-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 0 0 320px;
  width: 320px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
  background: rgba(248, 250, 252, 0.96);
  border-right: 1px solid rgba(148, 163, 184, 0.24);
}

.kg-detail {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
  max-height: none;
}

.kg-overview {
  flex: 0 0 auto;
}

.kg-legend {
  flex: 0 0 auto;
}

.kg-overview,
.kg-legend {
  right: auto;
  bottom: auto;
}

.kg-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  gap: 7px;
}

.kg-panel-header {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 14px;
  cursor: default;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  justify-content: flex-start;
  gap: 7px;
}

/* 覆盖通用的 kg-enterprise-card-title 样式 */
.kg-enterprise-card-title {
  position: relative;
  display: flex;
  align-items: center;
  padding-left: 10px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.4;
  white-space: nowrap;
  flex: 0 0 auto;
}

.kg-enterprise-card-title::before {
  position: absolute;
  left: 0;
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: #2563eb;
  content: '';
}

.kg-detail__header strong {
  color: #0f172a;
  font-size: 14px;
  line-height: 1.42;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.kg-detail__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 8px 14px 12px;
  overflow: hidden;
}

.kg-detail dl {
  padding: 7px 0;
  border-bottom-color: rgba(148, 163, 184, 0.14);
}

.kg-detail dt {
  margin-bottom: 3px;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
}

.kg-detail dd {
  color: #1f2937;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
}

.kg-detail-children {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding-top: 9px;
}

.kg-detail-children__header {
  flex: 0 0 auto;
  margin-bottom: 8px;
  font-size: 11px;
}

.kg-detail-children__header strong {
  font-size: 12px;
}

.kg-detail-children__list {
  min-height: 0;
  max-height: none;
  overflow-y: auto;
  gap: 6px;
}

.kg-detail-children__item {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 3px;
  padding: 7px 9px;
}

.kg-detail-children__item strong {
  overflow: visible;
  white-space: normal;
  text-overflow: clip;
  color: #0f172a;
  font-size: 12px;
  line-height: 1.42;
}

.kg-detail-children__item em {
  color: #64748b;
  font-size: 11px;
  line-height: 1.3;
  text-align: left;
}

.kg-overview .kg-panel-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-height: none;
  padding: 10px 14px 12px;
}

.kg-overview dl {
  margin: 0;
  padding: 8px 9px;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.9);
}

.kg-overview dt {
  color: #64748b;
  font-size: 11px;
  line-height: 1.3;
}

.kg-overview dd {
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.25;
}

.kg-legend .kg-panel-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  max-height: none;
  gap: 12px;
  padding: 10px 14px 12px;
}

.kg-legend__section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
  width: 100%;
  padding: 0;
}

.kg-legend__section h3 {
  flex: none;
  margin: 0 0 6px 0;
  padding: 0;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  width: 100%;
}

.kg-legend__item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-height: 22px;
  padding: 2px 0;
  margin: 0 0 3px 0;
  gap: 4px;
  font-size: 11px;
  border: none;
  background: none;
  cursor: pointer;
  color: #1f2937;
  font-weight: 500;
  text-align: left;
}

.kg-legend__swatch {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
}

.kg-legend__item--line .kg-legend__line {
  flex: 0 0 auto;
  width: 20px;
  height: 2px;
  display: inline-block;
  vertical-align: middle;
}

.kg-legend__line {
  flex: 0 0 auto;
  width: 20px;
  height: 2px;
  display: inline-block;
  vertical-align: middle;
}

.kg-legend__line--dashed {
  border-style: dashed !important;
}

.kg-legend__hint {
  font-size: 11px;
  grid-column: 1 / -1;
  margin-top: 4px;
}
</style>
