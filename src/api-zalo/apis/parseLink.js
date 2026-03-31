import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function parseLinkFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/parselink`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Parse link Zalo để lấy thông tin
   *
   * @param {string} link - Link Zalo cần parse
   * @throws {ZaloApiError}
   */
  return async function parseLink(link) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    if (!link) throw new ZaloApiError("Link is not available");

    const params = {
      link: link,
      version: 1,
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
    if (result.error) return null;

    //data:
        // thumb: link ảnh
        // title: tiêu đề
        // desc: mô tả
        // src: nguồn
        // href: link
        // media:
            // type:    
            // count:   
            // mediaTitle: "",
            // artist: "",
            // streamUrl: "",
            // stream_icon: "",
    // error_maps:
    return result.data;
  };
}