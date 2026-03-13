import client from './client'

const baseURL = '/marketplace'

/**
 * Marketplace Templates API
 * Provides access to 1000+ pre-built templates across three categories:
 * - Chatflows (250 templates)
 * - Agentflows (250 templates)
 * - Assistants (250 templates)
 */

const marketplaceTemplatesApi = {
    /**
     * Get all templates with optional filtering
     * @param {Object} params - Query parameters
     * @param {string} params.category - Filter by category (chatflows, agentflows, assistants)
     * @param {string} params.tags - Comma-separated tags to filter by
     * @param {string} params.search - Search query
     * @param {number} params.page - Page number (1-indexed)
     * @param {number} params.limit - Results per page
     * @returns {Promise} Paginated template list
     */
    getAllTemplates: async (params = {}) => {
        const queryParams = new URLSearchParams()
        if (params.category) queryParams.append('category', params.category)
        if (params.tags) queryParams.append('tags', params.tags)
        if (params.search) queryParams.append('search', params.search)
        queryParams.append('page', params.page || 1)
        queryParams.append('limit', params.limit || 20)

        return client.get(`${baseURL}/templates?${queryParams.toString()}`)
    },

    /**
     * Get a single template by ID
     * @param {string} templateId - Template ID
     * @returns {Promise} Template details
     */
    getTemplate: async (templateId) => {
        return client.get(`${baseURL}/templates/${templateId}`)
    },

    /**
     * Get trending/popular templates
     * @param {number} limit - Number of templates to return
     * @returns {Promise} List of trending templates
     */
    getTrending: async (limit = 10) => {
        return client.get(`${baseURL}/trending?limit=${limit}`)
    },

    /**
     * Get new/recently added templates
     * @param {number} limit - Number of templates to return
     * @returns {Promise} List of new templates
     */
    getNew: async (limit = 10) => {
        return client.get(`${baseURL}/new?limit=${limit}`)
    },

    /**
     * Get marketplace statistics
     * @returns {Promise} Stats including total count, categories, etc.
     */
    getStats: async () => {
        return client.get(`${baseURL}/stats`)
    },

    /**
     * Get available categories
     * @param {string} category - Optional: get items in specific category
     * @returns {Promise} Categories and their items
     */
    getCategories: async (category = null) => {
        const url = category ? `${baseURL}/categories?category=${category}` : `${baseURL}/categories`
        return client.get(url)
    },

    /**
     * Use a template (create instance from template)
     * @param {string} templateId - Template ID
     * @param {Object} config - Configuration options
     * @returns {Promise} Created workflow/assistant instance
     */
    useTemplate: async (templateId, config = {}) => {
        return client.post(`${baseURL}/templates/${templateId}/use`, config)
    },

    /**
     * Search templates
     * @param {string} query - Search query
     * @param {Object} filters - Additional filters
     * @returns {Promise} Search results
     */
    search: async (query, filters = {}) => {
        return client.post(`${baseURL}/search`, {
            query,
            ...filters
        })
    },

    /**
     * Get templates by difficulty level
     * @param {string} difficulty - Difficulty level (Beginner, Intermediate, Advanced)
     * @returns {Promise} Filtered templates
     */
    getByDifficulty: async (difficulty) => {
        return client.get(`${baseURL}/templates?difficulty=${difficulty}`)
    },

    /**
     * Get templates by use case
     * @param {string} usecase - Use case name
     * @returns {Promise} Templates matching use case
     */
    getByUsecase: async (usecase) => {
        return client.get(`${baseURL}/templates?usecase=${usecase}`)
    },

    /**
     * Get templates by framework
     * @param {string} framework - Framework name (Langchain, Langgraph, etc.)
     * @returns {Promise} Templates using specific framework
     */
    getByFramework: async (framework) => {
        return client.get(`${baseURL}/templates?framework=${framework}`)
    },

    /**
     * Get featured/recommended templates
     * @returns {Promise} Featured templates
     */
    getFeatured: async () => {
        return client.get(`${baseURL}/featured`)
    }
}

export default marketplaceTemplatesApi
