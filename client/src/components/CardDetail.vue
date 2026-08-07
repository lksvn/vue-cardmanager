<template>
<div class="modal-overlay" @click.self="$emit('close')">
    <div class="card-modal">
        <button class="close-btn" @click="$emit('close')">&times;</button>
        <div class="card-body">
            <div class="detail-image" :class="flipCard ? flipStyle : ''">
                <div class="detail-image-front">
                    <img :src="getCardImage(card)" :alt="hasBackImage ? card.card_faces[0].name : card.name"/>
                </div>
                <div class="detail-image-back" v-if="isFlippable && hasBackImage">
                    <img :src="getCardImage(card, true)" :alt="card.card_faces[1].name"/>
                </div>

                
            </div>
            <div class="detail-actions">
                <button v-if="isFlippable" @click="flipCard = !flipCard" class="btn btn-add">
                    {{ flipButtonText }}
                </button>
            </div>
                
            <div class="detail-text">
                <div class="detail-wrapper">
                    <template v-if="['normal', 'planar', 'saga'].includes(card.layout)">
                        <h2>
                            <span>{{ card.name }} <SymbolText class="mana-cost" :text="card.mana_cost" /></span>
                            <small>{{ card.flavor_name }}</small>
                        </h2>
                        <p class="type-line">{{ card.type_line }}</p>
                        
                        <div class="oracle-text"><SagaText v-if="isSaga(card)" :text="card.oracle_text" /><SymbolText v-else :text="card.oracle_text" /></div>
                    </template>
                
                    <template v-else-if="isAdventure">
                        <div class="adventure-faces">
                            <section v-for="(face, index) in card.card_faces" :key="face.name" :class="['adventure-face', { spell: index === 1 }]">
                                <span class="face-label">{{ index === 0 ? 'Permanent' : 'Adventure' }}</span>
                                <h3>{{ face.name }} <SymbolText class="mana-cost" :text="face.mana_cost" /></h3>
                                <p class="type-line">{{ face.type_line }}</p>
                                <div class="oracle-text" v-if="face.oracle_text"><SymbolText :text="face.oracle_text" /></div>
                                <p v-if="face.flavor_text" class="flavor-text">{{ face.flavor_text }}</p>
                            </section>
                        </div>
                    </template>

                    <template v-else-if="isFlippable">
                        <div v-for="face in card.card_faces" style="margin-bottom: 20px;">
                            <h3>{{ face.name }} <SymbolText class="mana-cost" :text="face.mana_cost" /></h3>
                            <p class="type-line">{{ face.type_line }}</p>
                            <div class="oracle-text" v-if="face.oracle_text"><SagaText v-if="isSaga(face)" :text="face.oracle_text" /><SymbolText v-else :text="face.oracle_text" /></div>
                        </div>
                    </template>

                    <div v-if="card.flavor_text" class="flavor-text italic">
                        {{ card.flavor_text }}
                    </div>
                </div>
                <div class="save-controls">
                    <div class="form-item">
                        <label>Collection:</label>
                        <input v-model="selectedCollection" list="collections-list" class="form-input" />
                        <datalist id="collections-list">
                            <option v-for="c in tags.collections" :key="c" :value="c" />
                        </datalist>
                    </div>
    
                    <div class="form-item">
                        <label>Type:</label>
                        <select v-model="selectedType" class="form-input">
                            <option v-for="t in tags.types" :key="t" :value="t">{{ t }}</option>
                        </select>
                    </div>
    
                    <div class="form-item">
                        <label>Grouping Tags:</label>
                        <div class="groups-list">
                            <div v-for="g in tags.groups" :key="g" class="group-checkbox">
                                <input 
                                    type="checkbox" 
                                    :id="'group-' + g" 
                                    :value="g" 
                                    v-model="selectedGroups" 
                                />
                                <label :for="'group-' + g">{{ g }}</label>
                            </div>
                        </div>
                        <div class="add-group-inline">
                            <input 
                                v-model="newGroupName" 
                                type="text" 
                                placeholder="Add new group..."
                                @keyup.enter="addNewGroup"
                                class="form-input"
                            />
                            <button @click="addNewGroup" class="btn-small">Add</button>
                        </div>
                    </div>
                    <button 
                        @click="saveToVault" 
                        :disabled="saving" 
                        class="btn btn-add"
                    >
                        {{ saving ? 'Saving...' : card.isSaved ? 'Update Saved Card' : 'Add to Obsidian Vault' }}
                    </button>
                    <p v-if="statusMsg" :class="['status-msg', statusType]">{{ statusMsg }}</p>
                </div>
            </div>
            <div class="detail-prints">
                <div class="card-meta" @click="showAllFromSet(card.set)" style="cursor: pointer;">
                    <div><img v-if="setIcon" :src="setIcon" class="set-icon" alt="Set Icon" /></div>
                    <div>
                        <strong>{{ card.set_name }} ({{ card.set.toUpperCase() }})</strong>
                        <small>#{{ card.collector_number }} &bull; {{ formattedFinishes }}</small>
                    </div>
                </div>
                <div class="prints-heading"><h3>Other Prints</h3><span v-if="prints.total">{{ prints.total }}</span></div>
                <div v-if="printsLoading" class="prints-state">Loading printings...</div>
                <div v-else-if="prints.items?.length" class="prints-grid">
                    <button v-for="print in prints.items" :key="print.id" class="print-card" @click="searchPrint(print)">
                        <img :src="getPrintImage(print)" :alt="print.name" loading="lazy" />
                        <span class="print-info">
                            <strong>{{ print.set_name }}</strong>
                            <span class="print-set"><img :src="getPrintSetIcon(print)" alt="" />{{ print.set.toUpperCase() }} #{{ print.collector_number }}</span>
                            <small>{{ formatReleaseDate(print.released_at) }} · {{ print.rarity }}</small>
                            <small>{{ formatPrintFinishes(print.finishes) }}</small>
                        </span>
                    </button>
                </div>
                <div v-else class="prints-state">No other paper printings found.</div>
                <button v-if="prints.total > prints.items?.length" @click="showAllPrints(card.oracle_id, card.name)" class="view-all-prints">View all {{ prints.total }} prints</button>
            </div>
        </div>
    </div>
</div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { apiAssetUrl, apiErrorMessage, serverService } from '../services/server';
import { scryfallService } from '../services/scryfall';
import SymbolText from './SymbolText.vue';
import SagaText from './SagaText.vue';

const emit = defineEmits(['close', 'save-success', 'update:search', 'select-print']);
const props = defineProps({
    card: {
        type: Object,
        required: true
    },
    tags: {
        type: Object,
        default: () => ({ collections: [], groups: [], types: [] })
    }
});

const selectedGroups = ref([]);
const selectedCollection = ref('');
const selectedType = ref('');
const newGroupName = ref('');
const saving = ref(false);
const statusMsg = ref('');
const statusType = ref('');
const typeMapping = ref({});
const isAdventure = computed(() => props.card.layout === 'adventure' && props.card.card_faces?.length >= 2);
const isSaga = cardOrFace => /(^|\s|—)Saga($|\s|—)/i.test(cardOrFace?.type_line || '');

const normalizeType = (typeLine) => {
    if (!typeLine) return typeLine;
    const mapping = new Map(Object.entries(typeMapping.value).map(([source, target]) => [source.toLowerCase(), target]));
    const mappedType = mapping.get(typeLine.toLowerCase()) || typeLine
        .split(/(\s+|—|\/\/)/)
        .map(part => mapping.get(part.trim().toLowerCase()) || part)
        .join('');
    const exactTag = props.tags.types?.find(tag => tag.toLowerCase() === mappedType.toLowerCase());
    if (exactTag) return exactTag;
    if (!props.tags.types?.length) return mappedType;
    const parts = mappedType.split(/[—/\s]+/);
    const result = parts
        .map(part => {
            return props.tags.types.find(t => t.toLowerCase() === part.toLowerCase());
        })
        .filter(Boolean);

    return [...new Set(result)].join(' ') || mappedType;
};

onMounted(async () => {
    try {
        typeMapping.value = (await serverService.getConfig()).typeMapping || {};
        if (!props.card.savedType) selectedType.value = normalizeType(props.card.Type || props.card.type_line);
    } catch (error) {
        console.error('Failed to load type mappings:', error);
    }
});

const flipCard = ref(false);
const isFlippable = ref(false);
const hasBackImage = ref(false);
const flipStyle = ref('');
const flipButtonText = ref('');

const flippable = async () => {
    let type = props.card.layout;
    let set = props.card.set.toUpperCase();
    let transformLayouts = ['modal_dfc', 'transform', 'double_faced_token', 'reversible_card'];
    let splitLayouts = ['split', 'battle', 'planar'];

    // note to future self
    // dont't even ask why, just know some split cards need to be flipped differently or not at all based on the set they were printed in
    // scryfall doesn't provide any info on this so I have to hardcode it based on testing a bunch of cards from different sets, if you know of a better way to do this please tell me
    let sets = ['HOU','AKH','NCC']; 
    let sets_noflip = ['UNK','MB2','CMB2'];
    
    switch (true) {
        case sets.includes(set) && type === 'split': 
            flipStyle.value = 'ccw-90';
            isFlippable.value = true;
            flipButtonText.value = '↕️ Rotate';
            hasBackImage.value = false;
            return;
    
        case sets_noflip.includes(set) && type === 'split':
            flipStyle.value = '';
            isFlippable.value = false;
            flipButtonText.value = '↕️ Rotate';
            hasBackImage.value = false;
            return;
        
        case type === 'flip':
            flipStyle.value = 'cw-180';
            isFlippable.value = true;
            flipButtonText.value = '↕️ Flip';
            hasBackImage.value = false;
            return;

        case splitLayouts.includes(type):
            flipStyle.value = 'cw-90';
            isFlippable.value = true;
            flipButtonText.value = '🔄 Rotate';
            hasBackImage.value = false;
            return;

        case transformLayouts.includes(type):
            flipStyle.value = 'flip-backside';
            isFlippable.value = true;
            flipButtonText.value = '🔄 Turn Over';
            hasBackImage.value = true;
            return;

        default:
            flipStyle.value = '';
            isFlippable.value = false;
            flipButtonText.value = '';
            hasBackImage.value = false;
            return;
    }
};

const formattedFinishes = computed(() => {
    if (!props.card.finishes || props.card.finishes.length === 0) return 'No special finishes';
    return props.card.finishes.map(f => f.toUpperCase()).join(', ');
});

const setIcon = ref('');
const fetchSetIcon = async () => {
    if (props.card && props.card.set) {
        setIcon.value = apiAssetUrl(`/api/sets/${encodeURIComponent(props.card.set)}/icon`);
    }
};

const prints = ref({});
const printsLoading = ref(false);
const fetchPrints = async () => {
    printsLoading.value = true;
    try {
        const response = await scryfallService.getCardPrints(props.card.oracle_id, props.card.name);
        const otherPrints = response.data.filter(print => print.id !== props.card.id);
        prints.value = { total: otherPrints.length, items: otherPrints.slice(0, 8) };
    } catch (error) {
        console.error('Failed to fetch prints:', error);
        prints.value = { total: 0, items: [] };
    } finally {
        printsLoading.value = false;
    }
};
const getPrintImage = print => print.image_uris?.small || print.image_uris?.normal || print.card_faces?.[0]?.image_uris?.small || 'placeholder.jpg';
const getPrintSetIcon = print => apiAssetUrl(`/api/sets/${encodeURIComponent(print.set)}/icon`);
const formatReleaseDate = value => value ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`)) : 'Unknown date';
const formatPrintFinishes = finishes => finishes?.length ? finishes.map(finish => finish.toUpperCase()).join(' · ') : 'NONFOIL';
const searchPrint = (print) => {
    emit('select-print', print);
};
const showAllPrints = (oracle_id, name) => {
    emit('update:search', '!"' + name + '" oracleid:' + oracle_id + ' unique:prints order:release');
    emit('close');
};
const showAllFromSet = (set) => {
    emit('update:search', 'set:"' + set + '" unique:prints order:set');
    emit('close');
};

const getCardImage = (card, isBack = false) => {
    if (card.image_uris && card.image_uris.large) {
        return card.image_uris.large;
    }
    if (card.card_faces && card.card_faces[isBack ? 1 : 0].image_uris) {
        return card.card_faces[isBack ? 1 : 0].image_uris.large;
    }
    return 'placeholder.jpg'; // Fallback image
};

const addNewGroup = () => {
    if (newGroupName.value && !selectedGroups.value.includes(newGroupName.value)) {
        selectedGroups.value.push(newGroupName.value);
        props.tags.groups.push(newGroupName.value);
        newGroupName.value = '';
    }
};

const saveToVault = async () => {
    saving.value = true;
    statusMsg.value = '';
    
    try {
        const result = await serverService.saveCard(
            props.card, 
            selectedGroups.value,
            selectedCollection.value,
            selectedType.value
        );
        statusMsg.value = result.message;
        statusType.value = 'success';
        emit('save-success');
    } catch (error) {
        console.error('Save failed:', error);
        statusMsg.value = apiErrorMessage(error, 'Failed to save card.');
        statusType.value = 'error';
    } finally {
        saving.value = false;
    }
};

watch(() => props.tags.groups, (newGroups) => {
    selectedGroups.value = selectedGroups.value.filter(g => newGroups.includes(g));
}, { deep: true });

watch(() => props.tags.collections, (newCollections) => {
    if (selectedCollection.value && !newCollections.includes(selectedCollection.value)) {
        selectedCollection.value = '';
    }
});

watch(() => props.tags.types, (newTypes) => {
    if (selectedType.value && !newTypes.includes(selectedType.value)) {
        selectedType.value = '';
    }
});

watch(() => props.card, (newCard) => {
    flipCard.value = false;
    fetchSetIcon();
    flippable();
    fetchPrints();
    
    // Initialize selected groups from card data if available
    const existingGroups = newCard?.savedGroups || newCard?.Groups || newCard?.Group || [];
    if (Array.isArray(existingGroups)) {
        selectedGroups.value = [...existingGroups];
    } else {
        selectedGroups.value = existingGroups ? [existingGroups] : [];
    }

    // Initialize collection and type
    selectedCollection.value = newCard.savedCollection || newCard.Collection || `${newCard.set_name} (${newCard.set.toUpperCase()})`;
    selectedType.value = newCard.savedType || normalizeType(newCard.Type || newCard.type_line);
}, { immediate: true });
</script>

<style scoped>
.ccw-90 { transform-origin: center; transform: rotate(-90deg) translateY(60px); }
.cw-90 { transform-origin: center; transform: rotate(90deg) translateY(-60px); }
.ccw-180 { transform-origin: center; transform: rotate(-180deg); }
.cw-180 { transform-origin: center; transform: rotate(180deg); }
.transform-180 { transform-origin: center; transform: rotateY(-180deg); }

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    overflow: hidden;
    overscroll-behavior: contain;
}

.card-modal {
    background-color: #F5F6F7;
    border-radius: 12px;
    width: calc(100% - 50px);
    max-width: 1280px;
    max-height: 90dvh;
    overflow-y: auto;
    position: relative;
    overscroll-behavior: contain;
}

.card-body {
    margin: 25px;
    display: flex;
    flex-flow: column nowrap;
}

.close-btn {
    position: absolute;
    top: 10px;
    right: 0;
    font-size: 36px;
    padding: 0 15px;
    border: none;
    background: none;
    cursor: pointer;
    color: #4a5568;
}


.detail-image {
    position: relative;
    transition: transform 200ms;
    transform-style: preserve-3d;
    width: 336px;
    height: 468px;
    margin: 0 auto;
}
.detail-image.flip-backside {
    transition: transform 750ms;
    transform: rotateY(-180deg);
}
.detail-image-front, .detail-image-back {
    backface-visibility: hidden;
    position: absolute;
    top: 0;
    left: 0;
    height: 468px;
    border-radius: 4.75% / 3.5%;
    box-shadow: 1px 1px 8px rgba(0,0,0,0.5);
    overflow: hidden;
}
.detail-image-front { 
    transform: rotateY(0); 
}
.detail-image-back { 
    transform: rotateY(180deg); 
}
.detail-image img {
    width: 100%;
    
    transition: transform 200ms;
    will-change: transform;

    overflow: visible;
}

.detail-actions {
    width: 100%;
    margin: 20px 0;
    display: flex;
    justify-content: center;
}

.detail-text {
    flex-grow: 1;
    /* max-width: 500px; */
    margin-bottom: 20px;
}
.detail-wrapper {
    background-color: #f7fafc;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07);
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
}

.detail-prints {
    width: 100%;
    display: flex;
    flex-flow: column nowrap;
    /* max-width: 500px; */
}
.card-meta {
    background-color: #f7fafc;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07);
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 20px;
    display: flex;
    gap: 15px;
    align-items: center;
}

.card-meta div:first-child {
    flex: 0 0 30px;
    width: 30px;
    display: flex; 
    justify-content: center;
    align-items: center;
}
.card-meta div {
    display: flex;
    flex-grow: 1;
    flex-direction: column;
}
.set-icon {
    width: 30px;
    height: 30px;
}

h2, h3 {
    margin: 0;
    padding: 0 0 10px 0;
    display: flex;
    align-items: start;
    /* flex-direction: column; */
}
h2 > span, .adventure-face h3, .detail-wrapper > div > h3 { flex-wrap: wrap; }
h2 small, h3 small {
    font-size: 65%;
    color: #718096;
}

.mana-cost { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px; max-width: 100%; margin-left: 10px; }
p {margin-top:0;}
.type-line {
    font-weight: bold;
    color: #4a5568;
    border: 1px solid rgba(0, 0, 0, 0.07);
    border-width: 1px 0;
    padding: 10px 0;
}

.oracle-text {
    line-height: 1.4;
    padding: 0 0 10px 0;
    margin: 0 0 10px 0;
}

.flavor-text {
    font-style: italic;
    color: #718096;
    padding: 10px 0;
    border-top: 1px solid rgba(0,0,0,0.07);
}



.save-controls {
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07);
    margin-top: 20px;
    padding: 20px;
    background-color: #edf2f7;
    border-radius: 12px;
}

.form-item {
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
}

.form-item label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}

.auto-value {
    padding: 8px;
    background-color: #fff;
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    color: #4a5568;
}

.groups-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 15px;
    max-height: 120px;
    overflow-y: auto;
    background: white;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #cbd5e0;
}
.prints-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.prints-heading h3 { padding: 0; }.prints-heading span { background: #e2e8f0; border-radius: 999px; padding: 3px 8px; font-size: 12px; }
.prints-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.print-card { min-width: 0; display: flex; gap: 9px; align-items: stretch; padding: 7px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; color: inherit; text-align: left; cursor: pointer; }
.print-card:hover { border-color: #3182ce; background: #ebf8ff; }.print-card > img { width: 58px; align-self: flex-start; border-radius: 4px; }
.print-info { min-width: 0; display: flex; flex-direction: column; gap: 3px; }.print-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.print-info small { color: #718096; text-transform: capitalize; }.print-set { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; }.print-set img { width: 14px; height: 14px; }
.prints-state { padding: 24px; text-align: center; color: #718096; background: #f7fafc; border-radius: 8px; }
.view-all-prints { margin-top: 10px; padding: 9px; border: 1px solid #3182ce; border-radius: 6px; background: white; color: #3182ce; cursor: pointer; }
.adventure-faces { display: grid; gap: 14px; }
.adventure-face { position: relative; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
.adventure-face.spell { background: #fffaf0; border-color: #f6ad55; }
.face-label { display: inline-block; margin-bottom: 8px; padding: 3px 8px; border-radius: 999px; background: #4a5568; color: white; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.adventure-face.spell .face-label { background: #c05621; }

.group-checkbox {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
}

.group-checkbox input {
    margin: 0;
}

.add-group-inline {
    display: flex;
    gap: 10px;
}

.form-input {
    flex: 1;
    padding: 8px;
    border: 1px solid #cbd5e0;
    border-radius: 4px;
}

.btn-small {
    padding: 4px 12px;
    background-color: #3182ce;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.btn-add {
    background-color: #38a169;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    /* width: 100%; */
    font-weight: bold;
}

.btn-add:hover:not(:disabled) {
    background-color: #2f855a;
}

.btn-add:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.status-msg {
    margin-top: 10px;
    text-align: center;
    font-weight: bold;
}

.success { color: #2f855a; }
.error { color: #c53030; }

@media screen and (min-width: 720px) {
    .card-body {
        flex-flow: row wrap;
        justify-content: center;
    }
    .detail-image {
        flex: 0 0 336px;
    }
    .detail-text {
        width: auto;
    }
}

@media screen and (max-width: 520px) {
    .prints-grid { grid-template-columns: 1fr; }
}

@media screen and (min-width: 980px) {
    .card-body {
        flex-flow: row nowrap;
        justify-content: flex-start;
    }

    .detail-actions {
        position: absolute;
        top: 510px;
        width: 336px;
        margin: 0;
    }
    
    .detail-text {
        width: 36.5%;
        margin: 0 25px;
    }

    .detail-prints {
        width: 35.0%;
        max-width: 400px;
    }
}
</style>
