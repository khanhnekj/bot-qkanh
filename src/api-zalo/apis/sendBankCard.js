import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function sendBankCardFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.zimsg[0]}/api/transfer/card`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Gửi thông tin thẻ ngân hàng đến một cuộc trò chuyện
   *
   * @param {Object} message Thông tin tin nhắn
   * @param {string|number} message.threadId ID của người dùng/nhóm
   * @param {number} message.type Loại tin nhắn (DirectMessage/GroupMessage)
   * @param {string} binBank Mã BIN của ngân hàng
   * @param {string} accountNumber Số tài khoản
   * @param {string} accountName Tên chủ tài khoản  
   * @throws {ZaloApiError}
   */
  return async function sendBankCard(message, binBank, accountNumber, accountName) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
    if (!message) throw new ZaloApiError("Missing message");
    if (!binBank) throw new ZaloApiError("Missing binBank");
    if (!accountNumber) throw new ZaloApiError("Missing accountNumber");
    if (!accountName) throw new ZaloApiError("Missing accountName");

    const params = {
      binBank: parseInt(binBank),
      numAccBank: accountNumber,
      nameAccBank: accountName,
      cliMsgId: message.data.cliMsgId,
      tsMsg: message.data.ts,
      destUid: message.threadId,
      destType: message.type
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