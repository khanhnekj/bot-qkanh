import axios from "axios";
import crypto from "node:crypto";
import FormData from "form-data";
import { log } from "../logger.js";

export const name = "upscale";
export const description = "Làm nét ảnh 4K cực đỉnh (Remaker AI)";

async function reply(ctx, text) {
    await ctx.api.sendMessage(
        { msg: text, quote: ctx.message.data },
        ctx.threadId,
        ctx.threadType
    );
}

const extractImageUrl = (attachStr) => {
    if (!attachStr) return null;
    try {
        let attachObj = typeof attachStr === "string" ? JSON.parse(attachStr) : attachStr;
        if (Array.isArray(attachObj) && attachObj.length > 0) attachObj = attachObj[0];

        let url = null;
        if (attachObj.params) {
            let paramsObj = typeof attachObj.params === "string" ? JSON.parse(attachObj.params) : attachObj.params;
            if (paramsObj.hd) url = paramsObj.hd;
            else if (paramsObj.url) url = paramsObj.url;
        }
        if (!url && attachObj.href) url = attachObj.href;

        if (url && typeof url === 'string') {
            url = url.trim().replace(/^"|"$/g, '');
            if (url.startsWith("http")) return url;
        }
    } catch (e) { }
    return null;
};

function generateFingerprint() {
    const components = [
        process.version,
        process.arch,
        process.platform,
        Math.random().toString(),
        Date.now().toString()
    ];
    return crypto.createHash("md5").update(components.join("|")).digest("hex");
}

async function processUpscale(buffer) {
    const form = new FormData();
    form.append("type", "Enhancer");
    form.append("original_image_file", buffer, { filename: "image.jpg", contentType: "image/jpeg" });

    const productSerial = generateFingerprint();
    const headers = {
        ...form.getHeaders(),
        "authorization": "",
        "product-code": "067003",
        "product-serial": productSerial,
        "Referer": "https://remaker.ai/"
    };

    log.info("[Remaker] Creating enhancement job...");
    const createJobRes = await axios.post("https://api.remaker.ai/api/pai/v4/ai-enhance/create-job-new", form, { headers });

    if (createJobRes.data.code !== 100000) {
        throw new Error(`Tạo job thất bại: ${createJobRes.data.message?.en || createJobRes.data.message || "Unknown error"}`);
    }

    const jobId = createJobRes.data.result.job_id;
    log.info(`[Remaker] Job created: ${jobId}. Polling...`);

    let attempts = 0;
    while (attempts < 40) {
        await new Promise(r => setTimeout(r, 3000));
        const jobRes = await axios.get(`https://api.remaker.ai/api/pai/v4/ai-enhance/get-job/${jobId}`, {
            headers: {
                "authorization": "",
                "product-code": "067003",
                "product-serial": productSerial,
                "Referer": "https://remaker.ai/"
            }
        });

        if (jobRes.data.code === 100000) {
            log.info("[Remaker] Success!");
            return jobRes.data.result.output[0];
        } else if (jobRes.data.code !== 300013) {
            throw new Error(`Lỗi tiến trình: ${jobRes.data.message?.en || jobRes.data.message || "Progress error"}`);
        }

        attempts++;
        log.info(`[Remaker] Polling job ${jobId}... (${attempts}/40)`);
    }

    throw new Error("Thời gian xử lý quá lâu (Timeout).");
}

export const commands = {
    "4k": async (ctx) => {
        const { api, threadId, threadType, message } = ctx;
        const imageUrl = extractImageUrl(message.data?.quote?.attach) || extractImageUrl(message.data?.attach);

        if (!imageUrl) {
            return reply(ctx, "⚠️ Vui lòng reply (phản hồi) vào một bức ảnh hoặc đính kèm ảnh để làm nét!");
        }

        let waitMsg = null;
        try {
            waitMsg = await api.sendMessage({ msg: "⏳ Đang xử lý làm nét (Remaker AI), vui lòng chờ trong giây lát..." }, threadId, threadType);

            const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(res.data);

            const resultUrl = await processUpscale(imageBuffer);

            if (api.sendImageEnhanced) {
                await api.sendImageEnhanced({
                    imageUrl: resultUrl,
                    threadId,
                    threadType,
                    msg: "✨ Ảnh của bạn đã được làm nét lên 4K thành công!"
                });
            } else {
                await api.sendMessage({
                    msg: "✨ Ảnh của bạn đã được làm nét lên 4K thành công!",
                    attachments: [resultUrl]
                }, threadId, threadType);
            }

        } catch (err) {
            log.error("Upscale Error:", err.message);
            await reply(ctx, `❌ Lỗi: ${err.message}`);
        } finally {
            if (waitMsg && waitMsg.message) {
                try {
                    const msgData = waitMsg.message || waitMsg;
                    if (typeof api.undo === "function") {
                        await api.undo(msgData, threadId, threadType);
                    } else if (typeof api.deleteMessage === "function") {
                        await api.deleteMessage(msgData, threadId, threadType);
                    }
                } catch (e) { }
            }
        }
    },

    upscale: async (ctx) => {
        return commands["4k"](ctx);
    }
};
