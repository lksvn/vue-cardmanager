<template>
  <SearchBar :view-mode="viewMode" :_query="query" :options="searchOptions" :searching="loading" :saving-query="savingQuery" :saved-queries="savedQueries" :queries-loading="queriesLoading" @search="performSearch" @save-query="saveCurrentQuery" @delete-query="deleteSavedQuery" @update:view-mode="setViewMode" @update:options="setOptions" />
  <div v-if="loading && !loadingMore" class="loading" role="status">Searching Scryfall for “{{ query }}”...</div>
  <div v-else-if="error" class="error-state">{{ error }}<button class="btn-load-more" @click="performSearch(query)">Retry</button></div>
  <div v-else-if="cards.length" class="results">
    <div class="search-feedback" role="status">
      <strong>{{ resultSummary }}</strong>
      <span>for “{{ query }}”</span>
      <span v-if="hasMore" class="more-results">More results are available.</span>
    </div>
    <CardGrid v-if="viewMode === 'grid'" :cards="cards" @select="selectedCard = $event" @quick-add="quickAdd" />
    <CardList v-else :cards="cards" @select="selectedCard = $event" @quick-add="quickAdd" />
    <div v-if="hasMore" class="pagination-controls"><button class="btn-load-more" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? 'Loading more results...' : 'Load More Cards' }}</button></div>
  </div>
  <div v-else-if="searched" class="no-results">No cards found for “{{ query }}”.</div>
  <div v-else class="welcome">Start by searching for a Magic: The Gathering card!</div>
  <CardDetail v-if="selectedCard" :card="selectedCard" :tags="tagsStore.tags" :saved-printings="savedPrintingList" @close="selectedCard = null" @update:search="performSearch" @select-print="selectPrint" @save-success="onSaveSuccess(selectedCard)" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CardDetail from '../components/CardDetail.vue';
import CardGrid from '../components/CardGrid.vue';
import CardList from '../components/CardList.vue';
import SearchBar from '../components/SearchBar.vue';
import { apiAssetUrl } from '../services/server';
import { serverService } from '../services/server';
import { scryfallService } from '../services/scryfall';
import { symbolService } from '../services/symbols';
import { useTagsStore } from '../stores/tags';
import { useUiStore } from '../stores/ui';

const route = useRoute(); const router = useRouter(); const tagsStore = useTagsStore(); const ui = useUiStore();
const cards = ref([]); const loading = ref(false); const loadingMore = ref(false); const searched = ref(false);
const selectedCard = ref(null); const hasMore = ref(false); const nextPageUrl = ref(null); const error = ref('');
const totalResults = ref(0);
const savedCards = ref(new Map());
const savedPrintingList = computed(() => [...new Set(savedCards.value.values())]);
const savingQuery = ref(false);
const savedQueries = ref([]);
const queriesLoading = ref(false);
const query = computed(() => String(route.query.q || ''));
const viewMode = computed(() => route.query.view === 'list' ? 'list' : 'grid');
const searchOptions = computed(() => ({ order: route.query.order || 'name', dir: route.query.dir || 'auto', unique: route.query.unique || 'cards' }));
const resultSummary = computed(() => totalResults.value > cards.value.length
  ? `Showing ${cards.value.length} of ${totalResults.value} cards`
  : `${cards.value.length} ${cards.value.length === 1 ? 'card' : 'cards'} found`);
let controller = null;
const printKey = card => `${String(card.set || card.SetCode || '').toLowerCase()}:${String(card.collector_number || card.CollectorNumber || card.Number || '').toLowerCase()}`;
const findSaved = card => savedCards.value.get(`id:${card.id}`) || savedCards.value.get(`print:${printKey(card)}`);
const normalize = items => items.map(card => {
  const saved = findSaved(card);
  return {
    ...card,
    setIcon: apiAssetUrl(`/api/sets/${encodeURIComponent(card.set)}/icon`),
    isSaved: Boolean(saved),
    savedCollection: saved?.Collection || '',
    savedGroups: saved?.Groups || saved?.Group || [],
    savedType: saved?.Type || ''
  };
});
const loadSavedCards = async () => {
  const saved = await serverService.getSavedCards();
  const index = new Map();
  for (const card of saved) {
    if (card.ScryfallId) index.set(`id:${card.ScryfallId}`, card);
    index.set(`print:${printKey(card)}`, card);
  }
  savedCards.value = index;
  cards.value = normalize(cards.value);
};
const loadQueries = async () => {
  queriesLoading.value = true;
  try {
    savedQueries.value = (await serverService.getQueries()).queries;
  } catch (requestError) {
    const code = requestError.response?.data?.error?.code;
    if (code !== 'QUERIES_PATH_NOT_CONFIGURED') ui.notify(requestError.response?.data?.error?.message || 'Could not load saved queries.', 'error');
    savedQueries.value = [];
  } finally {
    queriesLoading.value = false;
  }
};

const setViewMode = view => router.replace({ query: { ...route.query, view } });
const setOptions = options => router.replace({ query: { ...route.query, ...options } });
const selectPrint = print => { selectedCard.value = normalize([print])[0]; };
const performSearch = async value => {
  const nextQuery = String(value || '').trim(); if (!nextQuery) return;
  controller?.abort();
  loading.value = true;
  searched.value = true;
  error.value = '';
  cards.value = [];
  selectedCard.value = null;
  hasMore.value = false;
  nextPageUrl.value = null;
  totalResults.value = 0;
  if (nextQuery !== query.value) {
    await router.push({ query: { ...route.query, q: nextQuery } });
    return;
  }
  const requestController = new AbortController();
  controller = requestController;
  try {
    const response = await scryfallService.searchCards(nextQuery, { signal: requestController.signal, params: searchOptions.value });
    cards.value = normalize(response.data); hasMore.value = response.has_more; nextPageUrl.value = response.next_page;
    totalResults.value = response.total_cards ?? cards.value.length;
  } catch (requestError) { if (requestError.code !== 'ERR_CANCELED') { cards.value = []; totalResults.value = 0; error.value = requestError.message || 'Search failed.'; } }
  finally { if (controller === requestController) loading.value = false; }
};
const quickAdd = async card => {
  if (card.isSaved) return;
  try { await serverService.saveCard(card, []); ui.notify(`${card.name} added to the collection.`); await Promise.all([tagsStore.load(true), loadSavedCards()]); }
  catch (requestError) { ui.notify(requestError.response?.data?.error?.message || 'Could not add card.', 'error'); }
};
const saveCurrentQuery = async ({ name, query: savedQuery, done }) => {
  savingQuery.value = true;
  try {
    await serverService.saveQuery(name, savedQuery);
    await loadQueries();
    ui.notify(`Query "${name}" saved.`);
    done();
  } catch (requestError) {
    if (requestError.response?.data?.error?.code === 'QUERY_EXISTS' && await ui.confirm(`Replace the saved query "${name}"?`)) {
      try {
        await serverService.saveQuery(name, savedQuery, true);
        await loadQueries();
        ui.notify(`Query "${name}" replaced.`);
        done();
      } catch (replaceError) {
        ui.notify(replaceError.response?.data?.error?.message || 'Could not replace query.', 'error');
      }
    } else if (requestError.response?.data?.error?.code !== 'QUERY_EXISTS') {
      ui.notify(requestError.response?.data?.error?.message || 'Could not save query.', 'error');
    }
  } finally {
    savingQuery.value = false;
  }
};
const deleteSavedQuery = async name => {
  if (!await ui.confirm(`Delete the saved query "${name}"?`)) return;
  queriesLoading.value = true;
  try {
    await serverService.deleteQuery(name);
    await loadQueries();
    ui.notify(`Query "${name}" deleted.`);
  } catch (requestError) {
    ui.notify(requestError.response?.data?.error?.message || 'Could not delete query.', 'error');
  } finally {
    queriesLoading.value = false;
  }
};
const onSaveSuccess = async card => {
  await Promise.all([tagsStore.load(true), loadSavedCards()]);
  const saved = findSaved(card);
  card.isSaved = Boolean(saved);
  card.savedCollection = saved?.Collection || '';
  card.savedGroups = saved?.Groups || saved?.Group || [];
  card.savedType = saved?.Type || '';
};
const loadMore = async () => {
  if (!nextPageUrl.value || loadingMore.value) return; loadingMore.value = true; error.value = '';
  try { const response = await scryfallService.fetchNextPage(nextPageUrl.value); cards.value.push(...normalize(response.data)); hasMore.value = response.has_more; nextPageUrl.value = response.next_page; }
  catch (requestError) { error.value = requestError.message || 'Could not load more cards.'; }
  finally { loadingMore.value = false; }
};
watch(query, value => { if (value) performSearch(value); else { cards.value = []; totalResults.value = 0; searched.value = false; } });
watch(searchOptions, () => { if (query.value) performSearch(query.value); });
onMounted(async () => { await Promise.all([tagsStore.load(), symbolService.loadSymbols(), loadSavedCards(), loadQueries()]); if (query.value) performSearch(query.value); });
onBeforeUnmount(() => controller?.abort());
</script>

<style scoped>
.results{padding:0 20px}
.search-feedback{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin:0 0 14px;padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;color:#4a5568}
.search-feedback strong{color:#2d3748}.more-results{margin-left:auto;color:#2b6cb0;font-size:14px}
</style>
