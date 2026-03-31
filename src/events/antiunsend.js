import { messageCache } from "../utils/messageCache.js";
import { protectionManager } from "../utils/protectionManager.js";
import { log } from "../logger.js";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";

export const name = "antiunsend";
export const description = "Tự động gửi lại tin nhắn khi có người thu hồi (Anti-Unsend)";

// ─── Helper: lấy tên hiển thị ─────────────────────────────────────────────────
async function getDisplayName(api, uid) {
    try {
        const info = await api.getUserInfo(uid);
        const u = info?.[uid] || info?.[String(uid)] || info;
        return u?.displayName || u?.zaloName || u?.name || String(uid);
    } catch {
        return String(uid);
    }
}

// ─── Helper: download file về disk ────────────────────────────────────────────
function downloadFile(url, destPath) {
    return new Promise((resolve) => {
        try {
            const proto = url.startsWith("https") ? https : http;
            const file = fs.createWriteStream(destPath);
            proto.get(url, (res) => {
                if (res.statusCode !== 200) { file.close(); resolve(null); return; }
                res.pipe(file);
                file.on("finish", () => { file.close(); resolve(destPath); });
            }).on("error", () => { file.close(); resolve(null); });
        } catch { resolve(null); }
    });
}

// ─── Helper: parse params (JSON hoặc query-string) ───────────────────────────
function parseParams(params) {
    if (!params) return {};
    if (typeof params === "object") return params;
    try { return JSON.parse(params); } catch { }
    try { return Object.fromEntries(new URLSearchParams(params)); } catch { }
    return {};
}

// ─── Helper: build notify message ─────────────────────────────────────────────
function buildNotify(label, authorName, authorId, extra = "") {
    const header = `[ UNDO ${label} ]`;
    const authorTag = `@${authorName}`;
    const line1 = `➜ ${header}`;
    const line2 = `${authorTag} vừa thu hồi một ${label.toLowerCase()}.`;
    const text = extra ? `${line1}\n${line2}\n${extra}` : `${line1}\n${line2}`;

    const headerStart = 2; // "➜ " = 2 chars
    const styles = [
        { start: headerStart, len: header.length, st: "b,c_db342e,f_18" }
    ];
    const mentionPos = text.indexOf(authorTag);
    const mentions = mentionPos >= 0
        ? [{ uid: String(authorId), pos: mentionPos, len: authorTag.length }]
        : [];
    return { text, styles, mentions };
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export async function handleUndo(ctx) {
    const { api, threadId, threadType, senderId: authorId, msgId, cliMsgId, log: ctxLog } = ctx;
    const logger = ctxLog || log;

    // 1. Kiểm tra AntiUndo có bật không
    if (!protectionManager.isEnabled(threadId, "undo")) return;

    // 2. Không bắt tin của chính mình hoặc Admin (để Admin có quyền xóa)
    const ownId = api.getOwnId();
    const { adminIds = [] } = ctx;
    if (String(authorId) === String(ownId) || adminIds.includes(String(authorId))) return;

    // 3. Tìm tin gốc trong cache
    const cached = messageCache.get(msgId) || messageCache.get(cliMsgId);

    if (!cached) {
        logger.warn(`[AntiUndo] ❌ Không tìm thấy tin gốc trong cache. msgId=${msgId}, cliMsgId=${cliMsgId}`);
        // Vẫn thông báo dù không có nội dung
        try {
            const authorName = await getDisplayName(api, authorId) || String(authorId);
            const { text, styles, mentions } = buildNotify("TIN NHẮN", authorName, authorId,
                "➜ (Không có trong cache - tin nhắn quá cũ hoặc bot chưa thấy)");
            await api.sendMessage({ msg: text, mentions, styles }, threadId, threadType);
        } catch (e) {
            logger.error(`[AntiUndo] Lỗi gửi thông báo fallback: ${e.message}`);
        }
        return;
    }

    const { senderId: cachedSenderId, senderName: rawName, content: originalText, data: originalData } = cached;
    const resolvedSenderId = cachedSenderId || authorId;

    // 3. Lấy tên hiển thị
    let authorName = rawName || String(resolvedSenderId);
    try { authorName = await getDisplayName(api, resolvedSenderId) || authorName; } catch { }

    // 4. Phân tích loại tin nhắn
    const msgType    = originalData?.msgType || "";
    const rawContent = originalData?.content;
    const rawAttach  = originalData?.attach;  // Zalo để sticker/media ở đây thay vì content

    // content có thể là string JSON (sticker, file...) → parse ra object
    let c = {};
    if (typeof rawContent === "object" && rawContent !== null) {
        c = rawContent;
    } else if (typeof rawContent === "string") {
        try { c = JSON.parse(rawContent); } catch { c = {}; }
    }

    // attach cũng có thể chứa sticker id/catId
    let attach = {};
    if (typeof rawAttach === "object" && rawAttach !== null) {
        attach = rawAttach;
    } else if (typeof rawAttach === "string") {
        try { attach = JSON.parse(rawAttach); } catch { attach = {}; }
    }

    // Sticker id/catId: tìm ở cả c và attach
    const stickerId  = c?.id  || attach?.id  || c?.stickerID  || attach?.stickerID;
    const stickerCat = c?.catId || attach?.catId || c?.catID || attach?.catID;

    const extra      = c?.extra || attach?.extra || {};
    const rawParams  = c?.params || attach?.params || originalData?.params || "";
    const parsedParams = parseParams(rawParams);


    // ── VIDEO ──────────────────────────────────────────────────────────────────
    const isVideo = msgType.startsWith("chat.video")
        || !!extra?.videoUrl || !!c?.videoUrl
        || ("video_width" in parsedParams);

    if (isVideo) {
        const videoUrl = extra?.videoUrl || c?.videoUrl || c?.href;
        const thumbUrl = extra?.thumbUrl  || c?.thumb   || videoUrl;
        const duration = Number(parsedParams?.duration || extra?.duration || 0);
        const width    = Number(parsedParams?.video_width  || extra?.width  || 720);
        const height   = Number(parsedParams?.video_height || extra?.height || 1280);

        if (videoUrl) {
            try {
                const { text, styles, mentions } = buildNotify("VIDEO", authorName, resolvedSenderId);
                await api.sendMessage({ msg: text, mentions, styles }, threadId, threadType);
                await api.sendVideoEnhanced({ videoUrl, thumbnailUrl: thumbUrl, duration: Math.floor(duration), width: Math.floor(width), height: Math.floor(height), msg: "", threadId, threadType });
                logger.success(`[AntiUndo] ✅ Đã tóm VIDEO của ${authorName}`);
            } catch (e) { logger.error(`[AntiUndo] Lỗi VIDEO: ${e.message}`); }
            return;
        }
    }

    // ── VOICE ─────────────────────────────────────────────────────────────────
    const isVoice = msgType.startsWith("chat.voice")
        || msgType.startsWith("chat.audio")
        || (typeof c?.href === "string" && (c.href.includes(".aac") || c.href.includes(".m4a")));

    if (isVoice && c?.href) {
        try {
            const fileSize = Number(parsedParams?.fileSize || 0);
            const duration = Number(parsedParams?.duration || 0);
            const { text, styles, mentions } = buildNotify("VOICE", authorName, resolvedSenderId);
            await api.sendMessage({ msg: text, mentions, styles }, threadId, threadType);
            // sendVoiceNative nhận URL CDN trực tiếp, không cần file local
            await api.sendVoiceNative({
                voiceUrl: c.href,
                duration,
                fileSize,
                threadId,
                threadType,
                ttl: 1800000
            }).catch(async (e) => {
                logger.warn(`[AntiUndo] sendVoiceNative thất bại (${e.message}), thử sendVoiceUnified...`);
                // Fallback: download về rồi gửi
                const tmpPath = path.join(process.cwd(), `tmp_voice_${Date.now()}.aac`);
                const downloaded = await downloadFile(c.href, tmpPath);
                if (downloaded) {
                    await api.sendVoiceUnified({ filePath: downloaded, threadId, threadType })
                        .finally(() => fs.unlink(downloaded, () => {}));
                } else {
                    await api.sendMessage({ msg: `🎵 Voice: ${c.href}` }, threadId, threadType);
                }
            });
            logger.success(`[AntiUndo] ✅ Đã tóm VOICE của ${authorName}`);
        } catch (e) { logger.error(`[AntiUndo] Lỗi VOICE: ${e.message}`); }
        return;
    }

    // ── FILE ──────────────────────────────────────────────────────────────────
    if (msgType === "share.file" || msgType.includes("file")) {
        try {
            const fileUrl   = c?.href || "";
            const fileName  = parsedParams?.fileName  || "Tệp_đính_kèm";
            const fileExt   = parsedParams?.fileExt   || "";
            const fullName  = fileExt ? `${fileName}.${fileExt}` : fileName;
            const extra_str = `➜ Tên tệp: ${fullName}` + (fileUrl ? `\n➜ Link: ${fileUrl}` : "");
            const { text, styles, mentions } = buildNotify("TỆP", authorName, resolvedSenderId, extra_str);
            await api.sendMessage({ msg: text, mentions, styles }, threadId, threadType);
            if (fileUrl) {
                await api.sendFile({ fileUrl, fileName: fullName }, threadId, threadType).catch(() => { });
            }
            logger.success(`[AntiUndo] ✅ Đã tóm FILE của ${authorName}: ${fullName}`);
        } catch (e) { logger.error(`[AntiUndo] Lỗi FILE: ${e.message}`); }
        return;
    }

    // ── ẢNH ───────────────────────────────────────────────────────────────────
    const isPhoto = msgType.startsWith("chat.photo")
        || !!(extra?.hdUrl || extra?.url || extra?.thumbUrl || extra?.normalUrl);

    if (isPhoto) {
        const imgUrl = extra?.hdUrl || extra?.url || extra?.normalUrl || extra?.thumbUrl || c?.href;
        if (imgUrl) {
            try {
                const tmpPath = path.join(process.cwd(), `tmp_undo_${Date.now()}.jpg`);
                await downloadFile(imgUrl, tmpPath);
                const { text, styles, mentions } = buildNotify("ẢNH", authorName, resolvedSenderId);
                await api.sendMessage({ msg: text, mentions, styles }, threadId, threadType);
                await api.sendImageEnhanced({
                    imageUrl: imgUrl, msg: "",
                    threadId, threadType,
                    width:  Math.floor(Number(extra?.width  || 720)),
                    height: Math.floor(Number(extra?.height || 1280))
                }).catch(() => { });
                fs.unlink(tmpPath, () => { });
                logger.success(`[AntiUndo] ✅ Đã tóm ẢNH của ${authorName}`);
            } catch (e) { logger.error(`[AntiUndo] Lỗi ẢNH: ${e.message}`); }
            return;
        }
    }

    // ── STICKER ───────────────────────────────────────────────────────────────
    const isSticker = msgType.startsWith("chat.sticker")
        || !!(stickerId && stickerCat);

    if (isSticker && stickerId && stickerCat) {
        try {
            const stickerObj = {
                id: String(stickerId),
                cateId: String(stickerCat),
                type: 1 // Loại mặc định
            };

            const { text, styles, mentions } = buildNotify("STICKER", authorName, resolvedSenderId);
            await api.sendMessage({ msg: text, mentions, styles }, threadId, threadType);

            // Gửi sticker theo đúng định nghĩa: sendSticker(sticker, threadId, type, ttl)
            // Trong đó type: 1 là Group, 0 là Direct
            await api.sendSticker(stickerObj, threadId, threadType === 1 ? 1 : 0).catch((e) => {
                logger.error(`[AntiUndo] sendSticker API Error: ${e.message}`);
                // Thử fallback cuối nếu vẫn fail
                api.sendSticker(stickerObj, threadId, threadType).catch(() => { });
            });

            logger.success(`[AntiUndo] ✅ Đã tóm STICKER id=${stickerId} cat=${stickerCat} của ${authorName}`);
        } catch (e) { logger.error(`[AntiUndo] Lỗi STICKER: ${e.message}`); }
        return;
    }

    // ── VĂN BẢN (fallback cuối) ───────────────────────────────────────────────
    const displayText = originalText
        || (typeof rawContent === "string" ? rawContent : null)
        || c?.text || c?.title || c?.desc || "";

    if (displayText) {
        try {
            const { text, styles, mentions } = buildNotify("TIN NHẮN", authorName, resolvedSenderId,
                `➜ Nội dung: "${displayText}"`);
            await api.sendMessage({ msg: text, mentions, styles }, threadId, threadType);
            logger.success(`[AntiUndo] ✅ Đã tóm TEXT của ${authorName}: "${displayText.slice(0, 50)}"`);
        } catch (e) { logger.error(`[AntiUndo] Lỗi TEXT: ${e.message}`); }
        return;
    }

    // Không xác định được loại
    logger.warn(`[AntiUndo] ⚠️ Không xử lý được. msgType="${msgType}" | content=${JSON.stringify(c).slice(0, 100)}`);
    try {
        const { text, styles, mentions } = buildNotify("TIN NHẮN", authorName, resolvedSenderId,
            "➜ (Không thể khôi phục nội dung tin nhắn này)");
        await api.sendMessage({ msg: text, mentions, styles }, threadId, threadType);
    } catch { }
}
