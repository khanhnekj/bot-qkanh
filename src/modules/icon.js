import { autoReactManager } from "../utils/autoReactManager.js";
import { reaction_all } from "../utils/reactionList.js";
import { log } from "../logger.js";

export const name = "icon";
export const description = "Tự động thả reaction vào tin nhắn (on/off)";

async function reply(ctx, text) {
    await ctx.api.sendMessage(
        { msg: text, quote: ctx.message.data },
        ctx.threadId,
        ctx.threadType
    );
}

export const commands = {
    icon: async (ctx) => {
        const { api, threadId, threadType, senderId, adminIds, args } = ctx;

        // Kiểm tra quyền (Chỉ Admin Bot hoặc Key Vàng mới được bật/tắt tool này)
        // Dựa trên yêu cầu của bạn ở lệnh setkey, tôi áp dụng logic tương tự.
        const isOwner = adminIds.includes(String(senderId));
        if (!isOwner) {
            return reply(ctx, "⚠️ Chỉ Admin Bot mới có quyền điều khiển Tool này!");
        }

        const sub = args[0]?.toLowerCase();
        if (sub === "on") {
            let icon = null;
            let count = 10; // Mặc định là 10 lần để thả "càng nhiều càng tốt"

            // Xử lý args: !icon on [icon] [số]
            if (args.length > 1) {
                // Nếu tham số cuối cùng là số, coi đó là số lần thả
                if (!isNaN(args[args.length - 1])) {
                    count = parseInt(args[args.length - 1]);
                    icon = args.slice(1, -1).join(" ");
                } else {
                    // Nếu không có số ở cuối, coi toàn bộ là icon (hoặc text icon)
                    icon = args.slice(1).join(" ");
                }
            }

            if (icon === "") icon = null;

            autoReactManager.set(threadId, true, count, icon);

            const infoMsg = `[ ⚡ TOOL REACTION BẬT ]\n` +
                `─────────────────\n` +
                `◈ Icon: ${icon || "Ngẫu nhiên 🎲"}\n` +
                `◈ Số lượng: ${count}\n` +
                `─────────────────\n` +
                `🚀 Bot sẽ thả reaction vào mọi tin nhắn mới và 30 tin nhắn cũ!`;

            await reply(ctx, infoMsg);

            // Thả reaction vào 30 tin nhắn cũ nhất (zca-js giới hạn history)
            try {
                const history = await api.getGroupChatHistory(threadId, 30);
                if (history && history.length > 0) {
                    for (const msg of history) {
                        for (let i = 0; i < count; i++) {
                            const reactIcon = icon || reaction_all[Math.floor(Math.random() * reaction_all.length)];
                            await api.addReaction({ icon: reactIcon, rType: 75, source: 1 }, {
                                data: { msgId: msg.msgId, cliMsgId: msg.cliMsgId, uidFrom: msg.uidFrom },
                                threadId,
                                type: threadType
                            }).catch(() => { });
                        }
                    }
                }
            } catch (e) {
                log.error("Lỗi thả reaction lịch sử:", e.message);
            }

        } else if (sub === "off") {
            autoReactManager.set(threadId, false);
            await reply(ctx, "⛔ Tool Reaction đã TẮT trong nhóm này!");
        } else {
            const help = `[ ⚙️ HƯỚNG DẪN ICON ]\n` +
                `─────────────────\n` +
                ` ❯ !icon on [icon] [số] ➥ Bật auto reaction\n` +
                ` ❯ !icon off ➥ Tắt auto reaction\n` +
                `─────────────────\n` +
                `💡 Ví dụ: !icon on ❤️ 5\n` +
                `💡 Ví dụ: !icon on (tự động thả ngẫu nhiên)`;
            await reply(ctx, help);
        }
    }
};
