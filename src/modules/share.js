import fs from 'node:fs';
import path from 'node:path';
import { log } from '../logger.js';

export const name = "share";
export const description = "Trình quản lý tệp tin: Duyệt thư mục và gửi tệp tin (Chỉ Admin Bot)";

const shareSessions = new Map();

/**
 * Định dạng dung lượng tệp tin dễ đọc
 */
function formatSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export const commands = {
    share: async (ctx) => {
        const { api, threadId, threadType, senderId, args, adminIds } = ctx;

        // Bảo mật: Chỉ cho phép Admin Bot sử dụng lệnh này
        if (!adminIds.includes(String(senderId))) {
            return api.sendMessage({ msg: "⚠️ Lệnh này cực kỳ nhạy cảm và chỉ dành cho Admin Bot!" }, threadId, threadType);
        }

        let targetPathInput = args.join(" ").trim();
        let targetPath = "";
        
        if (!targetPathInput) targetPath = process.cwd();
        else {
            // Xử lý thông minh dấu gạch chéo ở đầu: Luôn coi là thư mục con trong project trừ khi là đường dẫn ổ đĩa tuyệt đối
            let cleanRelative = targetPathInput;
            if (cleanRelative.startsWith("/") || cleanRelative.startsWith("\\")) {
                cleanRelative = cleanRelative.slice(1);
            }
            
            // Nếu là đường dẫn tuyệt đối (vd C:\...) thì dùng luôn, còn không thì nối từ CWD
            if (path.isAbsolute(targetPathInput)) {
                targetPath = targetPathInput;
            } else {
                targetPath = path.resolve(process.cwd(), cleanRelative);
            }
        }

        if (!fs.existsSync(targetPath)) {
            return api.sendMessage({ msg: `⚠️ Đường dẫn không tồn tại!\n📌 Đã thử tại: ${targetPath}\n(Mẹo: Gõ -share src/modules để mở thư mục)` }, threadId, threadType);
        }

        const stats = fs.statSync(targetPath);
        if (stats.isFile()) {
            return sendFile(api, threadId, threadType, targetPath);
        } else {
            return listDirectory(api, threadId, threadType, senderId, targetPath);
        }
    }
};

async function listDirectory(api, threadId, threadType, senderId, dirPath) {
    try {
        if (!fs.existsSync(dirPath)) return api.sendMessage({ msg: "⚠️ Thư mục không tồn tại!" }, threadId, threadType);
        
        const files = fs.readdirSync(dirPath);
        const folderName = path.basename(dirPath) || dirPath;
        
        let msg = `📂 [ THƯ MỤC: ${folderName.toUpperCase()} ]\n`;
        msg += `─────────────────\n`;
        msg += `📁 0. .. (Thư mục cha)\n`;
        
        let totalDirSize = 0;
        const items = [];
        
        for (const f of files) {
            try {
                const fPath = path.join(dirPath, f);
                const stat = fs.statSync(fPath);
                if (!stat.isDirectory()) totalDirSize += stat.size;
                items.push({ 
                    name: f, 
                    path: fPath, 
                    isDir: stat.isDirectory(), 
                    mtime: stat.mtimeMs, 
                    size: stat.size 
                });
            } catch { /* Skip broken files */ }
        }

        // Sắp xếp: Thư mục trước, file sau.
        items.sort((a, b) => {
            if (a.isDir !== b.isDir) return b.isDir - a.isDir;
            return b.mtime - a.mtime;
        });

        // Hiển thị tối đa 100 mục
        const displayItems = items.slice(0, 100);
        displayItems.forEach((item, index) => {
            const sizeStr = item.isDir ? "" : ` - ⚖️ ${formatSize(item.size)}`;
            msg += `${index + 1}. ${item.isDir ? "📁" : "📄"} ${item.name}${sizeStr}\n`;
        });

        msg += `─────────────────\n`;
        msg += `📊 Tổng dung lượng tệp tin: ${formatSize(totalDirSize)}\n`;
        msg += `💡 Phản hồi STT (vd: 1 2 3) để Gửi nhiều tệp.\n`;
        msg += `💡 Gõ "up" hoặc "0" để quay lại.\n`;
        msg += `📌 Path: ${dirPath}`;

        const sent = await api.sendMessage({ msg }, threadId, threadType);
        const key = `${threadId}-${senderId}`;
        shareSessions.set(key, {
            currentPath: dirPath,
            items: displayItems
        });
    } catch (e) {
        api.sendMessage({ msg: `⚠️ Lỗi: ${e.message}` }, threadId, threadType);
    }
}

async function sendFile(api, threadId, threadType, filePath) {
    try {
        const fileName = path.basename(filePath);
        const stats = fs.statSync(filePath);
        const fileSizeStr = formatSize(stats.size);

        if (stats.size > 100 * 1024 * 1024) { 
            return api.sendMessage({ msg: `⚠️ File ${fileName} quá lớn (${fileSizeStr}). Bot chỉ hỗ trợ tối đa 100MB.` }, threadId, threadType);
        }

        await api.sendMessage({
            msg: `📄 File: ${fileName} (${fileSizeStr})`,
            attachments: [filePath]
        }, threadId, threadType);

    } catch (e) {
        api.sendMessage({ msg: `⚠️ Lỗi gửi file ${path.basename(filePath)}: ${e.message}` }, threadId, threadType);
    }
}

export async function handle(ctx) {
    const { api, threadId, threadType, senderId, content } = ctx;
    const key = `${threadId}-${senderId}`;
    const session = shareSessions.get(key);
    if (!session) return false;

    const input = content.trim();
    if (input.toLowerCase() === "up" || input === "0") {
        const parentPath = path.dirname(session.currentPath);
        shareSessions.delete(key);
        await listDirectory(api, threadId, threadType, senderId, parentPath);
        return true;
    }

    // Xử lý chọn nhiều tệp (vd: 1 2 3)
    const parts = input.split(/[\s,]+/).filter(p => !isNaN(parseInt(p)));
    if (parts.length === 0) return false;

    const selectedItems = [];
    for (const p of parts) {
        const idx = parseInt(p);
        if (idx >= 1 && idx <= session.items.length) {
            selectedItems.push(session.items[idx - 1]);
        }
    }

    if (selectedItems.length === 0) return false;

    // Nếu chỉ chọn 1 thư mục thì mở thư mục đó
    if (selectedItems.length === 1 && selectedItems[0].isDir) {
        shareSessions.delete(key);
        await listDirectory(api, threadId, threadType, senderId, selectedItems[0].path);
        return true;
    }

    // Nếu chọn nhiều hoặc chọn file
    shareSessions.delete(key);
    
    let totalSize = 0;
    const filePaths = [];
    for (const item of selectedItems) {
        if (!item.isDir) {
            totalSize += item.size;
            filePaths.push(item.path);
        }
    }

    if (filePaths.length > 0) {
        await api.sendMessage({ msg: `⏳ Đang gửi ${filePaths.length} tệp (Tổng: ${formatSize(totalSize)})...` }, threadId, threadType);
        for (const filePath of filePaths) {
            await sendFile(api, threadId, threadType, filePath);
        }
    }

    // Nếu trong danh sách chọn có thư mục (khi chọn nhiều)
    for (const item of selectedItems) {
        if (item.isDir && selectedItems.length > 1) {
            await api.sendMessage({ msg: `📁 Lưu ý: Mục "${item.name}" là thư mục, bạn cần mở vào trong để chọn gửi tệp.` }, threadId, threadType);
        }
    }

    return true;
}
