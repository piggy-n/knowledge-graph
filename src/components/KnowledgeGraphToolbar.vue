<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  title: string;
  subtitle?: string;
  switchText: string;
}>();

const emit = defineEmits<{
  search: [keyword: string];
  reset: [];
  expandAll: [];
  collapseAll: [];
  switchVersion: [];
  relayout: [];
}>();

const keyword = ref('');

function handleSearch() {
  emit('search', keyword.value);
}
</script>

<template>
  <header class="kg-toolbar">
    <div class="kg-toolbar__title">
      <strong>{{ title }}</strong>
      <span v-if="subtitle">{{ subtitle }}</span>
    </div>
    <div class="kg-toolbar__actions">
      <label class="kg-search">
        <span>搜索</span>
        <input
          v-model="keyword"
          type="search"
          placeholder="节点名称 / 编码"
          @keyup.enter="handleSearch"
        />
      </label>
      <button type="button" @click="handleSearch">定位</button>
      <button type="button" @click="emit('reset')">重置视图</button>
      <button type="button" @click="emit('expandAll')">全部展开</button>
      <button type="button" @click="emit('collapseAll')">全部收起</button>
      <button type="button" class="kg-toolbar__ghost" @click="emit('relayout')">重算布局</button>
      <button type="button" class="kg-toolbar__primary" @click="emit('switchVersion')">
        {{ switchText }}
      </button>
    </div>
  </header>
</template>
