import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { MessageType } from "../models/Message.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../zalo.js";

export function sendMessageForwardFactory(api) {
	const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/mforward`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
	});
	const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/mforward`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
	});
	/**
	   * Gửi tin nhắn chuyển tiếp
	   *
	   * @param {Message} message Nội Dung Tin Nhắn
	   * @param {string|number} threadId ID Cuộc Trò Chuyện Sẽ Được Chuyển Tiếp
	   * @param {number} [ttl=0] Thời gian tồn tại của tin nhắn (tùy chọn)
	   * @throws {ZaloApiError}
	   */
	return async function sendMessageForward(message, threadId, type, ttl = 0) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
		if (!message) throw new ZaloApiError("Missing message");
		if (!threadId) throw new ZaloApiError("Missing threadId");
		if (!type) throw new ZaloApiError("Missing type");

		let params;
		if (message.link) {
			const linkData = await api.parseLink(message.link);
			params = {
				grids: [{
					clientId: Date.now(),
					ttl: ttl
				}],
				ttl: ttl,
				msgType: '3',
				totalIds: 1,
				msgInfo: JSON.stringify({
					link: linkData.data.href,
					linkTitle: message.title || linkData.data.title || "",
					linkDesc: message.desc || linkData.data.desc || "",
					linkThumb: message.thumb || linkData.data.thumb || "",
					linkType: "",
					message: message.msg || "",
					extData: JSON.stringify({
						redirect_url: "",
						src: linkData.data.src || new URL(linkData.data.href).hostname,
						mediaTitle: linkData.data.media.mediaTitle || "",
						streamUrl: linkData.data.media.streamUrl || "",
						type: linkData.data.media.type || 0,
						linkType: 0,
						artist: linkData.data.media.artist || "",
						count: linkData.data.media.count || "",
						stream_icon: linkData.data.media.stream_icon || "",
						mediaId: linkData.data.media.mediaId || "",
						video_duration: 0,
						arid: 0,
						href: message.link,
						tType: 1,
						tWidth: 0,
						tHeight: 0,
						brand_name: "Zalo Video",
						local_path_thumb_link: "",
						thumb_renew: message.thumb || linkData.data.thumb,
						thumb_src_type: 1,
						width: 250,
						height: 250
					}),
				})
			};
		} else {
			params = {
				grids: [{
					clientId: Date.now(),
					ttl: ttl
				}],
				ttl: ttl,
				msgType: '1',
				totalIds: 1,
				msgInfo: JSON.stringify({
					message: message.msg,
					...(message.style && { rtfProps: message.style })
				})
			};
		}

		let url;
		if (type === MessageType.DirectMessage) {
			url = directMessageServiceURL;
			params.toIds = params.grids;
			delete params.grids;
			params.toIds[0].toUid = threadId.toString();
			params.toIds.imei = appContext.imei;
		} else if (type === MessageType.GroupMessage) {
			url = groupMessageServiceURL;
			params.visibility = 0;
			params.grids[0].grid = threadId.toString();
			params.grids[0].imei = appContext.imei;
		} else {
			throw new Error("Invalid thread type");
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