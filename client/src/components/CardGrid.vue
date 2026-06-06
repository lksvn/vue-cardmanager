<template>
	<div class="card-grid">
		<div 
			v-for="card in cards" 
			:key="card.id" 
			class="card-item"
			@click="$emit('select', card)"
			:title="card.name + (card.set_name ? ' - ' + card.set_name : '')"
		>
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
			</div>
		</div>
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
	overflow: hidden;
	border-radius: 10px;
	margin: 1px;
}
.card-image {
  width: 100%;
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
</style>
