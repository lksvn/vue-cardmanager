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
      <div v-if="issueGroups.length" class="issue-groups" aria-label="Issues by type">
        <div v-for="issue in issueGroups" :key="issue.code">
          <strong>{{ issue.count }}</strong>
          <span>{{ issue.label }}</span>
          <code>{{ issue.code }}</code>
        </div>
      </div>
      <p v-if="report.summary.totalIssues === 0" class="healthy">No collection issues found.</p>
      <details v-for="card in report.cards" :key="card.filename" class="audit-card">
        <summary><strong>{{ card.name }}</strong><small>{{ card.filename }} · {{ card.issues.length }} issue(s)</small></summary>
        <button class="search-card" @click="searchCard(card)">{{ needsIdentity(card) ? 'Resolve identity' : 'Search all printings' }}</button>
        <ul><li v-for="issue in card.issues" :key="issue.code"><code>{{ issue.code }}</code> {{ issue.message }}</li></ul>
      </details>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiErrorMessage, serverService } from '../services/server';

const router = useRouter();
const loading = ref(false);
const error = ref('');
const report = ref(null);
const issueLabels = {
  MISSING_SCRYFALL_ID: 'Missing Scryfall ID', MISSING_ORACLE_ID: 'Missing Oracle ID',
  MISSING_PRINT_IDENTITY: 'Missing printing identity', LEGACY_SCHEMA: 'Legacy schema',
  MISSING_COVER: 'Missing cover link', MISSING_IMAGE: 'Missing image',
  FILENAME_MISMATCH: 'Filename mismatch', PARSE_ERROR: 'Note parsing error',
  DUPLICATE_SCRYFALL_ID: 'Duplicate Scryfall ID', DUPLICATE_PRINT_IDENTITY: 'Duplicate printing'
};
const issueGroups = computed(() => Object.entries(report.value?.summary?.issueCounts || {})
  .map(([code, count]) => ({ code, count, label: issueLabels[code] || code }))
  .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)));

const runAudit = async () => {
  loading.value = true;
  error.value = '';
  try { report.value = await serverService.auditCards(); }
  catch (requestError) { error.value = apiErrorMessage(requestError, 'Audit failed.'); }
  finally { loading.value = false; }
};

const needsIdentity = card => card.issues.some(issue => ['MISSING_SCRYFALL_ID', 'MISSING_ORACLE_ID', 'MISSING_PRINT_IDENTITY'].includes(issue.code));
const searchCard = card => {
  const oracleId = card.identity?.oracleId;
  const escapedName = String(card.name || '').replace(/(["\\])/g, '\\$1');
  const query = oracleId ? `oracleid:${oracleId}` : `!"${escapedName}"`;
  router.push({ path: '/search', query: {
    q: query, unique: 'prints', order: 'released', dir: 'desc', view: 'grid',
    ...(needsIdentity(card) ? { resolve: card.filename } : {})
  } });
};
</script>

<style scoped>
.audit-panel{background:white;padding:24px;border-radius:8px;margin-bottom:30px}.audit-header{display:flex;justify-content:space-between;align-items:center;gap:16px}.audit-header h3{margin:0}.audit-header p{margin:5px 0;color:#718096}.btn{padding:8px 14px;border:1px solid #cbd5e0;border-radius:4px;cursor:pointer}.summary{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.summary span{background:#edf2f7;border-radius:999px;padding:5px 10px}.healthy{padding:10px;background:#f0fff4;color:#276749}.audit-card{border-top:1px solid #e2e8f0;padding:10px 0}.audit-card summary{cursor:pointer}.audit-card small{display:block;color:#718096;margin-top:3px}.audit-card code{color:#c53030}.error{color:#c53030}
.issue-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-bottom:18px}.issue-groups>div{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:2px 8px;padding:9px 10px;border:1px solid #e2e8f0;border-radius:6px}.issue-groups strong{font-size:20px;color:#c53030}.issue-groups code{grid-column:2;color:#718096;font-size:10px}.search-card{margin:10px 0 0;padding:6px 10px;border:1px solid #3182ce;border-radius:4px;background:white;color:#2b6cb0;cursor:pointer}.search-card:hover{background:#ebf8ff}
</style>
