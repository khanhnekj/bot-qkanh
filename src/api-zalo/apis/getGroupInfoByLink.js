import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function getInfoGroupByLinkFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/link/ginfo`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Lấy thông tin nhóm thông qua link
   * 
   * @param {string} link - Link của nhóm (dạng https://zalo.me/g/xxxxxx)
   * @param {object} options - Các tùy chọn
   * @param {number} [options.avatarSize=120] - Kích thước avatar nhóm
   * @param {number} [options.memberAvatarSize=120] - Kích thước avatar thành viên
   * @param {number} [options.page=1] - Trang danh sách thành viên
   * @throws {ZaloApiError}
   */
  return async function getInfoGroupByLink(link, options = {}) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available"); 
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");
    if (!link) throw new ZaloApiError("Link is not available");

    const params = {
      link: link,
      avatar_size: options.avatarSize || 120,
      member_avatar_size: options.memberAvatarSize || 120,
      mpage: options.page || 1
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