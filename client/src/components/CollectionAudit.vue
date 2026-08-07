<template>
  <section class="audit-panel">
    <div class="audit-header">
      <div><h3>Collection Audit</h3><p>Read-only checks for metadata, identities, filenames, and image links.</p></div>
      <button class="btn" :disabled="loading" @click="runAudit">{{ loading ? 'Scanning...' : 'Run Audit' }}</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <template v-if="report">
      <div class="summary">
        <span>{{ report.summary.totalCards }} cards</span><span>{{ report.summary.affectedCards }} affected</span><span>{{ report.summary.totalIssues }} issues</span>
      </div>
      <p v-if="report.summary.totalIssues === 0" class="healthy">No collection issues found.</p>
      <details v-for="card in report.cards" :key="card.filename" class="audit-card">
        <summary><strong>{{ card.name }}</strong><small>{{ card.filename }} · {{ card.issues.length }} issue(s)</small></summary>
        <ul><li v-for="issue in card.issues" :key="issue.code"><code>{{ issue.code }}</code> {{ issue.message }}</li></ul>
      </details>
    </template>
  </section>
</template>
<script setup>
import { ref } from 'vue';
import { apiErrorMessage, serverService } from '../services/server';
const loading = ref(false); const error = ref(''); const report = ref(null);
const runAudit = async () => { loading.value = true; error.value = ''; try { report.value = await serverService.auditCards(); } catch (requestError) { error.value = apiErrorMessage(requestError, 'Audit failed.'); } finally { loading.value = false; } };
</script>
<style scoped>
.audit-panel{background:white;padding:24px;border-radius:8px;margin-bottom:30px}.audit-header{display:flex;justify-content:space-between;align-items:center;gap:16px}.audit-header h3{margin:0}.audit-header p{margin:5px 0;color:#718096}.btn{padding:8px 14px;border:1px solid #cbd5e0;border-radius:4px;cursor:pointer}.summary{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.summary span{background:#edf2f7;border-radius:999px;padding:5px 10px}.healthy{padding:10px;background:#f0fff4;color:#276749}.audit-card{border-top:1px solid #e2e8f0;padding:10px 0}.audit-card summary{cursor:pointer}.audit-card small{display:block;color:#718096;margin-top:3px}.audit-card code{color:#c53030}.error{color:#c53030}
</style>
