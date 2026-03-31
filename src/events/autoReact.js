import { autoReactManager } from "../utils/autoReactManager.js";
import { reaction_all } from "../utils/reactionList.js";

export const name = "autoReact";

/**
 * Xử lý tự động thả reaction cho tin nhắn mới
 */
export async function handle(ctx) {
    const { api, threadId, threadType, message, isGroup } = ctx;

    // Chỉ hoạt động trong nhóm
    if (!isGroup) return false;

    const settings = autoReactManager.get(threadId);
    if (!settings.enabled) return false;

    const { count, icon } = settings;

    // Thực hiện thả reaction
    for (let i = 0; i < count; i++) {
        const reactIcon = icon || reaction_all[Math.floor(Math.random() * reaction_all.length)];
        // Dùng try-catch để tránh crash nếu tin nhắn bị lỗi
        try {
            await api.addReaction({ icon: reactIcon, rType: 75, source: 1 }, {
                data: {
                    msgId: message.data.msgId || message.data.globalMsgId,
                    cliMsgId: message.data.cliMsgId,
                    uidFrom: message.data.uidFrom || message.data.uid
                },
                threadId,
                type: threadType
            }).catch(() => { });
        } catch (e) {
            // Bỏ qua lỗi
        }
    }

    // Trả về false để các module khác vẫn có thể xử lý tin nhắn này
    return false;
}
