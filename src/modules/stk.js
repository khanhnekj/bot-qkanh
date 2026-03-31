import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import FormData from "form-data";
import { log } from "../logger.js";

export const name = "stk";
export const version = "2.1.3";
export const credits = "V Tuấn & Gemini";
export const description = "Tối ưu xử lý ảnh Zalo và chống lỗi Cache";

export const commands = {
    stk: async (ctx) => {
        await stkHandler(ctx);
    }
};

async function uploadToCatbox(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", fs.createReadStream(filePath));

        const response = await axios.post("https://catbox.moe/user/api.php", form, {
            headers: form.getHeaders(),
            timeout: 30000
        });
        return response.data.trim();
    } catch (e) {
        log.error(`Lỗi Catbox: ${e.message}`);
        return null;
    }
}

async function convertMedia(mediaUrl, uniqueId) {
    const tempDir = path.join(process.cwd(), "src/modules/cache/stk_temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tIn = path.join(tempDir, `in_${uniqueId}`);
    const tOut = path.join(tempDir, `out_${uniqueId}.webp`);

    try {
        const response = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 20000
        });
        fs.writeFileSync(tIn, Buffer.from(response.data));

        if (!fs.existsSync(tIn) || fs.statSync(tIn).size < 100) return null;

        const cmdArgs = [
            "-y",
            "-i", tIn,
            "-vf", "scale='if(gt(iw,ih),min(iw,512),-1)':'if(gt(iw,ih),-1,min(ih,512))'",
            "-c:v", "libwebp",
            "-lossless", "0",
            "-compression_level", "4",
            "-q:v", "75",
            "-loop", "0",
            "-an",
            "-vsync", "0",
            tOut
        ];

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn(ffmpegPath, cmdArgs);
            ffmpeg.on("close", (code) => {
                if (code === 0) resolve();
                else reject(new Error(`ffmpeg exited with code ${code}`));
            });
            ffmpeg.on("error", reject);
        });

        if (fs.existsSync(tOut) && fs.statSync(tOut).size > 0) {
            return await uploadToCatbox(tOut);
        }
        return null;
    } catch (e) {
        log.error(`Lỗi Convert: ${e.message}`);
        return null;
    } finally {
        if (fs.existsSync(tIn)) try { fs.unlinkSync(tIn); } catch (e) { }
        if (fs.existsSync(tOut)) try { fs.unlinkSync(tOut); } catch (e) { }
    }
}

const personaName = "『 🎀 Bé Hân ✨ 』: ";

async function stkHandler(ctx) {
    const { api, threadId, threadType, message, senderId, senderName } = ctx;
    const quote = message.data?.quote;

    if (!quote || !quote.attach) {
        return api.sendMessage({ msg: `${personaName}➜ 💡 Hãy reply (phản hồi) vào ảnh hoặc GIF để Hân làm sticker xịn xò cho sếp nha! 🥺` }, threadId, threadType);
    }

    const tag = `@${senderName} `;
    try {
        let attachData = quote.attach;
        if (typeof attachData === "string") {
            try {
                attachData = JSON.parse(attachData);
            } catch (e) {
                return api.sendMessage({ msg: `${personaName}➜ ❌ Hân hông đọc được dữ liệu ảnh này, sếp thử gởi lại ảnh khác xem sao nè.` }, threadId, threadType);
            }
        }

        let mediaUrl = attachData.hdUrl || attachData.url || attachData.href || attachData.thumbUrl;
        if (!mediaUrl) {
            return api.sendMessage({ msg: `${personaName}➜ ❌ Hân hông lấy được link ảnh rồi. Sếp thử lại với ảnh khác nhé!` }, threadId, threadType);
        }

        if (Array.isArray(mediaUrl)) mediaUrl = mediaUrl[0];
        mediaUrl = decodeURIComponent(mediaUrl.replace(/\\\//g, "/"));

        await api.sendMessage({
            msg: tag + personaName + `Oki nè! Hân đang tút tát sticker và gởi vào nhóm ngay đây! Đợi em xíu siêu nha... ✨`,
            mentions: [{ uid: senderId, pos: 0, len: tag.length }]
        }, threadId, threadType);

        const uniqueId = `${senderId}_${Date.now()}`;
        const webpUrl = await convertMedia(mediaUrl, uniqueId);

        if (webpUrl && webpUrl.startsWith("http")) {
            await api.sendCustomSticker({
                animationImgUrl: webpUrl,
                staticImgUrl: webpUrl,
                threadId,
                type: threadType, // Phải dùng 'type' thay vì 'threadType'
                width: 512,
                height: 512
            });
        } else {
            api.sendMessage({ msg: `${personaName}➜ ❌ Huhu, Hân làm sticker lỗi mất rồi! Có thể do server ảnh hoặc sếp gởi file hông đúng định dạng đó.` }, threadId, threadType);
        }
    } catch (e) {
        log.error(`Lỗi STK: ${e.message}`);
        api.sendMessage({ msg: `${personaName}➜ ❌ Lỗi hệ thống: ${e.message}` }, threadId, threadType);
    }
}

