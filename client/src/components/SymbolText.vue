<template>
  <span class="symbol-text">
    <template v-for="(token, index) in tokens" :key="index">
      <img v-if="token.type === 'symbol'" :src="token.src" :alt="token.value" class="mana-symbol" />
      <template v-else>{{ token.value }}</template>
    </template>
  </span>
</template>
<script setup>
import { computed } from 'vue';
import { symbolService } from '../services/symbols';
const props = defineProps({ text: { type: String, default: '' } });
const tokens = computed(() => symbolService.tokenize(props.text));
</script>
<style scoped>.symbol-text{white-space:pre-line}.mana-symbol{flex:0 0 auto;height:.9em;vertical-align:middle;margin:0 1px}</style>
