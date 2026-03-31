import { google } from "googleapis";
import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { log } from "../logger.js";

const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "gdrive_token.json");
const FOLDER_ID = "1YQJl73TN8SZLJObLNGTiJ4jsA_U6W8FM";

/**
 * Lấy MIME type thủ công
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
        ".aac": "audio/aac",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".zip": "application/zip",
        ".txt": "text/plain"
    };
    return mimeMap[ext] || "application/octet-stream";
}

/**
 * Khởi tạo OAuth2 Client và xử lý đăng nhập nếu cần
 */
async function getDriveClient() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error("⚠️ Không tìm thấy credentials.json!");
    }

    const content = fs.readFileSync(CREDENTIALS_PATH, "utf8");
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Nếu đã có token lưu từ trước
    if (fs.existsSync(TOKEN_PATH)) {
        const token = fs.readFileSync(TOKEN_PATH, "utf8");
        oAuth2Client.setCredentials(JSON.parse(token));

        // Tự động làm mới token nếu hết hạn
        oAuth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                const currentToken = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
                fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...currentToken, ...tokens }));
            }
        });

        return google.drive({ version: "v3", auth: oAuth2Client });
    }

    // Nếu chưa có token, bắt đầu quy trình đăng nhập (chỉ chạy 1 lần duy nhất)
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/drive"],
    });

    console.log("\n⚠️ [GDRIVE] BẠN CẦN ĐĂNG NHẬP ĐỂ CẤP QUYỀN:");
    console.log("1. Truy cập link sau trên trình duyệt:");
    console.log(authUrl);
    console.log("\n2. Sau khi cho phép, bạn sẽ được chuyển hướng đến localhost hoặc trang báo lỗi.");
    console.log("3. Copy cái đoạn mã code=`MÃ_Ở_ĐÂY` trên thanh địa chỉ và dán vào đây.");

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    return new Promise((resolve, reject) => {
        rl.question("\nNhập mã xác thực (code) vào đây: ", async (code) => {
            rl.close();
            try {
                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
                log.info("✅ Đã lưu token Google Drive thành công!");
                resolve(google.drive({ version: "v3", auth: oAuth2Client }));
            } catch (err) {
                reject(new Error("⚠️ Lỗi xác thực mã code: " + err.message));
            }
        });
    });
}

/**
 * Upload file từ URL lên Google Drive
 */
export async function uploadFromUrl(url, headers = {}) {
    let drive;
    try {
        drive = await getDriveClient();
    } catch (e) {
        log.error("⚠️ Lỗi khởi tạo Drive:", e.message);
        throw e;
    }

    const urlObj = new URL(url);
    let fileName = urlObj.pathname.split("/").pop() || `file_${Date.now()}`;
    if (!path.extname(fileName)) fileName += ".mp4";
    const tempPath = path.join(process.cwd(), `gdrive_oauth_${Date.now()}_${fileName}`);

    log.info(`◈ [GDrive context] Đang tải file...`);
    const response = await axios({ 
        method: "GET", 
        url, 
        responseType: "stream", 
        timeout: 60000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
            ...headers
        }
    });
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

    try {
        const mimeType = getMimeType(tempPath);
        log.info(`◈ [GDrive context] Đang upload vào folder cá nhân...`);
        const res = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: mimeType,
                parents: [FOLDER_ID]
            },
            media: {
                mimeType: mimeType,
                body: fs.createReadStream(tempPath)
            },
            fields: "id"
        });

        const fileId = res.data.id;
        log.info(`✅ [GDrive] Upload xong! ID: ${fileId}`);

        // Share public
        await drive.permissions.create({
            fileId: fileId,
            requestBody: { role: "reader", type: "anyone" }
        });

        return `https://drive.google.com/uc?id=${fileId}&export=download`;
    } catch (e) {
        log.error(`⚠️ [GDrive] Lỗi upload:`, e.message);
        throw e;
    } finally {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
}

/**
 * Upload file từ máy lên Drive
 */
export async function uploadFromFile(filePath) {
    const drive = await getDriveClient();
    const fileName = path.basename(filePath);
    const mimeType = getMimeType(filePath);

    try {
        const res = await drive.files.create({
            requestBody: { name: fileName, parents: [FOLDER_ID] },
            media: { mimeType: mimeType, body: fs.createReadStream(filePath) },
            fields: "id"
        });

        const fileId = res.data.id;
        await drive.permissions.create({
            fileId: fileId,
            requestBody: { role: "reader", type: "anyone" }
        });

        return `https://drive.google.com/uc?id=${fileId}&export=download`;
    } catch (e) {
        log.error(`⚠️ [GDrive] Lỗi upload file:`, e.message);
        throw e;
    }
}
