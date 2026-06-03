<script setup>
import { ref, watch } from 'vue';
import { ElButton, ElInput, ElTag } from 'element-plus';
import { Back, Connection, Fold, Hide, Refresh, Search, View } from '@element-plus/icons-vue';
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
const quickKeywords = ['用地', '耕地', '湿地', '交通', '水域'];

watch(
  () => props.searchKeyword,
  (value) => {
    keyword.value = value;
  },
);

function handleSearch() {
  emit('search', keyword.value);
}

function handleQuickSearch(value) {
  keyword.value = value;
  emit('search', value);
}
</script>

<template>
  <main class="kg-enterprise-right">
    <header class="kg-toolbar kg-enterprise-toolbar">
      <div class="kg-enterprise-search-area">
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
      </div>
      <div class="kg-toolbar__actions">
        <ElButton :icon="Connection" @click="emit('expand-all')">全部展开</ElButton>
        <ElButton :icon="Fold" @click="emit('collapse-all')">全部收起</ElButton>
        <ElButton :icon="relationLabelsVisible ? Hide : View" @click="emit('toggle-relation-labels')">
          {{ relationLabelsVisible ? '隐藏关系文字' : '显示关系文字' }}
        </ElButton>
        <ElButton :icon="Refresh" class="kg-toolbar__ghost" @click="emit('relayout')">重算布局</ElButton>
      </div>
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
      <div v-if="searchResults.length" class="kg-search-results kg-enterprise-results">
        <div class="kg-search-results__header">
          <strong>搜索结果</strong>
          <span>{{ searchKeyword }} · {{ searchResults.length }} 个</span>
        </div>
        <div class="kg-enterprise-results-list">
          <button
            v-for="node in searchResults"
            :key="node.id"
            type="button"
            class="kg-search-results__item"
            @click="emit('select-result', node)"
          >
            <span>{{ formatNodeName(node) }}</span>
            <em>{{ searchResultPath(node) }}</em>
          </button>
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
  flex: 0 0 auto;
  height: auto;
  min-height: 88px;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(37, 99, 235, 0.1);
}

.kg-toolbar__actions {
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  min-width: 0;
  gap: 8px;
}

.kg-toolbar .el-button + .el-button {
  margin-left: 0;
}

.kg-enterprise-search {
  width: 320px;
}

.kg-enterprise-search-area {
  display: flex;
  flex: 0 0 430px;
  min-width: 360px;
  flex-direction: column;
  gap: 8px;
}

.kg-enterprise-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kg-enterprise-quick-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 22px;
}

.kg-enterprise-quick-tag {
  cursor: pointer;
  border-color: rgba(37, 99, 235, 0.18);
  background: rgba(239, 246, 255, 0.72);
}

.kg-toolbar .el-button {
  height: 32px;
  border-radius: 7px;
  color: #1e3a5f;
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(37, 99, 235, 0.18);
  font-weight: 700;
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
  width: 340px;
  max-height: none;
  overflow: hidden;
}

.kg-enterprise-results-list {
  max-height: 156px;
  overflow-y: auto;
  padding-right: 2px;
}
</style>
