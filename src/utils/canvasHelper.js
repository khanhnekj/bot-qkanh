import { createCanvas, registerFont, loadImage } from "canvas";
import path from "node:path";
import axios from "axios";

const fontPath = path.join(process.cwd(), "src/modules/cache/BeVietnamPro-Bold.ttf");
const emojiPath = path.join(process.cwd(), "src/modules/cache/NotoEmoji-Bold.ttf");

// Register fonts once
try {
    registerFont(fontPath, { family: "BeVietnamPro", weight: "bold" });
    registerFont(fontPath, { family: "BeVietnamProBold" });
    registerFont(emojiPath, { family: "NotoEmoji", weight: "bold" });
    registerFont(emojiPath, { family: "NotoEmojiBold" });
} catch (e) { }

/**
 * Shared Utils
 */
const msToTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

function drawRoundRect(ctx, x, y, width, height, radius) {
    if (radius === undefined) radius = 0;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * MUSIC CANVAS FUNCTIONS
 */

export async function drawSoundCloudSearch(songs, query) {
    const width = 1280;
    const height = 720;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const themeColor = "#ff5500"; // SoundCloud Orange

    // 1. Background Dark Premium
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "rgba(255, 85, 0, 0.2)");
    bgGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Header & Hướng dẫn (In thẳng lên Canvas)
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 60px BeVietnamProBold, Sans";
    ctx.fillText("SOUNDCLOUD", 50, 80);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 24px BeVietnamProBold, Sans";
    ctx.fillText(`KẾT QUẢ: ${query.toUpperCase()}`, 480, 75);

    // 3. Grid Setup (2 Cột x 5 Hàng)
    const paddingX = 50;
    const paddingY = 120;
    const itemW = 570;
    const itemH = 100;
    const gapX = 40;
    const gapY = 15;

    for (let i = 0; i < Math.min(songs.length, 10); i++) {
        const s = songs[i];
        const col = i >= 5 ? 1 : 0;
        const row = i % 5;
        const x = paddingX + (col * (itemW + gapX));
        const y = paddingY + (row * (itemH + gapY));

        // Card Box
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        drawRoundRect(ctx, x, y, itemW, itemH, 20);
        ctx.fill();

        // Thumb
        try {
            const thumbUrl = (s.thumbnail || s.thumb || s.artwork_url || "").replace("t120x120", "t240x240");
            if (thumbUrl) {
                const res = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 5000 });
                const img = await loadImage(Buffer.from(res.data));
                ctx.save();
                drawRoundRect(ctx, x + 10, y + 10, 80, 80, 15);
                ctx.clip();
                ctx.drawImage(img, x + 10, y + 10, 80, 80);
                ctx.restore();
            }
        } catch (e) { }

        // Index Badge (STT)
        ctx.fillStyle = themeColor;
        ctx.beginPath();
        ctx.arc(x + 10, y + 10, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px BeVietnamProBold, Sans";
        ctx.textAlign = "center";
        ctx.fillText(i + 1, x + 10, y + 17);

        // Name & Artist
        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px BeVietnamProBold, NotoEmojiBold, Sans";
        let title = s.title || "No Title";
        if (ctx.measureText(title).width > 420) title = title.substring(0, 25) + "...";
        ctx.fillText(title, x + 105, y + 40);

        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "18px BeVietnamPro, Sans";
        let artist = s.user?.username || "Artist";
        if (ctx.measureText(artist).width > 300) artist = artist.substring(0, 20) + "...";
        const durStr = typeof s.duration === 'number' ? msToTime(s.duration) : (s.duration || "00:00");
        ctx.fillText(`${artist}  •  ${durStr}`, x + 105, y + 80);
    }

    // Branding chân trang
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.font = "bold 16px BeVietnamPro, Sans";
    ctx.fillText("POWERED BY ZALO BOT • DGK SYSTEM", width / 2, height - 20);

    return canvas.toBuffer("image/png");
}

export async function drawZingSearch(songs, query, sourceName = "ZING MP3") {
    const sourceUpper = sourceName.toUpperCase();
    const isScl = sourceUpper === "SOUNDCLOUD";
    const isNct = sourceUpper === "NHACCUATUI";
    const isYt = sourceUpper.includes("YOUTUBE");
    const isSpt = sourceUpper === "SPOTIFY";

    // Theme Colors
    let themeColor = "#8a3ab9"; // Default Zing Purple
    if (isScl) themeColor = "#ff5500"; 
    else if (isNct) themeColor = "#00afea"; 
    else if (isYt) themeColor = "#ff0000"; 
    else if (isSpt) themeColor = "#1DB954"; 

    const width = 1280;
    const height = 720;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Background Phẳng (Dark)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, `${themeColor}33`); // 20% opacity
    bgGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Header & Hướng dẫn
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 60px BeVietnamProBold, Sans";
    ctx.fillText(sourceUpper.replace(" MUSIC", ""), 50, 80);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 24px BeVietnamProBold, Sans";
    ctx.fillText(`KẾT QUẢ: ${query.toUpperCase()}`, 480, 75);

    // Dòng hướng dẫn quan trọng (In vào Badge Box)
    const instrText = "➜ PHẢN HỒI STT (1-10) ĐỂ TẢI NHẠC";
    ctx.font = "bold 26px BeVietnamProBold, Sans";
    const textWidth = ctx.measureText(instrText).width;
    const badgeW = textWidth + 60;
    const badgeH = 55;
    const badgeX = width - badgeW - 50;
    const badgeY = 45;

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 15;
    ctx.fillStyle = themeColor;
    drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 20);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(instrText, badgeX + (badgeW / 2), badgeY + 36);

    // 3. Grid Setup (2 Cột x 5 Hàng)
    const paddingX = 50;
    const paddingY = 120;
    const itemW = 570;
    const itemH = 100;
    const gapX = 40;
    const gapY = 15;

    for (let i = 0; i < Math.min(songs.length, 10); i++) {
        const s = songs[i];
        const col = i >= 5 ? 1 : 0;
        const row = i % 5;
        const x = paddingX + (col * (itemW + gapX));
        const y = paddingY + (row * (itemH + gapY));

        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        drawRoundRect(ctx, x, y, itemW, itemH, 20);
        ctx.fill();

        try {
            const thumbUrl = (s.thumbnail || s.thumb || s.artwork_url || "").replace("w94", "w240");
            if (thumbUrl) {
                const res = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 5000 });
                const img = await loadImage(Buffer.from(res.data));
                ctx.save();
                drawRoundRect(ctx, x + 10, y + 10, 80, 80, 15);
                ctx.clip();
                ctx.drawImage(img, x + 10, y + 10, 80, 80);
                ctx.restore();
            }
        } catch (e) { }

        ctx.fillStyle = themeColor;
        ctx.beginPath();
        ctx.arc(x + 10, y + 10, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px BeVietnamProBold, Sans";
        ctx.textAlign = "center";
        ctx.fillText(i + 1, x + 10, y + 17);

        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px BeVietnamProBold, NotoEmojiBold, Sans";
        let title = s.title || "No Title";
        if (ctx.measureText(title).width > 420) title = title.substring(0, 25) + "...";
        ctx.fillText(title, x + 105, y + 40);

        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "18px BeVietnamPro, Sans";
        let artist = s.artistsNames || (s.user ? s.user.username : "Artist");
        if (ctx.measureText(artist).width > 300) artist = artist.substring(0, 20) + "...";
        
        let duration = "00:00";
        if (s.duration) {
            if (typeof s.duration === 'string' && s.duration.includes(':')) duration = s.duration;
            else duration = msToTime(s.duration * (s.duration > 10000 ? 1 : 1000));
        }
        ctx.fillText(`${artist}  •  ${duration}`, x + 105, y + 80);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.font = "bold 16px BeVietnamPro, Sans";
    ctx.fillText(`POWERED BY ZALO BOT • ${sourceUpper} SYSTEM`, width / 2, height - 20);

    return canvas.toBuffer("image/png");
}


export async function drawZingPlayer(song) {
    const width = 1100;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const sourceUpper = (song.sourceName || "Zing MP3").toUpperCase();
    const isScl = sourceUpper === "SOUNDCLOUD";
    const isNct = sourceUpper === "NHACCUATUI";
    const isYt = sourceUpper.includes("YOUTUBE");

    let themeColor = "#8a3ab9"; // Default Zing Purple
    let themeColorSecondary = "#5e1a8a";
    if (isScl) {
        themeColor = "#ff5500";
        themeColorSecondary = "#cc4400";
    } else if (isNct) {
        themeColor = "#00afea";
        themeColorSecondary = "#0086b3";
    } else if (isYt) {
        themeColor = "#ff0000";
        themeColorSecondary = "#800000";
    }

    let img = null;
    try {
        const thumbUrl = (song.thumbnail || song.thumb || "").replace("w94", "w500");
        if (thumbUrl && thumbUrl.startsWith("http")) {
            const response = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 5000 });
            img = await loadImage(Buffer.from(response.data));
        }
    } catch (e) { }

    // 1. Vibrant Background Gradient (Platform Specific)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, themeColorSecondary);
    bgGrad.addColorStop(1, themeColor);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Blur
    if (img) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.filter = 'blur(60px)';
        ctx.drawImage(img, -100, -100, width + 200, height + 200);
        ctx.restore();
    }

    // 2. Main Card (Dark Glass)
    const cardW = 900;
    const cardH = 360;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2;

    // Card Shadow
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "rgba(15, 15, 20, 0.85)";
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 35);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. Album Art (Rectangular/Square on the left)
    const artSize = cardH; // Flush with top/bottom
    if (img) {
        ctx.save();
        drawRoundRect(ctx, cardX, cardY, artSize, artSize, 35);
        ctx.clip();
        ctx.drawImage(img, cardX, cardY, artSize, artSize);
        ctx.restore();
    } else {
        ctx.fillStyle = "#222";
        drawRoundRect(ctx, cardX, cardY, artSize, artSize, 35);
        ctx.fill();
    }

    // Light border for art to separate from text area
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + artSize, cardY);
    ctx.lineTo(cardX + artSize, cardY + cardH);
    ctx.stroke();

    // 4. Content Area (Right Side)
    const textZoneX = cardX + artSize + 40;
    const textZoneW = cardW - artSize - 80;

    // Platform Name
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 20px BeVietnamProBold, Sans";
    ctx.fillText(sourceUpper, textZoneX, cardY + 60);

    // Divider Line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(textZoneX, cardY + 75);
    ctx.lineTo(cardX + cardW - 40, cardY + 75);
    ctx.stroke();

    // Song Title (Large, Bold, Uppercase)
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 60px BeVietnamProBold, NotoEmojiBold, Sans";
    let title = (song.title || "Unknown").toUpperCase();
    if (ctx.measureText(title).width > textZoneW) {
        let truncated = title;
        while (ctx.measureText(truncated + "...").width > textZoneW && truncated.length > 0) truncated = truncated.slice(0, -1);
        title = truncated + "...";
    }
    ctx.fillText(title, textZoneX, cardY + 160);

    // Artist Names
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 34px BeVietnamProBold, NotoEmojiBold, Sans";
    let artists = (song.artistsNames || "Unknown Artist").toUpperCase();
    if (ctx.measureText(artists).width > textZoneW) {
        let truncated = artists;
        while (ctx.measureText(truncated + "...").width > textZoneW && truncated.length > 0) truncated = truncated.slice(0, -1);
        artists = truncated + "...";
    }
    ctx.fillText(artists, textZoneX, cardY + 220);

    // Metadata / Status
    ctx.fillStyle = themeColor;
    ctx.font = "bold 20px BeVietnamProBold, Sans";
    if (song.processTime) {
        ctx.fillText(`⚡ PROCESSING: ${song.processTime}S`, textZoneX, cardY + 265);
    }

    // Duration (Bottom Right)
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 28px BeVietnamProBold, Sans";
    const durationStr = song.duration ? (typeof song.duration === 'string' ? song.duration : msToTime(song.duration * 1000)) : "00:00";
    ctx.fillText(durationStr, cardX + cardW - 40, cardY + cardH - 40);

    return canvas.toBuffer("image/png");
}

export async function drawZingPlaylist(playlistInfo, songs) {
    const CARD_W = 700;
    const CARD_H = 100;
    const PADDING = 50;
    const HEADER_HEIGHT = 450;
    const FOOTER_HEIGHT = 60;
    const CARD_GAP = 15;

    const width = 800;
    const displaySongs = songs.slice(0, 10);
    const height = HEADER_HEIGHT + (displaySongs.length * (CARD_H + CARD_GAP)) + FOOTER_HEIGHT;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(0.5, "#1e293b");
    bgGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Blur
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath(); ctx.arc(0, 0, 400, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath(); ctx.arc(width, 500, 400, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    // 2. Playlist Header
    let playlistImg = null;
    try {
        const thumbUrl = (playlistInfo.thumbnailM || playlistInfo.thumbnail || "").replace("w165", "w600");
        if (thumbUrl && thumbUrl.startsWith("http")) {
            const response = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 5000 });
            playlistImg = await loadImage(Buffer.from(response.data));

            // Draw blurred background under header
            ctx.save();
            ctx.filter = 'blur(50px)';
            ctx.globalAlpha = 0.4;
            ctx.drawImage(playlistImg, -100, -100, width + 200, HEADER_HEIGHT + 100);
            ctx.restore();
        }
    } catch (e) { }

    // Playlist Thumbnail
    const thumbSize = 240;
    const thumbX = (width - thumbSize) / 2;
    const thumbY = 40;
    if (playlistImg) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 30;
        drawRoundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 25);
        ctx.clip();
        ctx.drawImage(playlistImg, thumbX, thumbY, thumbSize, thumbSize);
        ctx.restore();
    }

    // Playlist Title
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px BeVietnamProBold, NotoEmojiBold, Sans";
    ctx.fillText(playlistInfo.title || "Zing MP3 Playlist", width / 2, thumbY + thumbSize + 55);

    // Playlist Artists/Description
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 20px BeVietnamPro, Sans";
    const subTitle = playlistInfo.artistsNames || "Zing MP3 Official";
    ctx.fillText(subTitle, width / 2, thumbY + thumbSize + 85);

    // "TOP RANKING" Label
    ctx.fillStyle = "#3b82f6";
    drawRoundRect(ctx, width / 2 - 80, thumbY + thumbSize + 110, 160, 35, 17.5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px BeVietnamProBold, Sans";
    ctx.fillText("BẢNG XẾP HẠNG", width / 2, thumbY + thumbSize + 134);

    // 3. Songs List
    ctx.textAlign = "left";
    for (let i = 0; i < displaySongs.length; i++) {
        const s = displaySongs[i];
        const y = HEADER_HEIGHT + (i * (CARD_H + CARD_GAP));
        const x = (width - CARD_W) / 2;

        // Card
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        drawRoundRect(ctx, x, y, CARD_W, CARD_H, 15);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.stroke();

        // Rank Number & Status
        const rank = i + 1;
        ctx.textAlign = "center";

        // Vẽ số thứ hạng
        ctx.fillStyle = (i < 3) ? (i === 0 ? "#fbbf24" : (i === 1 ? "#94a3b8" : "#92400e")) : "#ffffff";
        ctx.font = "bold 34px BeVietnamProBold, Sans";
        ctx.fillText(rank, x + 40, y + CARD_H / 2 + 5);

        // Vẽ trạng thái tăng/giảm hạng (Vét thông tin từ API)
        const status = s.rakingStatus || 0; // 1: up, -1: down, 0: stable, 2: new
        ctx.font = "bold 14px BeVietnamProBold, Sans";
        if (status === 1) {
            ctx.fillStyle = "#10b981"; // Green
            ctx.fillText("▲ " + (s.lastRank - rank || 1), x + 40, y + CARD_H / 2 + 25);
        } else if (status === -1) {
            ctx.fillStyle = "#ef4444"; // Red
            ctx.fillText("▼ " + (rank - s.lastRank || 1), x + 40, y + CARD_H / 2 + 25);
        } else if (status === 2) {
            ctx.fillStyle = "#3b82f6"; // Blue
            ctx.fillText("NEW", x + 40, y + CARD_H / 2 + 25);
        } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            ctx.fillText("-", x + 40, y + CARD_H / 2 + 25);
        }

        // Song Thumb
        try {
            const songThumbUrl = (s.thumbnail || s.thumb || "").replace("w94", "w240");
            if (songThumbUrl) {
                const response = await axios.get(songThumbUrl, { responseType: 'arraybuffer', timeout: 5000 });
                const img = await loadImage(Buffer.from(response.data));
                ctx.save();
                drawRoundRect(ctx, x + 85, y + 10, 80, 80, 12);
                ctx.clip();
                ctx.drawImage(img, x + 85, y + 10, 80, 80);
                ctx.restore();
            }
        } catch (e) { }

        // Info
        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px BeVietnamProBold, NotoEmojiBold, Sans";
        let title = s.title;
        if (ctx.measureText(title).width > 420) title = title.substring(0, 25) + "...";
        ctx.fillText(title, x + 185, y + 40);

        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "18px BeVietnamPro, Sans";
        let artist = s.artistsNames || "Unknown";
        if (ctx.measureText(artist).width > 420) artist = artist.substring(0, 30) + "...";
        ctx.fillText(artist, x + 185, y + 68);

        // Vét sạch thông tin: Lượt nghe | Điểm (nếu có)
        ctx.fillStyle = "#9deadd";
        ctx.font = "bold 16px BeVietnamPro, Sans";
        let extraInfo = [];
        if (s.listen) extraInfo.push(`🎧 ${s.listen.toLocaleString("vi-VN")}`);
        if (s.score) extraInfo.push(`🔥 ${s.score.toLocaleString("vi-VN")} điểm`);

        ctx.fillText(extraInfo.join("  |  "), x + 185, y + 92);

        // VIP Label
        if (s.streamingStatus === 3 || s.isVIP) {
            ctx.fillStyle = "#fbbf24";
            ctx.font = "bold 14px BeVietnamProBold, Sans";
            ctx.fillText("VIP", x + CARD_W - 50, y + 35);
        }
    }

    return canvas.toBuffer("image/png");
}

/**
 * WEATHER CANVAS FUNCTIONS
 */

export async function drawWeatherCard(data) {
    const width = 800, height = 1250;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#334155");
    bg.addColorStop(1, "#0f172a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const margin = 30;
    const boxBg = "rgba(45, 45, 45, 0.8)";
    const textColor = "#ffffff";

    /** 1. TOP BOX: CURRENT WEATHER **/
    ctx.save();
    drawRoundRect(ctx, margin, margin, width - margin * 2, 280, 40);
    ctx.fillStyle = boxBg;
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = textColor;
    ctx.font = "bold 44px BeVietnamProBold, Sans";
    ctx.fillText(data.location.split(",")[0], margin + 30, margin + 70);

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 26px BeVietnamPro, Sans";
    ctx.fillText("Thời tiết hiện tại", margin + 30, margin + 115);

    ctx.textAlign = "right";
    ctx.fillStyle = textColor;
    ctx.font = "bold 34px BeVietnamPro, Sans";
    ctx.fillText(data.time, width - margin - 30, margin + 70);

    try {
        const icon = await loadImage(data.current.icon);
        ctx.drawImage(icon, margin + 30, margin + 150, 100, 100);
    } catch (e) { }

    ctx.textAlign = "left";
    ctx.font = "bold 90px BeVietnamProBold, Sans";
    ctx.fillText(`${Math.round(data.current.temp)}°`, margin + 150, margin + 225);
    ctx.font = "bold 28px BeVietnamPro, Sans";
    ctx.fillText("C", margin + 255, margin + 195);

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "24px BeVietnamPro, Sans";
    ctx.fillText(`RealFeel® ${Math.round(data.current.feelsLike)}°`, margin + 150, margin + 260);
    ctx.fillText(data.current.condition, margin + 30, margin + 270);

    const rightLabelX = width - 280;
    const rightValX = width - margin - 30;
    const rows = [
        { l: "RealFeel Shade™", v: `${Math.round(data.current.temp - 1)}°` },
        { l: "Gió", v: `BTB ${Math.round(data.current.wind)} km/h` },
        { l: "Gió giật mạnh", v: `${Math.round(data.current.windGust)} km/h` },
        { l: "Chất lượng không khí", v: data.current.aqiLevel, c: data.current.aqiLevel === "Tốt" ? "#4ade80" : "#facc15" }
    ];

    rows.forEach((r, i) => {
        const y = margin + 130 + i * 42;
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "22px BeVietnamPro, Sans";
        ctx.fillText(r.l, rightLabelX, y);
        ctx.textAlign = "right";
        ctx.fillStyle = r.c || "#fff";
        ctx.fillText(r.v, rightValX, y);
    });
    ctx.restore();

    /** 2. HOURLY BOX **/
    ctx.save();
    const hourlyY = 340;
    drawRoundRect(ctx, margin, hourlyY, width - margin * 2, 220, 30);
    ctx.fillStyle = boxBg;
    ctx.fill();

    const hourW = (width - margin * 2) / 7;
    for (let i = 0; i < 7; i++) {
        const h = data.hourly[i];
        if (!h) break;
        const x = margin + i * hourW + hourW / 2;

        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 24px BeVietnamPro, Sans";
        ctx.fillText(h.time, x, hourlyY + 45);

        try {
            const icon = await loadImage(h.icon);
            ctx.drawImage(icon, x - 35, hourlyY + 60, 70, 70);
        } catch (e) { }

        ctx.fillStyle = "#fff";
        ctx.font = "bold 26px BeVietnamPro, Sans";
        ctx.fillText(`${Math.round(h.temp)}°`, x, hourlyY + 160);

        ctx.fillStyle = "#93c5fd";
        ctx.font = "18px BeVietnamPro, Sans";
        ctx.fillText(`💧${h.pop}%`, x, hourlyY + 195);
    }
    ctx.restore();

    /** 3. ASTRONOMY & AQI **/
    ctx.save();
    const astroY = 590;
    const colW = (width - margin * 2 - 20) / 4;

    const drawSubBox = (x, y, w, h, icon, title, val1, val2) => {
        drawRoundRect(ctx, x, y, w, h, 20);
        ctx.fillStyle = boxBg;
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = "#fbbf24";
        ctx.font = "30px NotoEmoji";
        ctx.fillText(icon, x + w / 2, y + 45);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px BeVietnamPro, Sans";
        ctx.fillText(title, x + w / 2, y + 85);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "18px BeVietnamPro, Sans";
        ctx.fillText(val1, x + w / 2, y + 115);
        ctx.fillText(val2, x + w / 2, y + 145);
    };

    drawSubBox(margin, astroY, colW * 1.5, 220, "☀️", data.astronomy.sunDuration, `Mọc: ${data.astronomy.sunrise}`, `Lặn: ${data.astronomy.sunset}`);
    drawSubBox(margin + colW * 1.5 + 10, astroY, colW * 1.5, 220, "🌕", "Mặt Trăng", `Mọc: ${data.astronomy.moonrise}`, `Lặn: ${data.astronomy.moonset}`);

    const aqiX = margin + colW * 3 + 20;
    const aqiW = (width - margin) - aqiX;
    drawRoundRect(ctx, aqiX, astroY, aqiW, 220, 20);
    ctx.fillStyle = boxBg;
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px BeVietnamPro, Sans";
    ctx.fillText("Chất lượng không khí", aqiX + 20, astroY + 40);
    ctx.fillStyle = data.current.aqiLevel === "Tốt" ? "#4ade80" : "#facc15";
    ctx.fillText(data.current.aqiLevel, aqiX + 20, astroY + 75);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "16px BeVietnamPro, Sans";
    wrapText(ctx, data.current.aqiText, aqiX + 20, astroY + 110, aqiW - 40, 22);
    ctx.restore();

    /** 4. DAILY LIST **/
    ctx.save();
    const dailyY = 840;
    drawRoundRect(ctx, margin, dailyY, width - margin * 2, 320, 30);
    ctx.fillStyle = "rgba(20, 20, 20, 0.4)";
    ctx.fill();

    for (let i = 0; i < data.daily.length; i++) {
        const d = data.daily[i];
        const y = dailyY + 30 + i * 90;
        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px BeVietnamPro, Sans";
        ctx.fillText(d.date, margin + 20, y + 15);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "18px BeVietnamPro, Sans";
        ctx.fillText(d.dayName, margin + 20, y + 45);

        try {
            const icon = await loadImage(d.icon);
            ctx.drawImage(icon, margin + 100, y - 5, 70, 70);
        } catch (e) { }

        ctx.fillStyle = "#fff";
        ctx.font = "bold 32px BeVietnamPro, Sans";
        ctx.fillText(`${Math.round(d.high)}°`, margin + 180, y + 25);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "24px BeVietnamPro, Sans";
        ctx.fillText(`${Math.round(d.low)}°`, margin + 250, y + 25);

        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.font = "20px BeVietnamPro, Sans";
        const summary = d.condition;
        ctx.fillText(summary, margin + 330, y + 15);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText(summary, margin + 330, y + 45);

        ctx.textAlign = "right";
        ctx.fillStyle = "#93c5fd";
        ctx.font = "bold 24px BeVietnamPro, Sans";
        ctx.fillText(`${d.pop}% 💧`, width - margin - 30, y + 25);

        if (i < data.daily.length - 1) {
            ctx.strokeStyle = "rgba(255,255,255,0.05)";
            ctx.beginPath(); ctx.moveTo(margin + 20, y + 75); ctx.lineTo(width - margin - 20, y + 75); ctx.stroke();
        }
    }
    ctx.restore();

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "italic 18px BeVietnamPro, Sans";
    ctx.fillText("Hệ thống Zalo Bot - Dự báo thời tiết thông minh v4.5", width / 2, height - 35);

    return canvas.toBuffer("image/png");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + " ";
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

/**
 * USER INFO CANVAS
 */
export async function drawUserInfo({ displayName, username, avatar, bio, onlineStatus, fields = [] }) {
    const width = 800, height = 420;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath(); ctx.arc(0, 0, 350, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8b5cf6";
    ctx.beginPath(); ctx.arc(width, height, 300, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    // Avatar
    const avX = 80, avY = 80, avR = 80;
    let avImg = null;
    try {
        if (avatar && avatar.startsWith("http")) {
            const res = await axios.get(avatar, { responseType: 'arraybuffer', timeout: 5000 });
            avImg = await loadImage(Buffer.from(res.data));
        }
    } catch (e) { }

    // Glow ring
    const statusColor = onlineStatus === "online" ? "#10b981" : "#94a3b8";
    ctx.shadowColor = statusColor; ctx.shadowBlur = 20;
    ctx.strokeStyle = statusColor; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(avX, avY, avR + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    if (avImg) {
        ctx.save();
        ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(avImg, avX - avR, avY - avR, avR * 2, avR * 2);
        ctx.restore();
    } else {
        ctx.fillStyle = "#334155";
        ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.fill();
    }

    // Online dot
    ctx.fillStyle = statusColor;
    ctx.beginPath(); ctx.arc(avX + avR * 0.7, avY + avR * 0.7, 14, 0, Math.PI * 2); ctx.fill();

    // Name & Username
    const textX = avX + avR + 40;
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px BeVietnamProBold, NotoEmojiBold, Sans";
    ctx.fillText(displayName || "Zalo User", textX, 65);

    if (username) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "20px BeVietnamPro, Sans";
        ctx.fillText(`@${username}`, textX, 95);
    }

    if (bio) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "italic 18px BeVietnamPro, Sans";
        ctx.fillText(bio.substring(0, 60), textX, 125);
    }

    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 180); ctx.lineTo(width - 40, 180); ctx.stroke();

    // Fields Grid (2 columns)
    const colW = (width - 80) / 2;
    fields.forEach((f, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const fx = 40 + col * colW;
        const fy = 210 + row * 65;

        ctx.fillStyle = "rgba(255,255,255,0.05)";
        drawRoundRect(ctx, fx, fy, colW - 15, 50, 12);
        ctx.fill();

        ctx.fillStyle = "#60a5fa";
        ctx.font = "bold 20px NotoEmojiBold, BeVietnamPro, Sans";
        ctx.textAlign = "left";
        ctx.fillText(f.icon || "▸", fx + 12, fy + 32);

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "bold 15px BeVietnamPro, Sans";
        ctx.fillText(f.label, fx + 40, fy + 18);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px BeVietnamProBold, Sans";
        ctx.fillText(String(f.value || "—").substring(0, 28), fx + 40, fy + 36);
    });

    return canvas.toBuffer("image/png");
}

/**
 * MIXCLOUD CANVAS FUNCTIONS
 */
export async function drawMcSearch(results, query) {
    const CARD_H = 130, CARD_GAP = 18, PADDING = 40;
    const width = 800, height = 150 + (results.length * (CARD_H + CARD_GAP)) + 90;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0a1a"); bg.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#ff6b35";
    ctx.beginPath(); ctx.arc(width, 0, 280, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.textAlign = "center";
    ctx.fillStyle = "#ff6b35";
    ctx.font = "bold 42px BeVietnamProBold, Sans";
    ctx.shadowColor = "#ff6b35"; ctx.shadowBlur = 15;
    ctx.fillText("MIXCLOUD", width / 2, 75);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "20px BeVietnamPro, Sans";
    ctx.fillText(`"${query}"`, width / 2, 112);

    ctx.textAlign = "left";
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const y = 140 + i * (CARD_H + CARD_GAP);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        drawRoundRect(ctx, PADDING, y, width - PADDING * 2, CARD_H, 18);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,107,53,0.2)"; ctx.stroke();

        try {
            const thumbUrl = r.picture_url || r.thumbnail || "";
            if (thumbUrl.startsWith("http")) {
                const res = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 5000 });
                const img = await loadImage(Buffer.from(res.data));
                ctx.save();
                drawRoundRect(ctx, PADDING + 12, y + 12, 106, 106, 12); ctx.clip();
                ctx.drawImage(img, PADDING + 12, y + 12, 106, 106);
                ctx.restore();
            }
        } catch (e) {
            ctx.fillStyle = "#333"; drawRoundRect(ctx, PADDING + 12, y + 12, 106, 106, 12); ctx.fill();
        }

        const tx = PADDING + 135;
        ctx.fillStyle = "#fff"; ctx.font = "bold 24px BeVietnamProBold, NotoEmojiBold, Sans";
        let name = (r.name || "Unknown").substring(0, 30);
        ctx.fillText(name, tx, y + 42);

        ctx.fillStyle = "#ff6b35"; ctx.font = "bold 18px BeVietnamPro, Sans";
        ctx.fillText(r.user?.name || r.artist || "Unknown", tx, y + 72);

        ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "16px BeVietnamPro, Sans";
        const dur = r.duration ? `⏱️ ${Math.floor(r.duration / 60)}:${String(Math.floor(r.duration % 60)).padStart(2, '0')}` : "";
        ctx.fillText(dur, tx, y + 100);

        ctx.fillStyle = "#ff6b35";
        ctx.beginPath(); ctx.arc(width - PADDING - 30, y + CARD_H / 2, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 18px BeVietnamPro, Sans"; ctx.textAlign = "center";
        ctx.fillText(i + 1, width - PADDING - 30, y + CARD_H / 2 + 7);
        ctx.textAlign = "left";
    }

    ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "italic 18px BeVietnamPro, Sans";
    ctx.fillText(`➜ Trả lời 1-${results.length} để tải nhạc`, width / 2, height - 35);
    return canvas.toBuffer("image/png");
}

export async function drawMcPlayer(track) {
    const width = 800, height = 260;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    let img = null;
    try {
        const thumbUrl = track.picture_url || track.thumbnail || "";
        if (thumbUrl.startsWith("http")) {
            const res = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 5000 });
            img = await loadImage(Buffer.from(res.data));
        }
    } catch (e) { }

    if (img) {
        ctx.save(); ctx.filter = 'blur(40px) brightness(0.5)';
        const sc = Math.max(width / img.width, height / img.height);
        ctx.drawImage(img, (width - img.width * sc) / 2, (height - img.height * sc) / 2, img.width * sc, img.height * sc);
        ctx.restore();
        ctx.fillStyle = "rgba(10,10,20,0.78)"; ctx.fillRect(0, 0, width, height);
    } else {
        const bg = ctx.createLinearGradient(0, 0, width, height);
        bg.addColorStop(0, "#0a0a1a"); bg.addColorStop(1, "#1a1a2e");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    }

    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(0, 0, width, 40);
    ctx.fillStyle = "#ff6b35"; ctx.font = "bold 18px BeVietnamProBold, Sans"; ctx.textAlign = "center";
    ctx.fillText("MIXCLOUD", width / 2, 27);

    const cx = 150, cy = 147, r = 88;
    ctx.shadowColor = "#ff6b35"; ctx.shadowBlur = 20;
    ctx.strokeStyle = "rgba(255,107,53,0.5)"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    if (img) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2); ctx.restore();
    } else {
        ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = "#ff6b35"; ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 9); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx - 5, cy + 9);
    ctx.closePath(); ctx.fill();

    const tx = cx + r + 40; let cY = cy - 60;
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff"; ctx.font = "bold 28px BeVietnamProBold, NotoEmojiBold, Sans";
    let title = (track.name || "Unknown").substring(0, 28);
    ctx.fillText(title, tx, cY); cY += 42;
    ctx.fillStyle = "#ff6b35"; ctx.font = "bold 22px BeVietnamProBold, Sans";
    ctx.fillText(track.user?.name || track.artist || "Unknown", tx, cY); cY += 38;
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "20px BeVietnamPro, Sans";
    const durStr = track.duration ? `⏱️ ${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}` : "⏱️ --:--";
    ctx.fillText(durStr, tx, cY);

    const barY = height - 38, barW = 340, barH = 6;
    ctx.fillStyle = "rgba(255,255,255,0.1)"; drawRoundRect(ctx, tx, barY, barW, barH, 3); ctx.fill();
    ctx.fillStyle = "#ff6b35"; drawRoundRect(ctx, tx, barY, barW * 0.4, barH, 3); ctx.fill();

    return canvas.toBuffer("image/png");
}

/**
 * TIKTOK CANVAS FUNCTION
 */
export async function drawTikTokSearch(videos, title = "TIKTOK") {
    const CARD_H = 130, CARD_GAP = 16, PADDING = 40;
    const width = 800, height = 150 + (videos.length * (CARD_H + CARD_GAP)) + 90;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0d0d0d"); bg.addColorStop(1, "#1a0a1a");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#69c9d0";
    ctx.beginPath(); ctx.arc(0, 0, 250, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ee1d52";
    ctx.beginPath(); ctx.arc(width, height, 250, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.textAlign = "center";
    ctx.shadowColor = "#ee1d52"; ctx.shadowBlur = 20;
    ctx.fillStyle = "#fff"; ctx.font = "bold 40px BeVietnamProBold, Sans";
    ctx.fillText(title.toUpperCase().substring(0, 40), width / 2, 75);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "18px BeVietnamPro, Sans";
    ctx.fillText(`${videos.length} kết quả`, width / 2, 110);

    ctx.textAlign = "left";
    for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        const y = 140 + i * (CARD_H + CARD_GAP);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        drawRoundRect(ctx, PADDING, y, width - PADDING * 2, CARD_H, 18);
        ctx.fill();
        ctx.strokeStyle = "rgba(238,29,82,0.2)"; ctx.stroke();

        try {
            const thumbUrl = v.origin_cover || v.cover || "";
            if (thumbUrl.startsWith("http")) {
                const res = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 5000 });
                const img = await loadImage(Buffer.from(res.data));
                ctx.save();
                drawRoundRect(ctx, PADDING + 10, y + 10, 110, 110, 12); ctx.clip();
                ctx.drawImage(img, PADDING + 10, y + 10, 110, 110);
                ctx.restore();
            }
        } catch (e) {
            ctx.fillStyle = "#222"; drawRoundRect(ctx, PADDING + 10, y + 10, 110, 110, 12); ctx.fill();
        }

        const tx = PADDING + 135;
        ctx.fillStyle = "#fff"; ctx.font = "bold 22px BeVietnamProBold, NotoEmojiBold, Sans";
        let vTitle = (v.title || "Không tiêu đề").substring(0, 32);
        ctx.fillText(vTitle, tx, y + 38);

        ctx.fillStyle = "#69c9d0"; ctx.font = "bold 17px BeVietnamPro, Sans";
        ctx.fillText(`@${v.author?.unique_id || v.author?.uniqueId || "unknown"}`, tx, y + 62);

        ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "15px BeVietnamPro, NotoEmojiBold, Sans";
        const likes = v.digg_count ? `❤️ ${(+v.digg_count).toLocaleString("vi-VN")}` : "";
        const dur = v.duration ? `⏱️ ${v.duration}s` : "";
        ctx.fillText([likes, dur].filter(Boolean).join("  |  "), tx, y + 90);

        const badgeColors = ["#ee1d52", "#ff6b35", "#fbbf24", "#10b981", "#3b82f6", "#8b5cf6"];
        ctx.fillStyle = badgeColors[i % badgeColors.length];
        ctx.beginPath(); ctx.arc(width - PADDING - 28, y + CARD_H / 2, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 18px BeVietnamPro, Sans"; ctx.textAlign = "center";
        ctx.fillText(i + 1, width - PADDING - 28, y + CARD_H / 2 + 7);
        ctx.textAlign = "left";
    }

    ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "italic 17px BeVietnamPro, Sans";
    ctx.fillText(`➜ Phản hồi số 1-${videos.length} để tải video`, width / 2, height - 35);
    return canvas.toBuffer("image/png");
}

/**
 * PREMIUM WELCOME / GOODBYE CANVAS FUNCTIONS
 */

export async function drawWelcome(userInfo, groupName = "nhóm", approverName = "", joinTime = "") {
    const width = 1100, height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // LUXURY DESIGN SYSTEM
    const themeColor = "#00f2ea"; // Cyan/Neon Blue
    const themeColorSecondary = "#ff0050"; // Pink/Red

    // 1. Vibrant Animated-style Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0a0a0f");
    bgGrad.addColorStop(0.5, "#1a1a2e");
    bgGrad.addColorStop(1, "#0a0a0f");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Blur / Glows
    let avatarImg = null;
    try {
        const avUrl = (userInfo.avatar_251 || userInfo.avatar || userInfo.avatar_25 || "").replace("w94", "w500");
        if (avUrl.startsWith("http")) {
            const res = await axios.get(avUrl, { responseType: 'arraybuffer', timeout: 5000 });
            avatarImg = await loadImage(Buffer.from(res.data));

            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.filter = "blur(50px)";
            ctx.drawImage(avatarImg, -100, -100, width + 200, height + 200);
            ctx.restore();
        }
    } catch (e) { }

    // Modern Neon Blobs
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = themeColor;
    ctx.beginPath(); ctx.arc(0, 0, 400, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = themeColorSecondary;
    ctx.beginPath(); ctx.arc(width, height, 400, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    // 2. Main Glassmorphism Card
    const cardMargin = 40;
    const cardW = width - (cardMargin * 2);
    const cardH = height - (cardMargin * 2);
    const cardX = cardMargin;
    const cardY = cardMargin;

    // Card Shadow
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "rgba(15, 15, 25, 0.8)";
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 40);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Card Glass Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3. Avatar on the left
    const avR = 100;
    const avX = cardX + 40 + avR;
    const avY = cardY + cardH / 2;

    // Outer Neon Ring
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(avX, avY, avR + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (avatarImg) {
        ctx.save();
        ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(avatarImg, avX - avR, avY - avR, avR * 2, avR * 2);
        ctx.restore();
    } else {
        ctx.fillStyle = "#334155";
        ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.fill();
    }

    // Inner White Border
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.stroke();

    // 4. Content Area
    const textX = avX + avR + 50;
    const centerT = cardY + cardH / 2;

    // User Name (Multicolor / Large)
    ctx.textAlign = "left";
    ctx.font = "bold 52px BeVietnamProBold, NotoEmojiBold, Sans";
    const displayName = (userInfo.displayName || userInfo.zaloName || "THÀNH VIÊN MỚI").toUpperCase();

    // Gradient text for name
    const nGrad = ctx.createLinearGradient(textX, 0, textX + ctx.measureText(displayName).width, 0);
    nGrad.addColorStop(0, themeColorSecondary);
    nGrad.addColorStop(1, themeColor);
    ctx.fillStyle = nGrad;
    ctx.fillText(displayName, textX, centerT - 50);

    // Divider
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(textX, centerT - 35);
    ctx.lineTo(cardX + cardW - 60, centerT - 35);
    ctx.stroke();

    // Join Message
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px BeVietnamProBold, Sans";
    const statusText = `✓ Đã tham gia vào `;
    ctx.fillText(statusText, textX, centerT + 20);

    const groupText = groupName.toUpperCase();
    ctx.fillStyle = themeColor;
    ctx.fillText(groupText, textX + ctx.measureText(statusText).width, centerT + 20);

    // Approver / Approval Info
    if (approverName) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "bold 24px BeVietnamPro, Sans";
        ctx.fillText(`Duyệt bởi: ${approverName}`, textX, centerT + 65);
    }

    // Footer Slogan
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "italic 22px BeVietnamPro, Sans";
    ctx.fillText("✨ Gặp nhau là duyên, đồng hành là nghĩa ✨", cardX + cardW / 2 + avR, cardY + cardH - 30);

    // Extra Tag (e.g. Join Date)
    if (joinTime) {
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "bold 16px BeVietnamPro, Sans";
        ctx.fillText(`📅 ${joinTime}`, cardX + 30, height - 15);
    }

    return canvas.toBuffer("image/png");
}

export async function drawGoodbye(userInfo, groupName = "nhóm") {
    const width = 1100, height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const themeColor = "#fbbf24"; // Amber/Gold
    const themeColorSecondary = "#ef4444"; // Red/Danger

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0c0a09");
    bgGrad.addColorStop(0.5, "#1c1917");
    bgGrad.addColorStop(1, "#0c0a09");
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, width, height);

    // Glows
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = themeColorSecondary;
    ctx.beginPath(); ctx.arc(width, 0, 400, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    const cardMargin = 40;
    const cardW = width - (cardMargin * 2), cardH = height - (cardMargin * 2);
    const cardX = cardMargin, cardY = cardMargin;

    ctx.fillStyle = "rgba(24, 24, 27, 0.9)";
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 40);
    ctx.fill();

    // Avatar on the left (Grayscale-ish)
    const avR = 100, avX = cardX + 40 + avR, avY = cardY + cardH / 2;
    try {
        const avUrl = (userInfo.avatar_251 || userInfo.avatar || userInfo.avatar_25 || "").replace("w94", "w500");
        if (avUrl.startsWith("http")) {
            const res = await axios.get(avUrl, { responseType: 'arraybuffer', timeout: 5000 });
            const img = await loadImage(Buffer.from(res.data));
            ctx.save();
            ctx.filter = "grayscale(80%) brightness(0.7)";
            ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(img, avX - avR, avY - avR, avR * 2, avR * 2);
            ctx.restore();
        }
    } catch (e) {
        ctx.fillStyle = "#27272a";
        ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(avX, avY, avR + 5, 0, Math.PI * 2); ctx.stroke();

    // Content
    const textX = avX + avR + 50;
    const centerT = cardY + cardH / 2;

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px BeVietnamProBold, NotoEmojiBold, Sans";
    const name = (userInfo.displayName || userInfo.zaloName || "THÀNH VIÊN").toUpperCase();
    ctx.fillText(name, textX, centerT - 40);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 34px BeVietnamProBold, Sans";
    ctx.fillText("HẸN GẶP LẠI BẠN VÀO MỘT NGÀY KHÁC 🕊️", textX, centerT + 20);

    ctx.fillStyle = themeColorSecondary;
    ctx.font = "bold 24px BeVietnamPro, Sans";
    ctx.fillText(`Vừa rời khỏi ${groupName.toUpperCase()}`, textX, centerT + 70);

    return canvas.toBuffer("image/png");
}

/**
 * TAI XIU CANVAS FUNCTION
 */
export async function drawTaiXiu(dices, total, result, betInfoText) {
    const width = 600, height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Luxury Dark Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Blur
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = result === "tai" ? "#fbbf24" : "#10b981";
    ctx.beginPath(); ctx.arc(width / 2, height / 2, 200, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    // Header
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px BeVietnamProBold, Sans";
    ctx.fillText("🎲 TÀI XỈU LUXURY 🎲", width / 2, 60);

    // Dices Section
    const diceIcons = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    const gap = 120;
    const startX = width / 2 - gap;

    ctx.font = "bold 100px Sans";
    dices.forEach((d, i) => {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        drawRoundRect(ctx, startX + i * gap - 50, 120, 100, 100, 20);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(diceIcons[d], startX + i * gap, 200);
    });

    // Total & Result
    ctx.font = "bold 40px BeVietnamProBold, Sans";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`${dices.join(" + ")} = ${total}`, width / 2, 260);

    // Big Result Text
    ctx.font = "bold 80px BeVietnamProBold, Sans";
    ctx.fillStyle = result === "tai" ? "#fbbf24" : "#10b981";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 20;
    ctx.fillText(result.toUpperCase(), width / 2, 350);
    ctx.shadowBlur = 0;

    // Bet Info Text Box
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    drawRoundRect(ctx, 40, 380, width - 80, 80, 15);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.stroke();

    ctx.font = "20px BeVietnamPro, Sans";
    ctx.fillStyle = "#ffffff";
    wrapText(ctx, betInfoText, width / 2, 420, width - 120, 25);

    return canvas.toBuffer("image/png");
}

/**
 * CAPCUT SEARCH CANVAS FUNCTION
 */
export async function drawCapCutSearch(templates, query) {
    const CARD_W = 540;
    const CARD_H = 140;
    const PADDING = 130;
    const HEADER_HEIGHT = 150;
    const FOOTER_HEIGHT = 100;
    const CARD_GAP = 20;

    const width = 800;
    const height = HEADER_HEIGHT + (templates.length * (CARD_H + CARD_GAP)) + FOOTER_HEIGHT;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Luxury Dark Background 
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#000000");
    bgGrad.addColorStop(0.5, "#0f172a");
    bgGrad.addColorStop(1, "#000000");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Glows
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#ff0050"; // CapCut Pink
    ctx.beginPath(); ctx.arc(0, 0, 300, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#00f2ea"; // CapCut Cyan
    ctx.beginPath(); ctx.arc(width, height, 300, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    // Title
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff0050";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px BeVietnamProBold, Sans";
    ctx.fillText("CAPCUT SEARCH", width / 2, 75);
    ctx.shadowBlur = 0;

    ctx.font = "22px BeVietnamPro, Sans";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`“${query}”`, width / 2, 115);

    ctx.textAlign = "left";
    for (let i = 0; i < templates.length; i++) {
        const t = templates[i];
        const y = HEADER_HEIGHT + (i * (CARD_H + CARD_GAP));
        const x = PADDING;

        // Card
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        drawRoundRect(ctx, x, y, CARD_W, CARD_H, 20);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.stroke();

        // Thumbnail
        try {
            const thumbUrl = t.cover_url || t.cover || (t.video_template?.cover_url) || "";
            if (thumbUrl && thumbUrl.startsWith("http")) {
                const response = await axios.get(thumbUrl, { responseType: 'arraybuffer', timeout: 5000 });
                const img = await loadImage(Buffer.from(response.data));
                ctx.save();
                drawRoundRect(ctx, x + 15, y + 15, 110, 110, 15);
                ctx.clip();
                ctx.drawImage(img, x + 15, y + 15, 110, 110);
                ctx.restore();
            }
        } catch (e) {
            ctx.fillStyle = "#222";
            drawRoundRect(ctx, x + 15, y + 15, 110, 110, 15);
            ctx.fill();
        }

        const titleX = x + 145;
        // Title
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px BeVietnamProBold, Sans";
        let title = t.title || "No Title";
        if (ctx.measureText(title).width > CARD_W - 180) title = title.substring(0, 25) + "...";
        ctx.fillText(title, titleX, y + 50);

        // Author
        ctx.fillStyle = "#00f2ea";
        ctx.font = "bold 18px BeVietnamPro, Sans";
        const author = t.author?.name || "Unknown Author";
        ctx.fillText(`👤 ${author}`, titleX, y + 85);

        // Stats
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "16px BeVietnamPro, Sans";
        const usage = t.usage_amount ? (t.usage_amount / 1000).toFixed(1) + "k dùng" : "Hot";
        const duration = t.duration ? (t.duration / 1000).toFixed(1) + "s" : "";
        ctx.fillText(`🔥 ${usage}  |  ⏱️ ${duration}`, titleX, y + 115);

        // Badge Number
        ctx.fillStyle = "#ff0050";
        ctx.beginPath();
        ctx.arc(x + CARD_W - 40, y + CARD_H / 2, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px BeVietnamPro, Sans";
        ctx.textAlign = "center";
        ctx.fillText(i + 1, x + CARD_W - 40, y + CARD_H / 2 + 7);
        ctx.textAlign = "left";
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "italic 20px BeVietnamPro, Sans";
    ctx.fillText(`➜ Phản hồi số 1-${templates.length} để tải video`, width / 2, height - 40);

    return canvas.toBuffer("image/png");
}


/**
 * GROUP CARD INFO CANVAS (with member avatars & group bg)
 */
export async function drawGroupCard({ groupName, groupId, avatar, memberCount, creatorName, createdTime, description, settings = [], memberAvatarUrls = [] }) {
    const width = 800, height = 750;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Background: Dark base
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0b0e1a");
    bgGrad.addColorStop(0.4, "#131835");
    bgGrad.addColorStop(1, "#0b0e1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Group Avatar as BLURRED BACKGROUND (top area)
    let groupAvImg = null;
    try {
        if (avatar && avatar.startsWith("http")) {
            const res = await axios.get(avatar, { responseType: 'arraybuffer', timeout: 5000 });
            groupAvImg = await loadImage(Buffer.from(res.data));
        }
    } catch (e) { }

    if (groupAvImg) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.filter = 'blur(40px)';
        ctx.drawImage(groupAvImg, -50, -50, width + 100, 320);
        ctx.restore();
    }

    // Decorative Glow
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#6366f1";
    ctx.beginPath(); ctx.arc(0, 0, 350, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ec4899";
    ctx.beginPath(); ctx.arc(width, height, 300, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    // 3. Top Card
    const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
    headerGrad.addColorStop(0, "rgba(99, 102, 241, 0.25)");
    headerGrad.addColorStop(0.5, "rgba(236, 72, 153, 0.15)");
    headerGrad.addColorStop(1, "rgba(6, 182, 212, 0.25)");
    ctx.fillStyle = headerGrad;
    drawRoundRect(ctx, 30, 25, width - 60, 200, 25);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Group Avatar (sharp, circular)
    const avX = 130, avY = 125, avR = 60;
    ctx.shadowColor = "#6366f1";
    ctx.shadowBlur = 25;
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(avX, avY, avR + 6, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    if (groupAvImg) {
        ctx.save();
        ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(groupAvImg, avX - avR, avY - avR, avR * 2, avR * 2);
        ctx.restore();
    } else {
        ctx.fillStyle = "#1e1b4b";
        ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6366f1";
        ctx.font = "bold 40px BeVietnamProBold, Sans";
        ctx.textAlign = "center";
        ctx.fillText("G", avX, avY + 14);
    }

    // 4. Group Name & ID
    const textX = avX + avR + 35;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px BeVietnamProBold, NotoEmojiBold, Sans";
    let displayName = groupName || "Nhóm không tên";
    const maxNameW = width - textX - 60;
    if (ctx.measureText(displayName).width > maxNameW) {
        while (ctx.measureText(displayName + "...").width > maxNameW && displayName.length > 0) displayName = displayName.slice(0, -1);
        displayName += "...";
    }
    ctx.fillText(displayName, textX, avY - 15);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "16px BeVietnamPro, Sans";
    ctx.fillText("ID: " + (groupId || "N/A"), textX, avY + 15);

    // Member Badge
    ctx.fillStyle = "#6366f1";
    drawRoundRect(ctx, textX, avY + 28, 150, 32, 16);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px BeVietnamProBold, Sans";
    ctx.fillText("  " + (memberCount || "?") + " thành viên", textX + 14, avY + 50);

    // 5. MEMBER AVATARS ROW
    const memRowY = 250;
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    drawRoundRect(ctx, 30, memRowY, width - 60, 100, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "bold 14px BeVietnamProBold, Sans";
    ctx.textAlign = "left";
    ctx.fillText("THÀNH VIÊN", 55, memRowY + 22);

    const memAvSize = 42;
    const memOverlap = 14;
    const memStartX = 55;
    const memY = memRowY + 40;
    const maxDisplay = Math.min(memberAvatarUrls.length, 14);

    for (let i = 0; i < maxDisplay; i++) {
        const mx = memStartX + i * (memAvSize - memOverlap);
        const url = memberAvatarUrls[i];
        let mImg = null;

        try {
            if (url && url.startsWith("http")) {
                const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 3000 });
                mImg = await loadImage(Buffer.from(res.data));
            }
        } catch (e) { }

        // Dark border ring
        ctx.fillStyle = "#131835";
        ctx.beginPath(); ctx.arc(mx + memAvSize / 2, memY + memAvSize / 2, memAvSize / 2 + 2, 0, Math.PI * 2); ctx.fill();

        if (mImg) {
            ctx.save();
            ctx.beginPath(); ctx.arc(mx + memAvSize / 2, memY + memAvSize / 2, memAvSize / 2, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(mImg, mx, memY, memAvSize, memAvSize);
            ctx.restore();
        } else {
            const colors = ["#6366f1", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath(); ctx.arc(mx + memAvSize / 2, memY + memAvSize / 2, memAvSize / 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 16px BeVietnamProBold, Sans";
            ctx.textAlign = "center";
            ctx.fillText(String(i + 1), mx + memAvSize / 2, memY + memAvSize / 2 + 6);
            ctx.textAlign = "left";
        }
    }

    // "+N more" badge
    if (memberCount > maxDisplay) {
        const moreX = memStartX + maxDisplay * (memAvSize - memOverlap);
        ctx.fillStyle = "rgba(99, 102, 241, 0.6)";
        ctx.beginPath(); ctx.arc(moreX + memAvSize / 2, memY + memAvSize / 2, memAvSize / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px BeVietnamProBold, Sans";
        ctx.textAlign = "center";
        ctx.fillText("+" + (memberCount - maxDisplay), moreX + memAvSize / 2, memY + memAvSize / 2 + 5);
        ctx.textAlign = "left";
    }

    // 6. Info Section
    const infoY = 370;
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    drawRoundRect(ctx, 30, infoY, width - 60, 140, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    const infoFields = [
        { icon: "👑", label: "Người tạo", value: creatorName || "Không rõ" },
        { icon: "📅", label: "Ngày tạo", value: createdTime || "Không rõ" },
        { icon: "📝", label: "Mô tả", value: (description || "Không có mô tả").substring(0, 40) },
    ];

    const colW = (width - 80) / 2;
    infoFields.forEach((f, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const fx = 50 + col * colW;
        const fy = infoY + 20 + row * 60;

        ctx.fillStyle = "rgba(99, 102, 241, 0.15)";
        drawRoundRect(ctx, fx, fy, colW - 20, 48, 12);
        ctx.fill();

        ctx.textAlign = "left";
        ctx.fillStyle = "#a5b4fc";
        ctx.font = "bold 18px NotoEmojiBold, BeVietnamPro, Sans";
        ctx.fillText(f.icon, fx + 12, fy + 32);

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "13px BeVietnamPro, Sans";
        ctx.fillText(f.label, fx + 40, fy + 18);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px BeVietnamProBold, Sans";
        const maxValW = colW - 80;
        let val = String(f.value);
        if (ctx.measureText(val).width > maxValW) val = val.substring(0, 25) + "...";
        ctx.fillText(val, fx + 40, fy + 38);
    });

    // 7. Settings Section
    const settingsY = 530;
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    drawRoundRect(ctx, 30, settingsY, width - 60, 170, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "bold 18px BeVietnamProBold, Sans";
    ctx.textAlign = "left";
    ctx.fillText("CÀI ĐẶT NHÓM", 55, settingsY + 30);

    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath(); ctx.moveTo(50, settingsY + 42); ctx.lineTo(width - 50, settingsY + 42); ctx.stroke();

    const defaultSettings = [
        { label: "Anti-Link", value: "OFF", color: "#94a3b8" },
        { label: "Anti-Spam", value: "OFF", color: "#94a3b8" },
        { label: "Bé Hân", value: "ON", color: "#10b981" },
        { label: "Auto React", value: "OFF", color: "#94a3b8" },
    ];

    const displaySettings = settings.length > 0 ? settings : defaultSettings;
    const sColW = (width - 100) / displaySettings.length;

    displaySettings.forEach((s, i) => {
        const sx = 50 + i * sColW;
        const sy = settingsY + 55;

        ctx.fillStyle = s.value === "ON" ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.1)";
        drawRoundRect(ctx, sx, sy, sColW - 15, 90, 15);
        ctx.fill();

        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "13px BeVietnamPro, Sans";
        ctx.fillText(s.label, sx + (sColW - 15) / 2, sy + 32);

        ctx.fillStyle = s.color || (s.value === "ON" ? "#10b981" : "#94a3b8");
        ctx.font = "bold 24px BeVietnamProBold, Sans";
        ctx.fillText(s.value, sx + (sColW - 15) / 2, sy + 68);
    });

    // 8. Footer
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.font = "italic 14px BeVietnamPro, Sans";
    ctx.fillText("✦ Zalo Bot System ✦", width / 2, height - 15);

    return canvas.toBuffer("image/png");
}


export async function drawNoitu({ word, description, points, timeLeft, historyCount, skipsLeft, nextLetter, botAvatar, userName }) {
    const width = 800, height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Background Gradient
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#1e3a8a"); // Blue-900
    bg.addColorStop(1, "#1e40af"); // Blue-800
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid Pattern
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
    }
    for (let i = 0; i < height; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    // 2. Header
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, width, 80);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px BeVietnamProBold, Sans";
    ctx.textAlign = "left";
    ctx.fillText("NỐI TỪ VTV 🎮", 30, 52);

    // Stats on Header
    ctx.textAlign = "right";
    ctx.font = "bold 22px BeVietnamPro, Sans";
    ctx.fillStyle = "#fbbf24"; // Gold
    ctx.fillText(`Điểm: ${points}  |  Lượt: ${historyCount}  |  Bỏ qua: ${skipsLeft}/3`, width - 30, 50);

    // 3. Main Content Card
    const cardX = 30, cardY = 100, cardW = 740, cardH = 300;
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    drawRoundRect(ctx, cardX, cardY, cardW, cardH, 25);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.stroke();

    // 4. Timer Bar
    const timerW = (timeLeft / 30) * (cardW - 40);
    ctx.fillStyle = timeLeft > 10 ? "#10b981" : "#ef4444";
    drawRoundRect(ctx, cardX + 20, cardY + 20, Math.max(0, timerW), 10, 5);
    ctx.fill();

    // 5. Central Word
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 60px BeVietnamProBold, Sans";
    ctx.fillText(word.toUpperCase(), width / 2, cardY + 120);

    // Description text wrapping
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "italic 20px BeVietnamPro, Sans";
    wrapText(ctx, description || "Đang cập nhật định nghĩa...", width / 2, cardY + 170, cardW - 100, 28);

    // 6. Next Character Instruction
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 30px BeVietnamProBold, Sans";
    ctx.fillText(`HÃY Nối: ${nextLetter.toUpperCase()} ...`, width / 2, cardY + 260);

    // 7. Footer
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, height - 60, width, 60);
    
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "16px BeVietnamPro, Sans";
    ctx.fillText("HD: Nhắn từ 2 chữ cái để nối. Nhắn '!noitu skip' để bỏ qua.", 30, height - 25);

    return canvas.toBuffer("image/png");
}

export async function drawVtv({ jumbled, points, timeLeft, round, userName, avatar }) {
    const width = 800, height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Luxury Dark/Yellow Theme (VTV colors)
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#1a1a1a");
    bg.addColorStop(1, "#333333");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Yellow border
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 15;
    ctx.strokeRect(0, 0, width, height);

    // Header
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(15, 15, width - 30, 80);
    
    ctx.fillStyle = "#000";
    ctx.font = "bold 40px BeVietnamProBold, Sans";
    ctx.textAlign = "center";
    ctx.fillText("VUA TIẾNG VIỆT 🇻🇳", width / 2, 70);

    // Main Content
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px BeVietnamPro, Sans";
    ctx.fillText(`VÒNG ${round}: NHẬN DIỆN`, width / 2, 160);

    // Jumbled Word Box
    const boxW = 600, boxH = 120;
    const boxX = (width - boxW) / 2, boxY = 190;
    ctx.fillStyle = "rgba(251, 191, 36, 0.1)";
    drawRoundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 60px BeVietnamProBold, Sans";
    ctx.fillText(jumbled.toUpperCase(), width / 2, boxY + 80);

    // Timer and Info
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 28px BeVietnamProBold, Sans";
    ctx.textAlign = "left";
    ctx.fillText(`⏳ ${timeLeft}s`, boxX + 20, boxY + boxH + 60);
    ctx.textAlign = "right";
    ctx.fillText(`🏆 Điểm: ${points}`, width - boxX - 20, boxY + boxH + 60);

    // Footer
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "italic 18px BeVietnamPro, Sans";
    ctx.fillText("Hãy sắp xếp các chữ cái trên thành một từ có nghĩa!", width / 2, height - 50);

    return canvas.toBuffer("image/png");
}

export async function drawGoldPrice(goldList, updateTime) {
    const CARD_H = 75, CARD_GAP = 12, PADDING = 40;
    const HEADER_HEIGHT = 160;
    const FOOTER_HEIGHT = 120;
    const width = 800;
    const height = HEADER_HEIGHT + (goldList.length * (CARD_H + CARD_GAP)) + FOOTER_HEIGHT;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Luxury Dark & Gold Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c0a09");
    bgGrad.addColorStop(0.5, "#1c1917");
    bgGrad.addColorStop(1, "#0c0a09");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Blur
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#fbbf24"; // Gold
    ctx.beginPath(); ctx.arc(0, 0, 450, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#92400e";
    ctx.beginPath(); ctx.arc(width, height, 400, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    // 2. Header
    ctx.textAlign = "center";
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 44px BeVietnamProBold, Sans";
    ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 15;
    ctx.fillText("BẢNG GIÁ VÀNG PHÚ QUÝ", width / 2, 75);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "bold 20px BeVietnamPro, Sans";
    ctx.fillText(updateTime || "Cập nhật hôm nay", width / 2, 115);

    // Table Header
    ctx.textAlign = "left";
    ctx.font = "bold 18px BeVietnamProBold, Sans";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("LOẠI VÀNG", PADDING + 30, 145);
    ctx.textAlign = "right";
    ctx.fillText("MUA VÀO", width - PADDING - 180, 145);
    ctx.fillText("BÁN RA", width - PADDING - 40, 145);

    // 3. Rows
    for (let i = 0; i < goldList.length; i++) {
        const item = goldList[i];
        const y = HEADER_HEIGHT + i * (CARD_H + CARD_GAP);
        
        ctx.fillStyle = "rgba(251, 191, 36, 0.04)";
        drawRoundRect(ctx, PADDING, y, width - PADDING * 2, CARD_H, 15);
        ctx.fill();
        ctx.strokeStyle = "rgba(251, 191, 36, 0.1)";
        ctx.stroke();

        // Type
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px BeVietnamProBold, NotoEmojiBold, Sans";
        let type = item.type;
        if (ctx.measureText(type).width > 420) type = type.substring(0, 32) + "...";
        ctx.fillText(type, PADDING + 30, y + 45);

        // Buy/Sell
        ctx.textAlign = "right";
        ctx.font = "bold 22px BeVietnamProBold, Sans";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(item.buy || "—", width - PADDING - 180, y + 45);
        ctx.fillStyle = "#ef4444";
        ctx.fillText(item.sell || "—", width - PADDING - 40, y + 45);
    }

    // 4. Footer
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.font = "italic 18px BeVietnamPro, Sans";
    ctx.fillText("Dữ liệu được cập nhật từ Phú Quý Group • DGK System", width / 2, height - 60);

    return canvas.toBuffer("image/png");
}

export async function drawFuelPrice(fuelList, updateTime) {
    const CARD_H = 80, CARD_GAP = 12, PADDING = 40;
    const HEADER_HEIGHT = 180;
    const FOOTER_HEIGHT = 120;
    const width = 800;
    const height = HEADER_HEIGHT + (fuelList.length * (CARD_H + CARD_GAP)) + FOOTER_HEIGHT;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. PVOIL Theme Background (Deep Blue Gradient)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#075985"); // Blue 800
    bgGrad.addColorStop(1, "#1e1b4b"); // Navy
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Blur
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#ef4444"; 
    ctx.beginPath(); ctx.arc(width, 0, 400, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath(); ctx.arc(0, height, 350, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    // 2. Header
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px BeVietnamProBold, Sans";
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 10;
    ctx.fillText("BẢNG GIÁ XĂNG DẦU PVOIL", width / 2, 75);
    ctx.shadowBlur = 0;

    // Red Decorative Line
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(width / 2 - 150, 90, 300, 4);

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 22px BeVietnamPro, Sans";
    ctx.fillText(`🕒 Cập nhật: ${updateTime || "Mới nhất"}`, width / 2, 130);

    // Table Header
    ctx.textAlign = "left";
    ctx.font = "bold 18px BeVietnamProBold, Sans";
    ctx.fillStyle = "#bae6fd";
    ctx.fillText("SẢN PHẨM", PADDING + 30, 165);
    ctx.textAlign = "right";
    ctx.fillText("GIÁ (VNĐ/LÍT)", width - PADDING - 180, 165);
    ctx.fillText("THAY ĐỔI", width - PADDING - 30, 165);

    // 3. Rows
    for (let i = 0; i < fuelList.length; i++) {
        const item = fuelList[i];
        const y = HEADER_HEIGHT + i * (CARD_H + CARD_GAP);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        drawRoundRect(ctx, PADDING, y, width - PADDING * 2, CARD_H, 20);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.stroke();

        // Product Name
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px BeVietnamProBold, NotoEmojiBold, Sans";
        ctx.fillText(item.name, PADDING + 30, y + 48);

        // Price
        ctx.textAlign = "right";
        ctx.font = "bold 26px BeVietnamProBold, Sans";
        ctx.fillStyle = "#facc15"; 
        ctx.fillText(item.price, width - PADDING - 180, y + 48);

        // Change
        ctx.font = "bold 18px BeVietnamProBold, Sans";
        const chg = item.change || "";
        if (chg.includes("+")) ctx.fillStyle = "#f87171"; 
        else if (chg.includes("-")) ctx.fillStyle = "#4ade80"; 
        else ctx.fillStyle = "#94a3b8";
        ctx.fillText(chg === "0" ? "—" : chg, width - PADDING - 30, y + 48);
    }

    // 4. Footer
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = "italic 18px BeVietnamPro, Sans";
    ctx.fillText("Dữ liệu được trích xuất từ PVOIL.com.vn • System by DGK", width / 2, height - 60);

    return canvas.toBuffer("image/png");
}

export async function drawXSMB(results, dateStr) {
    const width = 800;
    const headerH = 150;
    const footerH = 80;
    const rowH = 65;
    const padding = 40;
    const height = headerH + (9 * rowH) + footerH;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Background (Red/Gradient)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#c00");
    bgGrad.addColorStop(1, "#800");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Pattern
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#fff";
    for(let i=0; i<10; i++) {
        ctx.beginPath(); ctx.arc(Math.random()*width, Math.random()*height, 100, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 2. Header
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff0"; // Yellow
    ctx.font = "bold 50px BeVietnamProBold, Sans";
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 10;
    ctx.fillText("XỔ SỐ MIỀN BẮC", width / 2, 70);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px BeVietnamPro, Sans";
    ctx.fillText(`📅 Ngày mở thưởng: ${dateStr}`, width / 2, 115);

    // 3. Results Table
    const tableY = headerH;
    const labels = ["Mã ĐB", "Giải ĐB", "Giải Nhất", "Giải Nhì", "Giải Ba", "Giải Tư", "Giải Năm", "Giải Sáu", "Giải Bảy"];
    const prizeKeys = ["code", "db", "g1", "g2", "g3", "g4", "g5", "g6", "g7"];

    for (let i = 0; i < labels.length; i++) {
        const y = tableY + i * rowH;
        
        // Row BG
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)";
        ctx.fillRect(padding, y, width - padding * 2, rowH);

        // Label
        ctx.textAlign = "left";
        ctx.fillStyle = "#ff0";
        ctx.font = "bold 22px BeVietnamProBold, Sans";
        ctx.fillText(labels[i], padding + 20, y + 42);

        // Value
        ctx.textAlign = "center";
        let val = results[prizeKeys[i]] || "—";
        if (Array.isArray(val)) val = val.join("   ");
        
        if (i === 1) { // G.DB
            ctx.fillStyle = "#fff";
            ctx.font = "bold 34px BeVietnamProBold, Sans";
            ctx.shadowColor = "rgba(255, 255, 0, 0.5)"; ctx.shadowBlur = 15;
            ctx.fillText(val, width / 2 + 50, y + 45);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 24px BeVietnamProBold, Sans";
            ctx.fillText(val, width / 2 + 50, y + 42);
        }
    }

    // 4. Footer
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "italic 18px BeVietnamPro, Sans";
    ctx.fillText("KQXS được cập nhật tự động từ xosodaiphat.com • By DGK", width / 2, height - 35);

    return canvas.toBuffer("image/png");
}

export async function drawBatchuImage(imageUrl) {
    const { createCanvas, loadImage } = await import("canvas");
    const size = 800;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");

    // Nền trắng và viền vàng đơn giản
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 15;
    ctx.strokeRect(10, 10, size - 20, size - 20);

    try {
        const img = await loadImage(imageUrl);
        const imgSize = 640;
        ctx.drawImage(img, (size - imgSize) / 2, (size - imgSize) / 2, imgSize, imgSize);
    } catch (e) {
        console.error("Lỗi vẽ ảnh Bắt chữ:", e.message);
    }

    return canvas.toBuffer("image/png");
}
