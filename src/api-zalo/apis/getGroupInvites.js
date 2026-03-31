import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function getGroupInvitesFactory(api) {
  return async function getGroupInvites(mpage = 1, page = 0, invPerPage = 12) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");

    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/inv-box/list`, {
      zpw_ver: Zalo.API_VERSION,
      zpw_type: Zalo.API_TYPE,
    });

    const params = {
      mpage: Number(mpage),
      page: Number(page),
      invPerPage: Number(invPerPage),
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
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

    return result.data;
  };
}
