import { appContext } from "../context.js";
import { Zalo, ZaloApiError } from "../index.js";
import { GroupMessage, Message, MessageType } from "../models/Message.js";
import { encodeAES, handleZaloResponse, removeUndefinedKeys, request } from "../utils.js";
export function removeMessageFactory(api) {
  const URLType = {
    [MessageType.DirectMessage]: `${api.zpwServiceMap.chat[0]}/api/message/delete?zpw_ver=${Zalo.API_VERSION}&zpw_type=${Zalo.API_TYPE}`,
    [MessageType.GroupMessage]: `${api.zpwServiceMap.group[0]}/api/group/deletemsg?zpw_ver=${Zalo.API_VERSION}&zpw_type=${Zalo.API_TYPE}`,
  };
  /**
   * Delete a message
   *
   * @param message Message or GroupMessage instance
   * @param onlyMe Delete message for only you
   *
   * @throws ZaloApiError
   */
  return async function deleteMessage(message, onlyMe = true) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    if (!message) throw new ZaloApiError("Missing message");
    const isGroupMessage = message.type === MessageType.GroupMessage;
    const params = {
      toid: !isGroupMessage ? message.threadId : undefined,
      grid: isGroupMessage ? message.threadId : undefined,
      cliMsgId: Date.now(),
      msgs: [
        {
          cliMsgId: String(message.data?.cliMsgId || message.data?.cliMessageId || ""),
          globalMsgId: String(message.data?.msgId || message.data?.globalMsgId || ""),
          ownerId: String(message.data?.uidFrom || message.data?.ownerId || ""),
          destId: String(message.threadId || message.threadid || ""),
        },
      ],
      onlyMe: onlyMe ? 1 : 0,
      imei: !isGroupMessage ? appContext.imei : undefined,
    };
    removeUndefinedKeys(params);
    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");
    // const response = await request(URLType[message.type], {
    //   method: "POST",
    //   body: new URLSearchParams({
    //     params: encryptedParams,
    //   }),
    // });
    // const result = await handleZaloResponse(response);
    // if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
    // return result.data;

    async function attemptRequest() {
      const response = await request(URLType[message.type], {
        method: "POST",
        body: new URLSearchParams({
          params: encryptedParams,
        }),
      });
      return await handleZaloResponse(response);
    }

    let result;
    const maxAttempts = 6;
    const delayMs = 500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      result = await attemptRequest();

      if (!result.error) break;

      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (result.error) {
      throw new ZaloApiError(result.error.message, result.error.code);
    }

    return result.data;
  };
}
