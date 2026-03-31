import fs from "node:fs";
import path from "node:path";

export const tempDir = path.join(process.cwd(), "src", "modules", "cache", "temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

export function logMessageToFile(message, type = "general") {
    try {
        const logDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

        const fileName = `${type}_${new Date().toISOString().split('T')[0]}.log`;
        const filePath = path.join(logDir, fileName);

        const timestamp = new Date().toLocaleString();
        fs.appendFileSync(filePath, `[${timestamp}] ${message}\n`);
    } catch (e) { }
}

export function readJSON(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, "utf8"));
        }
    } catch (e) { }
    return null;
}

export function writeJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
        return true;
    } catch (e) { }
    return false;
}

export function cleanTempFiles() {
    try {
        if (!fs.existsSync(tempDir)) return;
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            try {
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > 5 * 60 * 1000) fs.unlinkSync(filePath);
            } catch (e) { }
        });
    } catch (e) { }
}

export function cleanupOldFiles() {
    const extensions = [".mp4", ".mp3", ".aac", ".jpg", ".jpeg", ".png", ".webp", ".tmp"];
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 phút

    const targets = [
        process.cwd(),
        path.join(process.cwd(), "src", "modules", "cache"),
        tempDir
    ];

    targets.forEach(dir => {
        try {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const ext = path.extname(file).toLowerCase();
                if (extensions.includes(ext)) {
                    const fullPath = path.join(dir, file);
                    try {
                        // Bỏ qua các file quan trọng trong cache (ví dụ font .ttf)
                        if (ext === ".ttf") return;

                        const stats = fs.statSync(fullPath);
                        if (now - stats.mtimeMs > maxAge) {
                            fs.unlinkSync(fullPath);
                            // logMessageToFile(`Cleanup: Deleted ${file}`, "cleanup");
                        }
                    } catch (e) { }
                }
            });
        } catch (e) { }
    });
}
