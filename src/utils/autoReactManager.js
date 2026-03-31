import fs from "node:fs";
import path from "node:path";
import { log } from "../logger.js";

const configPath = path.join(process.cwd(), "src", "modules", "cache", "autoReact.json");

/**
 * Quản lý tính năng tự động thả reaction (Auto Reaction Manager)
 */
export const autoReactManager = {
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
            log.error("Lỗi khi load autoReact.json:", e.message);
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
            log.error("Lỗi khi save autoReact.json:", e.message);
        }
    },

    set(threadId, enabled, count = 10, icon = null) {
        this.load();
        this._settings[threadId] = {
            enabled,
            count: parseInt(count) || 10,
            icon: icon || null
        };
        this.save();
    },

    get(threadId) {
        this.load();
        return this._settings[threadId] || { enabled: false, count: 0, icon: null };
    },

    isEnabled(threadId) {
        return this.get(threadId).enabled;
    }
};
