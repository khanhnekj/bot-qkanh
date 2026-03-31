import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";

export function findUserFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/profile/get`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });
    /**
     * Find user by phone number
     *
     * @param phoneNumber Phone number
     *
     * @throws ZaloApiError
     */
    return async function findUser(phoneNumber, avatarSize = 240) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");
        if (!phoneNumber) throw new ZaloApiError("Missing phoneNumber");
        if (phoneNumber.startsWith("0")) {
            if (appContext.language == "vi")
                phoneNumber = "84" + phoneNumber.slice(1);
        }
        const params = {
            phone: phoneNumber,
            avatar_size: Number(avatarSize),
            language: appContext.language,
            imei: appContext.imei,
            reqSrc: 40,
        };
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt message");
        const finalServiceUrl = new URL(serviceURL);
        finalServiceUrl.searchParams.append("params", encryptedParams);
        const response = await request(makeURL(finalServiceUrl.toString(), {
            params: encryptedParams,
        }));
        const result = await handleZaloResponse(response);
        if (result.error && result.error.code != 216)
            throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
    };
}
