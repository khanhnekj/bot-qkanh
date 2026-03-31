const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    italic: "\x1b[3m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    gray: "\x1b[90m",
    white: "\x1b[37m",
    bgBlue: "\x1b[44m",
    bgGreen: "\x1b[42m",
    bgRed: "\x1b[41m",
    bgCyan: "\x1b[46m",
    bgYellow: "\x1b[43m",
    bgMagenta: "\x1b[45m",
};

function timestamp() {
    return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function getPrefix(color, icon) {
    return `${COLORS.gray}[${timestamp()}]${COLORS.reset} ${color}${COLORS.bright}${icon}${COLORS.reset}`;
}

export const log = {
    info: (msg) => console.log(`${getPrefix(COLORS.cyan, "ℹ")} ${msg}`),
    success: (msg) => console.log(`${getPrefix(COLORS.green, "✔")} ${COLORS.green}${msg}${COLORS.reset}`),
    warn: (msg) => console.log(`${getPrefix(COLORS.yellow, "⚠")} ${COLORS.yellow}${msg}${COLORS.reset}`),
    error: (msg, detail = "") => {
        const detailStr = (typeof detail === "object" && detail !== null) ? (detail.message || JSON.stringify(detail)) : detail;
        console.log(`${getPrefix(COLORS.red, "✘")} ${COLORS.red}${COLORS.bright}${msg}${COLORS.reset}${detailStr ? ` ${COLORS.gray}➔ ${detailStr}${COLORS.reset}` : ""}`);
    },
    debug: (msg) => console.log(`${getPrefix(COLORS.magenta, "⚙")} ${COLORS.gray}${msg}${COLORS.reset}`),

    // --- LOG CHAT BOX (PREMIUM) ---
    chat: (type, name, threadId, text, groupName = null, data = null) => {
        const isGroup = type === "GROUP";
        const hash = [...threadId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const groupColors = [COLORS.bgBlue, COLORS.bgCyan, COLORS.bgGreen, COLORS.bgMagenta, COLORS.bgRed];
        const gColor = groupColors[hash % groupColors.length];

        const timeStr = `${COLORS.gray}${timestamp()}${COLORS.reset}`;
        const threadTag = isGroup 
            ? `${gColor}${COLORS.white}${COLORS.bright} ${groupName || "GROUP"} ${COLORS.reset} ${COLORS.cyan}${threadId}${COLORS.reset}` 
            : `${COLORS.bgCyan}${COLORS.white}${COLORS.bright} PRIVATE ${COLORS.reset} ${COLORS.cyan}${threadId}${COLORS.reset}`;

        const senderId = data?.uidFrom || data?.uid || "N/A";
        const senderTag = `${COLORS.yellow}${COLORS.bright}${name}${COLORS.reset} ${COLORS.gray}(${senderId})${COLORS.reset}`;

        // Header khung
        console.log(`${COLORS.gray}╭─── ${timeStr} ─ ${threadTag}${COLORS.reset}`);
        console.log(`${COLORS.gray}│${COLORS.reset} FROM: ${senderTag}`);

        // Xử lý nội dung dựa trên type tin nhắn
        const msgType = data?.msgType || "chat.text";
        let contentStr = text || (typeof data?.content === "string" ? data.content : "");
        let icon = "💬";

        if (msgType.includes("photo")) {
            icon = "🖼️ [PHOTO]";
            const url = data?.content?.href || data?.attach?.url || data?.attach?.hdUrl || "";
            contentStr = `${COLORS.italic}${COLORS.gray}${contentStr || "Đã gửi một ảnh"}${COLORS.reset}\n${COLORS.gray}╰─▶ Link: ${COLORS.blue}${url}${COLORS.reset}`;
        } else if (msgType.includes("sticker")) {
            icon = "🎨 [STICKER]";
            let stickerData = {};
            try { stickerData = typeof data?.content === "string" ? JSON.parse(data.content) : (data?.content || data?.attach || {}); } catch { }
            contentStr = `${COLORS.magenta}Sticker ID: ${stickerData.id || "N/A"} | Cat: ${stickerData.catId || stickerData.cateId || "N/A"}${COLORS.reset}`;
        } else if (msgType.includes("video")) {
            icon = "📹 [VIDEO]";
            contentStr = `${COLORS.italic}${contentStr || "Đã gửi một video"}${COLORS.reset}`;
        } else if (msgType.includes("voice") || msgType.includes("audio")) {
            icon = "🎵 [AUDIO]";
            contentStr = `${COLORS.italic}${contentStr || "Đã gửi một tin nhắn thoại"}${COLORS.reset}`;
        } else if (msgType.includes("file")) {
            icon = "📁 [FILE]";
            contentStr = `${COLORS.blue}${COLORS.bright}${contentStr || "Tệp đính kèm"}${COLORS.reset}`;
        } else if (msgType.includes("link")) {
            icon = "🔗 [LINK]";
        }

        const lines = contentStr.split("\n");
        lines.forEach((line, i) => {
            const prefix = i === 0 ? `${COLORS.gray}│${COLORS.reset} ${icon}: ` : `${COLORS.gray}│${COLORS.reset}        `;
            console.log(`${prefix}${line}`);
        });

        console.log(`${COLORS.gray}╰───────────────────────────────────────────────────────${COLORS.reset}\n`);
    },

    event: (type, threadId, text) => {
        console.log(
            `${COLORS.gray}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}${COLORS.bright}✦ EVENT${COLORS.reset} ${COLORS.magenta}${type.toUpperCase()}${COLORS.reset} ${COLORS.gray}(${threadId})${COLORS.reset}: ${COLORS.cyan}${text}${COLORS.reset}`
        );
    },

    system: (msg) => {
        console.log(`${COLORS.bgGreen}${COLORS.white}${COLORS.bright} SYSTEM ${COLORS.reset} ${COLORS.bright}${msg}${COLORS.reset}`);
    },

    divider: () => console.log(`${COLORS.gray}─────────────────────────────────────────────────────────────────${COLORS.reset}`)
};
