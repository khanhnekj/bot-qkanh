import FormData from "form-data";
import fs from "fs";
import path from "path";
import { appContext } from "../context.js";
import { Zalo, ZaloApiError } from "../index.js";
import { MessageType } from "../models/Message.js";
import { encodeAES, getFileSize, getGifDimensions, getImageMetaData, getMd5LargeFileObject, handleZaloResponse, makeURL, request } from "../utils.js";
import { checkConfigUploadAttachment, getProphylacticUploadAttachment, setProphylacticUploadAttachment } from "../../index.js";
import { uploadTempFile } from "../../utils/util.js";

const urlType = {
  image: "photo_original/upload",
  aac: "voice/upload",
  video: "asyncfile/upload",
  gif: "gif?",
  others: "asyncfile/upload",
};

export function uploadAttachmentFactory(api) {
  const serviceURL = `${api.zpwServiceMap.file[0]}/api`;

  return async function uploadAttachment(filePaths, threadId, type = MessageType.DirectMessage, isUseProphylactic = false) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    if (!filePaths) throw new ZaloApiError("Missing filePaths");

    // Handle single string path
    if (typeof filePaths === "string") filePaths = [filePaths];

    if (!filePaths.length) throw new ZaloApiError("No files provided");
    if (!threadId) throw new ZaloApiError("Missing threadId");

    const results = [];

    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) throw new ZaloApiError("File not found");

      const extFile = path.extname(filePath).slice(1);

      if (getProphylacticUploadAttachment() || isUseProphylactic) {
        try {
          if (["jpg", "jpeg", "png", "webp"].includes(extFile)) {
            const imageData = await getImageMetaData(filePath);
            const url = await uploadTempFile(filePath);
            results.push({
              fileType: "image",
              width: imageData.width,
              height: imageData.height,
              totalSize: imageData.totalSize,
              photoId: Math.floor(Date.now() / 1000),
              normalUrl: url,
              hdUrl: url,
              thumbUrl: url,
            });
            continue;
          }
        } catch (error) {
          console.error("Upload Attachment API Thứ 3 Đã Xảy Ra Lỗi, Vui Lòng Kiểm Tra Lại!");
          console.error("Chuyển sang dùng api chính từ zalo (Không khả thi khi upload nhiều file trong thời gian ngắn)!");
        }
      }

      const chunkSize = appContext.settings.features.sharefile.chunk_size_file;
      const isGroupMessage = type == MessageType.GroupMessage;
      let url = `${serviceURL}/${isGroupMessage ? "group" : "message"}/`;
      const query = {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        type: isGroupMessage ? "11" : "2",
      };

      const fileName = path.basename(filePath);
      const processUpload = async () => {
        let clientId = Date.now();
        const data = {
          filePath,
          chunkContent: [],
          params: { imei: appContext.imei, isE2EE: 0, jxl: 0, chunkId: 1, clientId: clientId++, fileName },
        };

        if (isGroupMessage) data.params.grid = threadId;
        else data.params.toid = threadId;

        let totalSize;
        if (["jpg", "jpeg", "png"].includes(extFile)) {
          const imageData = await getImageMetaData(filePath);
          data.fileType = "image";
          data.fileData = imageData;
          totalSize = imageData.totalSize;
        } else if (["mp3"].includes(extFile)) {
          totalSize = await getFileSize(filePath);
          data.fileType = "aac";
          data.fileData = { fileName, totalSize };
          data.params.fileType = "aac";
        } else {
          totalSize = await getFileSize(filePath);
          data.fileType = extFile === "mp4" ? "video" : "others";
          data.fileData = { fileName, totalSize };
        }

        data.params.totalChunk = Math.ceil(totalSize / chunkSize);
        data.params.totalSize = totalSize;

        const fileBuffer = await fs.promises.readFile(filePath);
        for (let i = 0; i < data.params.totalChunk; i++) {
          const formData = new FormData();
          formData.append("chunkContent", fileBuffer.subarray(i * chunkSize, (i + 1) * chunkSize), {
            filename: fileName,
            contentType: "application/octet-stream",
          });
          data.chunkContent[i] = formData;
        }

        const requests = data.chunkContent.map(async (chunkContent, i) => {
          data.params.chunkId = i + 1;

          const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(data.params));
          if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

          const response = await request(makeURL(url + urlType[data.fileType], { ...query, params: encryptedParams }), {
            method: "POST",
            headers: chunkContent.getHeaders(),
            body: chunkContent.getBuffer(),
          });

          const result = await handleZaloResponse(response);
          if (result.error) {
            setProphylacticUploadAttachment(true);
            throw new ZaloApiError(result.error.message, result.error.code);
          }

          checkConfigUploadAttachment(extFile);

          const resData = result.data;
          if (resData) {
            if (resData.fileId && resData.fileId != -1) {
              return new Promise((resolve) => {
                if (["video", "aac", "others"].includes(data.fileType)) {
                  appContext.uploadCallbacks.set(resData.fileId, async (wsData) => {
                    results.push({
                      ...data.fileData,
                      ...resData,
                      ...wsData,
                      fileType: data.fileType,
                      checksum: (await getMd5LargeFileObject(data.filePath, data.fileData.totalSize)).data,
                    });
                    resolve();
                  });
                } else {
                  appContext.uploadCallbacks.set(resData.fileId, async (wsData) => {
                    results.push({
                      ...data.fileData,
                      ...resData,
                      ...wsData,
                      fileType: data.fileType,
                      checksum: (await getMd5LargeFileObject(data.filePath, data.fileData.totalSize)).data,
                    });
                    resolve();
                  });
                }
              });
            }
            if (resData.photoId) {
              if (resData.finished) {
                return new Promise((resolve) => {
                  results.push({
                    fileType: data.fileType,
                    width: data.fileData.width,
                    height: data.fileData.height,
                    totalSize: data.fileData.totalSize,
                    ...resData,
                  });
                  resolve();
                });
              }
            }
          }
        });

        await Promise.all(requests);
      };

      try {
        await processUpload();
      } catch (error) {
        console.error("Lỗi upload lần 1, thử lại sau 1s:", error);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await processUpload();
      }
    }

    return results;
  };
}
