import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";

export function searchStickerFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.sticker[0]}/api/sticker/search`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });

    /**
     * Tìm kiếm Sticker theo từ khóa
     *
     * @param {string} keyword Từ khóa tìm kiếm
     * @throws {ZaloApiError}
     */
    return async function searchSticker(keyword) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");
        if (!keyword) throw new ZaloApiError("Missing keyword");

        const params = {
            keyword: String(keyword),
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
