import { MessageType } from "../index.js";
import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { Zalo } from "../zalo.js";
import { encodeAES, handleZaloResponse, request, makeURL, getMd5LargeFileFromUrl, getFileInfoFromUrl } from "../utils.js";
import { checkExstentionFileRemote } from "../../utils/util.js";

export function sendFileFactory(api) {
  const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/asyncfile/msg`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
    nretry: "0",
  });

  const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/asyncfile/msg`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
    nretry: "0",
  });
  return async function sendFile(message, fileUrl, ttl = 0, fileNameInput, fileSizeInput, extInput, md5FileInput) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    if (!message) throw new ZaloApiError("Missing message");
    let fileName = fileNameInput;
    let fileSize = fileSizeInput;
    let ext = extInput;
    let md5File = md5FileInput;

    if (!ext) {
      ext = await checkExstentionFileRemote(fileUrl);
    }
    if (!fileName || !fileSize) {
      const { fileName: fileNameRemote, fileSize: fileSizeRemote } = await getFileInfoFromUrl(fileUrl);
      fileName = fileNameRemote;
      fileSize = fileSizeRemote;
    }
    if (!md5File) {
      md5File = (await getMd5LargeFileFromUrl(fileUrl, fileSize)).data;
    }

    const threadId = message.threadId;
    const threadType = message.type;
    const isGroupMessage = threadType === MessageType.GroupMessage;

    const params = {
      fileId: Date.now(),
      checksum: md5File,
      checksumSha: "",
      extension: ext,
      totalSize: fileSize,
      fileName: fileName,
      clientId: Date.now(),
      fType: 1,
      fileCount: 0,
      fdata: "{}",
      fileUrl: fileUrl,
      zsource: 402,
      ttl: ttl
    };

    if (threadType === MessageType.GroupMessage) {
      params.grid = String(threadId);
    } else {
      params.toid = String(threadId);
    }

    if (message.data?.content && typeof message.data.content === "string") {
      params.msg = message.data.content;
    }
    if (message.data?.mentions) {
      params.mentionInfo = JSON.stringify(message.data.mentions);
    }

    const url = isGroupMessage ? groupMessageServiceURL : directMessageServiceURL;
    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

    const response = await request(url, {
      method: "POST",
      body: new URLSearchParams({
        params: encryptedParams
      })
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
    return result.data;
  };
} 