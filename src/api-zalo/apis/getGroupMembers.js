import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function getGroupMembersFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.profile[0]}/api/social/group/members`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Lấy thông tin thành viên nhóm
   * 
   * @param {string[]} memberIds - Mảng ID của các thành viên cần lấy thông tin
   * @throws {ZaloApiError}
   */
  return async function getGroupMembers(memberIds) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");
    if (!memberIds || !Array.isArray(memberIds)) throw new ZaloApiError("Member IDs must be an array");

    const params = {
      friend_pversion_map: memberIds.map(id => id)
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