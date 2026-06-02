<script setup>
import { ref, watch } from 'vue';
import { ElButton, ElInput } from 'element-plus';
import { Connection, Fold, Hide, Refresh, Search, View } from '@element-plus/icons-vue';
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

watch(
  () => props.searchKeyword,
  (value) => {
    keyword.value = value;
  },
);

function handleSearch() {
  emit('search', keyword.value);
}
</script>

<template>
  <main class="kg-enterprise-right">
    <header class="kg-toolbar kg-enterprise-toolbar">
      <div class="kg-toolbar__title">
        <strong>G6 知识图谱</strong>
        <span>企业级用地用海分类关系展示</span>
      </div>
      <div class="kg-toolbar__actions">
        <ElInput
          v-model="keyword"
          class="kg-enterprise-search"
          clearable
          placeholder="请输入分类名称、编码或对应关系"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
        />
        <ElButton type="primary" :icon="Search" @click="handleSearch">搜索</ElButton>
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
      <button v-if="searchFocusActive" type="button" class="kg-focus-exit" @click="emit('restore-full-graph')">
        返回全部图谱
      </button>
      <slot name="canvas"></slot>
    </section>

    <section class="kg-search-results kg-enterprise-results" :class="{ 'is-empty': !searchResults.length }">
      <div class="kg-search-results__header">
        <strong>搜索结果</strong>
        <span>{{ searchKeyword ? `${searchKeyword} · ${searchResults.length} 个` : '请输入关键词检索节点' }}</span>
      </div>
      <template v-if="searchResults.length">
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
      </template>
      <div v-else class="kg-enterprise-results-empty">暂无搜索结果</div>
    </section>
  </main>
</template>

