import { appContext } from "../context.js";
import { Zalo, ZaloApiError, MessageType } from "../index.js";
import { ReactionMap } from "../models/Reaction.js";
import { decodeAES, encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";

export function addReactionFactory(api) {
  const directMessageServiceURL = makeURL(`${api.zpwServiceMap.reaction[0]}/api/message/reaction`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });
  const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.reaction[0]}/api/group/reaction`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Add reaction to one or multiple messages
   * 
   * @param icon Reaction icon
   * @param messages Single message object or array of message objects to react to
   * @param rType Optional reaction type (default: 75)
   * 
   * @throws ZaloApiError
   */
  return async function addReaction(icon, messages) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");
    const messageArray = Array.isArray(messages) ? messages : [messages];
    if (messageArray.length === 0) throw new ZaloApiError("No messages to react to");
    const isGroupMessage = messageArray[0].type === MessageType.GroupMessage;
    const threadId = messageArray[0].threadId;

    const reaction = ReactionMap[icon];
    const rType = reaction ? reaction.rType : 75;
    const text = reaction ? (reaction.text || icon) : icon;
    const rMsg = messageArray.map(msg => ({
      gMsgID: String(msg.data.msgId || msg.data.globalMsgId),
      cMsgID: String(msg.data.cliMsgId),
      msgType: parseInt(msg.type),
    }));

    const params = {
      react_list: [
        {
          message: JSON.stringify({
            rMsg,
            rIcon: text,
            rType,
            source: 6,
          }),
          clientId: Date.now(),
        },
      ],
      toid: isGroupMessage ? undefined : String(threadId),
      grid: isGroupMessage ? String(threadId) : undefined,
    };

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

    const url = isGroupMessage ? groupMessageServiceURL : directMessageServiceURL;
    const response = await request(url, {
      method: "POST",
      body: new URLSearchParams({
        params: encryptedParams,
      }),
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
    return { icon, rType };
  };
}
