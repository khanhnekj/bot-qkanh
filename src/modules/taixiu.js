import { drawTaiXiu } from "../utils/canvasHelper.js";
import { bankManager } from "../utils/bankManager.js";
import fs from "node:fs";
import path from "node:path";

export const name = "taixiu";
export const description = "Trò chơi Tài Xỉu Luxury - cá cược bằng xu";

export const commands = {
    taixiu: async (ctx) => {
        const { api, args, senderId, senderName, threadId, threadType, prefix } = ctx;

        if (args.length < 2) {
            let msg = `[ 🎲 TÀI XỈU LUXURY ]\n`;
            msg += `─────────────────\n`;
            msg += `👉 Cách chơi: ${prefix}taixiu [tai|xiu] [số_tiền|all]\n`;
            msg += `💰 Số dư hiện tại: ${bankManager.getBalance(senderId).toLocaleString()} xu\n`;
            msg += `─────────────────\n`;
            msg += `💡 Ví dụ: ${prefix}taixiu tai 1000`;
            return api.sendMessage({ msg }, threadId, threadType);
        }

        const choice = args[0].toLowerCase();
        if (choice !== "tai" && choice !== "xiu") {
            return api.sendMessage({ msg: "⚠️ Lựa chọn không hợp lệ. Vui lòng chọn 'tai' hoặc 'xiu'." }, threadId, threadType);
        }

        let balance = bankManager.getBalance(senderId);
        let betAmount = 0;

        if (args[1].toLowerCase() === "all") {
            betAmount = balance;
        } else {
            betAmount = parseInt(args[1]);
        }

        if (isNaN(betAmount) || betAmount <= 0) {
            return api.sendMessage({ msg: "⚠️ Số tiền cược không hợp lệ." }, threadId, threadType);
        }

        if (betAmount > balance) {
            return api.sendMessage({ msg: `⚠️ Bạn không đủ xu để cược. Số dư: ${balance.toLocaleString()} xu.` }, threadId, threadType);
        }

        // --- BẮT ĐẦU LẮC XÚC XẮC ---
        try {
            await api.sendMessage({
                msg: `🎲 Đang lắc xúc xắc... Chờ 3 giây nhé, ${senderName}!`,
                imageUrl: "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2ZkbTN5ZzAxaXp4ZzR6ZzR6ZzR6ZzR6ZzR6ZzR6ZzR6ZzR6JmVwPXYxX3N0aWNrZXJzX3NlYXJjaCZjdD1z/3o7TKVUn7iM8FMEU24/giphy.gif"
            }, threadId, threadType);
        } catch (e) { }

        // Giả lập thời gian lắc
        await new Promise(resolve => setTimeout(resolve, 3000));

        const dices = [
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1
        ];

        const total = dices.reduce((a, b) => a + b, 0);
        const result = total >= 11 ? "tai" : "xiu";
        const isWin = choice === result;

        // Xử lý tiền
        let endBalance = 0;
        let diff = 0;
        if (isWin) {
            diff = betAmount;
            endBalance = bankManager.add(senderId, betAmount);
        } else {
            diff = -betAmount;
            endBalance = bankManager.subtract(senderId, betAmount);
        }

        // Tạo ảnh kết quả
        const betInfoText = `${senderName} cược ${betAmount.toLocaleString()} ➜ ${isWin ? "THẮNG" : "THUA"} (${isWin ? "+" : ""}${diff.toLocaleString()} xu)\n💰 Số dư: ${endBalance.toLocaleString()} xu`;

        try {
            const resultImg = await drawTaiXiu(dices, total, result, betInfoText);
            const tmpPath = path.join(process.cwd(), `tx_${Date.now()}.png`);
            fs.writeFileSync(tmpPath, resultImg);

            await api.sendMessage({
                msg: `[ 🎲 KẾT QUẢ TÀI XỈU ]\n─────────────────\n👤 Người chơi: ${senderName}\n🎲 Kết quả: ${result.toUpperCase()} (${total} điểm)\n💰 ${isWin ? `Chúc mừng! Bạn thắng +${betAmount.toLocaleString()} xu` : `Chia buồn! Bạn thua -${betAmount.toLocaleString()} xu`}\n─────────────────\n🌟 Số dư mới: ${endBalance.toLocaleString()} xu`,
                attachment: fs.createReadStream(tmpPath)
            }, threadId, threadType);

            // Cleanup
            setTimeout(() => { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); }, 10000);

        } catch (e) {
            console.error("Lỗi vẽ Tai Xiu:", e);
            const txtMsg = `[ 🎲 KẾT QUẢ TÀI XỈU ]\n─────────────────\n🎲 Xúc xắc: ${dices.join(" - ")}\n📊 Tổng: ${total} ➜ ${result.toUpperCase()}\n💰 ${isWin ? `Chúc mừng! Bạn thắng ${betAmount.toLocaleString()} xu.` : `Chia buồn! Bạn thua ${betAmount.toLocaleString()} xu.`}\n─────────────────`;
            await api.sendMessage({ msg: txtMsg }, threadId, threadType);
        }
    },

    xu: async (ctx) => {
        const { api, senderId, senderName, threadId, threadType } = ctx;
        const balance = bankManager.getBalance(senderId);
        return api.sendMessage({ msg: `💰 Tài khoản của ${senderName}:\n📊 Số dư: ${balance.toLocaleString()} xu` }, threadId, threadType);
    },

    topxu: async (ctx) => {
        const { api, threadId, threadType } = ctx;
        const { statsManager } = await import("../utils/statsManager.js");

        bankManager.load();
        const top = Object.entries(bankManager._data)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (top.length === 0) return api.sendMessage({ msg: "⚠️ Hiện chưa có dữ liệu tài khoản nào." }, threadId, threadType);

        let msg = `[ 🏆 TOP PHÚ HỘ XU ]\n`;
        msg += `─────────────────\n`;

        // Lấy danh sách uids
        const uids = top.map(u => u[0]);
        let userProfiles = {};
        try {
            userProfiles = await api.getUserInfo(uids);
        } catch { }

        top.forEach(([uid, bal], i) => {
            const index = i + 1;
            const user = userProfiles[uid] || Object.values(userProfiles).find(p => String(p.userId || p.uid) === String(uid));
            const name = user?.displayName || user?.zaloName || (statsManager.getStats(null, uid)?.name) || `UID ${uid}`;
            msg += `${index}. ${name}: ${bal.toLocaleString()} xu\n`;
        });
        
        msg += `─────────────────`;
        return api.sendMessage({ msg }, threadId, threadType);
    }
};
