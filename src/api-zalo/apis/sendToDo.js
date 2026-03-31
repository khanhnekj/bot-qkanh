import { appContext } from "../context.js";
import { MessageType, Zalo, ZaloApiError } from "../index.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";

export function sendToDoFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.boards[0]}/api/board/personal/todo/create`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Gửi một todo đến người dùng hoặc nhóm
   * @param {Message} message Tin nhắn gốc
   * @param {string} content Nội dung todo
   * @param {Array<number>} assignees Danh sách ID người nhận
   * @param {number} dueDate Thời hạn (-1 nếu Không có)
   * @param {string} description Mô tả (có thể trống)
   * @throws {ZaloApiError}
   */
  return async function sendToDo(message, content, assignees, dueDate = -1, description = "") {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
    if (!message) throw new ZaloApiError("Missing message");
    if (!content) throw new ZaloApiError("Missing todo content");
    if (!assignees?.length) throw new ZaloApiError("Missing assignees");

    const threadId = message.threadId;
    const isGroup = message.type === MessageType.GroupMessage;
    const cliMsgId = message.data.cliMsgId;
    const msgId = message.data.msgId;

    const params = {
      assignees: JSON.stringify(assignees),
      dueDate,
      content,
      description,
      extra: JSON.stringify({
        msgId,
        toUid: threadId,
        isGroup,
        cliMsgId,
        msgType: 1,
        mention: [],
        ownerMsgUId: appContext.uid,
        message: content
      }),
      dateDefaultType: 0,
      status: -1,
      watchers: "[]",
      schedule: null,
      src: 5,
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