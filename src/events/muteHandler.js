

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

export const name = "muteHandler";
export const description = "Dùng deleteMessage để xóa tin nhắn nếu bị mute";

const MUTE_FILE = path.join(process.cwd(), "src", "modules", "cache", "mutes.json");

function isUserMuted(uid) {
    try {
        if (!existsSync(MUTE_FILE)) return false;
        const mutes = JSON.parse(readFileSync(MUTE_FILE, "utf-8"));
        return mutes.includes(String(uid));
    } catch (e) {
        return false;
    }
}

export async function handle(ctx) {
    const { api, message, senderId, threadId, threadType } = ctx;


    if (isUserMuted(senderId)) {
        const msgId = message.data?.msgId || message.data?.globalMsgId;
        if (!message.data || !msgId) {
            log.warn(`⚠️ [Mute] Phát hiện người dùng bị mute (${senderId}) nhưng tin nhắn không có msgId/globalMsgId. Data: ${JSON.stringify(message.data)}`);
            return false;
        }

        log.info(`[Mute] Đang tiến hành xóa tin nhắn của người dùng bị mute: ${senderId}`);
        log.debug(`[Mute] Message Data: ${JSON.stringify(message.data)}`);

        try {

            await api.deleteMessage(
                {
                    data: {
                        msgId: msgId,
                        cliMsgId: message.data.cliMsgId,
                        uidFrom: message.data.uidFrom || String(senderId)
                    },
                    threadId: threadId,
                    type: threadType
                },
                false
            );

            log.info(`✦ [Mute] Đã thu hồi tin nhắn của ${senderId} thành công.`);
            return true;
        } catch (delErr) {
            log.error(`⚠️ [Mute] Lỗi khi thu hồi tin (${delErr.code}):`, delErr.message);
            if (delErr.message.toLowerCase().includes("permission") || delErr.message.toLowerCase().includes("forbidden")) {
                log.warn(`⚠️ [Mute] Bot KHÔNG CÓ QUYỀN xóa tin này (Bot cần làm Admin nhóm ${threadId}).`);
            }
        }
    }
    return false;
}
