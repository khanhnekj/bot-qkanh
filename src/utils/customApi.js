import { readFileSync, statSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { ThreadType } from "../api-zalo/index.js";
import ffmpeg from "fluent-ffmpeg";
import { tempDir } from "./io-json.js";

export function registerCustomApi(api, log) {
    api.custom("uploadVoice", async ({ ctx, utils, props }) => {
        const { filePath, threadId, threadType } = props;
        const results = await api.uploadAttachment(filePath, threadId, threadType);
        if (!results || results.length === 0) throw new Error("Upload attachment thất bại.");
        const result = results[0];
        return { voiceId: result.fileId, voiceUrl: result.fileUrl || result.url };
    });

    api.custom("sendVoiceNative", async ({ ctx, utils, props }) => {
        const { voiceUrl, threadId, threadType, duration = 0, fileSize = 0, ttl = 1800000 } = props;
        const isGroup = threadType === ThreadType.Group;
        const clientId = Date.now().toString();
        const msgInfo = { voiceUrl: String(voiceUrl), m4aUrl: String(voiceUrl), fileSize: Number(fileSize) || 0, duration: Number(duration) || 0 };
        const params = isGroup ? { grid: threadId.toString(), visibility: 0, ttl: Number(ttl), zsource: -1, msgType: 3, clientId, msgInfo: JSON.stringify(msgInfo), imei: ctx.imei }
            : { toId: threadId.toString(), ttl: Number(ttl), zsource: -1, msgType: 3, clientId, msgInfo: JSON.stringify(msgInfo), imei: ctx.imei };
        const serviceURL = isGroup ? utils.makeURL(`${api.zpwServiceMap.file[0]}/api/group/forward`) : utils.makeURL(`${api.zpwServiceMap.file[0]}/api/message/forward`);
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        const response = await utils.request(utils.makeURL(serviceURL, { zpw_ver: ctx.API_VERSION, zpw_type: ctx.API_TYPE, nretry: "0" }), { method: "POST", body: new URLSearchParams({ params: encryptedParams }) });
        const result = await utils.resolve(response);
        if (result.error) throw new Error(result.error.message || "Lỗi gửi VoiceNative");
        return result.data || result;
    });

    api.custom("sendVoiceUnified", async ({ ctx, utils, props }) => {
        const { filePath, threadId, threadType } = props;
        let finalPath = filePath, tempFile = null;
        try {
            const ext = path.extname(filePath).toLowerCase();
            if (ext !== ".aac" && ext !== ".m4a") {
                tempFile = path.join(tempDir, `voice_${Date.now()}.aac`);
                await new Promise((resolve, reject) => { ffmpeg(filePath).audioCodec('aac').audioBitrate('128k').on('end', resolve).on('error', reject).save(tempFile); });
                finalPath = tempFile;
            }
            const metadata = await new Promise((resolve, reject) => { ffmpeg.ffprobe(finalPath, (err, meta) => err ? reject(err) : resolve(meta)); });
            const duration = Math.round((metadata.format.duration || 0) * 1000);
            const fileSize = metadata.format.size || statSync(finalPath).size;
            const uploadResults = await api.uploadAttachment(finalPath, threadId, threadType);
            if (!uploadResults || uploadResults.length === 0) throw new Error("Upload lên Zalo thất bại.");
            let remoteUrl = uploadResults[0].fileUrl || uploadResults[0].url;
            if (!remoteUrl.endsWith(".aac")) remoteUrl += `/${Date.now()}.aac`;
            try {
                await api.sendVoiceNative({ voiceUrl: remoteUrl, duration, fileSize, threadId, threadType });
            } catch (err) {
                await api.sendVoice({ voiceUrl: remoteUrl, ttl: 0 }, threadId, threadType);
            }
        } catch (e) { throw e; } finally { if (tempFile && existsSync(tempFile)) try { unlinkSync(tempFile); } catch { } }
    });


    api.custom("sendImageEnhanced", async ({ ctx, utils, props }) => {
        const { imageUrl, threadId, threadType, width = 720, height = 1280, msg = "" } = props;
        const isGroup = threadType === ThreadType.Group;
        const payload = { clientId: Date.now().toString(), desc: msg, oriUrl: String(imageUrl), thumbUrl: String(imageUrl), hdUrl: String(imageUrl), normalUrl: String(imageUrl), url: String(imageUrl), width: Number(width), height: Number(height), zsource: -1, ttl: 0 };
        if (isGroup) { payload.grid = threadId.toString(); payload.visibility = 0; } else { payload.toId = threadId.toString(); }
        let baseUrl = isGroup ? `${api.zpwServiceMap.file[0]}/api/group/photo_url` : `${api.zpwServiceMap.file[0]}/api/message/photo_url`;
        if (!baseUrl.startsWith("http")) baseUrl = "https://" + baseUrl;
        const encryptedParams = utils.encodeAES(JSON.stringify(payload));
        const res = await utils.request(utils.makeURL(baseUrl, { zpw_ver: ctx.API_VERSION, zpw_type: ctx.API_TYPE, nretry: "0" }), { method: "POST", body: new URLSearchParams({ params: encryptedParams }) });
        const result = await utils.resolve(res);
        if (result.error) throw new Error(result.error.message);
        return result.data || result;
    });

    api.custom("sendVideoEnhanced", async ({ ctx, utils, props }) => {
        const { videoUrl, thumbnailUrl, duration = 0, width = 720, height = 1280, fileSize, msg, threadId, threadType } = props;
        const isGroup = threadType === ThreadType.Group;
        const clientId = Date.now();
        const msgInfo = JSON.stringify({ videoUrl, thumbUrl: thumbnailUrl, duration: Math.floor(Number(duration) || 0), width: Math.floor(Number(width) || 720), height: Math.floor(Number(height) || 1280), fileSize: Math.floor(Number(fileSize) || 0), properties: { color: -1, size: -1, type: 1003, subType: 0, ext: { sSrcType: -1, sSrcStr: "", msg_warning_type: 0 } }, title: msg || "" });
        const params = isGroup ? { grid: threadId, visibility: 0, clientId: String(clientId), ttl: 0, zsource: 704, msgType: 5, msgInfo, imei: ctx.imei }
            : { toId: threadId, clientId: String(clientId), ttl: 0, zsource: 704, msgType: 5, msgInfo, imei: ctx.imei, title: msg || "" };
        const serviceURL = isGroup ? utils.makeURL(`${api.zpwServiceMap.file[0]}/api/group/forward`, { zpw_ver: 649, zpw_type: 30, nretry: 0 })
            : utils.makeURL(`${api.zpwServiceMap.file[0]}/api/message/forward`, { zpw_ver: 649, zpw_type: 30, nretry: 0 });
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        const response = await utils.request(serviceURL, { method: "POST", body: new URLSearchParams({ params: encryptedParams }) });
        return await utils.resolve(response);
    });

    api.custom("sendVideoUnified", async ({ ctx, utils, props }) => {
        const { videoPath, videoUrl, thumbnailUrl, msg, threadId, threadType } = props;
        let finalUrl = videoUrl, finalThumb = thumbnailUrl || "https://drive.google.com/uc?id=1pCQPRic8xPxbgUaPSIczb94S4RDdWDHK&export=download";
        let duration = 0, width = 720, height = 1280, fileSize = 0;
        if (videoPath && existsSync(videoPath)) {
            const metadata = await new Promise((resolve, reject) => { ffmpeg.ffprobe(videoPath, (err, meta) => err ? reject(err) : resolve(meta)); });
            duration = Math.round((metadata.format.duration || 0) * 1000);
            fileSize = metadata.format.size || statSync(videoPath).size;
            const stream = metadata.streams.find(s => s.width && s.height);
            if (stream) { width = stream.width; height = stream.height; }
            const uploadResults = await api.uploadAttachment(videoPath, threadId, threadType);
            if (!uploadResults || uploadResults.length === 0) throw new Error("Không thể upload video lên Zalo CDN");
            finalUrl = uploadResults[0].fileUrl || uploadResults[0].url;
        }
        return await api.sendVideoEnhanced({ videoUrl: finalUrl, thumbnailUrl: finalThumb, duration: Math.floor(Number(duration) || 0), width: Number(width) || 720, height: Number(height) || 1280, fileSize: Math.floor(Number(fileSize) || 0) || 1024, msg, threadId, threadType });
    });
}
