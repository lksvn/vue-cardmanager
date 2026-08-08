import axios from 'axios';

const BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api`;

export const apiAssetUrl = (path) => `${import.meta.env.VITE_API_URL || ''}${path}`;

const unwrapError = (error) => {
  const payload = error.response?.data?.error;
  return typeof payload === 'object' ? payload.message : payload;
};

export const apiErrorMessage = (error, fallback = 'Request failed') => unwrapError(error) || error.message || fallback;

export const serverService = {
  async getConfig() {
    const response = await axios.get(`${BASE_URL}/config`);
    return response.data;
  },

  async updateConfig(config) {
    const response = await axios.post(`${BASE_URL}/config`, config);
    return response.data;
  },

  async saveCard(card, groups, collection = null, type = null) {
    const response = await axios.post(`${BASE_URL}/cards/save`, {
      card,
      groups,
      collection,
      type
    });
    return response.data;
  },

  async getSavedCards() {
    const response = await axios.get(`${BASE_URL}/cards`);
    return response.data;
  },

  async deleteCard(filename) {
    const response = await axios.delete(`${BASE_URL}/cards/${encodeURIComponent(filename)}`);
    return response.data;
  },

  async updateCard(filename, updates) {
    const response = await axios.put(`${BASE_URL}/cards/${encodeURIComponent(filename)}`, { updates });
    return response.data;
  },

  async getTags() {
    const response = await axios.get(`${BASE_URL}/tags`);
    return response.data;
  },

  async addTag(type, tag) {
    const response = await axios.post(`${BASE_URL}/tags/${type}`, { tag });
    return response.data;
  },

  async updateTag(type, oldTag, newTag, updateCards = false) {
    const response = await axios.put(`${BASE_URL}/tags/${type}`, { oldTag, newTag, updateCards });
    return response.data;
  },

  async deleteTag(type, tag, updateCards = false) {
    const response = await axios.delete(`${BASE_URL}/tags/${type}`, { data: { tag, updateCards } });
    return response.data;
  },

  async resolveCard(filename, card) {
    const response = await axios.post(`${BASE_URL}/cards/${encodeURIComponent(filename)}/resolve`, { card });
    return response.data;
  },

  async getQueries() {
    const response = await axios.get(`${BASE_URL}/queries`);
    return response.data;
  },

  async saveQuery(name, query, replace = false) {
    const response = await axios.post(`${BASE_URL}/queries`, { name, query, replace });
    return response.data;
  },

  async deleteQuery(name) {
    const response = await axios.delete(`${BASE_URL}/queries/${encodeURIComponent(name)}`);
    return response.data;
  },

  async auditCards() {
    const response = await axios.get(`${BASE_URL}/reports/cards`);
    return response.data;
  },

  async getTagImpact(type, tag) {
    const response = await axios.get(`${BASE_URL}/tags/${type}/impact`, { params: { tag } });
    return response.data;
  },

  async rebuildCollections() {
    const response = await axios.post(`${BASE_URL}/tags/rebuild`);
    return response.data;
  },

  async rebuildTags(type) {
    const response = await axios.post(`${BASE_URL}/tags/rebuild/${type}`);
    return response.data;
  },

  async getSymbols() {
    const response = await axios.get(`${BASE_URL}/symbols`);
    return response.data;
  },

  async syncSymbols() {
    const response = await axios.post(`${BASE_URL}/symbols/sync`);
    return response.data;
  },

  async previewMigration() {
    const response = await axios.post(`${BASE_URL}/migrations/card-schema/preview`);
    return response.data;
  },

  async applyMigration(previewId, confirmedVaultPath) {
    const response = await axios.post(`${BASE_URL}/migrations/card-schema/apply`, { previewId, confirmedVaultPath });
    return response.data;
  },

  async getMigrationStatus() {
    const response = await axios.get(`${BASE_URL}/migrations/card-schema/status`);
    return response.data;
  },

  async rollbackMigration(migrationId) {
    const response = await axios.post(`${BASE_URL}/migrations/card-schema/${encodeURIComponent(migrationId)}/rollback`);
    return response.data;
  }
};
