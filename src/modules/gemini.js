import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { hanManager } from "../utils/hanManager.js";
import { search as sclSearch, download as sclDownload } from "../utils/soundcloud.js";
import { uploadAudioFile } from "../utils/process-audio.js";

export const name = "gemini";
export const description = "Hỏi đáp với AI Gemini (Hân) + Tạo video AI";

// Load config cho PixVerse token
let PIXVERSE_TOKEN = "";
try {
    const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
    PIXVERSE_TOKEN = config.pixverse?.token || "";
} catch { }

async function reply(ctx, text) {
    return ctx.api.sendMessage(
        { msg: text, quote: ctx.message.data },
        ctx.threadId,
        ctx.threadType
    );
}

// Hàm chuẩn hóa prompt để AI trả lời như người thật
function makeNaturalPrompt(p) {
    const naturalInstruction = `Bạn là Hân (18 tuổi), một cô gái miền Trung cực kỳ năng động, hài hước và có phần hơi 'lầy lội'.
- Quy tắc: Tuyệt đối không dùng phong cách 'trợ lý ảo'. Hãy trả lời như nhắn tin với bạn thân.
- Phong cách: Dùng ngôn ngữ tự nhiên, lầy lội, có thể dùng từ địa phương (ni, tề, mi, chi...) hoặc từ lóng Gen Z.
- Xưng hô: Xưng 'Hân' hoặc 'tôi', gọi người dùng là 'mi', 'ông', 'bà', 'cậu' hoặc 'mi'.
- Yêu cầu: Trả lời cực kỳ ngắn gọn, súc tích, tránh dùng nhiều icon hay kí tự đặc biệt rườm rà.
Câu bạn cần trả lời là: `;
    return naturalInstruction + p;
}

const personaName = "『 🎀 Bé Hân 』: ";

// ---- PixVerse helpers ----
const PIXVERSE_URL = "https://app-api.pixverse.ai/creative_platform";

async function downloadFile(url, destPath) {
    const response = await axios({ url, method: "GET", responseType: "stream", timeout: 120000 });
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve({
            contentType: response.headers["content-type"],
            path: destPath
        }));
        writer.on("error", reject);
    });
}

const PIXVERSE_HEADERS = {
    "token": PIXVERSE_TOKEN,
    "x-platform": "Web",
    "Content-Type": "application/json",
    "Origin": "https://app.pixverse.ai",
    "Referer": "https://app.pixverse.ai/",
    "refresh": "credit",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
};

async function pixverseCreate(prompt) {
    const seed = Math.floor(Math.random() * 999999999);
    const res = await axios.post(`${PIXVERSE_URL}/video/t2v`, {
        prompt,
        model: "v5.6",
        quality: "360p",
        aspect_ratio: "16:9",
        duration: 5,
        create_count: 1,
        credit_change: 20,
        seed
    }, { headers: PIXVERSE_HEADERS });
    if (res.data?.ErrCode === 0) return res.data.Resp?.video_id;
    throw new Error(res.data?.ErrMsg || "Lỗi tạo video PixVerse");
}

async function pixverseStatus(assetId, tab = "video") {
    const res = await axios.post(`${PIXVERSE_URL}/asset/library/list`, {
        tab: tab, asset_source: 1, folder_id: 0, offset: 0, limit: 20,
        sort_order: "", current: 1, filter: { off_peak: 0 }, app_offset: 0, web_offset: 0
    }, { headers: PIXVERSE_HEADERS });
    if (res.data?.ErrCode === 0 && res.data.Resp?.data?.length > 0) {
        const list = res.data.Resp.data;
        // Log item đầu tiên để debug cấu trúc fields
        console.log(`[PixVerse status] tab=${tab} assetId=${assetId} list[0]=`, JSON.stringify(list[0]).slice(0, 400));
        // So sánh ID dưới dạng string để tránh type mismatch
        const sid = String(assetId);
        const asset = list.find(v =>
            String(v.video_id) === sid ||
            String(v.image_id) === sid ||
            String(v.id) === sid
        );
        if (asset) {
            console.log(`[PixVerse status] FOUND asset:`, JSON.stringify(asset).slice(0, 400));
            return asset;
        }
        console.log(`[PixVerse status] NOT FOUND id=${sid} in list IDs:`, list.map(v => `vid:${v.video_id},img:${v.image_id},id:${v.id}`).join(" | "));
    } else {
        console.log(`[PixVerse status] ErrCode=${res.data?.ErrCode} data len=${res.data?.Resp?.data?.length}`);
    }
    return null;
}


// Fallback: lấy asset từ danh sách gần nhất
async function pixverseGetLatest(tab = "video") {
    const res = await axios.post(`${PIXVERSE_URL}/asset/library/list`, {
        tab: tab, asset_source: 1, folder_id: 0, offset: 0, limit: 1,
        sort_order: "", current: 1, filter: { off_peak: 0 }, app_offset: 0, web_offset: 0
    }, { headers: PIXVERSE_HEADERS });
    if (res.data?.ErrCode === 0 && res.data.Resp?.data?.length > 0) {
        return res.data.Resp.data[0];
    }
    return null;
}

async function pixverseCredits() {
    const res = await axios.get(`${PIXVERSE_URL}/user/credits`, { headers: PIXVERSE_HEADERS });
    if (res.data?.ErrCode === 0) return res.data.Resp;
    return null;
}

async function pixverseCreateImage(prompt) {
    const seed = Math.floor(Math.random() * 999999999);
    const res = await axios.post(`${PIXVERSE_URL}/image/t2i`, {
        prompt,
        model: "qwen-image",
        quality: "720p",
        aspect_ratio: "16:9",
        create_count: 1,
        credit_change: 5,
        seed
    }, { headers: PIXVERSE_HEADERS });
    console.log("[PixVerse createImage resp]", JSON.stringify(res.data?.Resp).slice(0, 300));
    if (res.data?.ErrCode === 0) {
        const id = res.data.Resp?.image_id || res.data.Resp?.video_id || res.data.Resp?.id;
        if (!id) throw new Error("API không trả về image_id: " + JSON.stringify(res.data.Resp));
        return id;
    }
    throw new Error(res.data?.ErrMsg || "Lỗi tạo ảnh PixVerse");
}



export const commands = {
    gemini: async (ctx) => {
        const prompt = ctx.args.join(" ");
        if (!prompt) return reply(ctx, "◈ Bạn cần nhập câu hỏi sau lệnh !gemini\n💡 Ví dụ: !gemini Xin chào");

        try {
            ctx.api.sendTypingEvent(ctx.threadId, ctx.threadType).catch(() => { });

            const res = await axios.get(`https://api.subhatde.id.vn/api/AI/geminipro`, {
                params: {
                    prompt: makeNaturalPrompt(prompt),
                    fileUrl: "",
                    utm_source: ""
                }
            });

            const result = res.data.content || res.data.result || res.data.message || res.data.data || (typeof res.data === 'string' ? res.data : null);

            if (result) {
                const tag = `@${ctx.senderName} `;
                await ctx.api.sendMessage({
                    msg: tag + personaName + result,
                    mentions: [{ uid: ctx.senderId, pos: 0, len: tag.length }],
                    quote: ctx.message.data
                }, ctx.threadId, ctx.threadType);
            } else {
                await reply(ctx, "⚠️ Hân không nhận được phản hồi từ AI mất rồi...");
            }
        } catch (e) {
            console.error("[GEMINI ERROR]", e.message);
        }
    },

    han: async (ctx) => {
        const { threadId, args, adminIds, senderId } = ctx;
        const isOwner = adminIds.includes(String(senderId));
        if (!isOwner) return reply(ctx, "⚠️ Chỉ Admin Bot mới có quyền cài đặt Hân!");

        const status = args[0]?.toLowerCase();
        if (status === "on") {
            hanManager.set(threadId, true);
            await reply(ctx, "✅ Đã BẬT Bé Hân trong nhóm này! Hân sẽ trả lời khi được gọi tên nè. 🥰");
        } else if (status === "off") {
            hanManager.set(threadId, false);
            await reply(ctx, "⛔ Đã TẮT Bé Hân trong nhóm này! Hân sẽ không làm phiền nữa đâu ạ. 👋");
        } else {
            await reply(ctx, `◈ Dùng: !han [on/off]\n💡 Trạng thái hiện tại: ${hanManager.isEnabled(threadId) ? "Đang BẬT" : "Đang TẮT"}`);
        }
    },

    taovideo: async (ctx) => {
        const { api, threadId, threadType, args, senderName, senderId } = ctx;
        const prompt = args.join(" ");

        if (!prompt) {
            return reply(ctx, `${personaName}Cậu muốn Hân làm video về cái gì nè? Gõ nội dung sau lệnh nha, ví dụ: -taovideo con mèo phi hành gia 🚀`);
        }

        if (!PIXVERSE_TOKEN) {
            return reply(ctx, "⚠️ Chưa cấu hình token PixVerse trong config.json ạ.");
        }

        try {
            const credits = await pixverseCredits();
            const total = (credits?.credit_daily || 0) + (credits?.credit_monthly || 0) + (credits?.credit_package || 0);
            if (total < 20) {
                return reply(ctx, `${personaName}Hân hết năng lượng (credits) mất tiêu rồi... 😢 Đợi em hồi phục tí nha, giờ còn có ${total} mà 1 clip tận 20 lận.`);
            }
        } catch { }

        const tag = `@${senderName} `;
        await api.sendMessage({
            msg: tag + personaName + `Oki! Hân đang làm video "${prompt}" cho cậu đây. Chờ em một lát (tầm 1-2 phút) là xong ngay nha! 🎬⏳`,
            mentions: [{ uid: senderId, pos: 0, len: tag.length }]
        }, threadId, threadType);

        try {
            const videoId = await pixverseCreate(prompt);
            console.log(`[PixVerse] Created task: ${videoId}`);

            // Polling cho đến khi video xong
            let videoData = null;
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 10000)); // 10s mỗi lần check
                videoData = await pixverseStatus(videoId, "video");
                if (videoData?.video_status === 1 || videoData?.status === 1) break;
                if (videoData?.video_status === 2 || videoData?.status === 2) throw new Error("Video bị lỗi khi xử lý!");
                videoData = null;
            }

            // Nếu polling ko tìm thấy, thử lấy video mới nhất
            if (!videoData || !videoData.url) {
                const latest = await pixverseGetLatest("video");
                if (latest && (latest.video_status === 1 || latest.status === 1) && latest.url) {
                    videoData = latest;
                }
            }

            if (!videoData || !videoData.url) {
                throw new Error("Quá thời gian chờ. Video chưa xong ạ.");
            }

            const tmpPath = path.join(process.cwd(), `pixverse_${Date.now()}.mp4`);
            await downloadFile(videoData.url, tmpPath);

            await api.sendVideoUnified({
                videoPath: tmpPath,
                msg: `${tag}${personaName}Tadaaa! Video của cậu xong rồi nè, nhìn mướt chưa? 🎬🏆 Yêu cầu của cậu là "${prompt}" nhé! hihi.`,
                threadId,
                threadType,
                mentions: [{ uid: senderId, pos: 0, len: tag.length }]
            });

            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

        } catch (e) {
            console.error("[PixVerse Video Error]", e.message);
            await reply(ctx, `${personaName}Hân xin lỗi, video bị lỗi mất tiêu rồi: ${e.message}. Cậu thử lại sau nhé! 😢`);
        }
    },

    taoanh: async (ctx) => {
        const { api, threadId, threadType, args, senderName, senderId } = ctx;
        const prompt = args.join(" ");

        if (!prompt) {
            return reply(ctx, `${personaName}Cậu muốn Hân vẽ gì nè? Gõ nội dung sau lệnh nha. VD: -taoanh con mèo bay`);
        }

        if (!PIXVERSE_TOKEN) {
            return reply(ctx, "⚠️ Hân chưa có chìa khóa (token) PixVerse nên hông vẽ được ạ. Cậu nhắc Admin cài nha!");
        }

        try {
            const credits = await pixverseCredits();
            const total = (credits?.credit_daily || 0) + (credits?.credit_monthly || 0) + (credits?.credit_package || 0);
            if (total < 5) {
                return reply(ctx, `${personaName}Hân hết năng lượng (credits) để vẽ rồi... 😢 Cậu đợi em hồi phục tí nha (Cần 5, còn ${total}).`);
            }
        } catch { }

        const tag = `@${senderName} `;
        await api.sendMessage({
            msg: tag + personaName + `Oki nè! Hân đang vẽ bức tranh "${prompt}" cho cậu đây. Chờ em tí xíu (30s) nha! 🎨⏳`,
            mentions: [{ uid: senderId, pos: 0, len: tag.length }]
        }, threadId, threadType);

        try {
            const imageId = await pixverseCreateImage(prompt);
            console.log(`[PixVerse] Image Task ID: ${imageId} (type: ${typeof imageId})`);

            let imageData = null;
            // Polling loop - 30 lần check (5 phút)
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 10000)); // Check mỗi 10s
                console.log(`[PixVerse] Poll ${i + 1}/30 for image id=${imageId}`);
                try {
                    imageData = await pixverseStatus(imageId, "image");
                } catch (pollErr) {
                    console.error(`[PixVerse] Poll error: ${pollErr.message}`);
                    imageData = null;
                }
                if (imageData) {
                    // PixVerse dùng image_status cho ảnh (1=xong, 2=lỗi, 0=đang xử lý)
                    const st = imageData.image_status ?? imageData.status ?? imageData.video_status;
                    console.log(`[PixVerse] Poll status=${st} (image_status=${imageData.image_status}, status=${imageData.status})`);
                    if (st === 1) break; // Hoàn thành
                    if (st === 2) throw new Error("PixVerse báo lỗi xử lý ảnh.");
                    imageData = null; // Đang xử lý, chờ tiếp
                }
            }

            // Fallback lấy cái mới nhất nếu polling xịt
            if (!imageData) {
                console.log(`[PixVerse] Polling done, trying fallback getLatest...`);
                const latest = await pixverseGetLatest("image");
                console.log(`[PixVerse] Latest image:`, JSON.stringify(latest)?.slice(0, 300));
                if (latest && (latest.image_status === 1 || latest.status === 1 || latest.video_status === 1)) {
                    imageData = latest;
                }
            }

            if (!imageData) {
                throw new Error("Quá thời gian chờ hoặc không tìm thấy ảnh.");
            }

            // Lấy URL ảnh - check nhiều fields khác nhau
            // PixVerse có thể dùng image_path (path trên CDN) thay vì url trực tiếp
            let imageUrl = imageData.url || imageData.image_url || imageData.origin_url ||
                imageData.download_url || imageData.hdUrl || imageData.href;
            // Nếu vẫn chưa có, build từ image_path qua CDN PixVerse
            if (!imageUrl && imageData.image_path) {
                imageUrl = `https://cdn-materials.pixverse.ai/${imageData.image_path}`;
            }
            console.log(`[PixVerse] Final imageUrl: ${imageUrl}`);
            if (!imageUrl) {
                throw new Error("Tìm thấy ảnh nhưng không có URL. Data: " + JSON.stringify(imageData).slice(0, 300));
            }
            
            // Xác định đuôi file
            let ext = "jpg";
            if (imageUrl.toLowerCase().includes(".png")) ext = "png";
            else if (imageUrl.toLowerCase().includes(".webp")) ext = "webp";

            const tmpPath = path.join(process.cwd(), `tmp_pix_${Date.now()}.${ext}`);
            await downloadFile(imageUrl, tmpPath);

            if (!fs.existsSync(tmpPath)) throw new Error("Tải ảnh thất bại, file không tồn tại.");

            await api.sendMessage({
                msg: `${tag}${personaName}Ảnh của cậu xong rồi nè! Đẹp hông? 🎨💖`,
                attachments: [tmpPath],
                mentions: [{ uid: senderId, pos: 0, len: tag.length }]
            }, threadId, threadType);

            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

        } catch (e) {
            console.error("[PixVerse Image Error]", e);
            await reply(ctx, `${personaName}Huhu, Hân vẽ lỗi mất rồi: ${e.message}. Cậu đừng buồn nha, thử lại sau giúp Hân nhé! 😢`);
        }
    },
};

export async function handle(ctx) {
    const { content, threadId, threadType, api, senderId, senderName } = ctx;
    if (!content || ctx.message.isSelf) return false;
    
    // Kiểm tra Hân có đang bật trong box không
    if (!hanManager.isEnabled(threadId)) return false;

    // Các từ khóa gọi Hân (chỉ dùng tên riêng) 
    const keywords = ["hân ơi", "bé hân", "hân nè", "hân"];
    const lowerContent = content.toLowerCase();

    const botId = String(api.getContext().uid);
    const mentions = ctx.message.data?.mentions || [];
    const isMentioned = mentions.some(m => String(m.uid) === botId);
    const isReplyToBot = String(ctx.message.data?.quote?.ownerId) === botId;
    const currentPrefix = ctx.prefix || "-";

    // Nếu gọi tên Hân, mention hoặc reply bot (không dùng prefix)
    if ((keywords.some(word => lowerContent.includes(word)) || isMentioned || isReplyToBot) && !content.startsWith(currentPrefix)) {
        let prompt = content;
        keywords.forEach(word => {
            prompt = prompt.replace(new RegExp(word, "gi"), "");
        });
        prompt = prompt.trim();

        const text = lowerContent;

        // 1. Detect tạo video
        if (text.includes("tạo video") || text.includes("làm video") || text.includes("tạo clip") || text.includes("quay video")) {
            const promptValue = text.replace(/hân ơi|hân|tạo video|làm video|tạo clip|quay video/gi, "").trim();
            if (promptValue) {
                ctx.args = [promptValue];
                return commands.taovideo(ctx);
            } else {
                return reply(ctx, `${personaName}Cậu muốn Hân làm video về nội dung gì nè? Hãy kể cho Hân nghe với, Hân sẽ làm thật xịn cho cậu luôn! 🎬✨\n💡 Ví dụ: hân ơi tạo video con mèo bay vào vũ trụ`);
            }
        }

        // 2. Detect tạo ảnh
        if (text.includes("tạo ảnh") || text.includes("vẽ cho") || text.includes("vẽ ảnh") || text.includes("vẽ con") || text.includes("vẽ cái")) {
            const promptValue = text.replace(/hân ơi|hân|tạo ảnh|vẽ cho|vẽ ảnh|vẽ con|vẽ cái/gi, "").trim();
            if (promptValue) {
                ctx.args = [promptValue];
                return commands.taoanh(ctx);
            } else {
                return reply(ctx, `${personaName}Cậu muốn Hân vẽ gì cho nào? Hãy tả cho Hân nghe nha, em sẽ vẽ thật là đẹp luôn ạ! 🎨💖\n💡 Ví dụ: hân ơi vẽ cho mình một thiên thần nhỏ`);
            }
        }

        // 3. Detect mở nhạc / hát bài
        const musicKeywords = ["mở nhạc", "phát nhạc", "hát bài", "bật nhạc", "cho nghe bài", "cho nghe nhạc", "tìm bài", "tìm nhạc"];
        const matchedMusicKw = musicKeywords.find(kw => text.includes(kw));
        if (matchedMusicKw) {
            // Tìm vị trí từ khóa nhạc và lấy phần text ngay SAU nó (giữ nguyên hoa/thường)
            const kwIdx = content.toLowerCase().indexOf(matchedMusicKw);
            let musicQuery = kwIdx !== -1
                ? content.slice(kwIdx + matchedMusicKw.length).trim()
                : "";

            // Fallback: xóa keywords nếu không tách được
            if (!musicQuery) {
                musicQuery = content;
                [...keywords, ...musicKeywords].forEach(kw => {
                    musicQuery = musicQuery.replace(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"), "");
                });
                musicQuery = musicQuery.trim();
            }

            if (!musicQuery) {
                return reply(ctx, `${personaName}Cậu muốn nghe bài nào đó? Nói tên bài cho Hân với nà! 🎵`);
            }

            const tag = `@${senderName} `;
            await api.sendMessage({
                msg: tag + personaName + `Ối giời, cái bài ni nghe là muốn ôm nhau dưới mưa liền tề. Để Hân mở cho mi nghe, có chi muốn ôm ai thì hú Hân nha :3`,
                mentions: [{ uid: senderId, pos: 0, len: tag.length }]
            }, threadId, threadType);

            try {
                const results = await sclSearch(musicQuery);
                const tracks = results.filter(r => r.kind === 'track');
                if (tracks.length === 0) {
                    return reply(ctx, `${personaName}Hân tìm hoài mà không ra bài nào hết cậu ơi! Thử đổi tên bài xem sao nhé. 😢`);
                }

                // Lấy bài đầu tiên tìm được (chính xác nhất)
                const track = tracks[0];
                console.log(`[Hân Music] Playing: ${track.title} | ${track.permalink_url}`);

                // Tải nhạc
                const { url: streamUrl } = await sclDownload(track.permalink_url);
                const tempMp3 = path.join(process.cwd(), `han_music_${Date.now()}.mp3`);

                const response = await axios({ method: 'get', url: streamUrl, responseType: 'stream', timeout: 60000 });
                const writer = fs.createWriteStream(tempMp3);
                response.data.pipe(writer);
                await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });

                // Upload & gửi voice
                const audioData = await uploadAudioFile(tempMp3, api, threadId, threadType);
                await api.sendVoiceNative({
                    voiceUrl: audioData.voiceUrl,
                    duration: audioData.duration || 0,
                    fileSize: audioData.fileSize,
                    threadId,
                    threadType
                });

                // Thông báo bài đang phát
                const dur = track.duration ? `${Math.floor(track.duration / 60000)}:${String(Math.floor((track.duration % 60000) / 1000)).padStart(2, '0')}` : '?:??';
                await api.sendMessage({
                    msg: tag + personaName + `Xong rồi nè! Bài "${track.title}" của ${track.user?.username || 'idol'} đó, nghe đi cho phê nha. [${dur}]`,
                    mentions: [{ uid: senderId, pos: 0, len: tag.length }]
                }, threadId, threadType);

                if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
            } catch (musicErr) {
                console.error("[Hân Music Error]", musicErr.message);
                reply(ctx, `${personaName}Huố hông mở được nhạc rồi cậu ơi: ${musicErr.message} 😢`);
            }
            return true;
        }

        // 3. Xử lý câu hỏi Gemini
        const finalPrompt = prompt || "Chào bạn";
        try {
            api.sendTypingEvent(threadId, threadType).catch(() => { });
            const res = await axios.get(`https://api.subhatde.id.vn/api/AI/geminipro`, {
                params: { prompt: makeNaturalPrompt(finalPrompt), fileUrl: "", utm_source: "" }
            });

            const result = res.data.content || res.data.result || res.data.message || res.data.data;
            if (result) {
                const tag = `@${senderName} `;
                await api.sendMessage({
                    msg: tag + personaName + result,
                    mentions: [{ uid: senderId, pos: 0, len: tag.length }],
                    quote: ctx.message.data
                }, threadId, threadType);
                return true;
            }
        } catch (e) {
            console.error("[GEMINI KEYWORD ERROR]", e.message);
        }
    }
    return false;
}


