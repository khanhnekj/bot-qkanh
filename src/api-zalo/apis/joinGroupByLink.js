import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function joinGroupByLinkFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/link/join`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Tham gia nhóm thông qua link
   * 
   * @param {string} link - Link tham gia nhóm (dạng https://zalo.me/g/xxxxxx)
   * @param {string} [message] - Câu trả lời hoặc tin nhắn kèm theo để xin vào nhóm
   * @throws {ZaloApiError}
   */
  return async function joinGroupByLink(link, message) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
    if (!link) throw new ZaloApiError("Link is not available");

    const params = {
      link: link,
      clientLang: appContext.language || "vi"
    };

    if (message) params.message = message;

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