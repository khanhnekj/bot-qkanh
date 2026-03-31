import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../zalo.js";

export function sendVoiceFactory(api) {
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
  return async function sendVoice(message, voiceUrl, ttl = 0) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    const threadId = message.threadId;
    const threadType = message.type;
    let fileSize = 0;
    try {
      const headResponse = await request(voiceUrl, { method: "HEAD" });
      if (headResponse.ok) {
        fileSize = parseInt(headResponse.headers.get("content-length")) || 0;
      }
    } catch (error) {
      throw new ZaloApiError(`Unable to get voice content: ${error.message}`);
    }

    const payload = {
      params: {
        ttl: ttl,
        zsource: -1,
        msgType: 3,
        clientId: String(Date.now()),
        msgInfo: JSON.stringify({
          voiceUrl: String(voiceUrl),
          m4aUrl: String(voiceUrl),
          fileSize: Number(fileSize),
        }),
      },
    };

    // if (message && message.mention) {
    //     payload.params.mentionInfo = message.mention;
    // }

    let url;
    if (threadType === 0) {
      url = directMessageServiceURL;
      payload.params.toId = String(threadId);
      payload.params.imei = appContext.imei;
    } else if (threadType === 1) {
      url = groupMessageServiceURL;
      payload.params.visibility = 0;
      payload.params.grid = String(threadId);
      payload.params.imei = appContext.imei;
    } else {
      throw new ZaloApiError("Thread type is invalid");
    }
    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(payload.params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

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
