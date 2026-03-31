import { appContext } from "../context.js";
import { Zalo, ZaloApiError } from "../index.js";
import { MessageType } from "../models/Message.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
export function sendStickerFactory(api) {
  const directMessageServiceURL = makeURL(`${api.zpwServiceMap.chat[0]}/api/message/sticker`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });
  const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/sticker`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });
  /**
   * Send a sticker to a thread
   *
   * @param sticker Sticker object
   * @param threadId group or user id
   * @param type Message type (DirectMessage or GroupMessage)
   *
   * @throws ZaloApiError
   */
  return async function sendSticker(sticker, threadId, type = MessageType.DirectMessage, ttl = 0) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
    if (!sticker) throw new ZaloApiError("Missing sticker");
    if (!threadId) throw new ZaloApiError("Missing threadId");
    const isGroupMessage = type === MessageType.GroupMessage;
    const params = {
      stickerId: sticker.id,
      cateId: sticker.cateId,
      type: sticker.type,
      clientId: Date.now(),
      imei: appContext.imei,
      zsource: 101,
      toid: isGroupMessage ? undefined : threadId,
      grid: isGroupMessage ? threadId : undefined,
      ttl: ttl,
    };
    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");
    const finalServiceUrl = new URL(isGroupMessage ? groupMessageServiceURL : directMessageServiceURL);
    finalServiceUrl.searchParams.append("nretry", "0");
    const response = await request(finalServiceUrl.toString(), {
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
