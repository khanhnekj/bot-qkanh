import FormData from "form-data";
import fs from "fs";
import sharp from "sharp";
import { appContext } from "../context.js";
import { Zalo, ZaloApiError } from "../index.js";
import { GroupMessage, Message, MessageType } from "../models/Message.js";
import {
  analyzeLinks,
  encodeAES,
  getClientMessageType,
  getFileExtension,
  getFileName,
  getGifDimensions,
  getMd5LargeFileObject,
  handleZaloResponse,
  makeURL,
  removeUndefinedKeys,
  request,
} from "../utils.js";
const attachmentUrlType = {
  image: "photo_original/send?",
  gif: "gif?",
  video: "asyncfile/msg?",
  others: "asyncfile/msg?",
};
function prepareQMSGAttach(quote) {
  const quoteData = quote.data || quote;
  if (typeof quoteData.content == "string") return quoteData.propertyExt;
  if (quoteData.msgType == "chat.todo")
    return {
      properties: {
        color: 0,
        size: 0,
        type: 0,
        subType: 0,
        ext: '{"shouldParseLinkOrContact":0}',
      },
    };
  return Object.assign(Object.assign({}, quoteData.content), {
    thumbUrl: quoteData.content.thumb,
    oriUrl: quoteData.content.href,
    normalUrl: quoteData.content.href,
  });
}
function prepareQMSG(quote) {
  const quoteData = quote.data || quote;
  if (quoteData.msgType == "chat.todo" && typeof quoteData.content != "string") {
    return JSON.parse(quoteData.content.params).item.content;
  }
  return "";
}
async function send(data) {
  if (!Array.isArray(data)) data = [data];
  const requests = [];
  for (const each of data) {
    requests.push(
      (async () => {
        const response = await request(each.url, {
          method: "POST",
          body: each.body,
          headers: each.headers,
        });
        const result = await handleZaloResponse(response);
        if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
        return result.data;
      })()
    );
  }
  return await Promise.all(requests);
}
export function sendMessageFactory(api) {
  const serviceURLs = {
    message: {
      [MessageType.DirectMessage]: makeURL(`${api.zpwServiceMap.chat[0]}/api/message`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        nretry: 0,
      }),
      [MessageType.GroupMessage]: makeURL(`${api.zpwServiceMap.group[0]}/api/group`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        nretry: 0,
      }),
    },
    attachment: {
      [MessageType.DirectMessage]: `${api.zpwServiceMap.file[0]}/api/message/`,
      [MessageType.GroupMessage]: `${api.zpwServiceMap.file[0]}/api/group/`,
    },
  };
  const { sharefile } = appContext.settings.features;
  function isExceedMaxFile(totalFile) {
    return totalFile > sharefile.max_file;
  }
  function isExceedMaxFileSize(fileSize) {
    return fileSize > sharefile.max_size_share_file_v3 * 1024 * 1024;
  }
  function getGroupLayoutId() {
    return Date.now();
  }
  async function upthumb(filePath, url) {
    let formData = new FormData();
    let fileHandle;
    try {
      fileHandle = await fs.promises.open(filePath, 'r');
      const fileContent = await fileHandle.readFile();
      let buffer = await sharp(fileContent).png().toBuffer();
      formData.append("fileContent", buffer, {
        filename: "blob",
        contentType: "image/png",
      });
    } finally {
      if (fileHandle) await fileHandle.close();
    }

    const params = {
      clientId: Date.now(),
      imei: appContext.imei,
    };
    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

    let response = await request(
      makeURL(url + "upthumb?", {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        params: encryptedParams,
      }),
      {
        method: "POST",
        headers: formData.getHeaders(),
        body: formData.getBuffer(),
      }
    );
    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
    return result.data;
  }
  function handleMentions(type, msg, mentions) {
    let totalMentionLen = 0;
    const mentionsFinal =
      Array.isArray(mentions) && type == MessageType.GroupMessage
        ? mentions
          .filter((m) => m.pos >= 0 && m.uid && m.len > 0)
          .map((m) => {
            totalMentionLen += m.len;
            return {
              pos: m.pos,
              uid: m.uid,
              len: m.len,
              type: m.uid == "-1" ? 1 : 0,
            };
          })
        : [];
    if (totalMentionLen > msg.length) {
      throw new ZaloApiError("Invalid mentions: total mention characters exceed message length");
    }
    return {
      mentionsFinal,
      msgFinal: msg,
    };
  }
  async function handleMessage({ msg, mentions, quote, style }, threadId, type, ttl) {
    if (!msg || msg.length == 0) throw new ZaloApiError("Missing message content");
    const quoteDataInternal = (quote && (quote.data || quote));
    const isValidInstance = quote instanceof Message || quote instanceof GroupMessage || (quoteDataInternal && quoteDataInternal.msgId && quoteDataInternal.cliMsgId);
    if (quote && !isValidInstance) throw new ZaloApiError("Invalid quote message");
    const isGroupMessage = type == MessageType.GroupMessage;
    const { mentionsFinal, msgFinal } = handleMentions(type, msg, mentions);
    msg = msgFinal;
    const quoteData = quote ? (quote.data || quote) : undefined;
    if (quoteData) {
      if (typeof quoteData.content != "string" && quoteData.msgType == "webchat") {
        throw new ZaloApiError("This kind of `webchat` quote type is not available");
      }
      if (quoteData.msgType == "group.poll") {
        throw new ZaloApiError("The `group.poll` quote type is not available");
      }
    }
    const isMentionsValid = mentionsFinal.length > 0 && isGroupMessage;
    const params = quote
      ? {
        toid: isGroupMessage ? undefined : threadId,
        grid: isGroupMessage ? threadId : undefined,
        message: msg,
        clientId: Date.now(),
        mentionInfo: isMentionsValid ? JSON.stringify(mentionsFinal) : undefined,
        qmsgOwner: quoteData.uidFrom,
        qmsgId: quoteData.msgId,
        qmsgCliId: quoteData.cliMsgId,
        qmsgType: getClientMessageType(quoteData.msgType),
        qmsgTs: quoteData.ts,
        qmsg: typeof quoteData.content == "string" ? quoteData.content : prepareQMSG(quote),
        imei: isGroupMessage ? undefined : appContext.imei,
        visibility: isGroupMessage ? 0 : undefined,
        qmsgAttach: isGroupMessage ? JSON.stringify(prepareQMSGAttach(quote)) : undefined,
        qmsgTTL: quoteData.ttl,
        ttl: ttl,
        textProperties: style ? style : undefined,
      }
      : {
        message: msg,
        clientId: Date.now(),
        mentionInfo: isMentionsValid ? JSON.stringify(mentionsFinal) : undefined,
        imei: isGroupMessage ? undefined : appContext.imei,
        ttl: ttl,
        visibility: isGroupMessage ? 0 : undefined,
        toid: isGroupMessage ? undefined : threadId,
        grid: isGroupMessage ? threadId : undefined,
        textProperties: style ? style : undefined,
      };
    for (const key in params) {
      if (params[key] === undefined) delete params[key];
    }
    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");
    const finalServiceUrl = new URL(serviceURLs.message[type]);
    if (quote) {
      finalServiceUrl.pathname = finalServiceUrl.pathname + "/quote";
    } else {
      finalServiceUrl.pathname =
        finalServiceUrl.pathname + "/" + (isGroupMessage ? (params.mentionInfo ? "mention" : "sendmsg") : "sms");
    }
    return {
      url: finalServiceUrl.toString(),
      body: new URLSearchParams({ params: encryptedParams }),
    };
  }
  async function handleAttachment({ msg, attachments, mentions, quote, isUseProphylactic }, threadId, type, ttl) {
    if (!attachments || attachments.length == 0) throw new ZaloApiError("Missing attachments");
    const firstExtFile = getFileExtension(attachments[0]);
    const isSingleFile = attachments.length == 1;
    const isGroupMessage = type == MessageType.GroupMessage;
    const canBeDesc = isSingleFile && ["jpg", "jpeg", "png", "webp"].includes(firstExtFile);
    const gifFiles = attachments.filter((e) => getFileExtension(e) == "gif");
    attachments = attachments.filter((e) => getFileExtension(e) != "gif");
    const attachmentsData = [];
    if (attachments.length > 0) {
      const uploadAttachment = await api.uploadAttachment(attachments, threadId, type, isUseProphylactic);
      let indexInGroupLayout = uploadAttachment.length - 1;
      const groupLayoutId = getGroupLayoutId();
      const { mentionsFinal, msgFinal } = handleMentions(type, msg, mentions);
      msg = msgFinal;
      const isMentionsValid = mentionsFinal.length > 0 && isGroupMessage && attachments.length == 1;
      const isMultiFile = attachments.length > 1;
      let clientId = Date.now();
      for (const attachment of uploadAttachment) {
        let data;
        switch (attachment.fileType) {
          case "image": {
            data = {
              fileType: attachment.fileType,
              params: {
                photoId: attachment.photoId,
                clientId: (clientId++).toString(),
                desc: msg,
                width: attachment.width,
                height: attachment.height,
                toid: isGroupMessage ? undefined : String(threadId),
                grid: isGroupMessage ? String(threadId) : undefined,
                rawUrl: attachment.normalUrl,
                hdUrl: attachment.hdUrl,
                thumbUrl: attachment.thumbUrl,
                oriUrl: isGroupMessage ? attachment.normalUrl : undefined,
                normalUrl: isGroupMessage ? undefined : attachment.normalUrl,
                hdSize: String(attachment.totalSize),
                zsource: -1,
                ttl: ttl,
                jcp: '{"convertible":"jxl"}',
                groupLayoutId: isMultiFile ? groupLayoutId : undefined,
                isGroupLayout: isMultiFile ? 1 : undefined,
                idInGroup: isMultiFile ? indexInGroupLayout-- : undefined,
                totalItemInGroup: isMultiFile ? uploadAttachment.length : undefined,
                mentionInfo: isMentionsValid && canBeDesc && !quote ? JSON.stringify(mentionsFinal) : undefined,
              },
              body: new URLSearchParams(),
            };
            break;
          }
          case "video": {
            data = {
              fileType: attachment.fileType,
              params: {
                fileId: attachment.fileId,
                checksum: attachment.checksum,
                checksumSha: "",
                extention: getFileExtension(attachment.fileName),
                totalSize: attachment.totalSize,
                fileName: attachment.fileName,
                clientId: attachment.clientFileId,
                fType: 1,
                fileCount: 0,
                fdata: "{}",
                toid: isGroupMessage ? undefined : String(threadId),
                grid: isGroupMessage ? String(threadId) : undefined,
                fileUrl: attachment.fileUrl,
                zsource: -1,
                ttl: ttl,
              },
              body: new URLSearchParams(),
            };
            break;
          }
          case "others": {
            data = {
              fileType: attachment.fileType,
              params: {
                fileId: attachment.fileId,
                checksum: attachment.checksum,
                checksumSha: "",
                extention: getFileExtension(attachment.fileName),
                totalSize: attachment.totalSize,
                fileName: attachment.fileName,
                clientId: attachment.clientFileId,
                fType: 1,
                fileCount: 0,
                fdata: "{}",
                toid: isGroupMessage ? undefined : String(threadId),
                grid: isGroupMessage ? String(threadId) : undefined,
                fileUrl: attachment.fileUrl,
                zsource: -1,
                ttl: ttl,
              },
              body: new URLSearchParams(),
            };
            break;
          }
        }
        removeUndefinedKeys(data.params);
        const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(data.params));
        if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");
        data.body.append("params", encryptedParams);
        attachmentsData.push(data);
      }
    }
    for (const gif of gifFiles) {
      const gifData = await getGifDimensions(gif);
      if (isExceedMaxFileSize(gifData.totalSize))
        throw new ZaloApiError(
          `File ${getFileName(gif)} size exceed maximum size of ${sharefile.max_size_share_file_v3}MB`
        );
      const _upthumb = await upthumb(gif, serviceURLs.attachment[MessageType.DirectMessage]);
      const formData = new FormData();

      let fileHandle;
      try {
        fileHandle = await fs.promises.open(gif, 'r');
        const fileContent = await fileHandle.readFile();
        formData.append("chunkContent", fileContent, {
          filename: getFileName(gif),
          contentType: "application/octet-stream",
        });
      } finally {
        if (fileHandle) await fileHandle.close();
      }

      const params = {
        clientId: Date.now().toString(),
        fileName: gifData.fileName,
        totalSize: gifData.totalSize,
        width: gifData.width,
        height: gifData.height,
        msg: msg,
        type: 1,
        ttl: ttl,
        visibility: isGroupMessage ? 0 : undefined,
        toid: isGroupMessage ? undefined : threadId,
        grid: isGroupMessage ? threadId : undefined,
        thumb: _upthumb.url,
        checksum: (await getMd5LargeFileObject(gif, gifData.totalSize)).data,
        totalChunk: 1,
        chunkId: 1,
      };
      removeUndefinedKeys(params);
      const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
      if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");
      attachmentsData.push({
        query: {
          params: encryptedParams,
          type: "1",
        },
        body: formData.getBuffer(),
        headers: formData.getHeaders(),
        fileType: "gif",
      });
    }
    let responses = [];
    for (const data of attachmentsData) {
      responses.push({
        url: makeURL(
          serviceURLs.attachment[type] + attachmentUrlType[data.fileType],
          Object.assign(
            {
              zpw_ver: Zalo.API_VERSION,
              zpw_type: Zalo.API_TYPE,
              nretry: "0",
            },
            data.query || {}
          )
        ),
        body: data.body,
        headers: data.fileType == "gif" ? data.headers : {},
      });
    }
    return responses;
  }
  /**
   * Send a message to a thread
   *
   * @param message Message content
   * @param threadId group or user id
   * @param type Message type (DirectMessage or GroupMessage)
   * @param quote Message or GroupMessage instance (optional), used for quoting
   *
   * @throws {ZaloApiError}
   */
  return async function sendMessage(message, threadId, type = MessageType.DirectMessage) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    if (!message) throw new ZaloApiError("Missing message content");
    if (!threadId) throw new ZaloApiError("Missing threadId");
    if (typeof message == "string") message = { msg: message };
    let { msg, quote, attachments, mentions, ttl, linkOn = true, isUseProphylactic = false } = message;
    msg = msg || "";
    ttl = ttl || appContext.timeMessage || 0;
    if (!msg && (!attachments || (attachments && attachments.length == 0)))
      throw new ZaloApiError("Missing message content");
    if (attachments && isExceedMaxFile(attachments.length))
      throw new ZaloApiError("Exceed maximum file of " + sharefile.max_file);
    const responses = {
      message: null,
      attachment: [],
      link: null,
    };
    if (attachments && attachments.length > 0) {
      const firstExtFile = getFileExtension(attachments[0]);
      const isSingleFile = attachments.length == 1;
      const canBeDesc = isSingleFile && ["jpg", "jpeg", "png", "webp"].includes(firstExtFile);
      if (((msg || "").length > 0 && !canBeDesc) || ((msg || "").length > 0 && quote)) {
        await handleMessage(message, threadId, type, ttl).then(async (data) => {
          responses.message = (await send(data))[0];
        });
        msg = "";
        mentions = undefined;
      }
      const handledData = await handleAttachment({ msg, mentions, attachments, quote, isUseProphylactic }, threadId, type, ttl);
      responses.attachment = await send(handledData);
      msg = "";
    }
    if (msg.length > 0) {
      const linkData = analyzeLinks(msg);
      let handledData = null;
      if (linkOn && linkData.count == 1) {
        try {
          responses.link = await api.sendLink(message.msg, linkData.links[0], threadId, type, ttl);
        } catch (error) {
          handledData = await handleMessage(message, threadId, type, ttl);
          responses.message = (await send(handledData))[0];
        }
      } else {
        handledData = await handleMessage(message, threadId, type, ttl);
        responses.message = (await send(handledData))[0];
      }
    }
    return responses;
  };
}
