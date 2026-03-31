import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function getAllFriendsFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.profile[0]}/api/social/friend/getfriends`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });
  /**
   * Lấy danh sách tất cả bạn bè
   *
   * @throws ZaloApiError
   */
  return async function getAllFriends(avatarSize = 120) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");

    const params = {
      params: {
        incInvalid: 0,
        page: 1,
        count: 20000,
        avatar_size: Number(avatarSize),
        actiontime: 0,
      },
      zpw_ver: appContext.API_VERSION,
      zpw_type: appContext.API_TYPE,
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
