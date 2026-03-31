import axios from "axios";
import FormData from "form-data";
import fs from "node:fs";
import { log } from "../logger.js";

/**
 * Upload file lên Zalo CDN hoặc tmpfiles.org
 */
export async function uploadToTmpFiles(filePath, api = null, threadId = null, threadType = null) {
    try {
        if (!fs.existsSync(filePath)) return null;

        // Nếu có api thì ưu tiên up thẳng lên Zalo CDN cho mượt
        if (api && threadId) {
            log.info(`◈ Đang upload file lên Zalo CDN...`);
            const results = await api.uploadAttachment(filePath, threadId, threadType);
            if (results && results.length > 0) {
                const url = results[0].fileUrl || results[0].url || results[0].hdUrl;
                if (url) {
                    log.info(`✅ [ZaloCDN] Upload thành công.`);
                    return url;
                }
            }
            log.warn(`⚠️ [ZaloCDN] Không lấy được link, thử chuyển sang tmpfiles...`);
        }

        const form = new FormData();
        form.append("file", fs.createReadStream(filePath));

        log.info(`◈ Đang upload file lên tmpfiles.org...`);
        const response = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
            headers: form.getHeaders(),
            timeout: 60000,
            maxBodyLength: Infinity
        });

        if (response.data?.status === "success") {
            const url = response.data.data.url;
            const directUrl = url.replace("tmpfiles.org/", "tmpfiles.org/dl/").replace("http://", "https://");
            log.info(`✅ [tmpFiles] Upload thành công: ${directUrl}`);
            return directUrl;
        }
        return null;
    } catch (e) {
        log.error("Lỗi upload file:", e.message);
        return null;
    }
}
