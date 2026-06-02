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
const childPageSize = 10;

const rows = computed(() => {
  const node = props.node;
  if (!node) return [];

  const systemLabel =
      node.system === 'survey'
          ? '国土调查工作分类'
          : node.system === 'planning'
              ? '国土空间用地用海分类'
              : node.system;

  return [
    ['节点编码', node.code],
    ['分类名称', node.name || node.label],
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
    <section class="kg-enterprise-panel kg-detail">
      <div class="kg-enterprise-panel-header">
        <span class="kg-enterprise-card-title">节点详情</span>
      </div>

      <div v-if="node" class="kg-detail__body">
        <div class="kg-detail-summary">
          <div class="kg-detail-summary__name">
            {{ formatNodeName(node) }}
          </div>
        </div>

        <div class="kg-detail-info">
          <div v-for="[label, value] in rows" :key="label" class="kg-detail-info__row">
            <span class="kg-detail-info__label">{{ label }}</span>
            <span class="kg-detail-info__value">{{ value }}</span>
          </div>
        </div>

        <section v-if="children.length" class="kg-detail-children">
          <div class="kg-detail-children__header">
            <span>下级分类</span>
            <strong>{{ children.length }} 项</strong>
          </div>

          <ElTable
              :data="pagedChildren"
              class="kg-detail-children-table"
              size="small"
              border
              :show-header="true"
          >
            <ElTableColumn label="分类名称" min-width="170">
              <template #default="{ row }">
                <span class="kg-detail-children__name">
                  {{ formatNodeName(row) }}
                </span>
              </template>
            </ElTableColumn>

            <ElTableColumn label="层级" width="78">
              <template #default="{ row }">
                <span class="kg-detail-children__level">
                  {{ row.levelName || '分类节点' }}
                </span>
              </template>
            </ElTableColumn>
          </ElTable>

          <div class="kg-detail-children__pager">
            <ElPagination
                v-model:current-page="childPage"
                small
                background
                layout="prev, pager, next"
                :page-size="childPageSize"
                :total="children.length"
                :pager-count="5"
            />
          </div>
        </section>
      </div>

      <div v-else class="kg-detail-empty">
        <ElEmpty description="请选择图谱节点查看详情" :image-size="64" />
      </div>
    </section>

    <section class="kg-enterprise-panel kg-overview">
      <div class="kg-enterprise-panel-header">
        <span class="kg-enterprise-card-title">数据概览</span>
      </div>

      <div class="kg-overview__body">
        <dl v-for="[label, value] in overviewItems" :key="label" class="kg-overview__item">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </dl>
      </div>
    </section>

    <section class="kg-enterprise-panel kg-legend">
      <div class="kg-enterprise-panel-header">
        <span class="kg-enterprise-card-title">图例说明</span>
      </div>

      <div class="kg-legend__body">
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
            <span class="kg-legend__text">{{ item.label }}</span>
          </button>
        </div>

        <div class="kg-legend__section">
          <h3>关系类型</h3>

          <button
              v-for="item in relationLegendItems"
              :key="item.id"
              type="button"
              class="kg-legend__item kg-legend__item--line"
          >
            <span
                class="kg-legend__line"
                :class="{ 'kg-legend__line--dashed': item.lineType === 'dashed' }"
                :style="{ borderColor: item.color, borderWidth: `${item.lineWidth || 2}px` }"
            ></span>
            <span class="kg-legend__text">{{ item.label }}</span>
          </button>
        </div>

        <div v-if="activeLegendLabel" class="kg-legend__hint">
          已筛选：{{ activeLegendLabel }}
        </div>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.kg-enterprise-left {
  --kg-panel-padding-x: 14px;

  display: flex;
  flex: 0 0 320px;
  flex-direction: column;
  width: 320px;
  height: 100%;
  min-height: 0;
  gap: 12px;
  padding: 14px;
  overflow: hidden;
  background: rgba(248, 250, 252, 0.96);
  border-right: 1px solid rgba(148, 163, 184, 0.24);
  box-sizing: border-box;
}

.kg-enterprise-panel {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
}

.kg-enterprise-panel-header {
  display: flex;
  flex: 0 0 38px;
  align-items: center;
  justify-content: flex-start;
  height: 38px;
  padding: 0 var(--kg-panel-padding-x);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  box-sizing: border-box;
}

.kg-enterprise-card-title {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding-left: 10px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}

.kg-enterprise-card-title::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: #2563eb;
  transform: translateY(-50%);
  content: '';
}

/* 节点详情 */

.kg-detail__body {
  flex: 1;
  min-height: 0;
  padding: 12px var(--kg-panel-padding-x);
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.kg-detail__body::-webkit-scrollbar {
  width: 6px;
}

.kg-detail__body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.45);
}

.kg-detail__body::-webkit-scrollbar-track {
  background: transparent;
}

.kg-detail-summary {
  padding: 10px 12px;
  margin-bottom: 10px;
  border: 1px solid rgba(37, 99, 235, 0.14);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.9), rgba(248, 250, 252, 0.9));
  box-sizing: border-box;
}

.kg-detail-summary__name {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
  white-space: normal;
}

.kg-detail-info {
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.kg-detail-info__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 24px;
  padding: 4px 0;
  box-sizing: border-box;
}

.kg-detail-info__label {
  flex: 0 0 66px;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  text-align: left;
  white-space: nowrap;
}

.kg-detail-info__value {
  flex: 1;
  min-width: 0;
  color: #1e293b;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  text-align: left;
  word-break: break-word;
  white-space: normal;
}

.kg-detail-children {
  padding-top: 10px;
}

.kg-detail-children__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 26px;
  margin-bottom: 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.kg-detail-children__header strong {
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
}

.kg-detail-children-table {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  font-size: 12px;
}

.kg-detail-children__name {
  display: inline-block;
  color: #0f172a;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}

.kg-detail-children__level {
  color: #64748b;
  font-size: 11px;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
}

.kg-detail-children__pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

:deep(.kg-detail-children__pager .el-pagination) {
  --el-pagination-font-size: 11px;
  --el-pagination-button-width: 22px;
  --el-pagination-button-height: 22px;
  --el-pagination-button-gap: 3px;
}

:deep(.kg-detail-children-table.el-table) {
  --el-table-border-color: rgba(148, 163, 184, 0.18);
  --el-table-header-bg-color: rgba(248, 250, 252, 0.95);
  --el-table-row-hover-bg-color: rgba(239, 246, 255, 0.65);
  --el-table-text-color: #1e293b;
  --el-table-header-text-color: #475569;
  border-color: rgba(148, 163, 184, 0.18);
}

:deep(.kg-detail-children-table .el-table__header-wrapper th) {
  height: 32px;
  padding: 0;
  background: rgba(248, 250, 252, 0.95);
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

:deep(.kg-detail-children-table .el-table__cell) {
  padding: 7px 0;
  vertical-align: top;
}

:deep(.kg-detail-children-table .cell) {
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}

:deep(.kg-detail-children-table::before),
:deep(.kg-detail-children-table::after) {
  background-color: rgba(148, 163, 184, 0.18);
}

.kg-detail-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
}

/* 数据概览 */

.kg-overview__body {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 8px;
  padding: 12px var(--kg-panel-padding-x);
  overflow: hidden;
  box-sizing: border-box;
}

.kg-overview__item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-width: 0;
  min-height: 40px;
  column-gap: 8px;
  margin: 0;
  padding: 8px 10px 8px 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.86);
  box-sizing: border-box;
}

.kg-overview__item::before {
  position: absolute;
  left: 8px;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #60a5fa;
  transform: translateY(-50%);
  content: '';
}

.kg-overview__item dt {
  min-width: 0;
  margin: 0;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: keep-all;
}

.kg-overview__item dd {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
  text-align: right;
  white-space: nowrap;
}

/* 图例说明 */

.kg-legend__body {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  column-gap: 10px;
  row-gap: 6px;
  padding: 10px var(--kg-panel-padding-x) 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.kg-legend__section {
  min-width: 0;
}

.kg-legend__section h3 {
  margin: 0 0 5px;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.kg-legend__item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-height: 20px;
  gap: 5px;
  padding: 1px 2px;
  margin: 0 0 3px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: #1f2937;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.25;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}

.kg-legend__item:hover {
  background: rgba(241, 245, 249, 0.9);
}

.kg-legend__item.is-active {
  border-color: rgba(37, 99, 235, 0.22);
  background: rgba(239, 246, 255, 0.95);
  color: #1d4ed8;
}

.kg-legend__swatch {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.kg-legend__line {
  flex: 0 0 auto;
  width: 20px;
  height: 0;
  border-top-style: solid;
}

.kg-legend__line--dashed {
  border-top-style: dashed;
}

.kg-legend__text {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kg-legend__hint {
  grid-column: 1 / -1;
  padding: 6px 8px;
  border-radius: 7px;
  background: rgba(239, 246, 255, 0.85);
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
}
</style>