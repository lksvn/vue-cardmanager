<template>
  <SearchBar :view-mode="viewMode" :_query="query" :options="searchOptions" @search="performSearch" @update:view-mode="setViewMode" @update:options="setOptions" />
  <div v-if="loading && !loadingMore" class="loading">Searching Scryfall...</div>
  <div v-else-if="error" class="error-state">{{ error }}<button class="btn-load-more" @click="performSearch(query)">Retry</button></div>
  <div v-else-if="cards.length" class="results">
    <CardGrid v-if="viewMode === 'grid'" :cards="cards" @select="selectedCard = $event" @quick-add="quickAdd" />
    <CardList v-else :cards="cards" @select="selectedCard = $event" @quick-add="quickAdd" />
    <div v-if="hasMore" class="pagination-controls"><button class="btn-load-more" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? 'Loading...' : 'Load More Cards' }}</button></div>
  </div>
  <div v-else-if="searched" class="no-results">No cards found for your search.</div>
  <div v-else class="welcome">Start by searching for a Magic: The Gathering card!</div>
  <CardDetail v-if="selectedCard" :card="selectedCard" :tags="tagsStore.tags" @close="selectedCard = null" @update:search="performSearch" @select-print="selectPrint" @save-success="onSaveSuccess(selectedCard)" />
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
const savedCards = ref(new Map());
const query = computed(() => String(route.query.q || ''));
const viewMode = computed(() => route.query.view === 'list' ? 'list' : 'grid');
const searchOptions = computed(() => ({ order: route.query.order || 'name', dir: route.query.dir || 'auto', unique: route.query.unique || 'cards' }));
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

const setViewMode = view => router.replace({ query: { ...route.query, view } });
const setOptions = options => router.replace({ query: { ...route.query, ...options } });
const selectPrint = print => { selectedCard.value = normalize([print])[0]; };
const performSearch = async value => {
  const nextQuery = String(value || '').trim(); if (!nextQuery) return;
  if (nextQuery !== query.value) { await router.push({ query: { ...route.query, q: nextQuery } }); return; }
  controller?.abort(); controller = new AbortController();
  loading.value = true; searched.value = true; error.value = ''; hasMore.value = false;
  try {
    const response = await scryfallService.searchCards(nextQuery, { signal: controller.signal, params: searchOptions.value });
    cards.value = normalize(response.data); hasMore.value = response.has_more; nextPageUrl.value = response.next_page;
  } catch (requestError) { if (requestError.code !== 'ERR_CANCELED') { cards.value = []; error.value = requestError.message || 'Search failed.'; } }
  finally { loading.value = false; }
};
const quickAdd = async card => {
  if (card.isSaved) return;
  try { await serverService.saveCard(card, []); ui.notify(`${card.name} added to the collection.`); await Promise.all([tagsStore.load(true), loadSavedCards()]); }
  catch (requestError) { ui.notify(requestError.response?.data?.error?.message || 'Could not add card.', 'error'); }
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
watch(query, value => { if (value) performSearch(value); else { cards.value = []; searched.value = false; } });
watch(searchOptions, () => { if (query.value) performSearch(query.value); });
onMounted(async () => { await Promise.all([tagsStore.load(), symbolService.loadSymbols(), loadSavedCards()]); if (query.value) performSearch(query.value); });
onBeforeUnmount(() => controller?.abort());
</script>

<style scoped>.results{padding:0 20px}</style>
