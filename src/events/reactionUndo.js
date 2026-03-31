import { appContext } from "../api-zalo/context.js";
import { MessageType } from "../api-zalo/models/Message.js";
import { log } from "../logger.js";

export const name = "reactionUndo";
export const description = "Thu hồi tin nhắn bot khi có reaction";

/**
 * Handle reaction event
 * @param {object} ctx 
 */
export async function handleReaction(ctx) {
    const { api, reaction, threadId, isGroup, log } = ctx;
    const { data } = reaction;
    const { content } = data;

    // console.log(`[ReactionUndo Debug] Raw Data: ${JSON.stringify(data)}`);

    // content.rType === -1 is typically a removed reaction
    if (content.rType === -1) return false;

    // Lấy thông tin tin nhắn bị thả reaction
    const targetMsg = content.rMsg?.[0] || {};
    // gMsgID thường có trong cả group và private event hiện đại
    const targetGlobalId = targetMsg.gMsgID || (isGroup ? null : content.msgId);
    const targetCliId = targetMsg.cMsgID || content.cliMsgId;

    // msgSender: UID người gửi tin (trong group)
    // uidOwner / fuid: UID người sở hữu tin (trong private)
    const ownerId = content.msgSender || data.uidOwner || data.fuid || data.ownerId;
    const botUid = appContext.uid;
    const botUin = appContext.uin;

    if (!targetGlobalId || !ownerId) return false;

    // So sánh với cả UID (dài) và UIN (ngắn)
    const isBot = String(ownerId) === String(botUid) || (botUin && String(ownerId) === String(botUin));

    if (!isBot) return false;

    log.chat("EVENT", "ReactionUndo", threadId, `Thu hồi tin nhắn Bot (ID: ${targetGlobalId})`);

    try {
        const fakeMessage = {
            type: isGroup ? MessageType.GroupMessage : MessageType.DirectMessage,
            threadId: threadId,
            data: {
                quote: {
                    globalMsgId: String(targetGlobalId),
                    cliMsgId: String(targetCliId)
                }
            }
        };

        await api.undoMessage(fakeMessage);
        log.info(`✅ [ReactionUndo] Đã thu hồi thành công.`);
        return true;
    } catch (e) {
        log.warn(`⚠️ [ReactionUndo] Thu hồi lỗi (${e.message}). Đang thử xóa...`);
        try {
            const deletePayload = {
                type: isGroup ? MessageType.GroupMessage : MessageType.DirectMessage,
                threadId: threadId,
                data: {
                    msgId: String(targetGlobalId),
                    cliMsgId: String(targetCliId),
                    uidFrom: String(botUid)
                }
            };
            await api.deleteMessage(deletePayload, false);
            log.info(`✅ [ReactionUndo] Đã xóa (Fallback).`);
            return true;
        } catch (e2) {
            log.error(`❌ [ReactionUndo] Fallback thất bại: ${e2.message}`);
        }
    }
    return false;
}
