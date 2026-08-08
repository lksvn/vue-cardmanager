<template>
	<div class="card-grid">
		<div 
			v-for="card in cards" 
			:key="card.id" 
			class="card-item"
			@click="$emit('select', card)"
			:title="card.name + (card.set_name ? ' - ' + card.set_name : '')"
		>
			<div v-if="card.isSaved" class="saved-badge" :title="card.savedCollection">Saved<span v-if="card.savedCollection"> · {{ card.savedCollection }}</span></div>
			<div class="img-wrapper">
				<img 
					:src="getCardImage(card)" 
					:alt="card.name" 
					class="card-image"
					loading="lazy"
				/>
			</div>
			<div class="card-info">
				<p class="card-name">{{ card.name }} <span>({{ card.set }})</span></p>
				<div class="card-actions">
					<a v-if="isCreatureCard(card)" class="edhrec-link" :href="edhrecCommanderUrl(card)" target="_blank" rel="noreferrer" @click.stop>EDHREC</a>
					<button class="quick-add" :disabled="card.isSaved" @click.stop="$emit('quick-add', card)">{{ card.isSaved ? 'Already saved' : 'Quick add' }}</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { edhrecCommanderUrl, isCreatureCard } from '../utils/edhrec';

const props = defineProps({
	cards: {
		type: Array,
		required: true
	}
});

const emit = defineEmits(['select', 'quick-add']);
const getCardImage = (card) => {
	if (card.image_uris && card.image_uris.large) {
		return card.image_uris.large;
	}
	if (card.card_faces && card.card_faces[0].image_uris) {
		return card.card_faces[0].image_uris.large;
	}
	return 'placeholder.jpg'; // Fallback image
};
</script>

<style scoped>
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.card-item {
  position: relative;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.25s;
  border-radius: 12px;
  overflow: hidden;
  background-color: #f7fafc;
  border: 1px solid #e2e8f0;
  box-shadow: inset 0 0 0 1px #e2e8f0;
  will-change: transform, box-shadow;
}

.card-item:hover {
  transform: translateY(-5px);
  box-shadow: inset 0 0 0 1px #1564a0
}

.img-wrapper {
	width: calc(100% - 2px);
	aspect-ratio: 63 / 88;
	overflow: hidden;
	border-radius: 10px;
	margin: 1px;
	background: #e2e8f0 url('/api/images/placeholder.jpg') center / cover no-repeat;
}
.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-info {
  padding: 10px;
  text-align: center;
}

.card-name {
  margin: 0;
  font-weight: bold;
  font-size: 14px;
  height: 38px;
  overflow: hidden;
}
.card-name span {text-transform: uppercase;}
.card-actions{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:8px}
.edhrec-link{border:1px solid #805ad5;color:#6b46c1;border-radius:4px;padding:5px 10px;text-decoration:none;font-size:13px}
.quick-add{border:1px solid #3182ce;background:white;color:#3182ce;border-radius:4px;padding:5px 10px;cursor:pointer}
.quick-add:disabled{border-color:#38a169;color:#276749;cursor:default}.saved-badge{position:absolute;z-index:1;top:9px;left:9px;max-width:calc(100% - 34px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#276749;color:white;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:700;box-shadow:0 2px 6px #0005}
</style>
