import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function getAllGroupsFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/getlg/v4`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Lấy danh sách tất cả các nhóm
   *
   * @throws ZaloApiError
   */
  return async function getAllGroups() {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");

    const response = await request(serviceURL, {
      method: "GET",
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

    return result.data;
  };
}
