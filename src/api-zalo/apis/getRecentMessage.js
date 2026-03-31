import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function getRecentMessageFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group_cloud_message[0]}/api/cm/getrecentv2`, {
    zpw_ver: Zalo.API_VERSION, 
    zpw_type: Zalo.API_TYPE,
    nretry: 0
  });

  /**
   * Lấy tin nhắn gần đây của nhóm
   * 
   * @param {string|number} groupId - ID của nhóm cần lấy tin nhắn
   * @param {number} [globalMsgId] - ID tin nhắn để lấy từ đó trở về trước (msgId)
   * @param {number} [count=50] - Số lượng tin nhắn cần lấy
   * @throws {ZaloApiError}
   */
  return async function getRecentMessage(groupId, globalMsgId = 10000000000000000, count = 50) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    if (!groupId) throw new ZaloApiError("Group ID is not available");

    const params = {
      groupId: String(groupId),
      globalMsgId: globalMsgId,
      count: count,
      msgIds: [],
      imei: appContext.imei,
      src: 1
    };

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

    const response = await request(serviceURL, {
      method: "POST",
      body: new URLSearchParams({
        params: encryptedParams
      })
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

    return result.data;
  };
} 