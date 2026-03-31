import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";
import { MessageType } from "../models/Message.js";
import ffmpeg from "fluent-ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

ffmpeg.setFfprobePath(ffprobeInstaller.path);

const getVideoInfo = (url) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(url, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const { duration, width, height } = metadata.streams[0];
      const fileSize = metadata.format.size;
      resolve({
        duration: duration * 1000,
        width,
        height,
        fileSize
      });
    });
  });
};

export function sendVideoFactory(api) {
  const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/forward`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
    nretry: 0,
  });
  const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/forward`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
    nretry: 0,
  });

  return async function sendVideo({
    videoUrl,
    threadId,
    threadType,
    message = null,
    ttl = 0,
  }) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");
    let fileSize = 0;
    let duration = 0;
    let width = 1280;
    let height = 720;
    let thumbnailUrl = null;
    try {
      const { duration: videoDuration, width: videoWidth, height: videoHeight, fileSize: videoFileSize } = await getVideoInfo(videoUrl);
      duration = videoDuration || 0;
      width = videoWidth || 1280;
      height = videoHeight || 720;
      fileSize = videoFileSize || 0;
      thumbnailUrl = videoUrl.replace(/\.[^/.]+$/, ".jpg") || null;
    } catch (error) {
      throw new ZaloApiError(`Unable to get video content: ${error.message}`);
    }

    const payload = {
      params: {
        clientId: String(Date.now()),
        ttl: ttl,
        zsource: 704,
        msgType: 5,
        msgInfo: JSON.stringify({
          videoUrl: String(videoUrl),
          thumbUrl: String(thumbnailUrl),
          duration: Number(duration),
          width: Number(width),
          height: Number(height),
          fileSize: Number(fileSize),
          properties: {
            color: -1,
            size: -1,
            type: 1003,
            subType: 0,
            ext: {
              sSrcType: -1,
              sSrcStr: "",
              msg_warning_type: 0,
            },
          },
          title: message ? message.text : "",
        }),
      },
    };

    if (message && message.mention) {
      payload.params.mentionInfo = message.mention;
    }

    let url;
    if (threadType === MessageType.DirectMessage) {
      url = directMessageServiceURL;
      payload.params.toId = String(threadId);
      payload.params.imei = appContext.imei;
    } else if (threadType === MessageType.GroupMessage) {
      url = groupMessageServiceURL;
      payload.params.visibility = 0;
      payload.params.grid = String(threadId);
      payload.params.imei = appContext.imei;
    } else {
      throw new ZaloApiError("Thread type is invalid");
    }

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(payload.params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

    const response = await request(url, {
      method: "POST",
      body: new URLSearchParams({
        params: encryptedParams,
      }),
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
    return result.data;
  };
}
