import { rentalManager } from "../utils/rentalManager.js";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { statsManager } from "../utils/statsManager.js";
import { threadSettingsManager } from "../utils/threadSettingsManager.js";

export const name = "admin";
export const description = "Lệnh quản trị hệ thống: rent, listbox, status...";

async function reply(ctx, text) {
    await ctx.api.sendMessage(
        { msg: text, quote: ctx.message.data },
        ctx.threadId,
        ctx.threadType
    );
}

function isAdmin(ctx) {
    return ctx.adminIds.includes(String(ctx.senderId));
}

async function getTargetName(api, userId) {
    if (!userId) return "Người dùng";
    const stats = statsManager.getStats(null, userId);
    if (stats && stats.name && stats.name !== "Người dùng") return stats.name;
    try {
        const u = await api.getUserInfo(userId);
        const user = u[userId] || Object.values(u)[0];
        return user?.displayName || user?.zaloName || `ID:${userId}`;
    } catch { return `ID:${userId}`; }
}

async function getGroupName(api, groupId) {
    if (!groupId) return "Nhóm ẩn danh";
    try {
        const info = await api.getGroupInfo(groupId);
        // zca-js có thể trả về thông tin dưới nhiều dạng tùy version
        const groupInfo = info.gridInfoMap?.[groupId] || info;
        return groupInfo.name || groupInfo.groupName || groupId;
    } catch { return groupId; }
}

export const pendingBoxRemovals = global.pendingBoxRemovals || new Map();
global.pendingBoxRemovals = pendingBoxRemovals;

export const pendingRentRemovals = global.pendingRentRemovals || new Map();
global.pendingRentRemovals = pendingRentRemovals;

export const pendingGroupInvites = global.pendingGroupInvites || new Map();
global.pendingGroupInvites = pendingGroupInvites;

export const pendingAdminRemovals = global.pendingAdminRemovals || new Map();
global.pendingAdminRemovals = pendingAdminRemovals;

// ─── Logic Duyệt Auto (Tự động duyệt lời mời) ───
if (global.autoAcceptInterval) clearInterval(global.autoAcceptInterval);
global.autoAcceptInterval = setInterval(async () => {
    try {
        const configPath = path.resolve(process.cwd(), "config.json");
        const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (!configData.bot.autoAcceptInvites) return;

        // Nếu sếp hông đang chạy API thì skip (tránh lỗi bẻ khóa)
        if (!global.zca_api) return;

        const data = await global.zca_api.getGroupInvites();
        const invites = data.invitations || data.list || data.invites || [];
        if (invites.length === 0) return;

        console.log(`[AutoAccept] Phát hiện ${invites.length} lời mời. Tiến hành duyệt...`);
        for (const inv of invites) {
            const gi = inv.groupInfo || inv;
            const gId = gi.groupId || gi.grid || inv.groupId;
            const gName = gi.name || gi.groupName || "Nhóm ẩn danh";
            
            await global.zca_api.handleGroupInvite(gId, true);
            console.log(`[AutoAccept] Đã vào nhóm: ${gName} (${gId})`);
            
            // Gửi lời chào (tùy ý)
            // await global.zca_api.sendMessage({ msg: "Bé Hân đã có mặt! Chào sếp và mọi người trong nhóm nhé! ✨" }, gId, 1).catch(() => {});
        }
    } catch (e) {
        // console.error("[AutoAccept Error]", e.message);
    }
}, 120000); // 2 Phút quét một lần

export const commands = {

    admin: async (ctx) => {
        if (!isAdmin(ctx)) {
            await reply(ctx, "⚠️ Bạn không có quyền dùng lệnh quản trị!");
            return;
        }

        const [sub, ...rest] = ctx.args;

        if (!sub) {
            await reply(ctx,
                `[ ⚙️ ADMIN COMMANDS ]\n` +
                `─────────────────\n` +
                ` ❯ ${ctx.prefix}admin status ➥ Trạng thái bot\n` +
                ` ❯ ${ctx.prefix}admin list   ➥ Danh sách Admin\n` +
                ` ❯ ${ctx.prefix}listbox      ➥ Danh sách Box\n` +
                ` ❯ ${ctx.prefix}admin say    ➥ Bot nói gì đó\n` +
                ` ❯ ${ctx.prefix}admin add    ➥ Tag/Reply/ID để thêm Admin\n` +
                ` ❯ ${ctx.prefix}admin del    ➥ Tag/Reply/ID/STT để xoá Admin\n` +
                ` ❯ ${ctx.prefix}admin invites ➥ Danh sách lời mời vào nhóm\n` +
                ` ❯ ${ctx.prefix}admin accept  ➥ Chấp nhận mời (on/off) [ID]\n` +
                 ` ❯ ${ctx.prefix}admin join    ➥ Vào nhóm bằng link\n` +
                 ` ❯ ${ctx.prefix}admin join    ➥ Vào nhóm bằng link\n` +
                 ` ❯ ${ctx.prefix}admin auto    ➥ Duyệt auto (on/off)\n` +
                 ` ❯ ${ctx.prefix}admin set     ➥ Cài đặt: prefix, selflisten, adminonly, autoaccept\n` +
                 `─────────────────\n` +
                 `✨ Dùng !rent để quản lý thuê bot.`
            );
            return;
        }

        switch (sub.toLowerCase()) {
            case "set": {
                const type = rest[0]?.toLowerCase();
                const status = rest[1];
                const configPath = path.resolve(process.cwd(), "config.json");
                const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));

                if (!type) {
                    return reply(ctx, `[ ⚙️ CÀI ĐẶT HỆ THỐNG ]\n─────────────────\n ❯ !admin set prefix [kí tự]\n ❯ !admin set selflisten [on/off]\n ❯ !admin set adminonly [on/off]\n ❯ !admin set autoaccept [on/off]\n─────────────────`);
                }

                switch (type) {
                    case "prefix":
                        if (!status) return reply(ctx, "◈ Dùng: !admin set prefix [kí tự]");
                        configData.bot.prefix = status;
                        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");
                        return reply(ctx, `✅ Đã đổi prefix chính thành: ${status}`);
                    
                    case "selflisten":
                        if (status === "on") configData.bot.selfListen = true;
                        else if (status === "off") configData.bot.selfListen = false;
                        else return reply(ctx, "◈ Dùng: !admin set selflisten [on/off]");
                        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");
                        return reply(ctx, `✅ Đã ${configData.bot.selfListen ? "BẬT" : "TẮT"} chế độ tự nghe lệnh của chính mình.`);
                        
                    case "adminonly": {
                        if (!ctx.isGroup) return reply(ctx, "⚠️ Lệnh này chỉ dùng trong nhóm!");
                        let newVal;
                        if (status === "on") newVal = true;
                        else if (status === "off") newVal = false;
                        else newVal = !threadSettingsManager.isAdminOnly(ctx.threadId); // toggle
                        threadSettingsManager.set(ctx.threadId, "adminOnly", newVal);
                        return reply(ctx, `✅ Đã ${newVal ? "BẬT" : "TẮT"} chế độ Admin Only tại nhóm này.`);
                    }

                    case "autoaccept":
                        if (status === "on") configData.bot.autoAcceptInvites = true;
                        else if (status === "off") configData.bot.autoAcceptInvites = false;
                        else return reply(ctx, "◈ Dùng: !admin set autoaccept [on/off]");
                        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");
                        return reply(ctx, `✅ Đã ${configData.bot.autoAcceptInvites ? "BẬT" : "TẮT"} chế độ tự động duyệt lời mời vào nhóm.`);

                    default:
                        return reply(ctx, "⚠️ Cài đặt này không tồn tại.");
                }
            }
            case "status": {
                const up = process.uptime();
                const h = Math.floor(up / 3600);
                const m = Math.floor((up % 3600) / 60);
                const s = Math.floor(up % 60);
                const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
                await reply(ctx,
                    `[ 📊 TRẠNG THÁI HỆ THỐNG ]\n` +
                    `─────────────────\n` +
                    ` 🚀 Uptime : ${h}h ${m}m ${s}s\n` +
                    ` 💾 Memory : ${mem} MB\n` +
                    ` 📅 Hạn Box: ${rentalManager.getExpiry(ctx.threadId)}\n` +
                    ` 👤 Admin  : ${ctx.adminIds.length}\n` +
                    `─────────────────\n` +
                    `✨ Bé Hân vẫn đang cực kì sung sức!`
                );
                break;
            }
            case "broadcast": {
                const msg = rest.join(" ");
                if (!msg) { await reply(ctx, "◈ Dùng: !admin broadcast [nội dung]"); return; }
                await reply(ctx, `[ 📢 BROADCAST ]\n─────────────────\n${msg}`);
                break;
            }
            case "say": {
                const msg = rest.join(" ");
                if (!msg) { await reply(ctx, "◈ Dùng: !admin say [nội dung]"); return; }
                await ctx.api.sendMessage({ msg }, ctx.threadId, ctx.threadType);
                break;
            }
            case "add": {
                let targetId = null;

                if (ctx.message.data.mentions?.length > 0) {
                    targetId = ctx.message.data.mentions[0].uid;
                } else if (ctx.message.data.quote) {
                    targetId = ctx.message.data.quote.uidFrom || ctx.message.data.quote.ownerId;
                } else if (rest[0] && /^\d+$/.test(rest[0])) {
                    targetId = rest[0];
                }

                if (!targetId) {
                    await reply(ctx, "◈ Vui lòng tag người dùng, reply tin nhắn hoặc nhập ID của người muốn cấp quyền Admin.");
                    return;
                }

                targetId = String(targetId);
                if (targetId === "0") {
                    await reply(ctx, "⚠️ Không lấy được ID người dùng hợp lệ.");
                    return;
                }
                
                if (ctx.adminIds.includes(targetId)) {
                    await reply(ctx, "⚠️ Người này đã là Admin.");
                    return;
                }

                // Cập nhật config
                try {
                    const configPath = path.resolve(process.cwd(), "config.json");
                    const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));

                    const targetName = await getTargetName(ctx.api, targetId);
                    configData.admin.ids.push(targetId);
                    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");

                    // Cập nhật runtime reference
                    ctx.adminIds.push(targetId);

                    await reply(ctx, `[ 🛡️ CẤP QUYỀN ADMIN ]\n─────────────────\n✅ Đã thêm người dùng [ ${targetName} ] vào danh sách Admin thành công sếp ơi! 🎉`);
                } catch (err) {
                    await reply(ctx, `❌ Lỗi khi lưu config: ${err.message}`);
                }
                break;
            }
            case "del":
            case "remove": {
                let targetId = null;

                if (ctx.message.data.mentions?.length > 0) {
                    targetId = ctx.message.data.mentions[0].uid;
                } else if (ctx.message.data.quote) {
                    targetId = ctx.message.data.quote.uidFrom || ctx.message.data.quote.ownerId;
                } else if (rest[0] && /^\d+$/.test(rest[0])) {
                    targetId = rest[0];
                }

                if (!targetId) {
                    await reply(ctx, "◈ Vui lòng tag người dùng, reply tin nhắn hoặc nhập ID của người muốn tước quyền Admin.");
                    return;
                }

                targetId = String(targetId);
                if (targetId === "0") {
                    await reply(ctx, "⚠️ Không lấy được ID người dùng hợp lệ.");
                    return;
                }

                if (targetId === "6507497158633565458" || targetId === String(ctx.senderId)) {
                    await reply(ctx, "⚠️ Không thể xoá quyền Admin của bạn hoặc Admin chính.");
                    return;
                }
                try {
                    const configPath = path.resolve(process.cwd(), "config.json");
                    const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
                    const targetName = await getTargetName(ctx.api, targetId);

                    if (configData.admin && configData.admin.ids) {
                        configData.admin.ids = configData.admin.ids.filter(id => id !== targetId);
                    }

                    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");

                    // Xoá ở mảng hiện tại
                    const idx = ctx.adminIds.indexOf(targetId);
                    if (idx !== -1) ctx.adminIds.splice(idx, 1);

                    await reply(ctx, `[ 🛡️ TƯỚC QUYỀN ADMIN ]\n─────────────────\n✅ Đã tước quyền Admin của người dùng: ${targetName} sếp nha! 💨`);
                } catch (err) {
                    await reply(ctx, `❌ Lỗi khi lưu config: ${err.message}`);
                }
                break;
            }
            case "invites": {
                try {
                    const data = await ctx.api.getGroupInvites();
                    const invites = data.invitations || data.list || data.invites || [];

                    if (invites.length === 0) {
                        return reply(ctx, "✅ Bot không có lời mời vào nhóm nào mới.");
                    }

                    let msg = `[ 📩 LỜI MỜI VÀO NHÓM ]\n`;
                    msg += `─────────────────\n`;
                    msg += `➥ Phản hồi STT để Bot vào nhóm.\n\n`;
                    
                    const sessionInvites = [];
                    invites.forEach((inv, index) => {
                        // Cấu trúc API: { groupInfo: { groupId, name }, inviterInfo: { ... } }
                        const gi = inv.groupInfo || inv;
                        const gName = gi.name || gi.groupName || gi.gname || "Nhóm không tên";
                        const gId = gi.groupId || gi.grid || inv.groupId;
                        const inviterName = inv.inviterInfo?.displayName || inv.inviterName || "Ẩn danh";
                        const memberCount = gi.totalMember || gi.memberIds?.length || "?";
                        
                        msg += `${index + 1}. ${gName}\n   🆔: ${gId}\n   👥 Thành viên: ${memberCount}\n   👤 Mời bởi: ${inviterName}\n\n`;
                        sessionInvites.push({ index: index + 1, id: gId, name: gName });
                    });
                    
                    msg += `─────────────────\n`;
                    msg += `💡 Nhắn STT (vd: "1") để đồng ý vào nhóm.\n`;
                    msg += `💡 Dùng: !admin accept off [ID] để từ chối`;

                    pendingGroupInvites.set(`${ctx.threadId}-${ctx.senderId}`, sessionInvites);
                    setTimeout(() => {
                        pendingGroupInvites.delete(`${ctx.threadId}-${ctx.senderId}`);
                    }, 60000);

                    await reply(ctx, msg);
                } catch (e) {
                    await reply(ctx, `⚠️ Lỗi khi lấy danh sách mời: ${e.message}`);
                }
                break;
            }
            case "accept": {
                const status = rest[0]?.toLowerCase();
                const targetId = rest[1];

                if (!["on", "off"].includes(status) || !targetId) {
                    return reply(ctx, "◈ Dùng: !admin accept [on/off] [ID]");
                }

                try {
                    const isAccept = status === "on";
                    const result = await ctx.api.handleGroupInvite(targetId, isAccept);
                    if (result?.status === "pending") {
                        await reply(ctx, `⏳ Đã gửi yêu cầu vào nhóm ${targetId}, đang chờ admin duyệt.`);
                    } else {
                        await reply(ctx, `✅ Đã ${isAccept ? "CHẤP NHẬN" : "TỪ CHỐI"} lời mời vào nhóm: ${targetId}`);
                    }
                } catch (e) {
                    await reply(ctx, `⚠️ Lỗi khi xử lý lời mời: ${e.message}`);
                }
                break;
            }
            case "join": {
                const link = rest[0];
                const answer = rest.slice(1).join(" ");

                if (!link) {
                    return reply(ctx, "◈ Dùng: !admin join [Link nhóm] [Câu trả lời (nếu có)]");
                }

                try {
                    await ctx.api.joinGroup(link, answer);
                    await reply(ctx, `✅ Đã gửi yêu cầu tham gia nhóm qua link thành công!${answer ? `\n💬 Câu trả lời: ${answer}` : ""}`);
                } catch (e) {
                    await reply(ctx, `⚠️ Lỗi khi vào nhóm: ${e.message}`);
                }
                break;
            }
            case "list": {
                try {
                    const ids = ctx.adminIds;
                    if (ids.length === 0) return reply(ctx, "⚠️ Danh sách admin trống (lỗi bất ngờ).");

                    let msg = `[ 🛡️ DANH SÁCH ADMIN ]\n─────────────────\n`;
                    const result = await ctx.api.getUserInfo(ids);
                    console.log("[Admin List] Raw Result Keys:", Object.keys(result || {}));
                    
                    // Zalo API thường trả về trong changed_profiles hoặc profiles
                    const profiles = result?.changed_profiles || result?.profiles || result || {};
                    
                    const adminList = [];
                    ids.forEach((id, index) => {
                        let profile = profiles[id];
                        
                        // Nếu không tìm thấy qua ID, thử tìm trong mảng nếu profiles là array
                        if (!profile && Array.isArray(profiles)) {
                            profile = profiles.find(p => String(p.userId || p.uid || p.id) === String(id));
                        }
                        
                        const name = profile?.displayName || profile?.zaloName || profile?.name || "Người dùng Zalo";
                        msg += `${index + 1}. ${name}\n   🆔: ${id}\n\n`;
                        adminList.push({ index: index + 1, id, name });
                    });
                    
                    msg += `─────────────────\n`;
                    msg += `✨ Phản hồi STT (1, 2,...) để tước quyền Admin tương ứng.`;
                    
                    pendingAdminRemovals.set(`${ctx.threadId}-${ctx.senderId}`, adminList);
                    setTimeout(() => {
                        pendingAdminRemovals.delete(`${ctx.threadId}-${ctx.senderId}`);
                    }, 60000);

                    await reply(ctx, msg);
                } catch (e) {
                    await reply(ctx, `⚠️ Lỗi khi lấy danh sách admin: ${e.message}`);
                }
                break;
            }
            case "auto": {
                const type = rest[0]?.toLowerCase(); // Ví dụ: accept
                const status = rest[1]?.toLowerCase(); // on/off
                const configPath = path.resolve(process.cwd(), "config.json");
                const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));

                if (type === "status" || !type) {
                    const isAuto = configData.bot.autoAcceptInvites ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌";
                    return reply(ctx, `[ 🛡️ TRẠNG THÁI DUYỆT AUTO ]\n─────────────────\n ❯ Chế độ: ${isAuto}\n─────────────────\n💡 Dùng: !admin auto accept [on/off]`);
                }

                if (type === "accept") {
                    if (status === "on") {
                        configData.bot.autoAcceptInvites = true;
                        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");
                        return reply(ctx, "✅ [ THÀNH CÔNG ] Đã BẬT chế độ tự động duyệt lời mời vào nhóm! Hân sẽ tự động kiểm tra mỗi 2 phút.");
                    } else if (status === "off") {
                        configData.bot.autoAcceptInvites = false;
                        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");
                        return reply(ctx, "❌ [ THÀNH CÔNG ] Đã TẮT chế độ tự động duyệt lời mời vào nhóm.");
                    } else {
                        return reply(ctx, "◈ Dùng: !admin auto accept [on/off]");
                    }
                }
                break;
            }
            default:
                await reply(ctx, `⚠️ Sub-command không tồn tại: ${sub}`);
        }
    },

    adminonly: async (ctx) => {
        if (!isAdmin(ctx)) return reply(ctx, "⚠️ Chỉ Admin Bot mới dùng được lệnh này!");
        if (!ctx.isGroup) return reply(ctx, "⚠️ Lệnh này chỉ dùng trong nhóm!");

        const val = ctx.args[0]?.toLowerCase();
        let newVal;
        if (val === "on") newVal = true;
        else if (val === "off") newVal = false;
        else newVal = !threadSettingsManager.isAdminOnly(ctx.threadId);

        threadSettingsManager.set(ctx.threadId, "adminOnly", newVal);
        return reply(ctx, `🔒 Admin Only: ${newVal ? "✅ BẬT" : "❌ TẮT"}\n${newVal ? "Chỉ Quản trị viên nhóm mới dùng được Bot." : "Mọi thành viên có thể dùng Bot."}`);
    },

    listbox: async (ctx) =>  {
        if (!isAdmin(ctx)) return;

        const icons = ["akoi", "lỏ r hihi", "ok", "Đang tải...", "Chờ tí nha", "Xong rùi ✨"];
        let iconIdx = 0;
        const reactionInterval = setInterval(() => {
            if (ctx.message && ctx.message.data) {
                ctx.api.addReaction(icons[iconIdx % icons.length], ctx.message).catch(() => { });
                iconIdx++;
            }
        }, 2000);

        try {
            const groupsResp = await ctx.api.getAllGroups();
            const groupIds = Object.keys(groupsResp.gridVerMap || {});

            if (groupIds.length === 0) return reply(ctx, "⚠️ Bot không có trong nhóm nào.");

            const groupInfoResp = await ctx.api.getGroupInfo(groupIds);
            const groupMap = groupInfoResp.gridInfoMap || {};

            let msg = `[ 📁 DANH SÁCH BOX ]\n`;
            msg += `─────────────────\n`;
            msg += `➥ Nhập STT để Bot RỜI khỏi các nhóm CHƯA THUÊ.\n\n`;

            let index = 1;
            const unrentedGroups = [];

            for (const id of groupIds) {
                const info = groupMap[id];
                const name = info ? info.name : "Không tên";
                const isRented = rentalManager.isRented(id);
                const expiry = rentalManager.getExpiry(id);

                msg += `${index}. ${name}\n◈ ID: ${id}\n◈ Hạn: ${expiry}\n\n`;

                if (!isRented) unrentedGroups.push({ index, id, name });
                index++;

                if (msg.length > 1800) {
                    await reply(ctx, msg);
                    msg = "";
                }
            }

            if (msg) await reply(ctx, msg);

            if (unrentedGroups.length > 0) {
                pendingBoxRemovals.set(`${ctx.threadId}-${ctx.senderId}`, unrentedGroups);

                setTimeout(() => {
                    pendingBoxRemovals.delete(`${ctx.threadId}-${ctx.senderId}`);
                }, 60000);
            }

        } catch (e) {
            console.error("Lỗi Listbox:", e.message);
            await reply(ctx, `⚠️ Lỗi khi lấy danh sách nhóm: ${e.message}`);
        } finally {
            clearInterval(reactionInterval);
        }
    },


    rs: async (ctx) => {
        if (!isAdmin(ctx)) return reply(ctx, "⚠️ Chỉ dành cho Admin!");
        await reply(ctx, "🔄 Đang khởi động lại Bot...");
        setTimeout(() => {
            const child = spawn("node", ["bot.js"], {
                cwd: process.cwd(),
                detached: true,
                stdio: "inherit",
                shell: true
            });
            child.unref();
            process.exit(0);
        }, 1000);
    },

    load: async (ctx) => {
        if (!isAdmin(ctx)) return reply(ctx, "⚠️ Chỉ dành cho Admin!");

        const startTime = Date.now();
        const { allCommands, moduleInfo, eventHandlers } = ctx;

        try {
            // 1. Xóa sạch các lệnh cũ trong object tham chiếu
            for (const key in allCommands) {
                delete allCommands[key];
            }

            // 2. Load Modules mới (bypass cache)
            const { loadModules } = await import(`./index.js?t=${Date.now()}`);
            const newModules = await loadModules();

            // 3. Load Events mới (bypass cache)
            const { loadEvents } = await import(`../events/index.js?t=${Date.now()}`);
            const newEvents = await loadEvents();

            // 4. Cập nhật Commands (bao gồm lệnh từ module và lệnh từ event)
            Object.assign(allCommands, newModules.allCommands, newEvents.eventCommands);

            // 5. Cập nhật moduleInfo (tham chiếu)
            if (moduleInfo) {
                moduleInfo.length = 0;
                moduleInfo.push(...newModules.moduleInfo);
            }

            // 6. Cập nhật eventHandlers (tham chiếu)
            if (eventHandlers) {
                eventHandlers.length = 0;
                eventHandlers.push(...newEvents.handlers, ...newModules.extraHandlers);
            }

            const endTime = Date.now();
            const msg = `✅ HỆ THỐNG ĐÃ ĐƯỢC LÀM MỚI!\n` +
                `─────────────────\n` +
                `◈ Module : ${newModules.moduleInfo.length}\n` +
                `◈ Lệnh   : ${Object.keys(allCommands).length}\n` +
                `◈ Event  : ${newEvents.handlers.length}\n` +
                `◈ Speed  : ${endTime - startTime}ms\n` +
                `─────────────────\n` +
                `🚀 Toàn bộ thay đổi đã có hiệu lực!`;

            await reply(ctx, msg);

        } catch (e) {
            console.error("Lỗi khi load lại hệ thống:", e);
            await reply(ctx, `❌ Lỗi nghiêm trọng: ${e.message}`);
        }
    }

};

export async function handle(ctx) {
    const { content, senderId, threadId, api, isGroup } = ctx;
    const key = `${threadId}-${senderId}`;
    const choice = parseInt(content);
    if (isNaN(choice)) return false;

    const unrentedGroups = pendingBoxRemovals.get(key);
    if (unrentedGroups) {
        const target = unrentedGroups.find(g => g.index === choice);
        if (target) {
            try {
                process.stdout.write(`\n✦ Bot đang rời khỏi nhóm: ${target.name} (${target.id}) theo lệnh của admin.\n`);
                await api.sendMessage({ msg: "✦ Bot xin phép rời nhóm vì chưa được gia hạn. Hẹn gặp lại!" }, target.id, 1).catch(() => { });

                // Fallback: zca-js có thể dùng leaveGroup hoặc group.leave tùy version
                if (typeof api.leaveGroup === "function") {
                    await api.leaveGroup(target.id);
                } else if (api.group && typeof api.group.leave === "function") {
                    await api.group.leave(target.id);
                } else {
                    throw new Error("API Bot không hỗ trợ lệnh rời nhóm (leaveGroup).");
                }

                await api.sendMessage({ msg: `✦ Đã rời khỏi nhóm: ${target.name}\n◈ ID: ${target.id}` }, threadId, isGroup ? 1 : 0);

                const newUnrented = unrentedGroups.filter(g => g.index !== choice);
                if (newUnrented.length === 0) pendingBoxRemovals.delete(key);
                else pendingBoxRemovals.set(key, newUnrented);
                return true;
            } catch (e) {
                await api.sendMessage({ msg: `⚠️ Lỗi khi rời nhóm ${target.name}: ${e.message}` }, threadId, isGroup ? 1 : 0);
            }
        }
    }

    const invitesList = pendingGroupInvites.get(key);
    if (invitesList) {
        const choiceIdx = parseInt(content.trim());
        
        const target = invitesList.find(g => g.index === choiceIdx);
        if (target) {
            try {
                const result = await api.handleGroupInvite(target.id, true);
                if (result?.status === "pending") {
                    await api.sendMessage({ msg: `⏳ Đã gửi yêu cầu vào nhóm ${target.name}, đang chờ admin nhóm duyệt nha! 💖` }, threadId, isGroup ? 1 : 0);
                } else {
                    await api.sendMessage({ msg: `✅ Đã vào nhóm ${target.name} thành công!` }, threadId, isGroup ? 1 : 0);
                }
                
                const newInvites = invitesList.filter(g => g.index !== choiceIdx);
                if (newInvites.length === 0) pendingGroupInvites.delete(key);
                else pendingGroupInvites.set(key, newInvites);
                return true;
            } catch (e) {
                await api.sendMessage({ msg: `⚠️ Lỗi khi vào nhóm ${target.name}: ${e.message}` }, threadId, isGroup ? 1 : 0);
            }
        }
    }

    const rentedGroups = pendingRentRemovals.get(key);
    if (rentedGroups) {
        const target = rentedGroups.find(g => g.index === choice);
        if (target) {
            try {
                const success = rentalManager.removeRent(target.id);
                if (success) {
                    await api.sendMessage({ msg: `✦ Đã XOÁ NGÀY THUÊ thành công cho Box:\n◈ ID: ${target.id}` }, threadId, isGroup ? 1 : 0);

                    const newRented = rentedGroups.filter(g => g.index !== choice);
                    if (newRented.length === 0) pendingRentRemovals.delete(key);
                    else pendingRentRemovals.set(key, newRented);
                } else {
                    await api.sendMessage({ msg: `⚠️ Không thể xóa ngày thuê cho Box:\n◈ ID: ${target.id}. Có thể không tìm thấy hoặc đã hết hạn.` }, threadId, isGroup ? 1 : 0);
                }
                return true;
            } catch (e) {
                await api.sendMessage({ msg: `⚠️ Lỗi khi xóa thuê cho Box ${target.id}: ${e.message}` }, threadId, isGroup ? 1 : 0);
            }
        }
    }

    const adminQueue = pendingAdminRemovals.get(key);
    if (adminQueue) {
        const target = adminQueue.find(a => a.index === choice);
        if (target) {
            try {
                const targetId = String(target.id);
                if (targetId === "6507497158633565458" || targetId === String(senderId)) {
                    await api.sendMessage({ msg: `⚠️ Không thể xoá quyền Admin của bạn hoặc Admin chính qua số thứ tự.` }, threadId, isGroup ? 1 : 0);
                    return true;
                }

                const configPath = path.resolve(process.cwd(), "config.json");
                const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
                if (configData.admin && configData.admin.ids) {
                    configData.admin.ids = configData.admin.ids.filter(id => id !== targetId);
                }
                fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");

                // Update runtime
                const idx = ctx.adminIds.indexOf(targetId);
                if (idx !== -1) ctx.adminIds.splice(idx, 1);

                await api.sendMessage({ msg: `✅ Đã tước quyền Admin của ${target.name} (🆔: ${targetId}) thành công!` }, threadId, isGroup ? 1 : 0);
                
                pendingAdminRemovals.delete(key);
                return true;
            } catch (e) {
                await api.sendMessage({ msg: `⚠️ Lỗi khi xoá admin qua STT: ${e.message}` }, threadId, isGroup ? 1 : 0);
            }
        }
    }
    return false;
}

