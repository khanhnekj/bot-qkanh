import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { MessageType } from "../models/Message.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../zalo.js";

export function sendForwardFactory(api) {
	const attachmentDirectForwardURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/forward`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
		nretry: "0"
	});
	const attachmentGroupForwardURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/forward`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
		nretry: "0"
	});
	/**
	   * Gửi tin nhắn chuyển tiếp
	   *
	   * @param {Message} message Nội Dung Tin Nhắn
	   * @param {string|number} threadId ID Cuộc Trò Chuyện Sẽ Được Chuyển Tiếp
	   * @param {number} [ttl=0] Thời gian tồn tại của tin nhắn (tùy chọn)
	   * @throws {ZaloApiError}
	   */
	return async function sendForward(message, threadId, type, ttl = 0) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
		if (!message) throw new ZaloApiError("Missing message");
		if (!threadId) throw new ZaloApiError("Missing threadId");
		if (!type) throw new ZaloApiError("Missing type");

		let params;
		let url;
		if (message.imageObject) {
			params = {
				ttl: ttl,
				zsource: 704,
				msgType: "2",
				clientId: Date.now().toString(),
				msgInfo: JSON.stringify({
					title: message.title || "",
					oriUrl: message.imageObject.normalUrl,
					thumbUrl: message.imageObject.thumbUrl,
					hdUrl: message.imageObject.hdUrl,
					width: message.imageObject.width || 400,
					height: message.imageObject.height || 400,
					properties: null,
					hdSize: message.imageObject.totalSize || 0,
					url: message.imageObject.normalUrl + "?jxlstatus=1",
					normalUrl: message.imageObject.normalUrl
				})
			};
		} else if (message.videoObject) {
			params = {
				ttl: ttl,
				zsource: 704,
				msgType: "5",
				clientId: Date.now().toString(),
				msgInfo: JSON.stringify({
					videoUrl: message.videoObject.fileUrl,
					thumbUrl: message.videoObject.thumbnailUrl,
					duration: message.videoObject.duration,
					width: message.videoObject.width || 540,
					height: message.videoObject.height || 960,
					fileSize: message.videoObject.totalSize,
					properties: null,
					title: message.title || ""
				})
			}
		}
		if (message.type === MessageType.DirectMessage) {
			url = attachmentDirectForwardURL;
            params.toId = String(threadId);
		} else {
			url = attachmentGroupForwardURL;
            params.visibility = 0;
            params.grid = String(threadId);
		}
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