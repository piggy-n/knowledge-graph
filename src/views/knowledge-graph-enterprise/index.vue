<script setup>
import 'element-plus/dist/index.css';
import LeftPanel from './left-panel.vue';
import RightPanel from './right-panel.vue';
import RightPanelContent from './right-panel-content.vue';
import GraphCanvasPanel from './graph-canvas-panel.vue';
import { useEnterpriseGraph } from './use-enterprise-graph';

const {
  leftPanelProps,
  rightPanelContentProps,
  canvasPanelProps,
  setContainerElement,
  setCanvasShellElement,
  setLegendHover,
  toggleLegend,
  removeMultiNode,
  clearMultiSelection,
  downloadSelectedNodes,
  searchNode,
  expandAll,
  collapseAll,
  toggleRelationLabels,
  relayout,
  selectSearchResult,
  restoreFullGraph,
  zoomGraph,
  setGraphMode,
  toggleFullscreen,
} = useEnterpriseGraph();
</script>

<template>
  <section class="kg-page kg-page--g6 kg-enterprise-page">
    <LeftPanel
      v-bind="leftPanelProps"
      @legend-hover="setLegendHover"
      @legend-toggle="toggleLegend"
      @remove-multi-node="removeMultiNode"
      @clear-multi-selection="clearMultiSelection"
      @download-multi-selection="downloadSelectedNodes"
    />

    <RightPanel>
      <RightPanelContent
        v-bind="rightPanelContentProps"
        @search="searchNode"
        @expand-all="expandAll"
        @collapse-all="collapseAll"
        @toggle-relation-labels="toggleRelationLabels"
        @relayout="relayout"
        @select-result="selectSearchResult"
        @restore-full-graph="restoreFullGraph"
      >
        <template #canvas>
          <GraphCanvasPanel
            v-bind="canvasPanelProps"
            @container-change="setContainerElement"
            @shell-change="setCanvasShellElement"
            @toggle-fullscreen="toggleFullscreen"
            @zoom="zoomGraph"
            @mode-change="setGraphMode"
          />
        </template>
      </RightPanelContent>
    </RightPanel>
  </section>
</template>

<style scoped>
.kg-enterprise-page {
  display: flex;
  flex-direction: row;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  contain: layout paint size;
}
</style>
