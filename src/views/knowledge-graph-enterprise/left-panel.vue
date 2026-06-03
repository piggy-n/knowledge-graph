<script setup>
import { computed, ref, watch } from 'vue';
import { ElEmpty, ElPagination, ElTable, ElTableColumn } from 'element-plus';
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

const childPage = ref(1);
const childPageSize = 5;

const rows = computed(() => {
  const node = props.node;
  if (!node) return [];

  const systemLabel =
      node.system === 'survey'
          ? '国土调查工作分类'
          : node.system === 'planning'
              ? '国土空间用地用海分类'
              : node.system;

  const isCategoryNode = ['一级类', '二级类', '三级类'].includes(node.levelName);
  const identityRows = isCategoryNode
      ? [['分类标识', formatNodeName(node)]]
      : [
          ['节点编码', node.code],
          ['分类名称', node.name || node.label],
        ];

  return [
    ...identityRows,
    ['分类体系', systemLabel],
    ['层级', node.levelName],
    ['父级分类', node.parentLabel],
    ['对应关系', node.mapping],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
});

const pagedChildren = computed(() => {
  const start = (childPage.value - 1) * childPageSize;
  return props.children.slice(start, start + childPageSize);
});

watch(
    () => [props.node?.id, props.children.length],
    () => {
      childPage.value = 1;
    }
);
</script>

<template>
  <aside class="kg-enterprise-left">
    <section class="kg-left-panel kg-left-panel--detail">
      <header class="kg-left-panel__header">
        <h2 class="kg-left-panel__title">节点详情</h2>
      </header>

      <div class="kg-left-panel__content kg-detail-content">
        <template v-if="node">
          <section class="kg-detail-section">
            <div class="kg-detail-subtitle">
              <span>基础信息</span>
            </div>

            <dl class="kg-detail-fields">
              <div v-for="[label, value] in rows" :key="label" class="kg-detail-field">
                <dt>{{ label }}</dt>
                <dd>{{ value }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="children.length" class="kg-child-section">
            <div class="kg-detail-subtitle">
              <span>下级分类</span>
              <em>{{ children.length }} 项</em>
            </div>

            <div class="kg-child-table-shell">
              <ElTable
                :data="pagedChildren"
                class="kg-child-table"
                size="small"
                :show-header="true"
              >
                <ElTableColumn label="分类名称" min-width="178">
                  <template #default="{ row }">
                    <span class="kg-child-name">{{ formatNodeName(row) }}</span>
                  </template>
                </ElTableColumn>

                <ElTableColumn label="层级" width="72">
                  <template #default="{ row }">
                    <span class="kg-child-level">{{ row.levelName || '分类节点' }}</span>
                  </template>
                </ElTableColumn>
              </ElTable>
            </div>

            <div v-if="children.length > childPageSize" class="kg-child-pager">
              <ElPagination
                v-model:current-page="childPage"
                small
                layout="prev, pager, next"
                :page-size="childPageSize"
                :total="children.length"
                :pager-count="5"
              />
            </div>
          </section>
        </template>

        <div v-else class="kg-detail-empty">
          <ElEmpty description="请选择图谱节点查看详情" :image-size="64" />
        </div>
      </div>
    </section>

    <section class="kg-left-panel kg-left-panel--overview">
      <header class="kg-left-panel__header">
        <h2 class="kg-left-panel__title">数据概览</h2>
      </header>

      <div class="kg-left-panel__content">
        <div class="kg-overview-grid">
          <dl v-for="[label, value] in overviewItems" :key="label" class="kg-overview-card">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </dl>
        </div>
      </div>
    </section>

    <section class="kg-left-panel kg-left-panel--legend">
      <header class="kg-left-panel__header">
        <h2 class="kg-left-panel__title">图例说明</h2>
      </header>

      <div class="kg-left-panel__content">
        <div class="kg-legend-columns">
          <div class="kg-legend-block">
            <h3>节点类别</h3>
            <div class="kg-legend-list">
              <button
                v-for="item in nodeLegendItems"
                :key="item.id"
                type="button"
                class="kg-legend-chip"
                :class="{ 'is-active': activeLegendId === item.id }"
                @mouseenter="emit('legend-hover', item.id)"
                @mouseleave="emit('legend-hover', '')"
                @click="emit('legend-toggle', item.id)"
              >
                <span class="kg-legend-swatch" :style="{ backgroundColor: item.color }"></span>
                <span>{{ item.label }}</span>
              </button>
            </div>
          </div>

          <div class="kg-legend-block">
            <h3>关系类型</h3>
            <div class="kg-legend-list">
              <button
                v-for="item in relationLegendItems"
                :key="item.id"
                type="button"
                class="kg-legend-chip"
              >
                <span
                  class="kg-legend-line"
                  :class="{ 'kg-legend-line--dashed': item.lineType === 'dashed' }"
                  :style="{ borderColor: item.color, borderWidth: `${item.lineWidth || 2}px` }"
                ></span>
                <span>{{ item.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeLegendLabel" class="kg-legend-hint">已筛选：{{ activeLegendLabel }}</div>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.kg-enterprise-left {
  --kg-left-gap: 12px;
  --kg-panel-padding-x: 14px;
  --kg-title-blue: #2563eb;
  --kg-border: rgba(148, 163, 184, 0.2);
  --kg-muted: #64748b;
  --kg-text: #0f172a;

  display: flex;
  flex: 0 0 320px;
  flex-direction: column;
  width: 320px;
  height: 100%;
  min-height: 0;
  gap: var(--kg-left-gap);
  padding: 14px;
  overflow: hidden;
  background: rgba(248, 250, 252, 0.96);
  border-right: 1px solid rgba(148, 163, 184, 0.24);
  box-sizing: border-box;
}

.kg-left-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--kg-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
}

.kg-left-panel--detail {
  flex: 1 1 auto;
}

.kg-left-panel--overview {
  flex: 0 0 auto;
}

.kg-left-panel--legend {
  flex: 0 0 calc((100% - (var(--kg-left-gap) * 2)) / 3);
  max-height: calc((100% - (var(--kg-left-gap) * 2)) / 3);
}

.kg-left-panel__header {
  display: flex;
  flex: 0 0 38px;
  align-items: center;
  height: 38px;
  padding: 0 var(--kg-panel-padding-x);
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  box-sizing: border-box;
}

.kg-left-panel__title {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding-left: 10px;
  color: var(--kg-text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.kg-left-panel__title::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: var(--kg-title-blue);
  transform: translateY(-50%);
  content: '';
}

.kg-left-panel__content {
  flex: 1;
  min-height: 0;
  padding: 10px var(--kg-panel-padding-x);
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  color: var(--kg-text);
  font-size: 12px;
}

.kg-left-panel__content::-webkit-scrollbar {
  width: 5px;
}

.kg-left-panel__content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.3);
}

.kg-left-panel__content::-webkit-scrollbar-track {
  background: transparent;
}

.kg-left-panel--overview .kg-left-panel__content {
  flex: 0 0 auto;
  overflow: visible;
}

.kg-detail-section {
  min-width: 0;
}

.kg-detail-subtitle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  margin-bottom: 7px;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.kg-detail-subtitle span {
  min-width: 0;
}

.kg-detail-subtitle em {
  color: var(--kg-title-blue);
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.kg-detail-fields {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
}

.kg-detail-field {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  column-gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.kg-detail-field dt,
.kg-detail-field dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.kg-detail-field dt {
  color: var(--kg-muted);
  font-weight: 500;
}

.kg-detail-field dd {
  color: #1e293b;
  font-weight: 500;
  word-break: break-word;
}

.kg-child-section {
  margin-top: 12px;
}

.kg-child-table-shell {
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
}

.kg-child-table {
  width: 100%;
  font-size: 12px;
}

.kg-child-name {
  display: inline-block;
  color: var(--kg-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}

.kg-child-level {
  color: var(--kg-muted);
  font-size: 11px;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
}

.kg-child-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

:deep(.kg-child-table.el-table) {
  --el-table-border-color: transparent;
  --el-table-header-bg-color: #f8fafc;
  --el-table-row-hover-bg-color: rgba(239, 246, 255, 0.65);
  --el-table-text-color: #1e293b;
  --el-table-header-text-color: #64748b;
  border: 0;
  border-radius: 8px;
}

:deep(.kg-child-table .el-table__inner-wrapper) {
  border-radius: 8px;
}

:deep(.kg-child-table .el-table__header-wrapper) {
  overflow: hidden;
  border-radius: 8px 8px 0 0;
}

:deep(.kg-child-table .el-table__inner-wrapper::before),
:deep(.kg-child-table .el-table__border-left-patch),
:deep(.kg-child-table::before),
:deep(.kg-child-table::after) {
  display: none;
}

:deep(.kg-child-table th.el-table__cell) {
  height: 34px;
  padding: 2px 0;
  background: #f8fafc;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}

:deep(.kg-child-table .el-table__cell) {
  padding: 6px 0;
  border-bottom-color: rgba(148, 163, 184, 0.07);
  vertical-align: top;
}

:deep(.kg-child-table .el-table__row:last-child .el-table__cell) {
  border-bottom: 0;
}

:deep(.kg-child-table .cell) {
  padding: 0 9px;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}

:deep(.kg-child-pager .el-pagination) {
  --el-pagination-font-size: 11px;
  --el-pagination-button-width: auto;
  --el-pagination-button-height: 22px;
  --el-pagination-button-gap: 2px;
  --el-pagination-hover-color: #2563eb;
}

:deep(.kg-child-pager .el-pager li),
:deep(.kg-child-pager button) {
  min-width: 22px;
  padding: 0 4px;
  color: #64748b;
  font-weight: 500;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

:deep(.kg-child-pager button.is-disabled) {
  color: #cbd5e1;
  background: transparent;
}

:deep(.kg-child-pager .el-pager li:hover),
:deep(.kg-child-pager button:hover) {
  color: var(--kg-title-blue);
  background: transparent;
}

:deep(.kg-child-pager .el-pager li.is-active) {
  color: #2563eb;
  background: transparent;
  font-weight: 700;
}

.kg-detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
}

.kg-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 8px;
}

.kg-overview-card {
  min-width: 0;
  min-height: 34px;
  margin: 0;
  padding: 6px 8px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.88);
  box-sizing: border-box;
}

.kg-overview-card dt,
.kg-overview-card dd {
  margin: 0;
}

.kg-overview-card dt {
  color: var(--kg-muted);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
}

.kg-overview-card dd {
  margin-top: 3px;
  color: var(--kg-title-blue);
  font-size: 14px;
  font-weight: 800;
  line-height: 1.2;
}

.kg-legend-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: start;
}

.kg-legend-block {
  min-width: 0;
}

.kg-legend-block h3 {
  margin: 0 0 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.kg-legend-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.kg-legend-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 21px;
  gap: 6px;
  padding: 1px 2px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #1f2937;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
}

.kg-legend-chip:hover {
  background: rgba(241, 245, 249, 0.92);
}

.kg-legend-chip.is-active {
  border-color: rgba(37, 99, 235, 0.22);
  background: rgba(239, 246, 255, 0.95);
  color: #1d4ed8;
}

.kg-legend-swatch {
  flex: 0 0 auto;
  width: 18px;
  height: 8px;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.kg-legend-line {
  flex: 0 0 auto;
  width: 20px;
  height: 0;
  border-top-style: solid;
}

.kg-legend-line--dashed {
  border-top-style: dashed;
}

.kg-legend-chip span:last-child {
  min-width: 0;
  white-space: normal;
  word-break: break-word;
}

.kg-legend-hint {
  margin-top: 10px;
  padding: 6px 8px;
  border-radius: 7px;
  background: rgba(239, 246, 255, 0.85);
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
}
</style>
