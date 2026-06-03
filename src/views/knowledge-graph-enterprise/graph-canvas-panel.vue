<script setup>
import { ElIcon, ElTooltip } from 'element-plus';
import {FullScreen, Mouse, Operation, Rank, ZoomIn, ZoomOut} from '@element-plus/icons-vue';

defineProps({
  graphMode: { type: String, default: 'select' },
  isFullscreen: { type: Boolean, default: false },
});

const emit = defineEmits(['container-change', 'shell-change', 'toggle-fullscreen', 'zoom', 'mode-change']);
const toolbarTooltipProps = {
  placement: 'left',
  showAfter: 0,
  hideAfter: 0,
  transition: '',
  enterable: false,
};

// 回传 G6 容器 DOM，避免页面层直接承载画布实现。
function setContainerRef(element) {
  emit('container-change', element);
}

// 回传全屏外壳 DOM，供组合式逻辑调用 Fullscreen API。
function setShellRef(element) {
  emit('shell-change', element);
}
</script>

<template>
  <div
    :ref="setShellRef"
    class="kg-canvas-shell"
    :class="{
      'is-roam': graphMode === 'roam',
      'is-fullscreen': isFullscreen,
    }"
  >
    <div :ref="setContainerRef" class="kg-canvas"></div>
    <nav class="kg-graph-ops-toolbar" aria-label="图谱操作工具栏">
      <ElTooltip v-bind="toolbarTooltipProps" content="全屏">
        <button
          type="button"
          class="kg-graph-op-button"
          :class="{ 'is-active': isFullscreen }"
          aria-label="全屏"
          @click="emit('toggle-fullscreen')"
        >
          <ElIcon><FullScreen /></ElIcon>
        </button>
      </ElTooltip>
      <ElTooltip v-bind="toolbarTooltipProps" content="放大">
        <button type="button" class="kg-graph-op-button" aria-label="放大" @click="emit('zoom', 1.16)">
          <ElIcon><ZoomIn /></ElIcon>
        </button>
      </ElTooltip>
      <ElTooltip v-bind="toolbarTooltipProps" content="缩小">
        <button type="button" class="kg-graph-op-button" aria-label="缩小" @click="emit('zoom', 0.86)">
          <ElIcon><ZoomOut /></ElIcon>
        </button>
      </ElTooltip>
      <span class="kg-graph-op-divider"></span>
      <ElTooltip v-bind="toolbarTooltipProps" content="选择模式">
        <button
          type="button"
          class="kg-graph-op-button"
          :class="{ 'is-active': graphMode === 'select' }"
          aria-label="选择模式"
          @click="emit('mode-change', 'select')"
        >
          <ElIcon><Mouse /></ElIcon>
        </button>
      </ElTooltip>
      <ElTooltip v-bind="toolbarTooltipProps" content="漫游模式">
        <button
          type="button"
          class="kg-graph-op-button"
          :class="{ 'is-active': graphMode === 'roam' }"
          aria-label="漫游模式"
          @click="emit('mode-change', 'roam')"
        >
          <ElIcon><Rank /></ElIcon>
        </button>
      </ElTooltip>
      <ElTooltip v-bind="toolbarTooltipProps" content="批选模式">
        <button
          type="button"
          class="kg-graph-op-button"
          :class="{ 'is-active': graphMode === 'multi' }"
          aria-label="批选模式"
          @click="emit('mode-change', 'multi')"
        >
          <ElIcon><Operation /></ElIcon>
        </button>
      </ElTooltip>
    </nav>
  </div>
</template>

<style scoped>
.kg-canvas-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
    #f8fbff;
  background-size: 32px 32px;
}

.kg-canvas-shell.is-fullscreen {
  background:
    linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px),
    #f8fbff;
  background-size: 32px 32px;
}

.kg-canvas-shell.is-roam,
.kg-canvas-shell.is-roam .kg-canvas,
.kg-canvas-shell.is-roam :deep(canvas) {
  cursor: grab;
}

.kg-canvas-shell.is-roam:active,
.kg-canvas-shell.is-roam:active .kg-canvas,
.kg-canvas-shell.is-roam:active :deep(canvas) {
  cursor: grabbing;
}

.kg-graph-ops-toolbar {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(10px);
}

.kg-graph-op-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 7px;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  transition: border-color 0.16s ease, color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.kg-graph-op-button:hover {
  border-color: rgba(37, 99, 235, 0.38);
  background: #eff6ff;
  color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
}

.kg-graph-op-button.is-active {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.24);
}

.kg-graph-op-button .el-icon {
  font-size: 18px;
}

.kg-graph-op-divider {
  display: block;
  width: 24px;
  height: 1px;
  margin: 2px auto;
  background: rgba(148, 163, 184, 0.28);
}
</style>
