import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function blockUsersInGroupFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/blockedmems/add`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });
  /**
   * Chặn thành viên trong nhóm theo ID.
   *
   * Client phải là chủ sở hữu của nhóm.
   *
   * @param {string|string[]} members - Một hoặc nhiều ID thành viên cần chặn
   * @param {string|number} groupId - ID của nhóm cần chặn thành viên
   * @throws {ZaloApiError}
   */
  return async function blockUsersInGroup(groupId, members) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");

    members = Array.isArray(members) ? members.map(String) : [String(members)];

    const params = {
      grid: String(groupId),
      members: members,
      imei: appContext.imei,
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
