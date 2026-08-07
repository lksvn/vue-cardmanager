<template>
  <div class="saga-text">
    <template v-for="(line, index) in lines" :key="index">
      <div v-if="line.chapters.length" class="chapter-row">
        <div class="chapter-icons" :aria-label="`Chapters ${line.chapters.join(', ')}`">
          <span v-for="chapter in line.chapters" :key="chapter" class="chapter-icon">{{ chapter }}</span>
        </div>
        <SymbolText :text="line.text" />
      </div>
      <div v-else class="saga-reminder"><SymbolText :text="line.text" /></div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import SymbolText from './SymbolText.vue';

const props = defineProps({ text: { type: String, default: '' } });
const lines = computed(() => props.text.split('\n').filter(Boolean).map(text => {
  const match = text.match(/^([IVX]+(?:,\s*[IVX]+)*)\s+—\s+(.+)$/);
  return match
    ? { chapters: match[1].split(',').map(chapter => chapter.trim()), text: match[2] }
    : { chapters: [], text };
}));
</script>

<style scoped>
.saga-text { display: grid; gap: 10px; }
.chapter-row { display: grid; grid-template-columns: minmax(58px, auto) 1fr; gap: 10px; align-items: start; }
.chapter-icons { display: flex; flex-wrap: wrap; gap: 4px; }
.chapter-icon { position: relative; isolation: isolate; display: grid; place-items: center; width: 32px; height: 32px; padding: 0 2px; background: #d69e2e; color: #fffaf0; clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%); font-family: Georgia, serif; font-size: 11px; font-weight: 700; }
.chapter-icon::before { content: ""; position: absolute; z-index: -1; inset: 2px; background: #744210; clip-path: inherit; }
.saga-reminder { color: #718096; font-style: italic; }
</style>
