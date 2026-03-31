import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function unblockUsersInGroupFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/blockedmems/remove`, {
    zpw_ver: 671,
    zpw_type: 30,
  });

  return async function unblockUsersInGroup(groupId, members) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    if (!groupId) throw new ZaloApiError("Missing groupId");
    if (!members) throw new ZaloApiError("Missing members");

    members = Array.isArray(members) ? members.map(String) : [String(members)];

    const params = {
      grid: String(groupId),
      members: members,
    };

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

    const response = await request(makeURL(serviceURL, { params: encryptedParams }), {
      method: "GET",
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
    return result.data;
  };
}
