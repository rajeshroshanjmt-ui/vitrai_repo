import client from './client'
import { successResponse, unavailableListResponse } from './responseAdapter'

const isNotFound = (error) => error?.response?.status === 404

const getInternalChatmessageFromChatflow = async (id, params = {}) => {
    try {
        const response = await client.get(`/internal-chatmessage/${id}`, { params: { feedback: true, ...params } })
        return successResponse(Array.isArray(response?.data) ? response.data : [], response?.status || 200)
    } catch (error) {
        if (isNotFound(error)) return unavailableListResponse(404)
        throw error
    }
}

const getAllChatmessageFromChatflow = async (id, params = {}) => {
    try {
        const response = await client.get(`/chatmessage/${id}`, { params: { order: 'DESC', feedback: true, ...params } })
        return successResponse(Array.isArray(response?.data) ? response.data : [], response?.status || 200)
    } catch (error) {
        if (isNotFound(error)) return unavailableListResponse(404)
        throw error
    }
}

const getChatmessageFromPK = async (id, params = {}) => {
    try {
        const response = await client.get(`/chatmessage/${id}`, { params: { order: 'ASC', feedback: true, ...params } })
        return successResponse(Array.isArray(response?.data) ? response.data : [], response?.status || 200)
    } catch (error) {
        if (isNotFound(error)) return unavailableListResponse(404)
        throw error
    }
}
const deleteChatmessage = (id, params = {}) => client.delete(`/chatmessage/${id}`, { params: { ...params } })
const abortMessage = (chatflowid, chatid) => client.put(`/chatmessage/abort/${chatflowid}/${chatid}`)

export default {
    getInternalChatmessageFromChatflow,
    getAllChatmessageFromChatflow,
    getChatmessageFromPK,
    deleteChatmessage,
    abortMessage
}
