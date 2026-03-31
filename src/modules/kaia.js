import axios from "axios";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { join, basename } from "node:path";
import { rentalManager } from "../utils/rentalManager.js";
import { statsManager } from "../utils/statsManager.js";

// Load config để lấy credentials
const config = JSON.parse(await fs.readFile("config.json", "utf-8"));
const KAIA_TOKEN = config.kaia?.token;
const KAIA_CHANNEL_ID = config.kaia?.channelId;
const CACHE_PATH = join(process.cwd(), "src", "modules", "cache", "kaia_cache.json");
const TOGGLE_PATH = join(process.cwd(), "src", "modules", "cache", "kaia_toggle.json");

let kaiaToggleCache = null;

async function loadKaiaToggle() {
    if (kaiaToggleCache) return kaiaToggleCache;
    try {
        if (existsSync(TOGGLE_PATH)) {
            const data = await fs.readFile(TOGGLE_PATH, "utf-8");
            kaiaToggleCache = JSON.parse(data);
            return kaiaToggleCache;
        }
    } catch { }
    kaiaToggleCache = {};
    return kaiaToggleCache;
}

async function saveKaiaToggle(data) {
    try {
        kaiaToggleCache = data;
        await fs.writeFile(TOGGLE_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch { }
}

async function isKaiaAutoEnabled(threadId) {
    try {
        if (existsSync(TOGGLE_PATH)) {
            const data = JSON.parse(await fs.readFile(TOGGLE_PATH, "utf-8"));
            return data[threadId] !== false;
        }
    } catch { }
    return true;
}

async function setKaiaAuto(threadId, enabled) {
    let data = {};
    try {
        if (existsSync(TOGGLE_PATH)) {
            data = JSON.parse(await fs.readFile(TOGGLE_PATH, "utf-8"));
        }
    } catch { }
    data[threadId] = enabled;
    await fs.writeFile(TOGGLE_PATH, JSON.stringify(data, null, 2), "utf-8");
    kaiaToggleCache = data;
}

export const name = "kaia";
export const description = "Xem KAIA (!kaia) hoặc Tắt/Bật tự thông báo (!kaia off / !kaia on)";

export const commands = {
    // !kaia hoặc !farm
    kaia: async (ctx) => {
        const { api, threadId, threadType, log, args, adminIds, senderId, isGroup } = ctx;

        if (!KAIA_TOKEN || !KAIA_CHANNEL_ID) {
            return api.sendMessage({ msg: "⚠️ Chưa cấu hình KAIA (token/channelId) trong config.json.\nVui lòng thiết lập để sử dụng lệnh này." }, threadId, threadType);
        }

        const sub = args[0]?.toLowerCase();
        if (["on", "bật", "off", "tắt"].includes(sub)) {
            if (!isGroup) return api.sendMessage({ msg: "⚠️ Cấu hình auto chỉ dùng cho nhóm." }, threadId, threadType);
            if (!adminIds.includes(String(senderId))) {
                return api.sendMessage({ msg: "⚠️ Chỉ Admin mới được phép bật/tắt thông báo!" }, threadId, threadType);
            }
            const isEnable = ["on", "bật"].includes(sub);
            await setKaiaAuto(threadId, isEnable);
            const statusMsg = isEnable ? "✅ Đã BẬT tính năng thông báo tự động KAIA." : " ⚠️ Đã TẮT thông báo tự động KAIA cho nhóm.";
            return api.sendMessage({ msg: statusMsg, styles: [{ start: 0, len: 45, st: "b" }] }, threadId, threadType);
        }

        try {
            const messages = await fetchDiscordMessages();
            if (!messages || messages.length === 0) {
                return api.sendMessage({ msg: "⚠️ Không lấy được dữ liệu từ hệ thống KAIA." }, threadId, threadType);
            }

            const categories = parseMessages(messages);
            const msgText = formatMessage(categories);

            if (!msgText) {
                return api.sendMessage({ msg: "⚠️ Hiện chưa có thông tin mới nào được cập nhật." }, threadId, threadType);
            }

            await api.sendMessage({ msg: msgText }, threadId, threadType);

        } catch (error) {
            log.error("Lỗi fetch KAIA Discord:", error.message);
            await api.sendMessage({ msg: `⚠️ Lỗi kết nối máy chủ KAIA: ${error.message}` }, threadId, threadType);
        }
    },

    farm: async (ctx) => {
        return commands.kaia(ctx);
    }
};

/**
 * Hàm tự động thông báo khi có thông tin mới (Gộp chung tin nhắn)
 */
export async function autoAnnounce(api, log) {
    if (!KAIA_TOKEN || !KAIA_CHANNEL_ID) return;

    try {
        const messages = await fetchDiscordMessages();
        if (!messages || messages.length === 0) return;

        // Đọc cache
        let cache = { processedIds: [] };
        if (existsSync(CACHE_PATH)) {
            try {
                const data = await fs.readFile(CACHE_PATH, "utf-8");
                cache = JSON.parse(data);
            } catch (e) {
                log.error("Lỗi đọc kaia_cache.json:", e.message);
            }
        }

        // Lọc tin nhắn mới
        const newMessages = messages.filter(msg => !cache.processedIds.includes(msg.id));
        if (newMessages.length === 0) return;

        // Thu thập dữ liệu từ tất cả các tin nhắn mới
        const combinedData = { "Hạt Giống": [], "Thời Tiết": [], "Nông Cụ": [] };
        const imageUrls = new Set();

        for (const msg of newMessages) {
            if (!msg.embeds || msg.embeds.length === 0) continue;
            for (const embed of msg.embeds) {
                const data = parseSingleEmbed(embed, msg.timestamp);
                if (data && combinedData[data.category]) {
                    combinedData[data.category].push(data);
                    if (data.imageUrl) imageUrls.add(data.imageUrl);
                }
            }
        }

        // Kiểm tra xem có dữ liệu thực sự không
        const hasContent = Object.values(combinedData).some(list => list.length > 0);
        if (!hasContent) {
            await updateCache(newMessages, cache);
            return;
        }

        // Format tin nhắn tổng hợp
        const announcementText = formatMessage(combinedData, "💡 [ THÔNG BÁO CẬP NHẬT KAIA ]");

        // Tải tất cả ảnh
        const imagePaths = [];
        for (const url of imageUrls) {
            try {
                const path = await downloadImage(url);
                if (path) imagePaths.push(path);
            } catch (e) {
                log.error(`Lỗi tải ảnh KAIA (${url}):`, e.message);
            }
        }

        // Gửi tới tất cả các box
        const allThreadIds = statsManager.getAllThreads();
        let count = 0;
        for (const threadId of allThreadIds) {
            // Chỉ gửi cho nhóm đã thuê và chưa tắt KAIA
            const isRented = rentalManager.isRented(threadId);
            if (isRented) {
                const autoEnabled = await isKaiaAutoEnabled(threadId);
                if (autoEnabled) {
                    try {
                        await api.sendMessage({
                            msg: announcementText,
                            attachments: imagePaths.filter(p => existsSync(p))
                        }, threadId, 1);
                        count++;
                    } catch (e) {
                        log.error(`Lỗi gửi auto kaia cho thread ${threadId}:`, e.message);
                    }
                }
            }
        }

        if (count > 0) log.info(`📢 [KAIA] Đã gửi thông báo tổng hợp tới ${count} nhóm.`);

        // Dọn dẹp ảnh
        for (const p of imagePaths) {
            try { if (existsSync(p)) await fs.unlink(p); } catch { }
        }

        // Cập nhật cache
        await updateCache(newMessages, cache);

    } catch (error) {
        log.error("Lỗi Auto KAIA:", error.message);
    }
}

/**
 * Cập nhật file cache
 */
async function updateCache(newMessages, cache) {
    cache.processedIds = [...new Set([...cache.processedIds, ...newMessages.map(m => m.id)])].slice(-100);
    await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/**
 * Helper: Fetch tin nhắn từ Discord
 */
async function fetchDiscordMessages() {
    const response = await axios.get(`https://discord.com/api/v9/channels/${KAIA_CHANNEL_ID}/messages?limit=30`, {
        headers: { "Authorization": KAIA_TOKEN }
    });
    return response.data;
}

/**
 * Helper: Parse 1 embed duy nhất
 */
function parseSingleEmbed(embed, timestamp) {
    const categories = ["Hạt Giống", "Thời Tiết", "Nông Cụ"];
    const authorName = embed.author?.name;
    if (!categories.includes(authorName)) return null;

    return {
        category: authorName,
        title: embed.title,
        desc: embed.description?.replace(/^>\s*/, "").trim() || "N/A",
        imageUrl: embed.thumbnail?.proxy_url || embed.thumbnail?.url || embed.image?.proxy_url || embed.image?.url,
        time: new Date(timestamp).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })
    };
}

/**
 * Helper: Tải ảnh về local
 */
async function downloadImage(url) {
    try {
        const fileName = `kaia_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
        const filePath = join(process.cwd(), fileName);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer'
        });
        await fs.writeFile(filePath, Buffer.from(response.data));
        return filePath;
    } catch { return null; }
}

/**
 * Helper: Parse list tin nhắn thành object phân loại (Dùng cho lệnh !kaia)
 */
function parseMessages(messages) {
    const categories = { "Hạt Giống": [], "Thời Tiết": [], "Nông Cụ": [] };
    const sorted = [...messages].sort((a, b) => a.id.localeCompare(b.id));

    for (const msg of sorted) {
        if (msg.embeds) {
            for (const embed of msg.embeds) {
                const data = parseSingleEmbed(embed, msg.timestamp);
                if (data && categories[data.category]) {
                    const idx = categories[data.category].findIndex(i => i.title === data.title);
                    if (idx !== -1) categories[data.category][idx] = data;
                    else categories[data.category].push(data);
                }
            }
        }
    }
    return categories;
}

/**
 * Helper: Format object categories thành text
 */
function formatMessage(categories, header = "🎮 [ THÔNG TIN NÔNG TRẠI KAIA ]") {
    let msgText = `${header}\n─────────────────\n`;
    let hasAnyInfo = false;

    for (const [catName, items] of Object.entries(categories)) {
        if (items.length > 0) {
            hasAnyInfo = true;
            msgText += `◈ ${catName.toUpperCase()}:\n`;
            items.forEach(item => {
                msgText += `  ‣ ${item.title}: ${item.desc} (${item.time})\n`;
            });
            msgText += "─────────────────\n";
        }
    }

    if (!hasAnyInfo) return null;
    msgText += "💡 Dữ liệu được cập nhật từ hệ thống Discord.";
    return msgText;
}
