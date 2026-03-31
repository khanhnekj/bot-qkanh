import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../zalo.js";

export function sendVoiceUnifiedFactory(api) {
    const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/forward`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        nretry: 0,
    });
    const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/forward`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        nretry: 0,
    });

    return async function sendVoiceUnified({ filePath, threadId, threadType }) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");

        const { uploadAudioFile } = await import("../../utils/process-audio.js");
        const audioData = await uploadAudioFile(filePath, api, threadId, threadType);

        if (!audioData) throw new ZaloApiError("Failed to upload audio file");

        const params = {
            ttl: 0,
            zsource: -1,
            msgType: 3,
            clientId: String(Date.now()),
            msgInfo: JSON.stringify({
                voiceUrl: String(audioData.voiceUrl),
                m4aUrl: String(audioData.voiceUrl),
                fileSize: Number(audioData.fileSize),
            }),
            imei: appContext.imei
        };

        let url;
        if (threadType === 0) {
            url = directMessageServiceURL;
            params.toId = String(threadId);
        } else if (threadType === 1) {
            url = groupMessageServiceURL;
            params.visibility = 0;
            params.grid = String(threadId);
        } else {
            throw new ZaloApiError("Thread type is invalid");
        }

        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

        const response = await request(url, {
            method: "POST",
            body: new URLSearchParams({ params: encryptedParams }),
        });

        const result = await handleZaloResponse(response);
        if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

        return result.data;
    };
}
