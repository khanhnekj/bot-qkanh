import { ThreadType } from "zca-js";

export const name = "ping";
export const description = "Lệnh Ping & Tag All thành viên nhóm";

export const commands = {
    // !ping [nội dung] - Tag All chính chủ hệ thống
    ping: async (ctx) => {
        const { api, threadId, isGroup, threadType, args } = ctx;
        const t = Date.now();

        if (!isGroup) {
            return await api.sendMessage({ msg: `✦ Pong! (${Date.now() - t}ms)` }, threadId, threadType);
        }

        const customMsg = args.join(" ").trim();

        try {
            const latency = Date.now() - t;

            // Xây dựng nội dung tin nhắn
            let msg = `[ 📣 THÔNG BÁO  ]\n`;
            msg += `─────────────────\n`;
            msg += customMsg ? `📝 Nội dung: ${customMsg}\n` : `🚀 Tín hiệu Bot: ${latency}ms\n`;
            msg += `─────────────────`;

            // Tag All hệ thống bằng cách phủ tag -1 lên toàn bộ nội dung tin nhắn
            const mentions = [{
                uid: "-1",
                pos: 0,
                len: msg.length
            }];

            await api.sendMessage({ msg, mentions }, threadId, threadType);
        } catch (e) {
            await api.sendMessage({
                msg: `✦ Pong! (${Date.now() - t}ms) - (Lỗi tag: ${e.message})`
            }, threadId, threadType);
        }
    }
};
