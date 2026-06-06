<template>
  <div class="card-list">
    <table class="list-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Set</th>
          <th>Rarity</th>
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
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
const props = defineProps({
  cards: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['select']);
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
</style>
