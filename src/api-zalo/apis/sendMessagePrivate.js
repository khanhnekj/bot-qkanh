import { appContext } from "../context.js";
import { Zalo, ZaloApiError } from "../index.js";
import { MessageType } from "../models/Message.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";

export function sendMessagePrivateFactory(api) {
  const serviceURLs = {
    [MessageType.DirectMessage]: makeURL(`${api.zpwServiceMap.chat[0]}/api/message/sms`, {
      zpw_ver: Zalo.API_VERSION,
      zpw_type: Zalo.API_TYPE,
      nretry: 0,
    }),
  };

  return async function sendMessagePrivate(message, threadId, ttl = 0) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
    if (!message) throw new ZaloApiError("Missing message content");
    if (!threadId) throw new ZaloApiError("Missing threadId");

    const params = {
      message: message,
      clientId: Date.now(),
      imei: appContext.imei,
      ttl: ttl,
      toid: threadId,
    };

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

    const response = await request(serviceURLs[MessageType.DirectMessage], {
      method: "POST",
      body: new URLSearchParams({ params: encryptedParams }),
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

    return result.data;
  };
}
