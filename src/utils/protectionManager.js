import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const settingsPath = path.join(process.cwd(), "src", "modules", "cache", "protection_settings.json");

export const protectionManager = {
    _settings: {},
    _violations: {}, // { threadId: { userId: { photo: { count: 0, firstTime: 0 }, sticker: { count: 0, firstTime: 0 } } } }
    
    CONFIG: {
        photo: {
            window: 15 * 1000,
            warn: 5,
            kick: 8,
            cleanup: 120 * 1000
        },
        sticker: {
            window: 15 * 1000,
            warn: 2,
            kick: 3,
            cleanup: 120 * 1000
        },
        tag: {
            window: 60 * 1000,
            warn: 2,
            kick: 3,
            cleanup: 300 * 1000
        },
        link: {
            window: 60 * 1000,
            warn: 1,
            kick: 5,
            cleanup: 300 * 1000
        },
        spam: {
            window: 5 * 1000,
            warn: 2,
            kick: 3,
            cleanup: 60 * 1000
        }
    },

    load() {
        try {
            if (fs.existsSync(settingsPath)) {
                this._settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
            } else {
                this._settings = {};
                this.save();
            }
        } catch (e) {
            log.error("Lỗi khi load protection_settings.json:", e.message);
            this._settings = {};
        }
    },

    save() {
        try {
            const dir = path.dirname(settingsPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(settingsPath, JSON.stringify(this._settings, null, 2), "utf-8");
        } catch (e) {
            log.error("Lỗi khi save protection_settings.json:", e.message);
        }
    },

    isEnabled(threadId, type) {
        if (Object.keys(this._settings).length === 0) this.load();
        if (!this._settings[threadId]) return false;
        return this._settings[threadId][type] === true;
    },

    setEnabled(threadId, type, enabled) {
        this.load();
        if (!this._settings[threadId]) this._settings[threadId] = {};
        this._settings[threadId][type] = enabled;
        this.save();
    },

    addViolation(threadId, userId, type) {
        this.cleanup(threadId); // Dọn dẹp dữ liệu cũ
        const now = Date.now();
        if (!this._violations[threadId]) this._violations[threadId] = {};
        if (!this._violations[threadId][userId]) this._violations[threadId][userId] = {};
        
        let v = this._violations[threadId][userId][type];
        const config = this.CONFIG[type];
        
        if (!v || (now - v.firstTime > config.window)) {
            v = { count: 1, firstTime: now };
        } else {
            v.count++;
        }
        
        this._violations[threadId][userId][type] = v;
        return v.count;
    },

    resetViolation(threadId, userId, type) {
        if (this._violations[threadId]?.[userId]?.[type]) {
            delete this._violations[threadId][userId][type];
        }
    },

    cleanup(threadId) {
        const now = Date.now();
        if (!this._violations[threadId]) return;
        
        for (const userId in this._violations[threadId]) {
            for (const type in this._violations[threadId][userId]) {
                const config = this.CONFIG[type];
                if (now - this._violations[threadId][userId][type].firstTime > config.cleanup) {
                    delete this._violations[threadId][userId][type];
                }
            }
            if (Object.keys(this._violations[threadId][userId]).length === 0) {
                delete this._violations[threadId][userId];
            }
        }
    }
};
