<template>
  <div class="search-bar">
    <div style="flex:1">
        <div class="search-input-group">
            <input 
                v-model="query" 
                @keyup.enter="handleSearch"
                type="text" 
                placeholder="Search for cards (e.g. Black Lotus, type:creature)..."
                class="search-input"
            />
            <button @click="handleSearch" class="btn btn-primary" :disabled="searching">{{ searching ? 'Searching...' : 'Search' }}</button>
            <button @click="showSave = !showSave" class="btn btn-save-query" :disabled="!query.trim() || savingQuery">Save query</button>
        </div>
        <div v-if="showSave" class="save-query-form">
          <input v-model="queryName" @keyup.enter="handleSaveQuery" type="text" maxlength="100" placeholder="Query name" />
          <button class="btn btn-secondary" :disabled="!queryName.trim() || savingQuery" @click="handleSaveQuery">{{ savingQuery ? 'Saving...' : 'Save' }}</button>
          <button class="btn btn-secondary" :disabled="savingQuery" @click="cancelSaveQuery">Cancel</button>
        </div>
    </div>
    
    <div class="view-controls">
      <select v-model="selectedSavedQuery" @change="loadSavedQuery" :disabled="searching || queriesLoading || !savedQueries.length" aria-label="Saved queries">
        <option value="">{{ queriesLoading ? 'Loading queries...' : savedQueries.length ? 'Saved queries' : 'No saved queries' }}</option>
        <option v-for="item in savedQueries" :key="item.name" :value="item.query">{{ item.name }}</option>
      </select>
      <select v-model="order" @change="emitOptions" aria-label="Order results">
        <option value="name">Name</option><option value="set">Set</option><option value="released">Release</option><option value="cmc">Mana value</option><option value="rarity">Rarity</option>
      </select>
      <select v-model="dir" @change="emitOptions" aria-label="Sort direction"><option value="auto">Auto</option><option value="asc">Ascending</option><option value="desc">Descending</option></select>
      <select v-model="unique" @change="emitOptions" aria-label="Unique results"><option value="cards">Cards</option><option value="prints">Prints</option><option value="art">Art</option></select>
      <button 
        @click="$emit('update:viewMode', 'grid')" 
        :class="{ active: viewMode === 'grid' }"
        class="btn btn-secondary"
      >
        Grid
      </button>
      <button 
        @click="$emit('update:viewMode', 'list')" 
        :class="{ active: viewMode === 'list' }"
        class="btn btn-secondary"
      >
        List
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
const props = defineProps({
    viewMode: {
        type: String,
        default: 'grid'
    },
    _query: {
        type: String,
        default: ''
    },
    searching: { type: Boolean, default: false },
    savingQuery: { type: Boolean, default: false },
    savedQueries: { type: Array, default: () => [] },
    queriesLoading: { type: Boolean, default: false },
    options: { type: Object, default: () => ({ order: 'name', dir: 'auto', unique: 'cards' }) }
});

const emit = defineEmits(['search', 'save-query', 'update:viewMode', 'update:options']);
const query = props._query ? ref(props._query) : ref('');
const order = ref(props.options.order || 'name');
const dir = ref(props.options.dir || 'auto');
const unique = ref(props.options.unique || 'cards');
const showSave = ref(false);
const queryName = ref('');
const selectedSavedQuery = ref('');
const emitOptions = () => emit('update:options', { order: order.value, dir: dir.value, unique: unique.value });

watch(() => props._query, (newQuery) => {
    if(newQuery !== query.value) {
        query.value = newQuery;
    }
});

const handleSearch = () => {
  if (props.searching) return;
  emit('search', query.value);
};
const handleSaveQuery = () => {
  const name = queryName.value.trim();
  const value = query.value.trim();
  if (!name || !value || props.savingQuery) return;
  emit('save-query', { name, query: value, done: () => { queryName.value = ''; showSave.value = false; } });
};
const cancelSaveQuery = () => { queryName.value = ''; showSave.value = false; };
const loadSavedQuery = () => {
  if (!selectedSavedQuery.value) return;
  query.value = selectedSavedQuery.value;
  selectedSavedQuery.value = '';
  handleSearch();
};
</script>

<style scoped>
.search-bar {
    position: sticky;
    top: 0;
    z-index: 2;
    padding: 15px 20px;
    margin-bottom: 20px;
    background-color: rgba(221, 221, 221, 0.8);
    justify-content: space-between;
    align-items: start;
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    backdrop-filter: blur(10px);
    border-radius: 0 0 12px 12px;
    box-shadow: 0 6px 15px 2px rgba(221, 221, 221, 0.8);
}

.search-input-group {
  display: flex;
  flex: 1;
  min-width: 300px;
}

.search-input {
  flex: 1;
  padding: 10px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 4px 0 0 4px;
  outline: none;
}

.btn {
  padding: 10px 20px;
  cursor: pointer;
  border: 1px solid #ccc;
  font-size: 14px;
}

.btn-primary {
  background-color: #3182ce;
  color: white;
  border-color: #3182ce;
  border-radius: 0 4px 4px 0;
}

.btn-secondary {
  background-color: #edf2f7;
  border-radius: 4px;
  margin-left: 5px;
}

.btn-secondary.active {
  background-color: #4a5568;
  color: white;
  border-color: #4a5568;
}

.view-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.btn-primary:disabled { opacity: .65; cursor: wait; }
.btn-save-query { border-radius: 4px; margin-left: 6px; background: #fff; color: #2b6cb0; }
.save-query-form { display: flex; gap: 6px; margin-top: 8px; }
.save-query-form input { flex: 1; min-width: 180px; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; }
.view-controls select { padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; }
</style>
