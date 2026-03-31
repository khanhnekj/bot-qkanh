import fs from "fs";
import sharp from "sharp";
import FormData from "form-data";
import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";

export function uploadThumbnailFactory(api) {
	const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/upthumb`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
		nretry: "0",
	});

	const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/upthumb`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
		nretry: "0",
	});

	/**
	 * Upload thumbnail
	 * @param {string} filePath Đường dẫn đến file	
	 * @returns {Promise<object>} Kết quả trả về từ API
	 */
	return async function uploadThumbnail(filePath) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
		if (!filePath) throw new ZaloApiError("Missing file path");

		let formData = new FormData();
		let fileHandle;
		try {
			fileHandle = await fs.promises.open(filePath, 'r');
			const fileContent = await fileHandle.readFile();
			let buffer = await sharp(fileContent).png().toBuffer();
			formData.append("fileContent", buffer, {
				filename: "blob",
				contentType: "image/png",
			});
		} finally {
			if (fileHandle) await fileHandle.close();
		}

		const params = {
			clientId: Date.now(),
			imei: appContext.imei,
		};
		const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
		if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

		let response = await request(
			makeURL(directMessageServiceURL + "upthumb?", {
				zpw_ver: Zalo.API_VERSION,
				zpw_type: Zalo.API_TYPE,
				params: encryptedParams,
			}),
			{
				method: "POST",
				headers: formData.getHeaders(),
				body: formData.getBuffer(),
			}
		);
		const result = await handleZaloResponse(response);
		if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
		return result.data;
	};
} 