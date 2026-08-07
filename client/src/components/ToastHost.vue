<template><div class="toasts"><div v-for="toast in ui.toasts" :key="toast.id" :class="['toast', toast.type]">{{ toast.message }}</div></div></template>
<script setup>import { useUiStore } from '../stores/ui'; const ui = useUiStore();</script>
<style scoped>.toasts{position:fixed;right:20px;bottom:20px;display:grid;gap:8px;z-index:2000}.toast{background:#2d3748;color:white;padding:10px 16px;border-radius:6px;box-shadow:0 3px 12px #0003}.error{background:#c53030}.success{background:#2f855a}</style>
