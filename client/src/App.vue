<template>
  <div id="app">
    <header class="app-header">
      <div class="container">
        <h1 @click="currentView = 'search'; _query = ''; cards = []">MTG Card Manager</h1>
        <nav>
          <button 
            @click="currentView = 'search';" 
            :class="['nav-link', { active: currentView === 'search' }]"
          >
            Search
          </button>
          <button 
            @click="currentView = 'collections'" 
            :class="['nav-link', { active: currentView === 'collections' }]"
          >
            Collections
          </button>
          <button 
            @click="currentView = 'settings'" 
            :class="['nav-link', { active: currentView === 'settings' }]"
          >
            Settings
          </button>
        </nav>
      </div>
    </header>

    <main class="container">
        <div v-if="currentView === 'search'">
            <SearchBar 
                :viewMode="viewMode" 
                :_query="_query"
                @search="performSearch" 
                @update:viewMode="viewMode = $event"
            />
            <div v-if="loading && !loadingMore" class="loading">
                Searching Scryfall...
            </div>

            <div v-else-if="cards.length > 0" style="padding: 0  20px">
                <CardGrid 
                    v-if="viewMode === 'grid'" 
                    :cards="cards" 
                    @select="selectCard" 
                />
                <CardList 
                    v-else 
                    :cards="cards" 
                    @select="selectCard" 
                />

                <div v-if="hasMore" class="pagination-controls">
                    <button 
                        @click="loadMore" 
                        :disabled="loadingMore" 
                        class="btn-load-more"
                    >
                        {{ loadingMore ? 'Loading more...' : 'Load More Cards' }}
                    </button>
                </div>
            </div>

            <div v-else-if="hasSearched" class="no-results">
                No cards found for your search.
            </div>

            <div v-else class="welcome">
                <p>Start by searching for a Magic: The Gathering card!</p>
            </div>
      </div>

      <div v-else-if="currentView === 'settings'">
        <Settings @refresh-tags="fetchTags" />
      </div>

      <div v-else-if="currentView === 'collections'">
        <CollectionView />
      </div>

      <div v-else class="welcome">
        <p>This view is under construction.</p>
      </div>
    </main>

    <CardDetail 
        v-if="selectedCard" 
        :card="selectedCard" 
        :tags="tags"
        @close="selectedCard = null" 
        @update:search="_query = $event"
        @save-success="fetchTags"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { scryfallService } from './services/scryfall';
import { serverService } from './services/server';
import { symbolService } from './services/symbols';
import SearchBar from './components/SearchBar.vue';
import CardGrid from './components/CardGrid.vue';
import CardList from './components/CardList.vue';
import CardDetail from './components/CardDetail.vue';
import Settings from './components/Settings.vue';
import CollectionView from './components/CollectionView.vue';

const currentView = ref('search');
const cards = ref([]);
const viewMode = ref('grid');
const loading = ref(false);
const loadingMore = ref(false);
const hasSearched = ref(false);
const selectedCard = ref(null);
const hasMore = ref(false);
const nextPageUrl = ref(null);
const tags = ref({ collections: [], groups: [], types: [] });
const _query = ref('');

const fetchTags = async () => {
  try {
    const data = await serverService.getTags();
    tags.value = data;
  } catch (error) {
    console.error('Failed to fetch tags:', error);
  }
};

onMounted(async () => {
  await fetchTags();
  await symbolService.loadSymbols();
});

const performSearch = async (query) => {
    if (!query) return;

    if(query !== _query.value) {
        _query.value = query;
    }

    hasSearched.value = true;
    loading.value = true;
    hasMore.value = false;
    nextPageUrl.value = null;
  
    try {
        const response = await scryfallService.searchCards(query);
        cards.value = response.data;
        for(const card of cards.value) {
            card.setIcon = `http://localhost:3001/api/sets/${card.set}/icon`;
        }
        hasMore.value = response.has_more;
        nextPageUrl.value = response.next_page;
    } catch (error) {
        console.error('Search failed:', error);
        hasSearched.value = false;
        cards.value = [];
    } finally {
        loading.value = false;
    }
};

const loadMore = async () => {
    if (!nextPageUrl.value || loadingMore.value) return;

    loadingMore.value = true;
    try {
        const response = await scryfallService.fetchNextPage(nextPageUrl.value);
        cards.value = [...cards.value, ...response.data];
        hasMore.value = response.has_more;
        nextPageUrl.value = response.next_page;
    } catch (error) {
        console.error('Loading more failed:', error);
    } finally {
        loadingMore.value = false;
    }
};

const selectCard = (card) => {
  selectedCard.value = card;
};
</script>

<style>
:root {
  --primary: #3182ce;
  --bg: #dddddd;
  --text: #2d3748;
}

body {
  margin: 0;
  padding-bottom: 20px;
  background-color: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 20px;
}

.app-header {
  background-color: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 10px 0;
  margin-bottom: 30px;
}

.app-header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1 {
  margin: 0;
  font-size: 24px;
  color: var(--primary);
}

.nav-link {
  background: none;
  border: none;
  font-size: 16px;
  margin-left: 20px;
  cursor: pointer;
  color: #718096;
  padding-bottom: 5px;
}

.nav-link.active {
  color: var(--primary);
  border-bottom: 2px solid var(--primary);
}

.loading, .no-results, .welcome {
  text-align: center;
  padding: 50px;
  font-size: 18px;
  color: #718096;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  margin: 40px 0;
}

.btn-load-more {
  background-color: white;
  border: 1px solid var(--primary);
  color: var(--primary);
  padding: 12px 30px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-load-more:hover:not(:disabled) {
  background-color: var(--primary);
  color: white;
}

.btn-load-more:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
