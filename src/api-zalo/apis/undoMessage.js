import { appContext } from "../context.js";
import { Zalo, ZaloApiError } from "../index.js";
import { GroupMessage, Message, MessageType } from "../models/Message.js";
import { encodeAES, handleZaloResponse, request } from "../utils.js";
export function undoMessageFactory(api) {
  const URLType = {
    [MessageType.DirectMessage]: `${api.zpwServiceMap.chat[0]}/api/message/undo?zpw_ver=${Zalo.API_VERSION}&zpw_type=${Zalo.API_TYPE}`,
    [MessageType.GroupMessage]: `${api.zpwServiceMap.group[0]}/api/group/undomsg?zpw_ver=${Zalo.API_VERSION}&zpw_type=${Zalo.API_TYPE}`,
  };
  /**
   * Undo a message
   *
   * @param message Message or GroupMessage instance that has quote to undo
   *
   * @throws ZaloApiError
   */
  /**
   * Undo a message (thu hồi tin nhắn)
   *
   * @param {Message|Object} message Tin nhắn gốc hoặc object chứa { msgId, cliMsgId }
   * @param {string} [threadId] ID của cuộc trò chuyện (nếu tham số đầu là object)
   * @param {number} [type] Loại cuộc trò chuyện (0: cá nhân, 1: nhóm)
   * @throws {ZaloApiError}
   */
  return async function undo(message, threadId = null, type = null) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");

    let params = {
      clientId: Date.now(),
    };

    if (message.data?.quote) {
      // Kiểu cũ: Truyền vào message object có quote
      params.msgId = message.data.quote.globalMsgId;
      params.cliMsgIdUndo = message.data.quote.cliMsgId;
      threadId = message.threadId;
      type = message.type;
    } else if (message.msgId && message.cliMsgId) {
      // Kiểu mới: Truyền vào direct msgId và cliMsgId
      params.msgId = message.msgId;
      params.cliMsgIdUndo = message.cliMsgId;
      threadId = threadId || message.threadId;
      type = type !== null ? type : (message.type !== undefined ? message.type : MessageType.DirectMessage);
    } else {
      throw new ZaloApiError("Invalid arguments for undo: message must be a Message object with quote OR an object with { msgId, cliMsgId }");
    }

    if (!threadId) throw new ZaloApiError("Missing threadId for undo");

    if (type === MessageType.GroupMessage) {
      params["grid"] = threadId.toString();
      params["visibility"] = 0;
      params["imei"] = appContext.imei;
      params["toid"] = undefined;
    } else {
      params["toid"] = threadId.toString();
    }

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

    const url = type === MessageType.GroupMessage ? URLType[MessageType.GroupMessage] : URLType[MessageType.DirectMessage];
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
