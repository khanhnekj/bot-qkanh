import { MessageType } from "../index.js";
import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { Zalo } from "../zalo.js";
import { encodeAES, handleZaloResponse, request, makeURL, removeUndefinedKeys, getGifDimensions } from "../utils.js";
import path from 'path';
import { deleteFile, downloadFile } from "../../utils/util.js";
import { tempDir } from "../../utils/io-json.js";

async function processGif(gifUrl, api) {
    const tempGifPath = path.join(tempDir, `${gifUrl.split('/').pop()}.gif`);
    try {
        await downloadFile(gifUrl, tempGifPath);

        const dimensions = await getGifDimensions(tempGifPath);
        const thumbData = await api.uploadThumbnail(tempGifPath);

        return {
            thumbUrl: thumbData.url,
            width: dimensions.width,
            height: dimensions.height
        };
    } catch (error) {
        throw new ZaloApiError(`Failed to process GIF: ${error.message}`);
    } finally {
        deleteFile(tempGifPath);
    }
}

export function sendGifFactory(api) {
    const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/gif`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        nretry: "0",
    });

    const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/gif`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        nretry: "0",
    });

    /**
     * Gửi GIF Remote
     * 
     * @param {string} gifUrl URL của file GIF
     * @param {string} message Tin nhắn kèm theo (tùy chọn)
     * @param {number} [ttl=0] Thời gian tồn tại của tin nhắn
     * @throws {ZaloApiError}
     */
    return async function sendGif(gifUrl, message, caption = "", ttl = 0) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
        if (!gifUrl) throw new ZaloApiError("Missing GIF URL");
        if (!message) throw new ZaloApiError("Missing message");

        const { thumbUrl, width, height } = await processGif(gifUrl, api);

        const threadId = message.threadId;
        const threadType = message.type;
        const contentId = Date.now().toString();
        const clientId = Date.now().toString();

        const params = {
            thumb: thumbUrl,
            width: Number(width),
            height: Number(height),
            msg: caption,
            type: 0,
            href: gifUrl,
            contentId: contentId,
            src: 1,
            ttl: ttl,
            clientId: clientId,
            imei: appContext.imei
        };

        let url;
        if (threadType === MessageType.DirectMessage) {
            url = directMessageServiceURL;
            params.toId = String(threadId);
        } else if (threadType === MessageType.GroupMessage) {
            url = groupMessageServiceURL;
            params.visibility = 0;
            params.grid = String(threadId);
        } else {
            throw new ZaloApiError("Thread type is invalid");
        }

        removeUndefinedKeys(params);

        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

        const response = await request(url, {
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