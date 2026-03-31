import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";
import { rentalManager } from "../utils/rentalManager.js";
import { downloadInstagram } from "../utils/instagram.js";
import { download as downloadSoundCloud } from "../utils/soundcloud.js";
import { downloadYoutube } from "../utils/youtube.js";
import { downloadAll as socialDownloader } from "../utils/socialDownloader.js";
import { downloadTikTok } from "../utils/tiktokDownloader.js";
import { downloadDouyin } from "../utils/douyinDownloader.js";
import { downloadCapCutV3 as downloadCapCut } from "../utils/capcutDownloader.js";
import { uploadToTmpFiles } from "../utils/tmpFiles.js";
import { downloadYoutubeVideo as downloadYoutubeAPI } from "../utils/ytdown.js";
import { downloadMixcloud } from "../utils/mixcloudDownloader.js";
import { drawZingPlayer } from "../utils/canvasHelper.js";
import spotify from "../utils/spotify.js";

export const name = "autodown";
export const description = "Tự động tải video/ảnh TikTok/Instagram/SoundCloud/YouTube/FB/Douyin/CapCut/Mixcloud";

const REGEX = {
    tiktok: /https?:\/\/(?:www\.tiktok\.com\/@[\w.-]+\/(?:video|photo)\/\d+|vt\.tiktok\.com\/\w+|vm\.tiktok\.com\/\w+|www\.tiktok\.com\/t\/\w+)/i,
    douyin: /https?:\/\/(?:v\.douyin\.com\/\w+|www\.douyin\.com\/video\/\d+)/i,
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?:p|tv|reel|stories)\/([^/?#&]+)/i,
    soundcloud: /https?:\/\/(?:soundcloud\.com|on\.soundcloud\.com)\/[a-zA-Z0-9._\-\/]+/i,
    youtube: /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/i,
    facebook: /https?:\/\/(?:www\.|web\.|m\.)?(?:facebook\.com|fb\.watch)\/[a-zA-Z0-9._\-\/]+/i,
    capcut: /https?:\/\/(?:www\.)?capcut\.com\/(?:t|tv2|template-detail)\/[a-zA-Z0-9_-]+/i,
    mixcloud: /https?:\/\/(?:www\.)?mixcloud\.com\/[^/]+\/[^/]+\/?/i,
    spotify: /https?:\/\/(?:open\.spotify\.com\/(?:track|album|playlist)\/|spotify:track:)([a-zA-Z0-9]+)/i,
};

const PLATFORM = {
    tiktok: { name: "TikTok", icon: "🎵", react: "⏳" },
    douyin: { name: "Douyin", icon: "🎬", react: "⏳" },
    facebook: { name: "Facebook", icon: "📘", react: "⏳" },
    instagram: { name: "Instagram", icon: "📸", react: "⏳" },
    youtube: { name: "YouTube", icon: "▶️", react: "⏳" },
    soundcloud: { name: "SoundCloud", icon: "🎧", react: "⏳" },
    capcut: { name: "CapCut", icon: "🎬", react: "⏳" },
    mixcloud: { name: "Mixcloud", icon: "☁️", react: "⏳" },
    spotify: { name: "Spotify", icon: "🎧", react: "⏳" },
};

const fmt = (n) => n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0";

// ─── HELPERS ───
async function followRedirect(url) {
    try {
        const resp = await axios.get(url, {
            maxRedirects: 5,
            timeout: 5000,
            headers: { "User-Agent": "Mozilla/5.0" },
            validateStatus: (status) => status >= 200 && status < 400
        });
        return resp.request.res.responseUrl || url;
    } catch {
        return url;
    }
}

function react(api, message, threadId, threadType, icon) {
    if (!message?.data?.msgId && !message?.data?.globalMsgId) return;
    api.addReaction(icon, {
        data: { msgId: message.data.msgId || message.data.globalMsgId, cliMsgId: message.data.cliMsgId },
        threadId, type: threadType
    }).catch(() => { });
}

async function dlFile(url, filePath, headers = {}) {
    const resp = await axios({
        url,
        method: "GET",
        responseType: "stream",
        timeout: 300000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { "User-Agent": "Mozilla/5.0", ...headers }
    });

    const totalSize = parseInt(resp.headers['content-length'], 10);
    let downloadedSize = 0;
    let lastLogged = 0;

    const w = fs.createWriteStream(filePath);
    resp.data.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (downloadedSize - lastLogged > 5 * 1024 * 1024) { // Báo tiến độ mỗi 5MB
            const percent = totalSize ? ` (${Math.floor((downloadedSize / totalSize) * 100)}%)` : '';
            log.info(`Đang tải... ${fmt(downloadedSize)} bytes${percent}`);
            lastLogged = downloadedSize;
        }
    });

    resp.data.pipe(w);
    await new Promise((r, j) => { w.on("finish", r); w.on("error", j); });
}

async function sendVideoPlayer(api, { videoUrl, thumbUrl, caption, threadId, threadType }) {
    const tmpPath = path.join(process.cwd(), `dl_vid_${Date.now()}.mp4`);
    try {
        log.info(`Đang tải video...`);
        await dlFile(videoUrl, tmpPath, { Referer: "https://www.tiktok.com/" });

        if (!fs.existsSync(tmpPath)) throw new Error("File không tồn tại.");
        const stats = fs.statSync(tmpPath);
        log.info(`Đã tải (${fmt(stats.size)} bytes). Đang upload...`);

        // Upload trực tiếp lên server Zalo để lấy URL sạch
        const uploads = await api.uploadAttachment(tmpPath, threadId, threadType);
        if (!uploads || uploads.length === 0) throw new Error("Upload lên Zalo thất bại.");

        const zaloUrl = uploads[0].fileUrl || uploads[0].url || uploads[0].href || (typeof uploads[0] === 'string' ? uploads[0] : null);
        if (!zaloUrl) throw new Error("Không lấy được URL từ Zalo upload.");

        log.success(`Upload thành công. Đang gửi trình phát...`);

        await api.sendVideoEnhanced({
            videoUrl: zaloUrl,
            thumbnailUrl: thumbUrl || "https://drive.google.com/uc?id=1pCQPRic8xPxbgUaPSIczb94S4RDdWDHK&export=download",
            duration: 10000, width: 720, height: 1280, fileSize: stats.size,
            msg: caption?.msg || caption, styles: caption?.styles,
            threadId, threadType
        });

        log.success(`Đã gửi video thành công.`);
    } catch (e) {
        log.error(`⚠️ Lỗi gửi video: ${e.message}`);
        // Fallback: Gửi file thô nếu player lỗi
        try {
            await api.sendMessage({ msg: caption?.msg || caption, styles: caption?.styles, attachments: [tmpPath] }, threadId, threadType);
        } catch (err2) {
            log.error(`⚠️ Gửi file thô cũng lỗi: ${err2.message}`);
        }
    } finally {
        if (fs.existsSync(tmpPath)) setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch (e) { } }, 20000);
    }
}

async function sendImages(api, urls, caption, threadId, threadType, headers = {}) {
    const paths = [];
    const ts = Date.now();
    try {
        for (let i = 0; i < urls.length; i++) {
            if (!urls[i]) continue;
            const p = path.join(process.cwd(), `dl_img_${ts}_${i}.jpg`);
            try {
                const resp = await axios({
                    url: urls[i],
                    method: "GET",
                    responseType: "arraybuffer",
                    timeout: 15000,
                    headers: { "User-Agent": "Mozilla/5.0", ...headers }
                });
                fs.writeFileSync(p, Buffer.from(resp.data));
                paths.push(p);
            } catch (e) { log.warn(`⚠️ Ảnh ${i + 1} lỗi: ${e.message}`); }
        }
        if (paths.length > 0) {
            await api.sendMessage({ msg: caption?.msg || caption, styles: caption?.styles, attachments: paths }, threadId, threadType);
        }
    } finally {
        setTimeout(() => { paths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); }); }, 20000);
    }
}

function makeCaption(platform, title, author, extra = "") {
    const p = PLATFORM[platform];
    const header = `Download ${p.name}\n`;
    let cap = header;
    if (title) cap += `📝 ${title.slice(0, 100)}${title.length > 100 ? "..." : ""}\n`;
    if (author && author !== "Unknown") cap += `👤 ${author}\n`;
    if (extra) cap += extra;

    return {
        msg: cap,
        styles: [
            { start: 0, len: header.length - 1, st: "b" },
            { start: 0, len: header.length - 1, st: "c_15a85f" }
        ]
    };
}

export async function sendAudio(api, audioUrl, threadId, threadType, isLarge = false) {
    if (!audioUrl) return;
    const audioPath = path.join(process.cwd(), `dl_audio_${Date.now()}.mp3`);
    try {
        log.info(`Bắt đầu tải audio...`);
        await dlFile(audioUrl, audioPath, { Referer: "https://www.mixcloud.com/" });

        const stats = fs.statSync(audioPath);
        log.info(`Tải xong (${fmt(stats.size)} bytes). Đang gửi qua Zalo...`);

        // Ưu tiên gửi Voice nếu dung lượng dưới 60MB
        if (stats.size > 60 * 1024 * 1024) {
            await api.sendMessage({ msg: "", attachments: [audioPath] }, threadId, threadType);
        } else {
            await api.sendVoiceUnified({ filePath: audioPath, threadId, threadType });
        }
        log.success(`Gửi audio thành công.`);
    } catch (e) {
        log.warn(`⚠️ Gửi audio lỗi: ${e.message}`);
    } finally {
        if (fs.existsSync(audioPath)) {
            setTimeout(() => { try { fs.unlinkSync(audioPath); } catch (e) { } }, 20000);
        }
    }
}

// ─── TOGGLE ON/OFF PER GROUP ───
const TOGGLE_FILE = path.join(process.cwd(), "src", "modules", "cache", "autodown_toggle.json");

function loadToggle() {
    try {
        if (fs.existsSync(TOGGLE_FILE)) return JSON.parse(fs.readFileSync(TOGGLE_FILE, "utf8"));
    } catch { }
    return {};
}

function saveToggle(data) {
    fs.writeFileSync(TOGGLE_FILE, JSON.stringify(data, null, 2), "utf8");
}

function isAutodownEnabled(threadId) {
    const data = loadToggle();
    return data[threadId] === true; // Mặc định tắt, phải bật mới hoạt động
}

function setAutodown(threadId, enabled) {
    const data = loadToggle();
    data[threadId] = enabled;
    saveToggle(data);
}

// Export commands cho module system (!autodown on/off)
export const commands = {
    autodown: async (ctx) => {
        const { api, args, threadId, threadType, senderId, adminIds, isGroup } = ctx;
        if (!isGroup) return api.sendMessage({ msg: "⚠️ Lệnh này chỉ dùng trong nhóm." }, threadId, threadType);

        const sub = (args[0] || "").toLowerCase();
        if (sub === "on" || sub === "bật") {
            setAutodown(threadId, true);
            const msgOn = "✅ Đã bật Auto Download trong nhóm này";
            await api.sendMessage({ msg: msgOn, styles: [{ start: 0, len: 39, st: "b" }, { start: 0, len: 39, st: "c_15a85f" }] }, threadId, threadType);
        } else if (sub === "off" || sub === "tắt") {
            setAutodown(threadId, false);
            const msgOff = " Đã tắt Auto Download trong nhóm này.";
            await api.sendMessage({ msg: msgOff, styles: [{ start: 0, len: 39, st: "b" }, { start: 0, len: 39, st: "c_db342e" }] }, threadId, threadType);
        } else {
            const status = isAutodownEnabled(threadId) ? "BẬT" : "TẮT";
            let msg = `[ 📥 AUTO DOWNLOAD ]\n`;
            msg += `─────────────────\n`;
            msg += `◈ Trạng thái: ${status}\n`;
            msg += `─────────────────\n`;
            msg += `💡 Dùng: !autodown on/off`;
            await api.sendMessage({ msg, styles: [{ start: 0, len: 20, st: "b" }, { start: 0, len: 20, st: "c_f27806" }, { start: 53, len: status.length, st: "b" }, { start: 53, len: status.length, st: isAutodownEnabled(threadId) ? "c_15a85f" : "c_db342e" }] }, threadId, threadType);
        }
    }
};

// ─── MAIN HANDLER ───
export async function handle(ctx) {
    const { content, api, message, threadId, threadType, senderId, adminIds } = ctx;
    let text = "";
    if (typeof content === "string") text = content;
    else if (message.data?.content) text = typeof message.data.content === "string" ? message.data.content : (message.data.content.href || message.data.content.text || "");
    if (!text) return false;

    let platform = null, match = null;
    for (const [key, regex] of Object.entries(REGEX)) {
        const m = text.match(regex);
        if (m) { platform = key; match = m; break; }
    }
    if (!platform) return false;

    // Check toggle per group
    if (!isAutodownEnabled(threadId)) return false;

    // Check rental/permission
    if (!adminIds.includes(String(senderId)) && !rentalManager.isRented(threadId)) return false;

    const url = match[0];
    const p = PLATFORM[platform];
    log.info(`✦ Detection [${p.name}]: ${url}`);

    const clocks = ["🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚", "🕛"];
    let ci = 0;
    
    // Gửi reaction thông báo trước
    react(api, message, threadId, threadType, "chờ 1 chút");
    
    // Sau 2 giây mới bắt đầu xoay đồng hồ
    const ri = setInterval(() => react(api, message, threadId, threadType, clocks[ci++ % 12]), 2000);

    try {
        react(api, message, threadId, threadType, p.react);

        // TikTok: dùng SnapTik API (có author đúng), fallback socialDownloader
        if (platform === "tiktok") {
            // Theo dõi redirect nếu là link rút gọn để phát hiện photo post chính xác hơn
            let finalUrl = url;
            if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com") || url.includes("tiktok.com/t/")) {
                finalUrl = await followRedirect(url);
                log.info(`◈ [TikTok] Expanded: ${finalUrl}`);
            }
            const isPhotoPost = /\/photo\//i.test(finalUrl);

            let tkData = null;
            try {
                log.info(`◈ [TikTok] Thử SnapTik API...`);
                tkData = await downloadTikTok(url); // Gửi url gốc cho SnapTik xử lý
            } catch (e) {
                log.warn(`⚠️ [TikTok] SnapTik lỗi: ${e.message}`);
            }

            if (tkData) {
                const cap = makeCaption("tiktok", tkData.title, tkData.author);

                // Nếu là photo post hoặc URL trông giống ảnh: SnapTik đôi khi bọc ảnh thành video -> buộc xử lý như ảnh
                const looksLikeImg = tkData.videoUrl && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(tkData.videoUrl);

                if ((isPhotoPost || looksLikeImg) && tkData.videoUrl && tkData.images.length === 0) {
                    log.info(`◈ [TikTok] Phát hiện ${isPhotoPost ? "Photo Post" : "Link ảnh"}, ép xử lý URL này như ảnh.`);
                    tkData.images = [tkData.videoUrl];
                    tkData.videoUrl = null;
                }

                // Ưu tiên gửi ảnh nếu là slideshow hoặc ảnh đơn
                if (tkData.images && tkData.images.length > 0) {
                    log.info(`◈ [TikTok] Phát hiện ${isPhotoPost ? "ảnh đơn/slideshow" : "media dạng ảnh"} (${tkData.images.length} ảnh).`);
                    await sendImages(api, tkData.images, cap, threadId, threadType);
                } else if (tkData.videoUrl) {
                    log.info(`◈ [TikTok] Gửi video...`);
                    await sendVideoPlayer(api, { videoUrl: tkData.videoUrl, thumbUrl: tkData.cover, caption: cap, threadId, threadType });
                }

                if (tkData.audioUrl) await sendAudio(api, tkData.audioUrl, threadId, threadType);
                return false;
            }

            // Fallback: dùng socialDownloader
            log.info(`◈ [TikTok] Fallback → socialDownloader...`);
            const data = await socialDownloader(finalUrl);
            if (data.error || !data.medias || data.medias.length === 0) {
                log.error(`⚠️ Lỗi API tải: ${data.message || "Không tìm thấy media"}`);
                react(api, message, threadId, threadType, ":-((");
                return false;
            }

            const cap = makeCaption("tiktok", data.title, data.author);
            let imgs = data.medias.filter(m => m.type === "image").map(i => i.url);
            let vids = data.medias.filter(m => m.type === "video");
            const audio = data.medias.find(m => m.type === "audio");

            // Kiểm tra xem trong link video có chứa dấu phẩy / là mảng không (Slideshow bị gộp link)
            const validVids = [];
            vids.forEach(v => {
                let u = v.url;
                if (Array.isArray(u)) {
                    if (u.length > 1) {
                        imgs = imgs.concat(u);
                    } else if (u[0]) {
                        v.url = u[0];
                        validVids.push(v);
                    }
                } else if (typeof u === 'string' && u.includes(',')) {
                    const splitted = u.split(',').filter(s => s.trim());
                    if (splitted.length > 1) {
                        imgs = imgs.concat(splitted);
                    } else if (splitted[0]) {
                        v.url = splitted[0];
                        validVids.push(v);
                    }
                } else if (u) {
                    validVids.push(v);
                }
            });
            vids = validVids;

            // Ưu tiên gửi ảnh nếu có
            if (imgs.length > 0) {
                log.info(`◈ [TikTok] Gửi ${imgs.length} ảnh...`);
                await sendImages(api, imgs, cap, threadId, threadType);
            } else if (vids.length > 0 && vids[0].url) {
                await sendVideoPlayer(api, { videoUrl: vids[0].url, thumbUrl: data.thumbnail, caption: cap, threadId, threadType });
            } else {
                log.warn(`⚠️ Không tìm thấy URL video/ảnh hợp lệ trong medias.`);
            }

            if (audio?.url) await sendAudio(api, audio.url, threadId, threadType);
            return false;
        }

        // Facebook: Ưu tiên dùng API SubHatDe (mới), fallback Crawler hoặc socialDownloader cũ
        if (platform === "facebook") {
            log.info(`◈ [Facebook] Đang tải từ API SubHatDe...`);
            const data = await socialDownloader(url);

            if (!data.error && data.medias && data.medias.length > 0) {
                const cap = makeCaption("facebook", data.title, data.author);
                const imgs = data.medias.filter(m => m.type === "image");
                const vids = data.medias.filter(m => m.type === "video");

                if (imgs.length > 0) {
                    log.info(`◈ [Facebook] Gửi ${imgs.length} ảnh từ API...`);
                    await sendImages(api, imgs.map(i => i.url), cap, threadId, threadType);
                } else if (vids.length > 0) {
                    // Ưu tiên bản HD (thường là link đầu tiên từ API này)
                    const bestVid = vids[0];
                    log.info(`◈ [Facebook] Gửi video chất lượng: ${bestVid.quality}...`);
                    await sendVideoPlayer(api, { videoUrl: bestVid.url, thumbUrl: data.thumbnail, caption: cap, threadId, threadType });
                }
                return false;
            }

            log.warn(`⚠️ [Facebook] API không hỗ trợ hoặc tải thất bại.`);
            react(api, message, threadId, threadType, ":-((");
            return false;
        }

        // Douyin (using savetik.io)
        if (platform === "douyin") {
            try {
                log.info(`◈ [Douyin] Đang tải từ SaveTik...`);
                const dyData = await downloadDouyin(url);

                if (!dyData) {
                    log.error(`⚠️ SaveTik (Douyin) trả về null.`);
                    react(api, message, threadId, threadType, ":-((");
                    return false;
                }

                const cap = makeCaption("douyin", dyData.title, dyData.author);

                // dyData.images is already an array of valid image URLs
                let validImages = dyData.images || [];

                if (validImages.length > 0) {
                    log.info(`◈ [Douyin] Tìm thấy ${validImages.length} ảnh.`);
                    await sendImages(api, validImages, cap, threadId, threadType);
                } else if (dyData.videoUrl) {
                    log.info(`◈ [Douyin] Gửi video...`);
                    await sendVideoPlayer(api, { videoUrl: dyData.videoUrl, thumbUrl: dyData.cover, caption: cap, threadId, threadType });
                } else {
                    log.error(`⚠️ SaveTik (Douyin) không tìm thấy url video/ảnh hợp lệ.`);
                    react(api, message, threadId, threadType, ":-((");
                }

                if (dyData.audioUrl) {
                    await sendAudio(api, dyData.audioUrl, threadId, threadType);
                }

                return false;
            } catch (err) {
                log.error(`⚠️ Lỗi xử lý Douyin: ${err.message}`);
                react(api, message, threadId, threadType, ":-((");
                return false;
            }
        }

        // Instagram
        if (platform === "instagram") {
            const ig = await downloadInstagram(url);
            if (!ig || !ig.attachments || ig.attachments.length === 0) {
                react(api, message, threadId, threadType, ":-((");
                return false;
            }
            const extra = `❤️ ${fmt(ig.like)} · 💬 ${fmt(ig.comment)}`;
            const cap = makeCaption("instagram", ig.message, ig.author, extra);
            const vids = ig.attachments.filter(a => a.type === "Video");

            if (vids.length === 1) await sendVideoPlayer(api, { videoUrl: vids[0].url, thumbUrl: ig.cover, caption: cap, threadId, threadType });
            else await sendImages(api, ig.attachments.map(a => a.url), cap, threadId, threadType);
            return false;
        }

        // YouTube
        if (platform === "youtube") {
            const yt = await downloadYoutube(url);
            const vi = yt.result?.video;
            if (!vi || !vi.videos || vi.videos.length === 0) {
                log.error(`⚠️ [YouTube] API hỏng hoặc không lấy được video.`);
                react(api, message, threadId, threadType, ":-((");
                return false;
            }
            const dur = parseInt(vi.lengthSeconds || "0");
            const cap = makeCaption("youtube", vi.content, null, `⏳ ${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, "0")}`);
            const best = vi.videos.find(v => v.hasAudio && v.url) || vi.videos[0];
            await sendVideoPlayer(api, { videoUrl: best.url, thumbUrl: `https://i.ytimg.com/vi/${match[1]}/default.jpg`, caption: cap, threadId, threadType });
            return false;
        }

        // SoundCloud
        if (platform === "soundcloud") {
            const sc = await downloadSoundCloud(url);
            if (!sc || !sc.url) {
                react(api, message, threadId, threadType, ":-((");
                return false;
            }
            const cap = makeCaption("soundcloud", sc.title, sc.author, `⏳ ${sc.duration} · ▶️ ${sc.playback} · ❤️ ${sc.likes}`);
            await sendAudio(api, sc.url, threadId, threadType);
            await api.sendMessage({ msg: cap?.msg || cap, styles: cap?.styles }, threadId, threadType);
            return false;
        }

        // CapCut
        if (platform === "capcut") {
            log.info(`[CapCut] Đang giải mã: ${url}`);
            const cpData = await downloadCapCut(url);
            if (!cpData || !cpData.videoUrl) {
                log.error(`CapCut trả về null hoặc thiếu videoUrl.`);
                react(api, message, threadId, threadType, ":-((");
                return false;
            }

            const cap = makeCaption("capcut", cpData.title, cpData.author?.name);
            await sendVideoPlayer(api, {
                videoUrl: cpData.videoUrl,
                thumbUrl: null, // CapCut API rarely gives thumb in this endpoint
                caption: cap,
                threadId,
                threadType
            });
            return false;
        }

        // Mixcloud
        if (platform === "mixcloud") {
            log.info(`[Mixcloud] Đang giải mã: ${url}`);
            const mc = await downloadMixcloud(url);
            if (!mc || mc.error || !mc.streamUrl) {
                const errMsg = mc?.error || "Không lấy được link stream Mixcloud.";
                log.error(`Mixcloud Error: ${errMsg}`);
                api.sendMessage({ msg: `❌ ${errMsg}` }, threadId, threadType);
                react(api, message, threadId, threadType, ":-((");
                return false;
            }

            const cap = makeCaption("mixcloud", mc.title, mc.author, `⏳ ${Math.floor(mc.duration / 60)} phút`);
            // Gửi info ngay, audio gửi sau khi tải xong
            await api.sendMessage({ msg: cap?.msg || cap, styles: cap?.styles }, threadId, threadType);
            await sendAudio(api, mc.streamUrl, threadId, threadType);
            return false;
        }

        // Spotify
        if (platform === "spotify") {
            log.info(`◈ [Spotify] Autodown detect: ${url}`);
            try {
                const trackId = match[1];
                const data = await spotify.download(trackId);
                
                if (data && data.primaryUrl) {
                    const cap = makeCaption("spotify", data.title, data.artist);
                    if (data.thumbnail) {
                        await sendImages(api, [data.thumbnail], cap, threadId, threadType);
                    } else {
                        await api.sendMessage({ msg: cap?.msg || cap, styles: cap?.styles }, threadId, threadType);
                    }
                    await sendAudio(api, data.primaryUrl, threadId, threadType);
                    return false;
                }
            } catch (e) {
                log.error(`⚠️ [Spotify Autodown] Lỗi: ${e.message}`);
                react(api, message, threadId, threadType, ":-((");
            }
        }

    } catch (e) {
        log.error(`Lỗi Autodown [${p?.name || "Unknown"}]:`, e.message);
        react(api, message, threadId, threadType, ":-((");
    } finally {
        clearInterval(ri);
    }
    return false;
}
