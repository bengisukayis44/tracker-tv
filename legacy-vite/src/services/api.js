/**
 * TVmaze API client for fetching TV shows and episodes.
 * Since TVmaze is a free public API, it does not require an API key.
 */

const BASE_URL = 'https://api.tvmaze.com';

/**
 * Helper to handle fetch responses and throw errors on API failure.
 */
async function apiFetch(endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('TVmaze API Client Error:', error);
        throw error;
    }
}

export const tvmazeApi = {
    /**
     * Search for shows by query string.
     * @param {string} query - The name of the show to search for.
     * @returns {Promise<Array>} List of matching shows.
     */
    searchShows: async (query) => {
        if (!query || query.trim() === '') return [];
        const encodedQuery = encodeURIComponent(query.trim());
        const results = await apiFetch(`/search/shows?q=${encodedQuery}`);
        // Map to extract show objects directly but keep search score if needed
        return results.map(item => item.show);
    },

    /**
     * Fetch full show details with embedded episodes.
     * @param {number|string} id - The TVmaze show ID.
     * @returns {Promise<Object>} Show details with episodes embedded in _embedded.episodes.
     */
    getShowDetails: async (id) => {
        if (!id) throw new Error('Show ID is required');
        return await apiFetch(`/shows/${id}?embed=episodes`);
    },

    /**
     * Fetch cast members for a show.
     * @param {number|string} showId - The TVmaze show ID.
     * @returns {Promise<Array>} List of cast members.
     */
    getShowCast: async (showId) => {
        if (!showId) throw new Error('Show ID is required');
        return await apiFetch(`/shows/${showId}/cast`);
    }
};
