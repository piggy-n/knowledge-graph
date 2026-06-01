import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';
import App from './App.vue';
import G6KnowledgeGraph from './views/knowledge-graph-g6/index.vue';
import D3KnowledgeGraph from './views/knowledge-graph-d3/index.vue';
import './styles.css';

const routes = [
  {
    path: '/',
    redirect: '/knowledge-graph-g6',
  },
  {
    path: '/knowledge-graph-g6',
    name: 'KnowledgeGraphG6',
    component: G6KnowledgeGraph,
    meta: { title: 'G6 知识图谱' },
  },
  {
    path: '/knowledge-graph-d3',
    name: 'KnowledgeGraphD3',
    component: D3KnowledgeGraph,
    meta: { title: 'D3 知识图谱' },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.afterEach((to) => {
  document.title = `${to.meta.title || '知识图谱'} - 用地用海分类`;
});

createApp(App).use(router).mount('#app');
