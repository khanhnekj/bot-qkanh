import { protectionManager } from "../utils/protectionManager.js";
import { log } from "../logger.js";

export const name = "anti-protections";
export const description = "Các lệnh bảo vệ nhóm (AntiPhoto, AntiSticker, AntiTag, AntiLink, AntiSpam)";

// Lưu phiên tương tác menu (UID-ThreadID)
const menuSessions = new Map();

async function getDisplayName(api, uid) {
    try {
        const info = await api.getUserInfo(uid);
        const u = info?.[uid] || info;
        return u?.displayName || u?.zaloName || uid;
    } catch {
        return uid;
    }
}

const PROTECTION_TYPES = [
    { id: "1", type: "link", name: "Anti-Link (Chặn link nhóm)", emoji: "🔗" },
    { id: "2", type: "spam", name: "Anti-Spam (Chặn tin dồn dập)", emoji: "⚡" },
    { id: "3", type: "photo", name: "Anti-Photo (Chặn gửi ảnh)", emoji: "📸" },
    { id: "4", type: "sticker", name: "Anti-Sticker (Chặn sticker)", emoji: "🎨" },
    { id: "5", type: "tag", name: "Anti-Tag (Chặn tag @all)", emoji: "🔔" },
    { id: "6", type: "undo", name: "Anti-Undo (Chống thu hồi tin)", emoji: "🔒" }
];

async function toggleProtection(api, threadId, threadType, senderId, items, ctx) {
    const senderName = await getDisplayName(api, senderId);
    let results = [];

    for (const item of items) {
        const current = protectionManager.isEnabled(threadId, item.type);
        const nextState = !current;
        protectionManager.setEnabled(threadId, item.type, nextState);
        results.push(`${item.emoji} ${item.name}: ${nextState ? "BẬT " : "TẮT "}`);
    }

    const msg = `➜ [ SETTINGS PROTECTION ]\n${senderName}\n─────────────────\n${results.join("\n")}\n─────────────────\n✨ Đã cập nhật trạng thái mới cho bạn nè!`;

    await api.sendMessage({
        msg,
        styles: [
            { start: 2, len: 21, st: "b" },
            { start: 2, len: 21, st: "c_db342e" }
        ]
    }, threadId, threadType);
}

export const commands = {
    anti: async (ctx) => {
        const { api, args, threadId, threadType, senderId, isGroup, message, adminIds } = ctx;
        const isUndoOnly = args[0]?.toLowerCase() === "undo" || ctx.commandName === "antiundo";
        if (!isGroup && !isUndoOnly) return api.sendMessage({ msg: "⚠️ Bé chỉ hỗ trợ bảo vệ trong nhóm thôi nha!" }, threadId, threadType);

        const senderName = await getDisplayName(api, senderId);

        // Check quyền Admin
        if (!adminIds.includes(String(senderId))) {
            return api.sendMessage({
                msg: `${senderName}\n➜ ⚠️ Menu này chỉ dành cho Admin Bot hoặc QTV thôi nè! 🌸`,
                styles: [{ start: 0, len: senderName.length, st: "b" }]
            }, threadId, threadType);
        }

        // Nếu có tham số (ví dụ: !anti link on)
        if (args.length > 0) {
            const firstArg = args[0].toLowerCase();
            const target = PROTECTION_TYPES.find(p => p.type === firstArg || p.id === firstArg);
            if (target) {
                const action = (args[1] || "").toLowerCase();
                if (action === "on" || action === "off") {
                    protectionManager.setEnabled(threadId, target.type, action === "on");
                    const msg = `➜ [ PROTECTION ]\n${senderName}\n➜ ${target.emoji} ${target.name} đã được ${action === "on" ? "BẬT ✅" : "TẮT ❌"}! ✨`;
                    return api.sendMessage({ msg }, threadId, threadType);
                }
            }
        }

        // Hiện Menu
        const header = "🛡️ [ SETTINGS PROTECTION ]";
        let help = `${senderName}\n${header}\n─────────────────\n`;

        PROTECTION_TYPES.forEach(p => {
            const status = protectionManager.isEnabled(threadId, p.type) ? "ON " : "OFF ";
            help += `${p.id}. ${p.emoji} ${p.name} [${status}]\n`;
        });

        help += `─────────────────\n`;
        help += `💡 Phản hồi (reply) số (ví dụ: 1 hoặc 135) để bật/tắt nhanh các tính năng nhé! 🎀`;

        const sentMsg = await api.sendMessage({
            msg: help,
            quote: message.data,
            styles: [
                { start: 0, len: senderName.length, st: "b" },
                { start: senderName.length + 1, len: header.length, st: "b" },
                { start: senderName.length + 1, len: header.length, st: "c_db342e" }
            ]
        }, threadId, threadType);

        // Lưu session trong 60s
        const key = `${threadId}_${senderId}`;
        menuSessions.set(key, { time: Date.now() });
        setTimeout(() => {
            if (menuSessions.get(key)?.time === menuSessions.get(key)?.time) {
                menuSessions.delete(key);
            }
        }, 60000);
    },


    antiphoto: async (ctx) => commands.anti({ ...ctx, args: ["photo", ctx.args[0]] }),
    antistk: async (ctx) => commands.anti({ ...ctx, args: ["sticker", ctx.args[0]] }),
    antitag: async (ctx) => commands.anti({ ...ctx, args: ["tag", ctx.args[0]] }),
    antilink: async (ctx) => commands.anti({ ...ctx, args: ["link", ctx.args[0]] }),
    antispam: async (ctx) => commands.anti({ ...ctx, args: ["spam", ctx.args[0]] }),
    antiundo: async (ctx) => commands.anti({ ...ctx, args: ["undo", ctx.args[0]] })
};

export async function handle(ctx) {
    const { content, threadId, threadType, senderId, api, adminIds, message } = ctx;
    if (!content || message.isSelf) return false;

    const key = `${threadId}_${senderId}`;
    if (!menuSessions.has(key)) return false;


    const cleanContent = content.trim();
    if (/^[1-6]+$/.test(cleanContent)) {

        menuSessions.delete(key);

        if (!adminIds.includes(String(senderId))) return false;

        const ids = [...new Set(cleanContent.split(""))];
        const selectedItems = PROTECTION_TYPES.filter(p => ids.includes(p.id));

        if (selectedItems.length > 0) {
            await toggleProtection(api, threadId, threadType, senderId, selectedItems, ctx);
            return true;
        }
    }

    return false;
}
