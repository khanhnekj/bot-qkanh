import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";
import { MessageType } from "../models/Message.js";
import { getImageInfo } from "../../utils/util.js";

export function sendImageFactory(api) {
	const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/photo_original/send`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
		nretry: "0",
	});

	const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/photo_original/send`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
		nretry: "0",
	});

	/**
	 * Gửi ảnh từ URL
	 * 
	 * @param {string} imageUrl URL của ảnh
	 * @param {object} message Tin Nhắn
	 * @param {string} caption Tiêu đề của ảnh
	 * @param {number} [ttl=0] Ttl của tin nhắn
	 * @throws {ZaloApiError}
	 */
	return async function sendImage(imageUrl, message, caption = "", ttl = 0) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");

		// Handle both: sendImage(url, ctx, caption) and sendImage({ imageUrl, threadId, threadType, width, height, msg, mentions })
		let paramsObj = {};
		if (typeof imageUrl === "object" && imageUrl !== null) {
			paramsObj = imageUrl;
		} else {
			paramsObj = { imageUrl, threadId: message.threadId, threadType: message.type, msg: caption, ttl };
		}

		if (!paramsObj.imageUrl) throw new ZaloApiError("Missing image URL");

		let finalWidth = paramsObj.width;
		let finalHeight = paramsObj.height;
		let finalSize = "0";

		if (!finalWidth || !finalHeight) {
			const info = await getImageInfo(paramsObj.imageUrl);
			if (info) {
				finalWidth = info.width;
				finalHeight = info.height;
				finalSize = String(info.totalSize || 0);
			}
		}

		const clientId = Date.now().toString();
		const params = {
			photoId: Math.floor(Date.now() / 1000),
			clientId: clientId,
			desc: paramsObj.msg || paramsObj.caption || "",
			width: finalWidth || 800,
			height: finalHeight || 500,
			rawUrl: paramsObj.imageUrl,
			thumbUrl: paramsObj.imageUrl,
			hdUrl: paramsObj.imageUrl,
			toid: paramsObj.threadType === MessageType.DirectMessage ? String(paramsObj.threadId) : undefined,
			grid: paramsObj.threadType === MessageType.GroupMessage ? String(paramsObj.threadId) : undefined,
			oriUrl: paramsObj.threadType === MessageType.GroupMessage ? paramsObj.imageUrl : undefined,
			normalUrl: paramsObj.threadType === MessageType.DirectMessage ? paramsObj.imageUrl : undefined,
			hdSize: finalSize,
			zsource: -1,
			jcp: JSON.stringify({ sendSource: 1, convertible: "jxl" }),
			ttl: paramsObj.ttl || 0,
			imei: appContext.imei
		};

		if (paramsObj.mentions) {
			params.mentionInfo = JSON.stringify(paramsObj.mentions);
		}

		const url = paramsObj.threadType === MessageType.GroupMessage ? groupMessageServiceURL : directMessageServiceURL;

		const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
		if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

		const response = await request(url, {
			method: "POST",
			body: new URLSearchParams({ params: encryptedParams }),
		});

		const result = await handleZaloResponse(response);
		if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
		return result.data;
	};
} 