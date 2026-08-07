<template><MigrationPanel :vault-path="config.obsidianVaultPath || ''" :schema-version="config.schemaVersion || 1" /></template>
<script setup>
import { onMounted, ref } from 'vue';
import MigrationPanel from '../components/MigrationPanel.vue';
import { serverService } from '../services/server';
const config = ref({});
onMounted(async () => { config.value = await serverService.getConfig(); });
</script>
