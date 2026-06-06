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
            <button @click="handleSearch" class="btn btn-primary">Search</button>
        </div>
    </div>
    
    <div class="view-controls">
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
    }
});

const emit = defineEmits(['search', 'update:viewMode']);
const query = props._query ? ref(props._query) : ref('');

watch(() => props._query, (newQuery) => {
    if(newQuery !== query.value) {
        query.value = newQuery;
        handleSearch();
    }
});

const handleSearch = () => {
  emit('search', query.value);
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
}
</style>
