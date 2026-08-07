<template>
  <div id="app">
    <header class="app-header">
      <div class="container">
        <RouterLink to="/search" class="brand">MTG Card Manager</RouterLink>
        <nav>
          <RouterLink to="/search">Search</RouterLink>
          <RouterLink to="/collection">Collections</RouterLink>
          <RouterLink to="/settings">Settings</RouterLink>
          <RouterLink to="/migration">Migration</RouterLink>
        </nav>
      </div>
    </header>
    <main class="container"><RouterView /></main>
    <ToastHost />
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router';
import ConfirmDialog from './components/ConfirmDialog.vue';
import ToastHost from './components/ToastHost.vue';
</script>

<style>
:root { --primary: #3182ce; --bg: #ddd; --text: #2d3748; }
body { margin: 0; padding-bottom: 20px; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; }
.container { max-width: 1440px; margin: 0 auto; padding: 0 20px; }
.app-header { background: white; border-bottom: 1px solid #e2e8f0; padding: 10px 0; margin-bottom: 30px; }
.app-header .container { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.brand { font-size: 24px; font-weight: 700; color: var(--primary); text-decoration: none; }
nav { display: flex; flex-wrap: wrap; gap: 20px; }
nav a { color: #718096; text-decoration: none; padding-bottom: 5px; }
nav a.router-link-active { color: var(--primary); border-bottom: 2px solid var(--primary); }
.loading, .no-results, .welcome, .error-state { text-align: center; padding: 50px; font-size: 18px; color: #718096; }
.error-state { color: #c53030; }.error-state button { display: block; margin: 16px auto 0; }
.pagination-controls { display: flex; justify-content: center; margin: 40px 0; }
.btn-load-more { background: white; border: 1px solid var(--primary); color: var(--primary); padding: 12px 30px; border-radius: 6px; font-size: 16px; cursor: pointer; }
.btn-load-more:hover:not(:disabled) { background: var(--primary); color: white; }.btn-load-more:disabled { opacity: .6; }
@media (max-width: 700px) { .app-header .container { align-items: flex-start; flex-direction: column; } }
</style>
