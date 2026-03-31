import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";

export function getStickersFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.sticker}/api/message/sticker`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });
    /**
     * Get stickers by keyword
     *
     * @param keyword Keyword to search for
     * @returns Sticker IDs
     *
     * @throws ZaloApiError
     */
    return async function getStickers(keyword) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
          throw new ZaloApiError("Missing required app context fields");
        if (!keyword) throw new ZaloApiError("Missing keyword");
        const params = {
            keyword: keyword,
            gif: 1,
            guggy: 0,
            imei: appContext.imei,
        };
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt message");
        const finalServiceUrl = new URL(serviceURL);
        finalServiceUrl.pathname = finalServiceUrl.pathname + "/suggest/stickers";
        const response = await request(makeURL(finalServiceUrl.toString(), {
            params: encryptedParams,
        }));
        const result = await handleZaloResponse(response);
        if (result.error)
            throw new ZaloApiError(result.error.message, result.error.code);
        const suggestions = result.data;
        const stickerIds = [];
        // @TODO: Implement these
        // suggestions.sugg_guggy, suggestions.sugg_gif
        if (suggestions.sugg_sticker)
            suggestions.sugg_sticker.forEach((sticker) => stickerIds.push(sticker.sticker_id));
        return stickerIds;
    };
}
