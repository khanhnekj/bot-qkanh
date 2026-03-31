import FormData from "form-data";
import fs from "node:fs";
import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, getFullTimeFromMilisecond, getImageMetaData, handleZaloResponse, request, makeURL } from "../utils.js";
import { Zalo } from "../index.js";

export function changeGroupAvatarFactory(api) {
    const serviceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/upavatar`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
    });
    /**
     * Change group avatar
     *
     * @param groupId Group ID
     * @param avatarPath Path to the image file
     *
     * @throws ZaloApiError
     */
    return async function changeGroupAvatar(groupId, avatarPath) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Missing required app context fields");
        if (!groupId) throw new ZaloApiError("Missing groupId");
        if (!avatarPath) throw new ZaloApiError("Missing avatarPath");
        const params = {
            grid: groupId,
            avatarSize: 120,
            clientId: `g${groupId}${getFullTimeFromMilisecond(new Date().getTime())}`,
            imei: appContext.imei,
        };
        const imageMetaData = await getImageMetaData(avatarPath);
        params.originWidth = imageMetaData.width || 1080;
        params.originHeight = imageMetaData.height || 1080;
        const formData = new FormData();
        formData.append("fileContent", fs.readFileSync(avatarPath), {
            filename: "blob",
            contentType: "image/jpeg",
        });
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");
        const response = await request(serviceURL + `&params=${encodeURIComponent(encryptedParams)}`, {
            method: "POST",
            headers: formData.getHeaders(),
            body: formData.getBuffer(),
        });
        const result = await handleZaloResponse(response);
        if (result.error)
            throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
    };
}
