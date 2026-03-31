import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";
import { MessageType } from "../models/Message.js";

export function sendLinkFactory(api) {
  const serviceURLs = {
    [MessageType.DirectMessage]: makeURL(`${api.zpwServiceMap.chat[0]}/api/message/link`, {
      zpw_ver: Zalo.API_VERSION,
      zpw_type: Zalo.API_TYPE,
      nretry: 0,
    }),
    [MessageType.GroupMessage]: makeURL(`${api.zpwServiceMap.group[0]}/api/group/sendlink`, {
      zpw_ver: Zalo.API_VERSION,
      zpw_type: Zalo.API_TYPE,
      nretry: 0,
    }),
  };
  /**
   * Gửi link đến một thread
   * 
   * @param {String} content Nội dung tin nhắn
   * @param {String} link Link URL
   * @param {number} threadId ID của người dùng/nhóm
   * @param {MessageType} type Loại thread (DirectMessage/GroupMessage)
   * @param {number} ttl Thời gian tự hủy tin nhắn (tùy chọn)
   * @throws {ZaloApiError}
   */
  return async function sendLink(content, link, threadId, type = MessageType.DirectMessage, ttl = 0) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
    if (!link) throw new ZaloApiError("Missing link");
    if (!threadId) throw new ZaloApiError("Missing threadId");
    const linkData = await api.parseLink(link);
    if (!linkData) throw new ZaloApiError("Invalid link");
    const isGroupMessage = type === MessageType.GroupMessage;

    const params = {
      msg: content || "",
      href: linkData.data.href,
      src: linkData.data.src || new URL(linkData.data.href).hostname,
      title: linkData.data.title || "",
      desc: linkData.data.desc || "",
      thumb: linkData.data.thumb || "",
      type: 0,
      media: JSON.stringify({
        type: linkData.data.media.type,
        count: linkData.data.media.count,
        mediaTitle: linkData.data.media.mediaTitle,
        artist: linkData.data.media.artist,
        streamUrl: linkData.data.media.streamUrl,
        stream_icon: linkData.data.media.stream_icon,
      }),
      ttl: ttl,
      clientId: Date.now(),
      mentionInfo: linkData.data.mentions ? JSON.stringify(linkData.data.mentions) : isGroupMessage ? "[]" : "",
    };

    if (isGroupMessage) {
      params.grid = String(threadId);
      params.imei = appContext.imei;
      params.visibility = 0;
    } else {
      params.toId = String(threadId);
    }

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

    const response = await request(serviceURLs[type], {
      method: "POST",
      body: new URLSearchParams({ params: encryptedParams }),
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

    return result.data;
  };
} 