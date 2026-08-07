<template>
  <div class="tag-manager">
    <div class="tag-section">
      <div class="header-with-action">
        <h3>Groups</h3>
        <button @click="showAdd('groups')" class="btn-add-small">+</button>
      </div>
      <div v-if="addingType === 'groups'" class="add-tag-form">
        <input v-model="newValue" @keyup.enter="addTag('groups')" placeholder="New group..." type="text" />
        <button @click="addTag('groups')" class="btn-confirm">Add</button>
        <button @click="addingType = null" class="btn-cancel">Cancel</button>
      </div>
      <div class="tag-list">
        <div v-for="tag in tags.groups" :key="tag" class="tag-item">
          <input 
            v-if="editingTag === 'groups:' + tag" 
            v-model="editValue" 
            @keyup.enter="saveEdit('groups', tag)"
            type="text" 
          />
          <span v-else>{{ tag }}</span>
          
          <div class="tag-actions">
            <button v-if="editingTag === 'groups:' + tag" @click="saveEdit('groups', tag)" class="btn-icon">✓</button>
            <button v-else @click="startEdit('groups', tag)" class="btn-icon">✎</button>
            <button @click="deleteTag('groups', tag)" class="btn-icon btn-delete">🗑</button>
          </div>
        </div>
      </div>
    </div>

    <div class="tag-section">
      <div class="header-with-action">
        <h3>Collections</h3>
        <button @click="showAdd('collections')" class="btn-add-small">+</button>
      </div>
      <div v-if="addingType === 'collections'" class="add-tag-form">
        <input v-model="newValue" @keyup.enter="addTag('collections')" placeholder="New collection..." type="text" />
        <button @click="addTag('collections')" class="btn-confirm">Add</button>
        <button @click="addingType = null" class="btn-cancel">Cancel</button>
      </div>
      <div class="tag-list">
        <div v-for="tag in tags.collections" :key="tag" class="tag-item">
          <input 
            v-if="editingTag === 'collections:' + tag" 
            v-model="editValue" 
            @keyup.enter="saveEdit('collections', tag)"
            type="text" 
          />
          <span v-else>{{ tag }}</span>
          
          <div class="tag-actions">
            <button v-if="editingTag === 'collections:' + tag" @click="saveEdit('collections', tag)" class="btn-icon">✓</button>
            <button v-else @click="startEdit('collections', tag)" class="btn-icon">✎</button>
            <button @click="deleteTag('collections', tag)" class="btn-icon btn-delete">🗑</button>
          </div>
        </div>
      </div>
    </div>

    <div class="tag-section">
      <div class="header-with-action">
        <h3>Types</h3>
        <button @click="showAdd('types')" class="btn-add-small">+</button>
      </div>
      <div v-if="addingType === 'types'" class="add-tag-form">
        <input v-model="newValue" @keyup.enter="addTag('types')" placeholder="New type..." type="text" />
        <button @click="addTag('types')" class="btn-confirm">Add</button>
        <button @click="addingType = null" class="btn-cancel">Cancel</button>
      </div>
      <div class="tag-list">
        <div v-for="tag in tags.types" :key="tag" class="tag-item">
          <input 
            v-if="editingTag === 'types:' + tag" 
            v-model="editValue" 
            @keyup.enter="saveEdit('types', tag)"
            type="text" 
          />
          <span v-else>{{ tag }}</span>
          
          <div class="tag-actions">
            <button v-if="editingTag === 'types:' + tag" @click="saveEdit('types', tag)" class="btn-icon">✓</button>
            <button v-else @click="startEdit('types', tag)" class="btn-icon">✎</button>
            <button @click="deleteTag('types', tag)" class="btn-icon btn-delete">🗑</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { serverService } from '../services/server';
import { useTagsStore } from '../stores/tags';
import { useUiStore } from '../stores/ui';

const tagsStore = useTagsStore();
const ui = useUiStore();
const tags = computed(() => tagsStore.tags);
const editingTag = ref(null);
const editValue = ref('');
const addingType = ref(null);
const newValue = ref('');

const emit = defineEmits(['changed']);

const fetchTags = async () => {
  try {
    await tagsStore.load(true);
  } catch (error) {
    console.error('Failed to fetch tags:', error);
  }
};

onMounted(fetchTags);

const startEdit = (type, tag) => {
  editingTag.value = `${type}:${tag}`;
  editValue.value = tag;
};

const saveEdit = async (type, oldTag) => {
  if (!editValue.value || editValue.value === oldTag) {
    editingTag.value = null;
    return;
  }
  try {
    const impact = await serverService.getTagImpact(type, oldTag);
    const updateCards = impact.count > 0 && await ui.confirm(`Also rename this tag in ${impact.count} card note(s)? Backups will be created.`);
    await serverService.updateTag(type, oldTag, editValue.value, updateCards);
    await fetchTags();
    editingTag.value = null;
    emit('changed');
  } catch (error) {
    ui.notify('Failed to update tag', 'error');
  }
};

const deleteTag = async (type, tag) => {
  if (!await ui.confirm(`Delete "${tag}" from ${type}?`)) return;
  try {
    const impact = await serverService.getTagImpact(type, tag);
    const updateCards = impact.count > 0 && await ui.confirm(`Also remove this tag from ${impact.count} card note(s)? Backups will be created.`);
    await serverService.deleteTag(type, tag, updateCards);
    await fetchTags();
    emit('changed');
  } catch (error) {
    ui.notify('Failed to delete tag', 'error');
  }
};

const showAdd = (type) => {
    addingType.value = type;
    newValue.value = '';
};

const addTag = async (type) => {
    if (!newValue.value) {
        addingType.value = null;
        return;
    }
    try {
        await serverService.addTag(type, newValue.value);
        await fetchTags();
        addingType.value = null;
        emit('changed');
    } catch (error) {
        ui.notify('Failed to add tag', 'error');
    }
};

defineExpose({ fetchTags });
</script>

<style scoped>
.tag-manager {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.tag-section {
  background-color: #f7fafc;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #edf2f7;
}

h3 {
  margin: 0;
  font-size: 18px;
  padding-bottom: 5px;
}

.header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 15px;
  padding-bottom: 5px;
}

.btn-add-small {
  background-color: #3182ce;
  color: white;
  border: none;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.add-tag-form {
  display: flex;
  gap: 5px;
  margin-bottom: 15px;
}

.add-tag-form input {
  flex: 1;
  padding: 6px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
}

.btn-confirm {
  background-color: #38a169;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel {
  background: none;
  border: 1px solid #cbd5e0;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 5px;
}

.tag-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: white;
  padding: 8px 12px;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.tag-item input {
  flex: 1;
  padding: 4px;
  border: 1px solid #3182ce;
  border-radius: 2px;
}

.tag-actions {
  display: flex;
  gap: 5px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 5px;
  border-radius: 3px;
  color: #718096;
}

.btn-icon:hover {
  background-color: #edf2f7;
  color: #3182ce;
}

.btn-delete:hover {
  color: #e53e3e;
}
</style>
