import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const CACHE_FILE = path.resolve(process.cwd(), "src/modules/cache/prefixes.json");

class PrefixManager {
    constructor() {
        this.prefixes = new Map();
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        this.load();
    }

    load() {
        if (!fs.existsSync(CACHE_FILE)) {
            this.save();
        } else {
            try {
                const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
                for (const [threadId, prefix] of Object.entries(data)) {
                    this.prefixes.set(String(threadId), prefix);
                }
            } catch (err) {
                log.error("Lỗi đọc file prefixes.json:", err.message);
            }
        }
    }

    save() {
        try {
            const data = Object.fromEntries(this.prefixes);
            fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
        } catch (err) {
            log.error("Lỗi lưu file prefixes.json:", err.message);
        }
    }

    getPrefix(threadId) {
        return this.prefixes.get(String(threadId));
    }

    setPrefix(threadId, prefix) {
        this.prefixes.set(String(threadId), prefix);
        this.save();
    }

    resetPrefix(threadId) {
        if (this.prefixes.has(String(threadId))) {
            this.prefixes.delete(String(threadId));
            this.save();
        }
    }
}

export const prefixManager = new PrefixManager();
