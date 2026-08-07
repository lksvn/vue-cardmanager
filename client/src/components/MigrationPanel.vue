<template>
  <section class="migration-panel">
    <div class="header">
      <div>
        <h3>Card Schema Migration</h3>
        <p>Preview and migrate existing card notes, images, and references to schema version 2.</p>
      </div>
      <button class="btn" :disabled="previewDisabled" @click="previewMigration">{{ migrationComplete ? 'Migration Complete' : 'Generate Preview' }}</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="success">{{ message }}</p>
    <p v-if="migrationComplete" class="complete-note">Schema version 2 is active and no legacy card files were detected.</p>
    <p v-else-if="statusLoaded && legacyFiles > 0" class="legacy-note">{{ legacyFiles }} legacy card file(s) detected.</p>

    <div v-if="preview" class="preview">
      <div class="totals">
        <span>{{ preview.totals.cards }} cards</span>
        <span>{{ preview.totals.images }} images</span>
        <span>{{ preview.totals.linkFiles }} linked files</span>
        <span>{{ preview.totals.unresolved }} unresolved</span>
      </div>

      <details v-if="preview.unresolved.length">
        <summary>Unresolved cards (will be skipped)</summary>
        <ul><li v-for="item in preview.unresolved" :key="item.filename">{{ item.filename }} — {{ item.reason }}</li></ul>
      </details>

      <label class="confirmation">
        Confirm the exact full vault path before applying:
        <input v-model="confirmedPath" type="text" :placeholder="preview.vaultPath" />
      </label>
      <label class="check"><input v-model="confirmedTotals" type="checkbox" /> I reviewed the totals and unresolved files.</label>
      <button class="btn danger" :disabled="busy || !canApply" @click="applyMigration">Apply Migration</button>
    </div>

    <div v-if="migrations.length" class="history">
      <h4>Migration Backups</h4>
      <div v-for="migration in migrations" :key="migration" class="history-row">
        <code>{{ migration }}</code>
        <button class="btn small" :disabled="busy" @click="selectRollback(migration)">Rollback</button>
      </div>
      <div v-if="rollbackId" class="rollback-confirm">
        <p>Type the migration ID to confirm rollback:</p>
        <input v-model="rollbackConfirmation" type="text" />
        <button class="btn danger" :disabled="rollbackConfirmation !== rollbackId || busy" @click="rollback">Confirm rollback</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { apiErrorMessage, serverService } from '../services/server';

const props = defineProps({ vaultPath: { type: String, default: '' }, schemaVersion: { type: Number, default: 1 } });
const emit = defineEmits(['completed']);
const preview = ref(null);
const confirmedPath = ref('');
const confirmedTotals = ref(false);
const migrations = ref([]);
const rollbackId = ref('');
const rollbackConfirmation = ref('');
const busy = ref(false);
const error = ref('');
const message = ref('');
const legacyFiles = ref(0);
const statusLoaded = ref(false);
const effectiveSchemaVersion = ref(props.schemaVersion);
const canApply = computed(() => confirmedTotals.value && confirmedPath.value === preview.value?.vaultPath);
const migrationComplete = computed(() => effectiveSchemaVersion.value >= 2 && statusLoaded.value && legacyFiles.value === 0);
const previewDisabled = computed(() => busy.value || !props.vaultPath || !statusLoaded.value || migrationComplete.value);

const loadStatus = async () => {
  try { const status = await serverService.getMigrationStatus(); migrations.value = status.migrations; legacyFiles.value = status.legacyFiles || 0; }
  catch { migrations.value = []; }
  finally { statusLoaded.value = true; }
};

const previewMigration = async () => {
  busy.value = true; error.value = ''; message.value = '';
  try {
    preview.value = await serverService.previewMigration();
    confirmedPath.value = '';
    confirmedTotals.value = false;
  } catch (requestError) { error.value = apiErrorMessage(requestError, 'Could not preview migration.'); }
  finally { busy.value = false; }
};

const applyMigration = async () => {
  busy.value = true; error.value = '';
  try {
    const result = await serverService.applyMigration(preview.value.previewId, confirmedPath.value);
    message.value = `Migration ${result.migrationId} completed.`;
    effectiveSchemaVersion.value = 2;
    preview.value = null;
    await loadStatus();
    emit('completed');
  } catch (requestError) { error.value = apiErrorMessage(requestError, 'Migration failed.'); }
  finally { busy.value = false; }
};

const selectRollback = (migration) => {
  rollbackId.value = migration;
  rollbackConfirmation.value = '';
};

const rollback = async () => {
  busy.value = true; error.value = '';
  try {
    const result = await serverService.rollbackMigration(rollbackId.value);
    message.value = `Restored ${result.restored} files from ${result.migrationId}.`;
    effectiveSchemaVersion.value = 1;
    rollbackId.value = '';
    await loadStatus();
    emit('completed');
  } catch (requestError) { error.value = apiErrorMessage(requestError, 'Rollback failed.'); }
  finally { busy.value = false; }
};

onMounted(loadStatus);
watch(() => props.schemaVersion, value => { effectiveSchemaVersion.value = value; });
</script>

<style scoped>
.migration-panel { background: white; padding: 24px; border-radius: 8px; margin-bottom: 30px; }
.header, .history-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
h3, h4 { margin: 0 0 6px; } p { color: #718096; }
.totals { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
.totals span { background: #edf2f7; border-radius: 14px; padding: 5px 10px; }
.confirmation { display: grid; gap: 6px; margin: 18px 0 8px; }
input[type="text"] { padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; }
.check { display: block; margin-bottom: 14px; }
.btn { padding: 8px 14px; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.danger { background: #c53030; color: white; border-color: #c53030; }
.small { padding: 4px 8px; }
.error { color: #c53030; }.success { color: #2f855a; }
.complete-note { color: #276749; background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 6px; padding: 10px; }
.legacy-note { color: #744210; background: #fffaf0; border: 1px solid #f6ad55; border-radius: 6px; padding: 10px; }
.history { margin-top: 24px; }.history-row { padding: 8px 0; border-top: 1px solid #edf2f7; }
.rollback-confirm { background: #fff5f5; padding: 12px; margin-top: 10px; display: grid; gap: 8px; }
</style>
