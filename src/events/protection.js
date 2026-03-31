import { protectionManager } from "../utils/protectionManager.js";
import { log } from "../logger.js";

export const name = "anti-protection";
export const description = "Hệ thống bảo vệ nhóm: Link, Spam, Photo, Sticker, Tag";

const ZALO_GROUP_LINK_REGEX = /zalo\.me\/g\/[a-zA-Z0-9_\-]+/i;
// Sticker trong nhóm Zalo thường gửi như CDN URL có pattern StickerBy
const STICKER_URL_REGEX = /zfcloud\.zdn\.vn.*StickerBy|sticker.*\.webp/i;

function isSticker(data, content) {
    if (data.stickerId || data.sticker_id) return true;
    if (data.msgType === "chat.sticker" || data.msgType === 36 || data.msgType === "36") return true;
    if (typeof content === "string" && (content === "[STICKER]" || STICKER_URL_REGEX.test(content))) return true;
    return false;
}

function isPhoto(data, content) {
    if (isSticker(data, content)) return false; 
    return data.mediaType === 1 || data.type === "photo" || data.msgType === "chat.photo" || data.msgType === 2 || data.msgType === "2" || data.msgType === 32 || data.msgType === "32";
}

const spamData = new Map();
const kickHistory = [];
const lastNotify = new Map();

const MSG_LIMIT = 7;
const TIME_LIMIT = 5000;
const MAX_KICKS_PER_MIN = 5;
const NOTIFY_COOLDOWN = 30000;

async function getDisplayName(api, uid) {
    try {
        const info = await api.getUserInfo(uid);
        const u = info?.[uid] || info;
        return u?.displayName || u?.zaloName || uid;
    } catch {
        return uid;
    }
}

async function handleDeleteAndReport(ctx, type, count) {
    const { api, message, threadId, threadType, senderId } = ctx;
    const config = protectionManager.CONFIG[type];
    
    // Xóa tin nhắn
    try {
        await api.deleteMessage({
            data: { 
                msgId: message.data.msgId || message.data.globalMsgId, 
                cliMsgId: message.data.cliMsgId,
                uidFrom: senderId 
            },
            threadId, type: threadType
        }, false);
    } catch (e) {
        log.error(`[Anti-${type}] Lỗi khi xóa tin:`, e.message);
    }

    const name = await getDisplayName(api, senderId);
    let msg = "";
    const typeLabel = type.toUpperCase();

    const headers = {
        photo: "📷 ANTI-PHOTO",
        sticker: "🎨 ANTI-STICKER",
        tag: "🏷️ ANTI-TAG",
        link: "🔗 ANTI-LINK",
        spam: "⚡ ANTI-SPAM"
    };

    const header = `➜ [ ${headers[type] || `ANTI-${typeLabel}`} ]\n`;

    if (config && count >= config.kick) {
        try {
            await api.blockUsers(threadId, [senderId]);
            msg = `${header}${name}\n➜ 📣 Đã thẳng tay tiễn bạn rời khỏi nhóm do cố ý vi phạm quá nhiều lần (${count}/${config.kick}). Tạm biệt nhé! 👋`;
            protectionManager.resetViolation(threadId, senderId, type);
        } catch (e) {
            msg = `${header}${name}\n➜ ⚠️ Định "kick" bạn rồi nhưng mà bot hổng có đủ quyền nè. Ad ơi xử lý giúp bé với! 🥺`;
            protectionManager.resetViolation(threadId, senderId, type);
        }
    } else if (config && count === config.warn) {
        msg = `${header}${name}\n➜ 😡 CẢNH BÁO CUỐI CÙNG! Bạn đã vi phạm ${count} lần rồi đó. Thêm 1 lần nữa là "bay màu" khỏi nhóm luôn nhé! 💣`;
    } else if (config && count === 1) {
        let reasons = {
            photo: "không cho gửi ảnh",
            sticker: "không cho gửi sticker",
            tag: "không được tag @Tất cả/spam tag",
            link: "không được gửi link nhóm Zalo",
            spam: "không cho phép gửi tin nhắn dồn dập"
        };
        msg = `${header}${name}\n➜ 🎀 Nhẹ nhàng nhắc nhở: Nhóm mình ${reasons[type] || "đang có bảo vệ"}. Đừng tái phạm nha, thương lắm nè! ✨`;
    } else if (type === "link_del") {
        msg = `➜ [ 🔗 ANTI-LINK ]\n${name}\n➜ 🚫 Link nhóm Zalo hổng có tốt cho nhóm mình đâu. Bé gỡ giúp rồi nhé, đừng gửi nữa nha! 🌸`;
    }

    if (msg) {
        const namePos = header.length;
        
        await api.sendMessage({ 
            msg, 
            mentions: [{ uid: senderId, pos: namePos, len: name.length }],
            styles: [
                { start: 2, len: (headers[type] || `ANTI-${typeLabel}`).length + 4, st: "b" },
                { start: 2, len: (headers[type] || `ANTI-${typeLabel}`).length + 4, st: "c_db342e" }
            ]
        }, threadId, threadType);
    }
}

export async function handle(ctx) {
    const { message, threadId, threadType, senderId, adminIds, isGroup, api, content } = ctx;
    // Bỏ qua tin nhắn của chính bot
    if (message.isSelf) return false;
    if (!isGroup || adminIds.includes(String(senderId))) return false;

    const { data } = message;
    const now = Date.now();

    // 1. Anti-Link
    if (protectionManager.isEnabled(threadId, "link")) {
        let textToCheck = content || "";
        if (!textToCheck && data?.content) {
            textToCheck = typeof data.content === "string" ? data.content : (data.content.href || data.content.text || "");
        }
        if (textToCheck && ZALO_GROUP_LINK_REGEX.test(textToCheck)) {
            await handleDeleteAndReport(ctx, "link_del", 0);
            return true;
        }
    }

    // 2. Anti-Spam (Kick behavior from antiSpam.js)
    if (protectionManager.isEnabled(threadId, "spam")) {
        const key = `${threadId}_${senderId}`;
        const oneMinuteAgo = now - 60000;
        
        // Rate limit kick
        while (kickHistory.length > 0 && kickHistory[0] < oneMinuteAgo) {
            kickHistory.shift();
        }

        if (!spamData.has(key)) {
            spamData.set(key, [now]);
        } else {
            const timestamps = spamData.get(key);
            const recentMsgs = timestamps.filter(t => now - t < TIME_LIMIT);
            recentMsgs.push(now);
            spamData.set(key, recentMsgs);

            if (recentMsgs.length >= MSG_LIMIT) {
                spamData.set(key, []);
                if (kickHistory.length < MAX_KICKS_PER_MIN) {
                    const count = protectionManager.addViolation(threadId, senderId, "spam");
                    await handleDeleteAndReport(ctx, "spam", count);
                    kickHistory.push(now);
                    return true;
                }
            }
        }
    }

    // 3. Anti-Tag (chỉ xử lý @Tất cả / @all)
    if (protectionManager.isEnabled(threadId, "tag")) {
        const mentions = data.mentions || [];
        const hasTagAll = mentions.some(m => m.uid === "-1" || m.uid === -1);
        if (hasTagAll) {
            const count = protectionManager.addViolation(threadId, senderId, "tag");
            await handleDeleteAndReport(ctx, "tag", count);
            return true;
        }
    }

    // 4. Anti-Sticker (check trước Anti-Photo vì sticker có thể có mediaType=1)
    if (protectionManager.isEnabled(threadId, "sticker")) {
        if (isSticker(data, content)) {
            const count = protectionManager.addViolation(threadId, senderId, "sticker");
            await handleDeleteAndReport(ctx, "sticker", count);
            return true;
        }
    }

    // 5. Anti-Photo (phải check sau sticker)
    if (protectionManager.isEnabled(threadId, "photo")) {
        if (isPhoto(data, content)) {
            const count = protectionManager.addViolation(threadId, senderId, "photo");
            await handleDeleteAndReport(ctx, "photo", count);
            return true;
        }
    }

    return false;
}
