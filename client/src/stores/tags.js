import { defineStore } from 'pinia';
import { ref } from 'vue';
import { serverService } from '../services/server';

export const useTagsStore = defineStore('tags', () => {
  const tags = ref({ collections: [], groups: [], types: [] });
  const loaded = ref(false);
  const loading = ref(false);

  const load = async (force = false) => {
    if (loading.value || (loaded.value && !force)) return;
    loading.value = true;
    try { tags.value = await serverService.getTags(); loaded.value = true; }
    finally { loading.value = false; }
  };
  return { tags, loaded, loading, load };
});
