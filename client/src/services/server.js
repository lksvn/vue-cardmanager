import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

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

  async updateTag(type, oldTag, newTag) {
    const response = await axios.put(`${BASE_URL}/tags/${type}`, { oldTag, newTag });
    return response.data;
  },

  async deleteTag(type, tag) {
    const response = await axios.delete(`${BASE_URL}/tags/${type}`, { data: { tag } });
    return response.data;
  },

  async rebuildCollections() {
    const response = await axios.post(`${BASE_URL}/tags/rebuild`);
    return response.data;
  },

  async getSymbols() {
    const response = await axios.get(`${BASE_URL}/symbols`);
    return response.data;
  },

  async syncSymbols() {
    const response = await axios.post(`${BASE_URL}/symbols/sync`);
    return response.data;
  }
};
