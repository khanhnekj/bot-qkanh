import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function changeGroupOwnerFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/change-owner`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Thay đổi chủ sở hữu nhóm (yellow key) theo ID.
   *
   * Client phải là chủ sở hữu của nhóm.
   *
   * @param {string|number} newAdminId - ID của thành viên sẽ trở thành chủ sở hữu mới
   * @param {string|number} groupId - ID của nhóm cần thay đổi chủ sở hữu
   * @throws {ZaloApiError}
   */
  return async function changeGroupOwner(groupId, newAdminId) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");

    const params = {
      grid: String(groupId),
      newAdminId: String(newAdminId),
      imei: appContext.imei,
      language: "vi",
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
