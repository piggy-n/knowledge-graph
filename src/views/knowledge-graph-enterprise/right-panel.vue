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
        <ElButton :icon="Back" @click="emit('restore-full-graph')">返回全部图谱</ElButton>
      </div>
    </header>

    <section class="kg-stage kg-stage--light kg-enterprise-stage">
      <div v-if="message" class="kg-message">{{ message }}</div>
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
