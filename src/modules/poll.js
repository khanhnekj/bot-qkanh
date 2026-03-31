export const name = "poll";
export const description = "Tạo Bảng Bình Chọn/Khảo sát chính chủ Zalo";

export const commands = {
    poll: async (ctx) => {
        const { api, args, threadId, threadType, log } = ctx;

        // Zalo chỉ hỗ trợ Poll trong Group (threadType = 1)
        if (threadType !== 1) {
            return api.sendMessage({ msg: "⚠️ Lệnh tạo Khảo sát/Bình chọn chỉ dùng được trong Nhóm Chat!" }, threadId, threadType);
        }

        // Cú pháp: !poll Câu hỏi | Lựa chọn 1 | Lựa chọn 2 ...
        const input = args.join(" ").split("|").map(s => s.trim()).filter(Boolean);

        if (input.length < 3) {
            const usage = `[ 📊 HƯỚNG DẪN TẠO VOTE ZALO ]\n` +
                `─────────────────\n` +
                `◈ Dùng: !poll [Câu hỏi] | [Lựa chọn 1] | [Lựa chọn 2] | ...\n` +
                `◈ Ví dụ: !poll Hôm nay đi ăn gì? | Ăn Phở | Ăn Lẩu | Nhịn đói`;
            return api.sendMessage({ msg: usage }, threadId, threadType);
        }

        const question = input[0];
        const options = input.slice(1);

        try {
            await api.createPoll({
                question,
                options,
                expiredTime: 0, // Không hết hạn
                allowMultiChoices: true, // Cho phép chọn nhiều
                allowAddNewOption: true, // Cho phép thành viên tự thêm lựa chọn
                hideVotePreview: false, // Hiển thị kết quả luôn
                isAnonymous: false // Công khai người bình chọn
            }, threadId);

            log.success(`Đã tạo Bảng Bình Chọn thành công trong nhóm ${threadId}`);
        } catch (e) {
            log.error("Lỗi tạo poll:", e.message);
            await api.sendMessage({ msg: `⚠️ Lỗi tạo bình chọn: ${e.message}\n(Đảm bảo bạn nhập đúng cú pháp dấu | để tách chia)` }, threadId, threadType);
        }
    }
};
