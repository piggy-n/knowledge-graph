<script setup>
import { ref, watch } from 'vue';
import { ElButton, ElIcon, ElInput, ElSwitch, ElTag } from 'element-plus';
import { ArrowDown, ArrowRight, ArrowUp, Back, Close, Connection, Fold, Refresh, Search, View } from '@element-plus/icons-vue';
import { formatNodeName } from './graph-data';

const props = defineProps({
  searchKeyword: { type: String, default: '' },
  searchResults: { type: Array, default: () => [] },
  relationLabelsVisible: { type: Boolean, default: true },
  message: { type: String, default: '' },
  searchFocusActive: { type: Boolean, default: false },
  searchResultPath: { type: Function, required: true },
});

const emit = defineEmits(['search', 'expand-all', 'collapse-all', 'toggle-relation-labels', 'relayout', 'select-result', 'restore-full-graph']);
const keyword = ref(props.searchKeyword);
const resultsClosed = ref(false);
const resultsCollapsed = ref(false);
const activeResultId = ref('');
const quickKeywords = ['用地', '耕地', '湿地', '交通', '水域'];

watch(
  () => props.searchKeyword,
  (value) => {
    keyword.value = value;
  },
);

function handleSearch() {
  resultsClosed.value = false;
  resultsCollapsed.value = false;
  activeResultId.value = '';
  emit('search', keyword.value);
}

function handleQuickSearch(value) {
  keyword.value = value;
  resultsClosed.value = false;
  resultsCollapsed.value = false;
  activeResultId.value = '';
  emit('search', value);
}

function handleSelectResult(node) {
  activeResultId.value = node.id;
  resultsCollapsed.value = true;
  emit('select-result', node);
}

function closeResults() {
  resultsClosed.value = true;
}
</script>

<template>
  <main class="kg-enterprise-right">
    <header class="kg-toolbar kg-enterprise-toolbar">
      <section class="kg-enterprise-search-area">
        <div class="kg-enterprise-search-row">
          <ElInput
            v-model="keyword"
            class="kg-enterprise-search"
            clearable
            placeholder="请输入分类名称、编码或对应关系"
            :prefix-icon="Search"
            @keyup.enter="handleSearch"
          />
          <ElButton type="primary" :icon="Search" @click="handleSearch">搜索</ElButton>
        </div>
        <div class="kg-enterprise-quick-tags">
          <span class="kg-enterprise-quick-label">热门检索</span>
          <ElTag
            v-for="item in quickKeywords"
            :key="item"
            class="kg-enterprise-quick-tag"
            size="small"
            effect="plain"
            @click="handleQuickSearch(item)"
          >
            {{ item }}
          </ElTag>
        </div>
      </section>

      <section class="kg-toolbar__actions">
        <div class="kg-action-group">
          <div class="kg-action-group__title">展开 / 收起</div>
          <div class="kg-action-group__body">
            <ElButton :icon="Connection" @click="emit('expand-all')">全部展开</ElButton>
            <ElButton :icon="Fold" @click="emit('collapse-all')">全部收起</ElButton>
          </div>
        </div>

        <div class="kg-action-group">
          <div class="kg-action-group__title">显示设置</div>
          <div class="kg-action-group__body kg-display-setting">
            <ElIcon class="kg-display-setting__icon"><View /></ElIcon>
            <span>显示关系文字</span>
            <ElSwitch
              :model-value="relationLabelsVisible"
              @change="emit('toggle-relation-labels')"
            />
          </div>
        </div>

        <div class="kg-action-group">
          <div class="kg-action-group__title">布局操作</div>
          <div class="kg-action-group__body">
            <ElButton :icon="Refresh" class="kg-toolbar__ghost" @click="emit('relayout')">重算布局</ElButton>
          </div>
        </div>
      </section>
    </header>

    <section class="kg-stage kg-stage--light kg-enterprise-stage">
      <div v-if="message" class="kg-message">{{ message }}</div>
      <ElButton
        v-if="searchFocusActive"
        type="primary"
        :icon="Back"
        class="kg-enterprise-focus-exit"
        @click="emit('restore-full-graph')"
      >
        返回全部图谱
      </ElButton>
      <div
        v-if="searchResults.length && !resultsClosed"
        class="kg-search-results kg-enterprise-results"
        :class="{ 'is-collapsed': resultsCollapsed }"
      >
        <div class="kg-enterprise-results-header">
          <div class="kg-enterprise-results-title">
            <ElIcon class="kg-enterprise-results-icon"><Search /></ElIcon>
            <div>
              <strong>搜索结果</strong>
              <p>关键词：<em>{{ searchKeyword }}</em></p>
            </div>
          </div>
          <div class="kg-enterprise-results-tools">
            <span>共 {{ searchResults.length }} 个结果</span>
            <ElButton
              class="kg-enterprise-result-tool"
              :icon="resultsCollapsed ? ArrowDown : ArrowUp"
              @click="resultsCollapsed = !resultsCollapsed"
            />
            <ElButton class="kg-enterprise-result-tool" :icon="Close" @click="closeResults" />
          </div>
        </div>

        <div class="kg-enterprise-results-body">
          <div class="kg-enterprise-results-divider"></div>
          <div class="kg-enterprise-results-list">
            <button
              v-for="(node, index) in searchResults"
              :key="node.id"
              type="button"
              class="kg-enterprise-result-card"
              :class="{ 'is-active': activeResultId === node.id }"
              @click="handleSelectResult(node)"
            >
              <span class="kg-enterprise-result-index">{{ index + 1 }}</span>
              <span class="kg-enterprise-result-main">
                <strong>{{ formatNodeName(node) }}</strong>
                <em>{{ searchResultPath(node) }}</em>
              </span>
              <ElTag v-if="node.levelName" class="kg-enterprise-result-tag" size="small" effect="plain">
                {{ node.levelName }}
              </ElTag>
              <ElIcon class="kg-enterprise-result-arrow"><ArrowRight /></ElIcon>
            </button>
          </div>
        </div>
      </div>
      <slot name="canvas"></slot>
    </section>
  </main>
</template>

<style scoped>
.kg-enterprise-right {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
}

.kg-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  flex: 0 0 auto;
  height: auto;
  min-height: 112px;
  padding: 24px 24px 18px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.kg-toolbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 1 auto;
  min-width: 0;
  gap: 0;
}

.kg-toolbar .el-button + .el-button {
  margin-left: 0;
}

.kg-enterprise-search {
  width: min(430px, 100%);
}

.kg-enterprise-search-area {
  display: flex;
  flex: 1 1 480px;
  min-width: 360px;
  flex-direction: column;
  gap: 14px;
}

.kg-enterprise-search-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.kg-enterprise-search-row .el-button {
  min-width: 84px;
  height: 46px;
  border-radius: 5px;
}

:deep(.kg-enterprise-search .el-input__wrapper) {
  min-height: 46px;
  border-radius: 5px;
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.34) inset;
}

:deep(.kg-enterprise-search .el-input__inner) {
  color: #0f172a;
  font-size: 15px;
  font-weight: 600;
}

.kg-enterprise-quick-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 22px;
}

.kg-enterprise-quick-label {
  margin-right: 4px;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.kg-enterprise-quick-tag {
  cursor: pointer;
  height: 24px;
  padding: 0 11px;
  border-color: rgba(37, 99, 235, 0.14);
  border-radius: 5px;
  background: rgba(239, 246, 255, 0.86);
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
}

.kg-toolbar .el-button {
  height: 32px;
  border-radius: 5px;
  color: #1e3a5f;
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(37, 99, 235, 0.18);
  font-size: 13px;
  font-weight: 500;
}

.kg-toolbar .el-button--primary {
  color: #ffffff;
  background: #2563eb;
  border-color: #2563eb;
}

.kg-toolbar .el-button:hover {
  color: #1d4ed8;
  background: #eff6ff;
  border-color: rgba(37, 99, 235, 0.38);
}

.kg-toolbar .el-button--primary:hover {
  color: #ffffff;
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.kg-action-group {
  position: relative;
  display: flex;
  min-height: 70px;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  padding: 0 24px;
}

.kg-action-group + .kg-action-group {
  border-left: 1px solid rgba(148, 163, 184, 0.18);
}

.kg-action-group__title {
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.kg-action-group__body {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}

.kg-display-setting {
  gap: 8px;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.kg-display-setting__icon {
  color: #64748b;
  font-size: 16px;
}

:deep(.kg-display-setting .el-switch__core) {
  border-color: transparent;
}

@media (max-width: 1280px) {
  .kg-toolbar {
    align-items: flex-start;
  }

  .kg-toolbar__actions {
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
  }

  .kg-action-group:first-child {
    padding-left: 0;
  }
}

.kg-enterprise-stage {
  flex: 1;
  min-height: 0;
}

.kg-enterprise-focus-exit {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 8;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: #2563eb;
  border-color: #2563eb;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.18);
  font-weight: 700;
}

.kg-enterprise-focus-exit:hover {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.kg-enterprise-results {
  top: 18px;
  left: 18px;
  width: min(430px, calc(100% - 36px));
  max-height: calc(100% - 36px);
  padding: 18px;
  overflow: hidden;
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(10px);
  box-sizing: border-box;
  transition: width 0.2s ease, padding 0.2s ease, box-shadow 0.2s ease;
}

.kg-enterprise-results.is-collapsed {
  width: min(360px, calc(100% - 36px));
  padding-bottom: 18px;
}

.kg-enterprise-results-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.kg-enterprise-results-title {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
}

.kg-enterprise-results-icon {
  flex: 0 0 auto;
  margin-top: 4px;
  color: #2563eb;
  font-size: 22px;
}

.kg-enterprise-results-title strong {
  display: block;
  color: #0f172a;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.25;
}

.kg-enterprise-results-title p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
}

.kg-enterprise-results-title em {
  color: #2563eb;
  font-style: normal;
  font-weight: 700;
}

.kg-enterprise-results-tools {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
}

.kg-enterprise-results-tools > span {
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.kg-enterprise-result-tool {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  color: #64748b;
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.92);
}

.kg-enterprise-result-tool:hover {
  color: #2563eb;
  border-color: rgba(37, 99, 235, 0.3);
  background: #eff6ff;
}

.kg-enterprise-results-body {
  max-height: min(456px, calc(100vh - 300px));
  overflow: hidden;
  opacity: 1;
  transition: max-height 0.24s ease, opacity 0.2s ease, margin-top 0.24s ease;
}

.kg-enterprise-results.is-collapsed .kg-enterprise-results-body {
  max-height: 0;
  margin-top: 0;
  opacity: 0;
}

.kg-enterprise-results-divider {
  height: 1px;
  margin: 16px 0 14px;
  background: rgba(148, 163, 184, 0.22);
}

.kg-enterprise-results-list {
  max-height: min(380px, calc(100vh - 378px));
  overflow-y: auto;
  padding: 0 2px 2px 0;
}

.kg-enterprise-results-list::-webkit-scrollbar {
  width: 5px;
}

.kg-enterprise-results-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.34);
}

.kg-enterprise-results-list::-webkit-scrollbar-track {
  background: transparent;
}

.kg-enterprise-result-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(36px, auto) minmax(0, 1fr) auto 18px;
  align-items: center;
  width: 100%;
  gap: 12px;
  min-height: 82px;
  margin: 0 0 12px;
  padding: 14px 14px 14px 20px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  cursor: pointer;
  text-align: left;
  box-sizing: border-box;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.kg-enterprise-result-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  background: transparent;
  content: '';
}

.kg-enterprise-result-card:hover {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(248, 250, 252, 0.96);
}

.kg-enterprise-result-card.is-active {
  border-color: #2563eb;
  background: rgba(239, 246, 255, 0.72);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.1);
}

.kg-enterprise-result-card.is-active::before {
  background: #2563eb;
}

.kg-enterprise-result-index {
  grid-column: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 32px;
  padding: 0 8px;
  border-radius: 7px;
  background: rgba(219, 234, 254, 0.9);
  color: #2563eb;
  font-size: 15px;
  font-weight: 800;
  box-sizing: border-box;
}

.kg-enterprise-result-main {
  grid-column: 2;
  min-width: 0;
}

.kg-enterprise-result-main strong {
  display: block;
  color: #0f172a;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
}

.kg-enterprise-result-main em {
  display: block;
  margin-top: 6px;
  color: #475569;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}

.kg-enterprise-result-tag {
  grid-column: 3;
  align-self: center;
  border-color: rgba(37, 99, 235, 0.14);
  border-radius: 6px;
  background: rgba(219, 234, 254, 0.84);
  color: #2563eb;
  font-weight: 600;
}

.kg-enterprise-result-arrow {
  grid-column: 4;
  color: #64748b;
  font-size: 16px;
}

.kg-enterprise-result-card.is-active .kg-enterprise-result-arrow {
  color: #2563eb;
}
</style>
