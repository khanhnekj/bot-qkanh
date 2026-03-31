import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";

export function getAvatarUrlProfileFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.chat[0]}/api/message/get-avatar`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Lấy URL ảnh đại diện gốc của người dùng
     *
     * @param {string} userId ID của người dùng
     * @param {number} size Kích thước ảnh (thường 240, 480, 1024)
     * @throws {ZaloApiError}
     */
    return async function getAvatarUrlProfile(userId, size = 1024) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");
        if (!userId) throw new ZaloApiError("Missing userId");

        const params = {
            uid: String(userId),
            size: Number(size),
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

        return result.data?.url || result.data;
    };
}
