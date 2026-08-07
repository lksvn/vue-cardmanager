import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const toasts = ref([]);
  const confirmation = ref(null);
  const notify = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    toasts.value.push({ id, message, type });
    setTimeout(() => { toasts.value = toasts.value.filter(item => item.id !== id); }, 4000);
  };
  const confirm = (message) => new Promise(resolve => { confirmation.value = { message, resolve }; });
  const answer = value => { confirmation.value?.resolve(value); confirmation.value = null; };
  return { toasts, confirmation, notify, confirm, answer };
});
