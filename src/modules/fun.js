/**
 * Module: Fun
 * Các lệnh vui vẻ, giải trí
 */

export const name = "fun";
export const description = "Lệnh vui: rps";

async function reply(ctx, text) {
    await ctx.api.sendMessage(
        { msg: text, quote: ctx.message.data },
        ctx.threadId,
        ctx.threadType
    );
}

export const commands = {

    // !rps [kéo|búa|bao] - Oẳn tù tì
    rps: async (ctx) => {
        const map = { kéo: 0, búa: 1, bao: 2, ko: 0, bu: 1, ba: 2 };
        const names = ["❂ Kéo", "❂ Búa", "❂ Bao"];
        const wins = [1, 2, 0]; // kéo thắng bao, búa thắng kéo, bao thắng búa

        const userKey = ctx.args[0]?.toLowerCase();
        const userIdx = map[userKey];
        if (userIdx === undefined) {
            await reply(ctx, "◈ Dùng: !rps kéo | búa | bao");
            return;
        }

        const botIdx = Math.floor(Math.random() * 3);
        let result;
        if (userIdx === botIdx) result = "✧ Hoà!";
        else if (wins[userIdx] === botIdx) result = "✦ Bạn thắng!";
        else result = "⚠️ Bot thắng!";

        await reply(ctx,
            `[ 🎮 RPS GAME ]\n` +
            `─────────────────\n` +
            `❯ Bạn : ${names[userIdx]}\n` +
            `❯ Bot : ${names[botIdx]}\n` +
            `─────────────────\n` +
            `➥ ${result}`
        );
    },

};
