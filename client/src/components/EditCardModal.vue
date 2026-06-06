<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="edit-modal">
      <header>
        <h3>Edit Card: {{ card.name }}</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </header>

      <div class="edit-form">
        <div class="form-item">
          <label>Collection:</label>
          <select v-model="editData.Collection">
            <option v-for="c in tags.collections" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="form-item">
          <label>Groups:</label>
          <div class="groups-list">
            <div v-for="g in tags.groups" :key="g" class="group-checkbox">
              <input 
                type="checkbox" 
                :id="'edit-group-' + g" 
                :value="g" 
                v-model="editData.Groups" 
              />
              <label :for="'edit-group-' + g">{{ g }}</label>
            </div>
          </div>
          <div class="add-group-inline">
            <input 
              v-model="newGroupName" 
              type="text" 
              placeholder="Add new group..."
              @keyup.enter="addNewGroup"
            />
            <button @click="addNewGroup" class="btn-small">Add</button>
          </div>
        </div>

        <div class="form-item">
          <label>Type:</label>
          <select v-model="editData.Type">
            <option v-for="t in tags.types" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="actions">
          <button @click="saveChanges" :disabled="saving" class="btn-save">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
          <button @click="$emit('close')" class="btn-cancel">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { serverService } from '../services/server';

const props = defineProps({
  card: { type: Object, required: true },
  tags: { type: Object, required: true }
});

const emit = defineEmits(['close', 'updated']);

const editData = reactive({
  Collection: props.card.Collection,
  Groups: props.card.Groups || [],
  Type: props.card.Type
});

const newGroupName = ref('');
const saving = ref(false);

// Prune selections if they are removed from global tags
watch(() => props.tags.collections, (newCollections) => {
  if (editData.Collection && !newCollections.includes(editData.Collection)) {
    editData.Collection = '';
  }
});

watch(() => props.tags.groups, (newGroups) => {
  editData.Groups = editData.Groups.filter(g => newGroups.includes(g));
});

watch(() => props.tags.types, (newTypes) => {
  if (editData.Type && !newTypes.includes(editData.Type)) {
    editData.Type = '';
  }
});

const addNewGroup = () => {
    if (newGroupName.value && !editData.Groups.includes(newGroupName.value)) {
        editData.Groups.push(newGroupName.value);
        newGroupName.value = '';
    }
};

const saveChanges = async () => {
  saving.value = true;
  try {
    await serverService.updateCard(props.card.filename, editData);
    emit('updated');
    emit('close');
  } catch (error) {
    alert('Failed to update card');
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.edit-modal {
  background: white;
  width: 90%;
  max-width: 450px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  overflow: hidden;
}

header {
  padding: 15px 20px;
  background: #f7fafc;
  border-bottom: 1px solid #edf2f7;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

header h3 {
  margin: 0;
  color: #2d3748;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #a0aec0;
}

.edit-form {
  padding: 20px;
}

.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #4a5568;
}

select, input {
  width: 100%;
  padding: 8px;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  font-size: 14px;
}

.groups-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  max-height: 120px;
  overflow-y: auto;
  border: 1px solid #cbd5e0;
  padding: 10px;
  border-radius: 4px;
  background: #fdfdfd;
}

.group-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.group-checkbox input {
  width: auto;
  margin: 0;
}

.add-group-inline {
  display: flex;
  gap: 10px;
}

.add-group-inline input {
  flex: 1;
}

.btn-small {
  width: auto !important;
  padding: 4px 12px !important;
  background-color: #3182ce;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}

.btn-save {
  background: #3182ce;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  flex: 1;
  font-weight: 600;
}

.btn-cancel {
  background: #edf2f7;
  color: #4a5568;
  border: 1px solid #cbd5e0;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-save:disabled {
  opacity: 0.6;
}
</style>
