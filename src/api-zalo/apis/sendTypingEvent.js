import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../zalo.js";
import { MessageType } from "../models/Message.js";

export function sendTypingEventFactory(api) {
    const directMessageServiceURL = makeURL(`${api.zpwServiceMap.chat[0] || api.zpwServiceMap.zimsg[0]}/api/message/typing`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.group[0] || api.zpwServiceMap.zimsg[0]}/api/group/typing`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    return async function sendTypingEvent(threadId, type = MessageType.DirectMessage) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");
        if (!threadId) throw new ZaloApiError("Missing threadId");

        const isGroup = type === MessageType.GroupMessage || type === 1;
        const params = {
            [isGroup ? "grid" : "toid"]: String(threadId),
            imei: appContext.imei
        };

        if (!isGroup) {
            params.destType = 0; // Default User
        }

        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

        const url = isGroup ? groupMessageServiceURL : directMessageServiceURL;

        const response = await request(url, {
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
