import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function leaveGroupFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/leave`, {
    zpw_ver: Zalo.API_VERSION, 
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Rời khỏi nhóm
   * 
   * @param {string|string[]} groupIds - ID hoặc danh sách ID của các nhóm muốn rời
   * @param {boolean} [silent=false] - Rời nhóm một cách im lặng Không thông báo
   * @throws {ZaloApiError}
   */
  return async function leaveGroup(groupIds, silent = false) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");

    // Chuyển đổi groupId thành mảng nếu là string
    if (!Array.isArray(groupIds)) {
      groupIds = [String(groupIds)];
    } else {
      groupIds = groupIds.map(id => String(id));
    }

    const params = {
      grids: groupIds,
      imei: appContext.imei,
      silent: silent ? 1 : 0,
      language: appContext.language
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