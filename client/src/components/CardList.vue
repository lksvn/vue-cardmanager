<template>
  <div class="card-list">
    <table class="list-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Set</th>
          <th>Rarity</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="card in cards" 
          :key="card.id" 
          @click="$emit('select', card)"
          class="list-row"
        >
          <td>{{ card.name }}</td>
          <td>{{ card.type_line }}</td>
          <td><img v-if="card.setIcon" :src="card.setIcon" class="set-icon" :alt="card.set_name" /> {{ card.set_name }} ({{ card.set.toUpperCase() }})</td>
          <td :class="['rarity', card.rarity]">{{ card.rarity }}</td>
          <td class="row-actions"><a v-if="isCreatureCard(card)" class="edhrec-link" :href="edhrecCommanderUrl(card)" target="_blank" rel="noreferrer" @click.stop>EDHREC</a><button v-if="resolveMode && card.isRepairTarget" class="quick-add" @click.stop="$emit('quick-add', card)">Use this printing</button><span v-else-if="card.isSaved" class="saved-label" :title="card.savedCollection">Saved<span v-if="card.savedCollection"> · {{ card.savedCollection }}</span></span><button v-else-if="resolveMode" class="quick-add" @click.stop="$emit('quick-add', card)">Use this printing</button><button v-else class="quick-add" @click.stop="$emit('quick-add', card)">Quick add</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { edhrecCommanderUrl, isCreatureCard } from '../utils/edhrec';

const props = defineProps({
  cards: {
    type: Array,
    required: true
  },
  resolveMode: { type: Boolean, default: false }
});

const emit = defineEmits(['select', 'quick-add']);
</script>

<style scoped>
.set-icon {
  width: 16px;
  height: 16px;
  vertical-align: middle;
  margin-left: 6px;
}
.card-list {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.list-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th, td {
  padding: 12px 15px;
  border-bottom: 1px solid #edf2f7;
}

th {
  background-color: #f7fafc;
  font-weight: bold;
  color: #4a5568;
}

.list-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.list-row:hover {
  background-color: #f0f4f8;
}

.rarity {
  text-transform: capitalize;
  font-weight: 500;
}

.common { color: #2d3748; }
.uncommon { color: #476291; font-weight: bold; }
.rare { color: #b7791f; }
.mythic { color: #c53030; }
.quick-add{border:1px solid #3182ce;background:white;color:#3182ce;border-radius:4px;padding:5px 10px;cursor:pointer}
.row-actions{display:flex;align-items:center;gap:8px}
.edhrec-link{border:1px solid #805ad5;color:#6b46c1;border-radius:4px;padding:5px 8px;text-decoration:none;font-size:12px}
.saved-label{display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#276749;font-weight:700}
</style>
