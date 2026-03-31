import { appContext } from "../context.js";
import { ZaloApiError } from "../index.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function createGroupFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/create/v2`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });
    /**
     * Create a new group
     *
     * @param options Group options
     *
     * @throws ZaloApiError
     */
    return async function createGroup(options) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");
        if (!options.name) throw new ZaloApiError("Missing name");
        if (!options.members) throw new ZaloApiError("Missing members");
        if (!Array.isArray(options.members))
            options.members = [options.members];
        if (options.members.length == 0)
            throw new ZaloApiError("Group must have at least one member");
        const params = {
            clientId: Date.now(),
            gname: String(Date.now()),
            gdesc: null,
            members: options.members,
            membersTypes: options.members.map(() => -1),
            nameChanged: 0,
            createLink: 1,
            clientLang: appContext.language,
            imei: appContext.imei,
            zsource: 601,
        };
        if (options.name && options.name.length > 0) {
            params.gname = options.name;
            params.nameChanged = 1;
        }
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt message");
        const response = await request(serviceURL + `&params=${encodeURIComponent(encryptedParams)}`, {
            method: "POST",
        });
        const createGroupResult = await handleZaloResponse(response);
        if (createGroupResult.error)
            throw new ZaloApiError(createGroupResult.error.message, createGroupResult.error.code);
        const data = createGroupResult.data;
        if (options.avatarPath)
            await api.changeGroupAvatar(data.groupId, options.avatarPath).catch(console.error);
        return data;
    };
}
