<template>
  <!-- 右侧容器只负责布局承载，具体业务内容由插槽组件提供。 -->
  <main class="kg-enterprise-right">
    <slot></slot>
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
</style>
