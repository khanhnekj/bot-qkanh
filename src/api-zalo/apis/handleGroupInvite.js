import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function handleGroupInviteFactory(api) {
  return async function handleGroupInvite(groupId, isAccept = true) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");

    const endpoint = isAccept ? "join" : "delete";
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/inv-box/${endpoint}`, {
      zpw_ver: Zalo.API_VERSION,
      zpw_type: Zalo.API_TYPE,
    });

    const params = {
      grid: String(groupId),
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
    if (result.error) {
      // "Waiting for approve" = nhóm cần duyệt, không phải lỗi thực sự
      const msg = result.error.message || "";
      if (msg.toLowerCase().includes("waiting") || result.error.code === 240) {
        return { status: "pending", message: "Đã gửi yêu cầu, đang chờ admin nhóm duyệt." };
      }
      throw new ZaloApiError(result.error.message, result.error.code);
    }

    return { status: "joined", data: result.data };
  };
}
