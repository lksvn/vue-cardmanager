	import axios from 'axios';

	const BASE_URL = 'https://api.scryfall.com';
	const paperOnlyQuery = (query) => /(^|\s)game:paper(?=\s|$)/i.test(query)
		? query
		: `${query} game:paper`;

	export const scryfallService = {
	/**
	 * Search for cards based on a query string.
	 * @param {string} query - The search query (e.g., card name, type, etc.)
	 * @returns {Promise<Array>} - A promise that resolves to an array of card objects.
	 */
	async searchCards(query, options = {}) {
		if (!query) return { data: [], has_more: false, next_page: null };
		try {
			const response = await axios.get(`${BASE_URL}/cards/search`, {
				params: { ...(options.params || {}), q: paperOnlyQuery(query) },
				signal: options.signal
			});
			return {
				data: response.data.data,
				has_more: response.data.has_more,
				next_page: response.data.next_page,
				total_cards: response.data.total_cards
			};
		} catch (error) {
			console.error('Error fetching cards from Scryfall:', error);
			if (error.response && error.response.status === 404) {
				return { data: [], has_more: false, next_page: null };
			}
			throw error;
		}
	},

	/**
	 * Fetch the next page of results using the Scryfall next_page URL.
	 * @param {string} url - The full next_page URL provided by Scryfall.
	 */
	async fetchNextPage(url) {
		if (!url) return { data: [], has_more: false, next_page: null };
		try {
			const response = await axios.get(url);
			return {
				data: response.data.data,
				has_more: response.data.has_more,
				next_page: response.data.next_page,
				total_cards: response.data.total_cards
		};
		} catch (error) {
			console.error('Error fetching next page from Scryfall:', error);
			throw error;
		}
	},

	/**
	 * Get a single card by its Scryfall ID.
	 * @param {string} id - Scryfall ID
	 */
	async getCardById(id) {
		try {
			const response = await axios.get(`${BASE_URL}/cards/${id}`);
			return response.data;
		} catch (error) {
			console.error(`Error fetching card with ID ${id}:`, error);
			throw error;
		}
	},

	async getSetByCode(code) {
		try {
			const response = await axios.get(`${BASE_URL}/sets/${code}`);
			return response.data;
		} catch (error) {
			console.error(`Error fetching set with code ${code}:`, error);
			throw error;
		}
	},

	async getCardPrints(oracleId, cardName) {
		try {
			const response = await axios.get(`${BASE_URL}/cards/search`, {
				params: { q: paperOnlyQuery(`!"${cardName}" oracleid:${oracleId} unique:prints`) }
			});
			return response.data;
		} catch (error) {
			console.error(`Error fetching prints for card ${cardName} (oracle ID: ${oracleId}):`, error);
			throw error;
		}
	}
};
