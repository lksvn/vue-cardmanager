<template>
  <div class="collections-view">
    <div class="header-actions">
      <h2>My Collection ({{ filteredCards.length }})</h2>
      <button @click="fetchSavedCards" class="btn btn-secondary">Refresh</button>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-item search">
        <label>Search:</label>
        <input v-model="filters.search" type="text" placeholder="Card name..." class="form-input" />
      </div>
      
      <div class="filter-item">
        <label>Collection:</label>
        <select v-model="filters.collection" class="form-select">
          <option value="">All Collections</option>
          <option v-for="c in tags.collections" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div class="filter-item">
        <label>Group:</label>
        <select v-model="filters.group" class="form-select">
          <option value="">All Groups</option>
          <option v-for="g in tags.groups" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>

      <div class="filter-item">
        <label>Type:</label>
        <select v-model="filters.type" class="form-select">
          <option value="">All Types</option>
          <option v-for="t in tags.types" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <div class="filter-item actions">
        <button @click="resetFilters" class="btn-text">Reset</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading collection...</div>
    
    <div v-else-if="savedCards.length === 0" class="empty-state">
      <p>Your collection is empty. Search for cards and add them to your vault!</p>
    </div>

    <div v-else-if="filteredCards.length === 0" class="empty-state">
      <p>No cards match your filters.</p>
    </div>

    <div v-else class="collection-grid">
      <div v-for="card in filteredCards" :key="card.filename" class="saved-card-item">
        <div class="card-preview">
          <img v-if="card.Cover" :src="getImageUrl(card.Cover)" :alt="card.name" />
          <div v-else class="no-image">No Image</div>
        </div>
        <div class="card-info">
          <h3>{{ card.name }}</h3>
          <p class="meta">{{ card.Collection }}</p>
          <p class="type">{{ card.Type }}</p>
          <div class="tags">
            <span v-for="g in card.Groups" :key="g" class="tag">{{ g }}</span>
          </div>
        </div>
        <div class="card-actions">
          <button @click="editCard(card)" class="btn-edit" title="Edit metadata">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button @click="deleteCard(card)" class="btn-delete" title="Delete from vault">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
    </div>

    <EditCardModal 
      v-if="editingCard" 
      :card="editingCard" 
      :tags="tags"
      @close="editingCard = null"
      @updated="onCardUpdated"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { serverService } from '../services/server';
import EditCardModal from './EditCardModal.vue';

const savedCards = ref([]);
const loading = ref(true);
const tags = ref({ collections: [], groups: [], types: [] });
const editingCard = ref(null);

const filters = reactive({
  search: '',
  collection: '',
  group: '',
  type: ''
});

const filteredCards = computed(() => {
  return savedCards.value.filter(card => {
    const matchesSearch = !filters.search || card.name.toLowerCase().includes(filters.search.toLowerCase());
    const matchesCollection = !filters.collection || card.Collection === filters.collection;
    const matchesType = !filters.type || card.Type === filters.type;
    const matchesGroup = !filters.group || (card.Groups && card.Groups.includes(filters.group));
    
    return matchesSearch && matchesCollection && matchesType && matchesGroup;
  });
});

const resetFilters = () => {
  filters.search = '';
  filters.collection = '';
  filters.group = '';
  filters.type = '';
};

const fetchTags = async () => {
  try {
    tags.value = await serverService.getTags();
  } catch (err) {
    console.error('Failed to fetch tags:', err);
  }
};

const fetchSavedCards = async () => {
  loading.value = true;
  try {
    savedCards.value = await serverService.getSavedCards();
  } catch (error) {
    console.error('Failed to fetch saved cards:', error);
  } finally {
    loading.value = false;
  }
};

const getImageUrl = (cover) => {
  if (!cover) return null;
  const match = cover.match(/\[\[(.*?)\]\]/);
  if (match && match[1]) {
    return `http://localhost:3001/api/images/${encodeURIComponent(match[1])}`;
  }
  return null;
};

const deleteCard = async (card) => {
  if (confirm(`Are you sure you want to delete "${card.name}" from your vault?`)) {
    try {
      await serverService.deleteCard(card.filename);
      await fetchSavedCards();
    } catch (error) {
      alert('Failed to delete card');
    }
  }
};

const editCard = (card) => {
  editingCard.value = card;
};

const onCardUpdated = async () => {
  await fetchSavedCards();
  await fetchTags();
};

onMounted(async () => {
  await fetchTags();
  await fetchSavedCards();
});
</script>

<style scoped>
.collections-view {
  padding: 20px 0;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  align-items: flex-end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 150px;
}

.filter-item.search {
  flex: 2;
  min-width: 250px;
}

.filter-item.actions {
  flex: 0;
  min-width: auto;
}

.filter-item label {
  font-size: 12px;
  font-weight: 600;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-input, .form-select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  width: 100%;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #3182ce;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
}

.btn-text {
  background: none;
  border: none;
  color: #3182ce;
  cursor: pointer;
  font-size: 14px;
  padding: 8px 0;
}

.btn-text:hover {
  text-decoration: underline;
}

.collection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.saved-card-item {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  position: relative;
}

.card-preview {
  height: 200px;
  background: #edf2f7;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.card-info {
  padding: 15px;
  flex-grow: 1;
  text-align: left;
}

.card-info h3 {
  margin: 0 0 5px 0;
  font-size: 16px;
  color: #2d3748;
}

.meta {
  font-size: 12px;
  color: #718096;
  margin-bottom: 5px;
}

.type {
  font-size: 13px;
  color: #4a5568;
  margin-bottom: 10px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tag {
  background: #ebf8ff;
  color: #2b6cb0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.card-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.btn-delete, .btn-edit {
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 4px;
  padding: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.btn-delete {
  color: #e53e3e;
}

.btn-edit {
  color: #3182ce;
}

.btn-delete:hover {
  background: #e53e3e;
  color: white;
}

.btn-edit:hover {
  background: #3182ce;
  color: white;
}

.loading, .empty-state {
  text-align: center;
  padding: 50px;
  color: #718096;
}

.btn-secondary {
  background-color: #edf2f7;
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid #cbd5e0;
  cursor: pointer;
}
</style>
