import { Zalo, ZaloApiError, MessageType } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function sendBusinessCardFactory(api) {
  const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/forward`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });
  const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/forward`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Gửi danh thiếp (business card) đến một cuộc trò chuyện
   *
   * @param {Message} message Tin nhắn đến
   * @param {string|number} userId ID người dùng của danh thiếp
   * @param {string|number} [phone] Số điện thoại kèm theo danh thiếp (tùy chọn)
   * @param {number} [ttl=0] Thời gian tồn tại của tin nhắn (tùy chọn)
   * @throws {ZaloApiError}
   */
  return async function sendBusinessCard(message, userId, phone, type, threadId, ttl = 0) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
    if (!userId) throw new ZaloApiError("Missing userId");
    
    type = message ? message.type : type;
    threadId = message ? message.threadId : threadId;

    const qrCodeUrl = await api.getQRLink(userId);
    if (!qrCodeUrl[userId.toString()]) throw new ZaloApiError("QR Code URL not found");

    const params = {
      ttl: ttl,
      msgType: 6,
      clientId: Date.now().toString(),
      msgInfo: {
        contactUid: userId.toString(),
        qrCodeUrl: qrCodeUrl[userId.toString()],
      }
    };

    if (phone) {
      params.msgInfo.phone = phone.toString();
    }

    if (type === MessageType.DirectMessage) {
      params.toId = threadId.toString();
      params.imei = appContext.imei;
    } else {
      params.visibility = 0;
      params.grid = threadId.toString();
    }

    params.msgInfo = JSON.stringify(params.msgInfo);

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

    const serviceURL = type === MessageType.DirectMessage ? directMessageServiceURL : groupMessageServiceURL;

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
