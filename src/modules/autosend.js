/**
 * Module: Autosend (v4.1 - Ultra Media Pro) 🚀
 * Hệ thống thông báo giờ mới chuyên nghiệp, tự động in thông tin lên Media.
 * Bổ sung chế độ Nhạc NCT Mỗi Giờ cho sếp! 🎼
 */

import fs from "node:fs";
import path from "node:path";
import moment from "moment-timezone";
import axios from "axios";
import { exec } from "child_process";
import { createCanvas, loadImage } from "canvas";
import { log } from "../logger.js";
import { statsManager } from "../utils/statsManager.js";
import { rentalManager } from "../utils/rentalManager.js";
import { tempDir } from "../utils/io-json.js";
import { searchNCT } from "../utils/nhaccuatui.js";

const CONFIG_PATH = path.join(process.cwd(), "src/modules/cache/autosend_v3_settings.json");
const HISTORY_PATH = path.join(process.cwd(), "src/modules/cache/autosend_history.json");

const MEDIA_PATHS = {
    video_gai: path.join(process.cwd(), "src/modules/cache/vdgai.json"),
    anime: path.join(process.cwd(), "src/modules/cache/vdanime.json"),
    anh_gai: path.join(process.cwd(), "src/modules/cache/gai.json")
};

const sysBrand = "[ 🔔 SYSTEM NOTIFICATION ]: ";

function loadData(file) {
    try {
        if (!fs.existsSync(file)) return file === CONFIG_PATH ? {} : [];
        return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch { return file === CONFIG_PATH ? {} : []; }
}

function saveData(file, data) {
    try {
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
    } catch { }
}

async function getUniqueMedia(type) {
    try {
        if (type === "nct") {
            const hotSongs = await searchNCT("top 10 nhạc trẻ");
            return hotSongs[Math.floor(Math.random() * hotSongs.length)] || null;
        }

        const filePath = MEDIA_PATHS[type] || MEDIA_PATHS.video_gai;
        if (!fs.existsSync(filePath)) return null;
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const list = Array.isArray(data) ? data : (data.urls || data.data || []);
        if (list.length === 0) return null;

        const history = loadData(HISTORY_PATH);
        const filtered = list.filter(url => !history.includes(url));
        const targetList = filtered.length > 0 ? filtered : list;
        if (filtered.length === 0) saveData(HISTORY_PATH, []);
        const selected = targetList[Math.floor(Math.random() * targetList.length)];
        
        if (filtered.length > 0) {
            history.push(selected);
            if (history.length > 1000) history.shift();
            saveData(HISTORY_PATH, history);
        }
        return selected;
    } catch (e) { return null; }
}

async function processImage(inputPath, outputPath, hour) {
    try {
        const img = await loadImage(inputPath);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const overlayW = 400, overlayH = 120, x = 30, y = 30;
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(x, y, overlayW, overlayH);
        ctx.strokeStyle = "#00afea"; ctx.lineWidth = 4;
        ctx.strokeRect(x, y, overlayW, overlayH);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 35px Sans";
        ctx.fillText(`THÔNG BÁO GIỜ MỚI`, x + 20, y + 50);
        ctx.fillStyle = "#00afea"; ctx.font = "bold 45px Sans";
        ctx.fillText(`${hour}:00`, x + 20, y + 100);
        fs.writeFileSync(outputPath, canvas.toBuffer("image/jpeg"));
        return true;
    } catch (e) { return false; }
}

async function processVideo(inputPath, outputPath, hour) {
    return new Promise((resolve) => {
        const drawtext = `drawtext=text='THÔNG BÁO GIỜ MỚI - ${hour}\\:00':fontcolor=white:fontsize=40:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=h-80`;
        const cmd = `ffmpeg -y -i "${inputPath}" -vf "${drawtext}" -codec:a copy -t 15 "${outputPath}"`;
        exec(cmd, (err) => resolve(!err));
    });
}

export async function startAutosendTicker(api) {
    log.system("⏳ Động cơ Autosend v4.1 (NCT Optimized) đã sẵn sàng!");

    let lastHour = -1;
    setInterval(async () => {
        const now = moment().tz("Asia/Ho_Chi_Minh");
        const minute = now.minute();
        const hour = now.hour();

        if (hour !== lastHour && minute === 0) {
            lastHour = hour;
            const settings = loadData(CONFIG_PATH);
            const threads = statsManager.getAllThreads();

            for (const tid of threads) {
                const config = settings[tid];
                if (!config || !config.enabled || !rentalManager.isRented(tid)) continue;

                try {
                    const media = await getUniqueMedia(config.type);
                    if (!media) continue;

                    const msgCaption = `[ 🔔 SYSTEM NOTIFICATION ]\n─────────────────\n💎 Bây giờ là: ${hour}:00\n✨ Chúc nhóm mình một giờ mới tốt lành! 🚀\n─────────────────`;

                    // Nếu là NCT (Nhạc)
                    if (config.type === "nct") {
                        const stream = media.streamURL?.find(s => s.type === "320") || media.streamURL?.[0];
                        if (stream?.stream) {
                            await api.sendMessage({ msg: msgCaption + `\n🎼 Gợi ý nhạc giờ mới: ${media.name}` }, tid, 1);
                            await api.sendVoiceNative({ voiceUrl: stream.stream, duration: media.duration || 0, threadId: tid, threadType: 1 });
                        }
                        continue;
                    }

                    const mediaUrl = typeof media === 'string' ? media : (media.urls?.[0] || media.url);
                    const tempIn = path.join(tempDir, `in_${Date.now()}.tmp`);
                    const tempOut = path.join(tempDir, `out_${Date.now()}.${config.type === "anh_gai" ? "jpg" : "mp4"}`);

                    try {
                        const response = await axios({ method: 'get', url: mediaUrl, responseType: 'stream', timeout: 60000 });
                        const writer = fs.createWriteStream(tempIn);
                        response.data.pipe(writer);
                        await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });

                        const isVideo = config.type !== "anh_gai";
                        let success = false;
                        if (isVideo) success = await processVideo(tempIn, tempOut, hour);
                        else success = await processImage(tempIn, tempOut, hour);

                        const finalFile = success ? tempOut : tempIn;
                        if (isVideo) {
                            await api.sendVideoUnified({ videoPath: finalFile, msg: msgCaption, threadId: tid, threadType: 1 });
                        } else {
                            await api.sendMessage({ msg: msgCaption, attachments: [finalFile] }, tid, 1);
                        }
                    } catch (err) { } finally {
                        if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
                        if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
                    }
                } catch (err) { }
            }
        }
    }, 60000); 
}

export const commands = {
    autosend: async (ctx) => {
        const { api, threadId, threadType, args, senderId, adminIds } = ctx;
        if (!adminIds.includes(String(senderId))) return;

        const action = args[0]?.toLowerCase();
        const settings = loadData(CONFIG_PATH);

        if (action === "on") {
            settings[threadId] = { enabled: true, type: settings[threadId]?.type || "video_gai" };
            saveData(CONFIG_PATH, settings);
            return api.sendMessage({ msg: `${sysBrand}✅ Đã BẬT Autosend! Hệ thống sẽ gửi Media kèm Bọc text vào mỗi giờ.` }, threadId, threadType);
        } else if (action === "off") {
            if (settings[threadId]) settings[threadId].enabled = false;
            saveData(CONFIG_PATH, settings);
            return api.sendMessage({ msg: `${sysBrand}🚨 Đã TẮT Autosend.` }, threadId, threadType);
        } else if (["video", "anime", "anh", "nct"].includes(action)) {
            const typeMap = { "video": "video_gai", "anime": "anime", "anh": "anh_gai", "nct": "nct" };
            settings[threadId] = { enabled: true, type: typeMap[action] };
            saveData(CONFIG_PATH, settings);
            return api.sendMessage({ msg: `${sysBrand}🎯 Đã đổi loại: ${action.toUpperCase()}!` }, threadId, threadType);
        } else {
            const config = settings[threadId];
            const status = config?.enabled ? "ĐANG BẬT ✅" : "ĐANG TẮT ❌";
            let msg = `${sysBrand}[ ⚙️ CÀI ĐẶT AUTOSEND PRO ]\n─────────────────\n💡 !autosend on/off | video | anime | anh | nct\n─────────────────\n📊 Trạng thái: ${status}\n🎁 Loại: ${config?.type || "N/A"}`;
            return api.sendMessage({ msg }, threadId, threadType);
        }
    }
};
