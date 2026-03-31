import { AvatarSize } from "zca-js";

export const name = "find";
export const description = "Truy tìm thông tin người dùng Zalo qua Số Điện Thoại";

export const commands = {
    find: async (ctx) => {
        const { api, args, threadId, threadType, log } = ctx;

        if (args.length === 0) {
            return api.sendMessage({ msg: "⚠️ Vui lòng cung cấp Số điện thoại Zalo cần tra cứu.\n◈ Dùng: !find 0987654321" }, threadId, threadType);
        }

        const phoneInput = args[0].replace(/\D/g, ''); // Bỏ hết khoảng trắng hoặc dấu, chỉ để lại số

        try {
            await api.sendMessage({ msg: `⏳ Đang tra cứu thông tin số ${phoneInput} trên Data Zalo...` }, threadId, threadType);

            // Fetch Size = 240 cho nét xí
            const result = await api.getMultiUsersByPhones(phoneInput, AvatarSize.Large);

            // Result trả về dang Map { "09xxxx": UserBasic }
            if (!result || Object.keys(result).length === 0) {
                return api.sendMessage({ msg: `❌ Không tìm thấy thông tin/Tài khoản không tồn tại của SĐT: ${phoneInput}` }, threadId, threadType);
            }

            // Có thể array hoặc object key là số điện thoại tuỳ ZCA trả
            const phoneKey = Object.keys(result)[0];
            const user = result[phoneKey];

            if (!user || user.error) {
                return api.sendMessage({ msg: `❌ Tài khoản khoá số, không có dữ liệu cho SĐT: ${phoneInput}` }, threadId, threadType);
            }

            // Ghép data thành 1 bản báo cáo ngầu
            let msg = `[ 🔍 HỒ SƠ ZALO ]\n`;
            msg += `─────────────────\n`;
            msg += `◈ SĐT Tìm : ${phoneInput}\n`;
            msg += `◈ Tên Zalo: ${user.dName || user.zaloName || "Ẩn"}\n`;
            msg += `◈ UID     : ${user.uid || "Chưa cấp"}\n`;
            msg += `─────────────────`;

            // Nếu user có ảnh đại diện, tải ảnh gửi kèm hoặc dán link gốc cho khỏe xí
            // Ở đây gọi sendMessage kèm link qua attach (Nếu ZCA không lấy được Attach có thể dùng URL text)
            if (user.avatar) {
                msg += `\n🔗 Link HD Avatar:\n${user.avatar}`;
            }

            // Style nổi bật
            const styles = [
                { start: 0, len: 18, st: "b" },
                { start: 0, len: 18, st: "c_db342e" }
            ];

            await api.sendMessage({ msg, styles }, threadId, threadType);
            log.success("Tra info thành công số: " + phoneInput);

        } catch (e) {
            log.error("Lỗi tra cứu SĐT:", e.message);
            await api.sendMessage({ msg: `⚠️ Hệ thống Zalo từ chối hoặc bị lỗi: ${e.message}\n(Có thể do người đó cài đặt riêng tư khoá tìm bằng SĐT).` }, threadId, threadType);
        }
    }
};
