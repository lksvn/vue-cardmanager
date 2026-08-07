<template>
<div class="settings">
    <h2>Configuration</h2>
    <span v-if="message" :class="['status-msg', messageType]">{{ message }}</span>
    <div class="settings-group">
        <h3>Local Paths</h3>
        <div class="form-item">
            <label>Obsidian Vault Path:</label>
            <input v-model="config.vaultPath" type="text" placeholder="C:\Users\...\Vault" />
        </div>
        <div class="form-item">
            <label>Full Obsidian Vault Path (required for migration):</label>
            <input v-model="config.obsidianVaultPath" type="text" placeholder="C:\Users\...\Vault" />
        </div>
        <div class="form-item">
            <label>Images Folder Path:</label>
            <input v-model="config.imagesPath" type="text" placeholder="C:\Users\...\Vault\Images" />
        </div>
        <div class="form-item">
            <label>groups.md File Path:</label>
            <input v-model="config.groupsFile" type="text" />
        </div>
        <div class="form-item">
            <label>types.md File Path:</label>
            <input v-model="config.typesFile" type="text" />
        </div>
        <div class="form-item">
            <label>collections.md File Path:</label>
            <input v-model="config.collectionsFile" type="text" />
        </div>
        <div class="form-item">
            <label>Obsidian Cards Base File:</label>
            <input v-model="config.baseFile" type="text" placeholder="C:\Users\...\Cards List.base" />
        </div>

        <div class="actions">
            <button @click="saveSettings" :disabled="saving" class="btn btn-primary">
            {{ saving ? 'Saving...' : 'Save Paths' }}
            </button>
        </div>
    </div>

    <MigrationPanel :vault-path="config.obsidianVaultPath" :schema-version="config.schemaVersion" @completed="refreshTags" />
    <CollectionAudit />

    <div class="settings-group">
        <h3>Type Mapping</h3>
        <p class="help-text">Map Scryfall types (e.g., Creature) to your preferred names (e.g., Criatura).</p>
        
        <div class="mapping-list">
            <div v-for="(pref, scry) in config.typeMapping" :key="scry" class="mapping-item">
            <span class="scry-name">{{ scry }}</span>
            <span class="arrow">→</span>
            <input v-model="config.typeMapping[scry]" type="text" class="pref-input" />
            <button @click="removeMapping(scry)" class="btn-remove">&times;</button>
            </div>
        </div>

        <div class="add-mapping">
            <input v-model="newScryType" type="text" placeholder="Scryfall Type" />
            <input v-model="newPrefType" type="text" placeholder="Preferred Name" />
            <button @click="addMapping" class="btn btn-secondary">Add Mapping</button>
        </div>

        <div class="actions" style="margin-top: 20px;">
            <button @click="saveSettings" :disabled="saving" class="btn btn-primary">Save Mappings</button>
        </div>
    </div>

    <div class="settings-group">
        <div class="header-with-action">
            <h3>Tag Manager</h3>
            <div class="tag-actions-header">
            <button
              v-for="tagType in rebuildTagTypes"
              :key="tagType.type"
              @click="rebuildTags(tagType)"
              :disabled="rebuildingType !== null"
              class="btn btn-secondary btn-small"
            >
              {{ rebuildingType === tagType.type ? 'Rebuilding...' : `Rebuild ${tagType.label}` }}
            </button>
            <button @click="refreshTags" class="btn btn-secondary btn-small">Refresh Files</button>
            </div>
        </div>
        <TagManager ref="tagManagerRef" @changed="emit('refresh-tags')" />
    </div>
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { apiErrorMessage, serverService } from '../services/server';
import TagManager from './TagManager.vue';
import MigrationPanel from './MigrationPanel.vue';
import CollectionAudit from './CollectionAudit.vue';
import { useUiStore } from '../stores/ui';

const config = ref({
  vaultPath: '',
  imagesPath: '',
  groupsFile: '',
  typesFile: '',
  collectionsFile: '',
  obsidianVaultPath: '',
  baseFile: '',
  schemaVersion: 1,
  typeMapping: {}
});

const newScryType = ref('');
const newPrefType = ref('');
const saving = ref(false);
const rebuildingType = ref(null);
const rebuildTagTypes = [
  { type: 'collections', label: 'Collections' },
  { type: 'groups', label: 'Groups' },
  { type: 'types', label: 'Types' }
];
const message = ref('');
const messageType = ref('');
const tagManagerRef = ref(null);
const ui = useUiStore();

const emit = defineEmits(['refresh-tags']);

onMounted(async () => {
  try {
    const data = await serverService.getConfig();
    config.value = data;
  } catch (error) {
    console.error('Failed to load config:', error);
  }
});

const addMapping = () => {
  if (newScryType.value && newPrefType.value) {
    config.value.typeMapping[newScryType.value] = newPrefType.value;
    newScryType.value = '';
    newPrefType.value = '';
  }
};

const removeMapping = (scry) => {
  delete config.value.typeMapping[scry];
};

const saveSettings = async () => {
  saving.value = true;
  message.value = '';
  try {
    await serverService.updateConfig(config.value);
    message.value = 'Settings saved successfully!';
    messageType.value = 'success';
    emit('refresh-tags');
  } catch (error) {
    message.value = 'Failed to save settings.';
    messageType.value = 'error';
  } finally {
    saving.value = false;
    setTimeout(() => { message.value = ''; }, 3000);
  }
};

const refreshTags = () => {
  if (tagManagerRef.value) {
    tagManagerRef.value.fetchTags();
  }
  emit('refresh-tags');
};

const rebuildTags = async ({ type, label }) => {
  if (!await ui.confirm(`Rescan every card and rewrite the ${label.toLowerCase()} list?`)) return;
  
  rebuildingType.value = type;
  message.value = '';
  try {
    const result = type === 'collections'
      ? await serverService.rebuildCollections()
      : await serverService.rebuildTags(type);
    message.value = `${result.message} (${result.count} ${label.toLowerCase()} found)`;
    messageType.value = 'success';
    refreshTags();
  } catch (error) {
    message.value = apiErrorMessage(error, `Failed to rebuild ${label.toLowerCase()}.`);
    messageType.value = 'error';
  } finally {
    rebuildingType.value = null;
    setTimeout(() => { message.value = ''; }, 5000);
  }
};
</script>

<style scoped>
.settings-group {
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: left;
}

.settings-group {
  margin-bottom: 30px;
  border-bottom: 1px solid #edf2f7;
  padding-bottom: 20px;
}

.settings-group:last-child {
  border-bottom: none;
}

h3 {
  margin-top: 0;
  color: #4a5568;
}

.header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.tag-actions-header {
  display: flex;
  gap: 10px;
}

.form-item {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #4a5568;
}

input[type="text"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
}

.help-text {
  font-size: 14px;
  color: #718096;
  margin-bottom: 15px;
}

.mapping-list {
  margin-bottom: 20px;
}

.mapping-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.scry-name {
  width: 120px;
  font-weight: bold;
}

.pref-input {
  width: 150px !important;
}

.btn-remove {
  background: none;
  border: none;
  color: #e53e3e;
  font-size: 20px;
  cursor: pointer;
}

.add-mapping {
  display: flex;
  gap: 10px;
}

.add-mapping input {
  width: 150px !important;
}

.actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.status-msg {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: fit-content;
    padding: 10px 20px;
    border-radius: 4px;
    border: 2px solid transparent;
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.success { color: #1c613c; border-color: #1c613c; background-color: #b7e7cd }
.error { color: #e92323; border-color: #e92323; background-color: #e4c8c8 }

.btn {
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #cbd5e0;
}

.btn-primary {
  background-color: #3182ce;
  color: white;
  border-color: #3182ce;
}

.btn-secondary {
  background-color: #edf2f7;
}

.btn-small {
  padding: 5px 10px;
  font-size: 12px;
}
</style>
