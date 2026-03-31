import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadModules() {
    const allCommands = {};
    const moduleInfo = [];
    const extraHandlers = [];

    let files;
    try {
        files = (await readdir(__dirname)).filter(
            (f) => f.endsWith(".js") && f !== "index.js"
        );
    } catch {
        return { allCommands, moduleInfo, extraHandlers };
    }

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
        try {
            const modulePath = pathToFileURL(join(__dirname, file)).href + "?t=" + Date.now();
            const mod = await import(modulePath);

            const modName = mod.name ?? file.replace(".js", "");
            const modDesc = mod.description ?? "";

            if (mod.commands && typeof mod.commands === "object") {
                for (let [cmd, handler] of Object.entries(mod.commands)) {
                    cmd = cmd.toLowerCase(); // Chuyển command sang chữ thường để match không phân biệt hoa thường
                    if (allCommands[cmd]) {
                        log.warn(`Module "${modName}" trùng lệnh: !${cmd}`);
                    }
                    allCommands[cmd] = handler;
                }
                moduleInfo.push({ name: modName, description: modDesc, cmdCount: Object.keys(mod.commands).length, commands: Object.keys(mod.commands).map(k => k.toLowerCase()) });
            }

            if (typeof mod.handle === "function" || typeof mod.handleReaction === "function" || typeof mod.handleGroupEvent === "function" || typeof mod.handleUndo === "function") {
                extraHandlers.push({
                    name: modName + "_handler",
                    handle: mod.handle,
                    handleReaction: mod.handleReaction,
                    handleGroupEvent: mod.handleGroupEvent,
                    handleUndo: mod.handleUndo
                });
            }
            successCount++;

        } catch (e) {
            errorCount++;
            log.error(`Module ${file} lỗi`, e.message);
        }
    }

    if (successCount > 0) log.system(`Tải thành công ${successCount} module hoạt động.`);
    return { allCommands, moduleInfo, extraHandlers };
}
