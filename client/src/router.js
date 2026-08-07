import { createRouter, createWebHistory } from 'vue-router';
import CollectionView from './components/CollectionView.vue';
import Settings from './components/Settings.vue';
import MigrationView from './views/MigrationView.vue';
import SearchView from './views/SearchView.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/search' },
    { path: '/search', component: SearchView },
    { path: '/collection', component: CollectionView },
    { path: '/settings', component: Settings },
    { path: '/migration', component: MigrationView }
  ]
});
