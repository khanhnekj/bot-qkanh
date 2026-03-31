import { statsManager } from "../utils/statsManager.js";
import { groupAdminManager } from "../utils/groupAdminManager.js";
import { log } from "../logger.js";

export const name = "kick";
export const description = "Module quản lý thành viên và phân quyền Key Vàng/Bạc";

const ROLES = {
    "Admin": 100,
    "Vàng": 50,
    "Bạc": 20,
    "Thành viên": 0
};

async function reply(ctx, text) {
    const { api, threadId, threadType, message } = ctx;
    const quote = message.data?.quote || message.data?.content?.quote || message.data;
    const targetUid = String(quote?.uidFrom || quote?.ownerId || "");
    
    let mentions = [];
    if (text.includes("@tag") && targetUid) {
        const name = "@Thành viên"; 
        const pos = text.indexOf("@tag");
        text = text.replace("@tag", name);
        mentions.push({ uid: targetUid, pos, len: name.length });
    }

    await api.sendMessage(
        { msg: text, quote: message.data, mentions },
        threadId,
        threadType
    );
}

function getLevel(uid, threadId, adminIds) {
    if (adminIds.includes(String(uid))) return ROLES["Admin"];
    const stats = statsManager.getStats(threadId, uid);
    return ROLES[stats?.role] || 0;
}

// Helper lấy tên nhanh từ cache hoặc API
async function getTargetName(api, threadId, uid) {
    const stats = statsManager.getStats(threadId, uid);
    if (stats?.name && stats.name !== "Người dùng") return stats.name;
    try {
        const userInfo = await api.getUserInfo(uid);
        return userInfo?.displayName || userInfo?.name || uid;
    } catch {
        return uid;
    }
}

export const commands = {
    kick: async (ctx) => {
        const { api, threadId, threadType, senderId, adminIds, args, message, prefix } = ctx;
        if (!ctx.isGroup) return reply(ctx, "⚠️ Lệnh này chỉ dùng trong nhóm!");

        const senderLevel = getLevel(senderId, threadId, adminIds);
        let hasPermission = senderLevel >= ROLES["Bạc"];
        let isBoxAdmin = false;

        if (!hasPermission) {
            try {
                const groupInfo = await api.getGroupInfo(threadId);
                const groupData = groupInfo.gridInfoMap?.[threadId] || groupInfo[threadId] || groupInfo;
                if (groupData?.adminIds?.includes(String(senderId)) || groupData?.creatorId === String(senderId)) {
                    isBoxAdmin = true;
                    hasPermission = true;
                }
            } catch (e) { console.error("[DEBUG KICK] Lỗi check quyền QTV:", e.message); }
        }

        if (!hasPermission) return reply(ctx, "⚠️ Bạn cần ít nhất Key Bạc hoặc là Quản trị viên nhóm để dùng lệnh này!");

        const quote = message.data?.quote || message.data?.content?.quote;
        let targetIds = [];

        if (quote?.uidFrom || quote?.ownerId) targetIds.push(String(quote.uidFrom || quote.ownerId));
        if (message.data?.mentions?.length > 0) {
            message.data.mentions.forEach(m => {
                const uid = String(m.uid);
                if (!targetIds.includes(uid)) targetIds.push(uid);
            });
        }
        args.forEach(arg => { if (/^\d+$/.test(arg) && !targetIds.includes(arg)) targetIds.push(arg); });

        const finalTargets = targetIds.filter(tid => {
            if (tid === senderId) return false;
            const targetLevel = getLevel(tid, threadId, adminIds);
            if (isBoxAdmin) return targetLevel < ROLES["Admin"]; 
            return targetLevel < senderLevel;
        });

        if (finalTargets.length === 0) {
            if (targetIds.length > 0) return reply(ctx, "⚠️ Không thể kick người có chức vụ bằng/cao hơn!");
            return reply(ctx, `◈ Cú pháp: ${prefix}kick [@tag / reply / ID]`);
        }

        try {
            await api.removeUserFromGroup(String(threadId), finalTargets);
            const tagString = finalTargets.map(() => "@tag").join(", ");
            await ctx.reply(`⚔️ [ TRỤC XUẤT ] ⚔️\n━━━━━━━━━━━━━━━━━━\n✅ Đã tiễn ${tagString} lên đường!\n━━━━━━━━━━━━━━━━━━\n📌 Tổng cộng: ${finalTargets.length} đối tượng.`, finalTargets);
        } catch (e) {
            await ctx.reply(`⚠️ Không thể kick: ${e.message}. Bot cần quyền phó/trưởng nhóm!`);
        }
    },

    setkey: async (ctx) => {
        const { api, threadId, senderId, adminIds, args, message, prefix } = ctx;
        if (!ctx.isGroup) return reply(ctx, "⚠️ Lệnh này chỉ dùng trong nhóm!");

        const isBotAdmin = adminIds.includes(String(senderId));
        const senderLevel = getLevel(senderId, threadId, adminIds);

        if (senderLevel < ROLES["Vàng"]) return reply(ctx, "⚠️ Chỉ những người có Key Vàng mới được quyền cấp Key.");

        const roleKeywords = {
            "Vàng": ["vàng", "vàng", "v", "gold", "vang"],
            "Bạc": ["bạc", "bạc", "b", "silver", "bac"],
            "Owner": ["owner", "trưởng nhóm", "truong nhom"],
            "Thành viên": ["xoa", "xóa", "xóa", "del", "huy", "hủy", "hủy", "remove"]
        };

        let resolvedRole = null;
        let idArgs = [];

        args.forEach(arg => {
            const norm = arg.toLowerCase().normalize("NFC");
            const normNFD = arg.toLowerCase().normalize("NFD");
            let isRole = false;
            for (const [roleName, keywords] of Object.entries(roleKeywords)) {
                if (keywords.includes(norm) || keywords.includes(normNFD)) {
                    resolvedRole = roleName;
                    isRole = true;
                    break;
                }
            }
            if (!isRole && /^\d+$/.test(arg)) if (!idArgs.includes(arg)) idArgs.push(arg);
        });

        let targetIds = [];
        const quote = message.data?.quote || message.data?.content?.quote;
        if (quote?.uidFrom || quote?.ownerId) targetIds.push(String(quote.uidFrom || quote.ownerId));
        if (message.data?.mentions?.length > 0) {
            message.data.mentions.forEach(m => {
                const uid = String(m.uid);
                if (!targetIds.includes(uid)) targetIds.push(uid);
            });
        }
        idArgs.forEach(id => { if (!targetIds.includes(id)) targetIds.push(id); });

        if (targetIds.length === 0 || args.length === 0) {
            let help = `[ 🔑 HƯỚNG DẪN SETKEY ]\n`;
            help += `─────────────────\n`;
            help += `◈ Cú pháp: ${prefix}setkey [@tag / reply] [loại key]\n\n`;
            help += `⭐ Các loại key:\n`;
            help += ` ❯ vàng (v/gold): Quyền tối cao, thay đổi chủ nhóm.\n`;
            help += ` ❯ bạc (b/silver): Quyền quản lý, kick thành viên.\n`;
            help += ` ❯ xóa (del/remove): Gỡ bỏ toàn bộ quyền hạn.\n`;
            help += `─────────────────\n`;
            help += `💡 Ví dụ: !setkey @tag vàng\n`;
            help += `💡 Mặc định nếu không nhập loại là cấp Key Bạc.`;
            return reply(ctx, help);
        }

        const isSelf = targetIds.length === 1 && targetIds[0] === senderId;
        if (!resolvedRole) resolvedRole = (isBotAdmin && isSelf) ? "Vàng" : "Bạc";

        try {
            const targetNames = await Promise.all(targetIds.map(id => getTargetName(api, threadId, id)));

            if (resolvedRole === "Owner" || resolvedRole === "Vàng") {
                if (!isBotAdmin) return reply(ctx, "⚠️ Chỉ Admin Bot mới có quyền thăng chức TRƯỞNG NHÓM!");
                
                for (const tid of targetIds) statsManager.setRole(threadId, tid, "Vàng");
                try {
                    await api.changeGroupOwner(threadId, targetIds[0]);
                    if (targetIds.length > 1) await api.addGroupAdmins(threadId, targetIds.slice(1));
                } catch (e) { await api.addGroupAdmins(threadId, targetIds); }

                // Cập nhật cache ngay với đúng UID - không cần hỏi Zalo API
                for (const uid of targetIds) groupAdminManager.addToCache(threadId, uid);

                // Gửi thông báo kèm @tag
                const nameStr = targetNames.map(n => `• ${n}`).join("\n");
                const text = `👑 [ KEY VÀNG - TRƯỞNG NHÓM ] 👑\n━━━━━━━━━━━━━━━━━━\n✅ Thăng chức thành công:\n${nameStr}\n━━━━━━━━━━━━━━━━━━\n📌 Trạng thái: Trưởng nhóm Zalo đã được trao cho ${targetNames[0]}.`;
                return ctx.reply({ msg: text, hidden: true }, targetIds);
            }

            if (resolvedRole === "Bạc") {
                for (const tid of targetIds) statsManager.setRole(threadId, tid, "Bạc");
                try { await api.addGroupAdmins(threadId, targetIds); } catch (e) { }

                // Cập nhật cache ngay với đúng UID - không cần hỏi Zalo API
                for (const uid of targetIds) groupAdminManager.addToCache(threadId, uid);

                const nameStr = targetNames.map(n => `• ${n}`).join("\n");
                const text = `🥈 [ KEY BẠC - PHÓ NHÓM ] 🥈\n━━━━━━━━━━━━━━━━━━\n✅ Thăng chức thành công:\n${nameStr}\n━━━━━━━━━━━━━━━━━━\n📌 Đã được thăng chức Quản lý trên Zalo.`;
                return ctx.reply({ msg: text, hidden: true }, targetIds);
            }

            if (resolvedRole === "Thành viên") {
                for (const tid of targetIds) statsManager.setRole(threadId, tid, "Thành viên");
                try { await api.removeGroupAdmins(threadId, targetIds); } catch (e) { }

                // Xóa khỏi cache ngay lập tức
                for (const uid of targetIds) groupAdminManager.removeFromCache(threadId, uid);

                const nameStr = targetNames.map(n => `• ${n}`).join("\n");
                const text = `🗑️ [ TƯỚC QUYỀN HẠN ] 🗑️\n━━━━━━━━━━━━━━━━━━\n✅ Đã giáng chức:\n${nameStr}\n━━━━━━━━━━━━━━━━━━\n📌 Đã bị gỡ quyền Quản trị trên Zalo.`;
                return ctx.reply({ msg: text, hidden: true }, targetIds);
            }
        } catch (e) { await reply(ctx, `⚠️ Lỗi: ${e.message}`); }
    },

    kickall: async (ctx) => {
        const { api, threadId, senderId, adminIds } = ctx;
        if (!ctx.isGroup) return reply(ctx, "⚠️ Lệnh này chỉ dùng trong nhóm!");
        const senderLevel = getLevel(senderId, threadId, adminIds);
        if (senderLevel < ROLES["Vàng"]) return reply(ctx, "⚠️ Chỉ Key Vàng mới có quyền dùng !kickall!");

        try {
            const res = await api.getGroupInfo(threadId);
            const info = res.gridInfoMap?.[threadId] || res[threadId];
            const members = info?.memVerList || [];
            await reply(ctx, `🚀 Đang dọn dẹp nhóm...`);
            let count = 0;
            for (const mem of members) {
                const uid = String(mem.uid || mem);
                if (uid === senderId) continue;
                if (getLevel(uid, threadId, adminIds) < senderLevel) {
                    try { await api.removeUserFromGroup(threadId, uid); count++; await new Promise(r => setTimeout(r, 600)); } catch { }
                }
            }
            await reply(ctx, `✅ Đã tiễn ${count} thành viên lên đường.`);
        } catch (e) { await reply(ctx, `⚠️ Lỗi: ${e.message}`); }
    }
};
