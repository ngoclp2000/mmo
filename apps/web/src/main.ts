import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import App from './App.vue';
import './style.css';
const Empty = { template: '<span />' };
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/overview' },
    ...[
      'overview',
      'watchlist',
      'library',
      'alerts',
      'operations',
      'demo-destination',
    ].map((path) => ({ path: `/${path}`, component: Empty })),
    { path: '/:pathMatch(.*)*', redirect: '/overview' },
  ],
});
createApp(App)
  .use(createPinia())
  .use(router)
  .use(VueQueryPlugin, {
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
    }),
  })
  .mount('#app');
