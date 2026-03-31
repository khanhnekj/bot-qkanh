import { exec } from "node:child_process";

export const name = "bug";
export const description = "Debug tools";

export const commands = {
    bug: async (ctx) => {
        try {
            const rawData = JSON.stringify(ctx.message.data, null, 2).substring(0, 1500);
            await ctx.api.sendMessage({ msg: "DEBUG BUG:\n" + rawData }, ctx.threadId, ctx.threadType);
        } catch (e) {
            console.error(e);
        }
    },
    debug: async (ctx) => {
        try {
            const rawData = JSON.stringify(ctx.message.data, null, 2).substring(0, 1500);
            await ctx.api.sendMessage({ msg: "DEBUG INFO:\n" + rawData }, ctx.threadId, ctx.threadType);
        } catch (e) {
            console.error(e);
        }
    },
    debugquote: async (ctx) => {
        try {
            const rawData = JSON.stringify(ctx.message.data || {}, null, 2).substring(0, 1500);
            await ctx.api.sendMessage({ msg: "DEBUG QUOTE:\n" + rawData }, ctx.threadId, ctx.threadType);
        } catch (e) {
            console.error(e);
        }
    },
    shell: async (ctx) => {
        const { api, threadId, threadType, args, senderId, adminIds } = ctx;
        if (!adminIds.includes(senderId)) return;

        const cmd = args.join(" ");
        if (!cmd) return api.sendMessage({ msg: "🔍 Nhập lệnh shell cần chạy!" }, threadId, threadType);

        exec(cmd, (err, stdout, stderr) => {
            if (err) return api.sendMessage({ msg: ` Lỗi:\n${err.message}` }, threadId, threadType);
            const output = stdout || stderr || "✅ Command executed with no output.";
            api.sendMessage({ msg: `💻 Shell Output:\n${output.substring(0, 1500)}` }, threadId, threadType);
        });
    }
};
