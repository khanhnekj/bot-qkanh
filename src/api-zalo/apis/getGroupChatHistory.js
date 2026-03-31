import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";

export function getGroupChatHistoryFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/get-chat-history`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Lấy lịch sử chat nhóm
     *
     * @param {string} groupId ID của nhóm
     * @param {number} count Số lượng tin nhắn cần lấy
     * @param {string} lastMsgId ID tin nhắn cuối cùng (để phân trang)
     * @throws {ZaloApiError}
     */
    return async function getGroupChatHistory(groupId, count = 20, lastMsgId = "") {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");
        if (!groupId) throw new ZaloApiError("Missing groupId");

        const params = {
            grid: String(groupId),
            count: Number(count),
            lastMsgId: String(lastMsgId),
            imei: appContext.imei
        };

        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

        const response = await request(serviceURL, {
            method: "POST",
            body: new URLSearchParams({
                params: encryptedParams,
            }),
        });

        const result = await handleZaloResponse(response);
        if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

        return result.data;
    };
}
