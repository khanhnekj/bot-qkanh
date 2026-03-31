import { drawWelcome, drawGoodbye } from "../utils/canvasHelper.js";
import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

export const name = "groupNotify";
export const description = "Thông báo join/leave nhóm với Card Canvas Premium";

export async function handle(ctx) { }

export async function handleGroupEvent(ctx) {
    const { api, event, threadId, threadType } = ctx;
    const { type, data } = event;

    // 1. NGƯỜI THAM GIA NHÓM
    if (type === "join") {
        const members = data.updateMembers || [];
        const approverId = data.approverId || null;
        let approverName = "";

        if (approverId) {
            try {
                const appInfo = await api.getUserInfo(approverId);
                const profiles = appInfo.changed_profiles || appInfo;
                const p = profiles[approverId] || Object.values(profiles)[0];
                approverName = p?.zaloName || p?.displayName || "Admin";
            } catch { }
        }

        for (const member of members) {
            try {
                const targetId = member.uId || member.id || member.userId;
                if (!targetId) continue;

                const result = await api.getUserInfo(targetId).catch(() => null);
                let userInfo = null;
                if (result) {
                    const profiles = result.changed_profiles || result;
                    userInfo = profiles[targetId] || Object.values(profiles)[0] || result;
                }

                const finalData = {
                    ...userInfo,
                    displayName: userInfo?.zaloName || userInfo?.displayName || member.dName,
                    avatar: userInfo?.avatar || member.avatar || member.avatar_25
                };

                const groupInfo = await api.getGroupInfo(threadId).catch(() => null);
                const groupName = groupInfo?.name || "nhóm";
                const groupAvatar = groupInfo?.avatar || "";

                const buffer = await drawWelcome(finalData, groupName, approverName, groupAvatar);
                const tempPath = path.join(process.cwd(), `welcome_${targetId}_${Date.now()}.png`);
                fs.writeFileSync(tempPath, buffer);

                await api.sendMessage({
                    msg: `🎊 Chào mừng ${finalData.displayName} đã tham gia nhóm! Chúc bạn có những giây phút vui vẻ cùng mọi người nhé. ✨`,
                    attachments: [tempPath]
                }, threadId, threadType);

                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch (err) {
                log.error("Welcome Error:", err.message);
                const nameFallback = member.dName || "bạn";
                await api.sendMessage({ msg: `🎊 Chào mừng ${nameFallback} đã tham gia nhóm! ✨` }, threadId, threadType);
            }
        }
    }

    // 2. NGƯỜI RỜI NHÓM
    else if (type === "leave" || type === "remove_member") {
        const members = data.updateMembers || [];
        const groupInfo = await api.getGroupInfo(threadId).catch(() => null);
        const groupName = groupInfo?.name || "nhóm";

        for (const member of members) {
            try {
                const targetId = member.uId || member.id || member.userId;
                const finalData = {
                    displayName: member.dName,
                    avatar: member.avatar || member.avatar_25
                };

                const buffer = await drawGoodbye(finalData, groupName);
                const tempPath = path.join(process.cwd(), `goodbye_${targetId}_${Date.now()}.png`);
                fs.writeFileSync(tempPath, buffer);

                const actionText = type === "leave" ? "đã rời khỏi nhóm" : "đã được mời ra khỏi nhóm";
                await api.sendMessage({
                    msg: `👋 ${finalData.displayName} ${actionText}. Chúc bạn gặp nhiều may mắn! 💫`,
                    attachments: [tempPath]
                }, threadId, threadType);

                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch (err) {
                log.error("Goodbye Error:", err.message);
                const names = members.map(m => m.dName).join(", ");
                const actionText = type === "leave" ? "đã rời nhóm" : "đã bị mời ra";
                await api.sendMessage({ msg: `👋 ${names} ${actionText}!` }, threadId, threadType);
            }
        }
    }
}
