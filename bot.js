import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Zalo } from "./src/api-zalo/index.js";
import sizeOf from "image-size";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import { loadModules } from "./src/modules/index.js";
import { loadEvents } from "./src/events/index.js";
import { log } from "./src/logger.js";
import { rentalManager } from "./src/utils/rentalManager.js";
import { autoReactManager } from "./src/utils/autoReactManager.js";
import { cleanTempFiles, cleanupOldFiles } from "./src/utils/io-json.js";
import { handleListen } from "./src/utils/listen.js";
import { registerCustomApi } from "./src/utils/customApi.js";
import { protectionManager } from "./src/utils/protectionManager.js";
import { startAutosendTicker } from "./src/modules/autosend.js";
import { startXSMBTracker } from "./src/modules/xsmb.js";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

const loadConfig = () => JSON.parse(readFileSync("config.json", "utf-8"));

const isValidCookies = (creds) => {
    const c = creds?.cookies;
    if (!c) return false;
    if (typeof c === "string") return c.length > 50;
    return (Array.isArray(c.cookies) && c.cookies.length > 0) || (Array.isArray(c) && c.length > 0) || Object.keys(c).length > 0;
};

async function main() {
    const config = loadConfig();
    const { bot: { prefix = "!", selfListen = false } = {}, admin: { ids: adminIds = [] } = {}, credentials: creds = {} } = config;

    log.info("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
    log.info("┃   ✦  ZALO BOT (zca-js)    ┃");
    log.info("┃   ✦  CREATE BY DGK         ┃");
    log.info("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛");

    rentalManager.load();
    autoReactManager.load();
    protectionManager.load();

    const { allCommands, moduleInfo, extraHandlers } = await loadModules();
    const { handlers: baseEventHandlers, eventCommands } = await loadEvents();
    const eventHandlers = [...baseEventHandlers, ...extraHandlers];
    Object.assign(allCommands, eventCommands);

    log.info(`✦ ${moduleInfo.length} modules | ${Object.keys(allCommands).length} commands | ${eventHandlers.length} events`);

    const zalo = new Zalo({
        selfListen,
        imageMetadataGetter: async (p) => {
            try {
                const b = readFileSync(p);
                const d = sizeOf(b);
                return { width: d.width, height: d.height, size: b.length };
            } catch (e) { return { width: 100, height: 100, size: 0 }; }
        }
    });

    let api;
    if (isValidCookies(creds) && creds.imei) {
        try {
            log.info("🔑 Đăng nhập bằng cookies...");
            api = await zalo.login({ cookie: creds.cookies, imei: creds.imei, userAgent: creds.userAgent });
            log.success("Đăng nhập thành công!");
        } catch { api = null; }
    }

    if (!api) {
        try {
            log.info("📱 Quét QR code...");
            api = await zalo.loginQR();
            log.success("Đăng nhập QR thành công!");
        } catch (e) { log.error("Thất bại:", e.message); process.exit(1); }
    }

    const ctx = api.getContext();
    const cfg = loadConfig();
    cfg.credentials.cookies = ctx.cookie;
    cfg.credentials.imei = ctx.imei;
    writeFileSync("config.json", JSON.stringify(cfg, null, 2));

    registerCustomApi(api, log);

    cleanTempFiles(); cleanupOldFiles();
    setInterval(() => { cleanTempFiles(); cleanupOldFiles(); }, 3600000);

    startAutosendTicker(api);
    startXSMBTracker(api);

    await handleListen(api, { prefix, selfListen, adminIds, allCommands, moduleInfo, eventHandlers, log });

    const stop = () => { log.info("\n✦ Tắt bot..."); api.listener.stop(); process.exit(0); };
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
}

main();
