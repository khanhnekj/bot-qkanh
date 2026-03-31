import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const configPath = path.join(process.cwd(), "src", "modules", "cache", "hanSetting.json");

/**
 * Quản lý tính năng auto-reply của Hân (Gemini)
 */
export const hanManager = {
    _settings: {},

    load() {
        try {
            if (fs.existsSync(configPath)) {
                this._settings = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            } else {
                this._settings = {};
                this.save();
            }
        } catch (e) {
            log.error("Lỗi khi load hanSetting.json:", e.message);
            this._settings = {};
        }
    },

    save() {
        try {
            if (!fs.existsSync(path.dirname(configPath))) {
                fs.mkdirSync(path.dirname(configPath), { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(this._settings, null, 2), "utf-8");
        } catch (e) {
            log.error("Lỗi khi save hanSetting.json:", e.message);
        }
    },

    set(threadId, enabled) {
        this.load();
        this._settings[threadId] = { enabled };
        this.save();
    },

    isEnabled(threadId) {
        this.load();
        // Mặc định là ON nếu chưa cài đặt
        if (this._settings[threadId] === undefined) return true;
        return this._settings[threadId].enabled;
    }
};
