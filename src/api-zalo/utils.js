import cryptojs from "crypto-js";
import JSONBigInit from "json-bigint";
const JSONBig = JSONBigInit({ storeAsString: true });
import crypto from "crypto";
import { appContext } from "./context.js";
import fs from "fs";
import sharp from "sharp";
import pako from "pako";
import SparkMD5 from "spark-md5";
import path from "path";
import fetch from "node-fetch";
import axios from "axios";
import ffmpeg from 'fluent-ffmpeg';
import { GroupEventType } from "./models/GroupEvent.js";

export function getSignKey(type, params) {
  let n = [];
  for (let s in params) {
    if (params.hasOwnProperty(s)) {
      n.push(s);
    }
  }
  n.sort();
  let a = "zsecure" + type;
  for (let s = 0; s < n.length; s++) a += params[n[s]];
  return cryptojs.MD5(a);
}
export function makeURL(baseURL, params) {
  let url = new URL(baseURL);
  for (let key in params) {
    if (params.hasOwnProperty(key)) {
      url.searchParams.append(key, params[key]);
    }
  }
  return url.toString();
}
export class ParamsEncryptor {
  constructor({ type, imei, firstLaunchTime }) {
    this.zcid = null;
    this.enc_ver = "v2";
    this.zcid = null;
    this.encryptKey = null;
    this.createZcid(type, imei, firstLaunchTime);
    this.zcid_ext = ParamsEncryptor.randomString();
    this.createEncryptKey();
  }
  getEncryptKey() {
    if (!this.encryptKey) throw new Error("getEncryptKey: didn't create encryptKey yet");
    return this.encryptKey;
  }
  createZcid(type, imei, firstLaunchTime) {
    if (!type || !imei || !firstLaunchTime) throw new Error("createZcid: missing params");
    const msg = `${type},${imei},${firstLaunchTime}`;
    const s = ParamsEncryptor.encodeAES("3FC4F0D2AB50057BCE0D90D9187A22B1", msg, "hex", true);
    this.zcid = s;
  }
  createEncryptKey(e = 0) {
    const t = (e, t) => {
      const { even: n } = ParamsEncryptor.processStr(e),
        { even: a, odd: s } = ParamsEncryptor.processStr(t);
      if (!n || !a || !s) return !1;
      const i = n.slice(0, 8).join("") + a.slice(0, 12).join("") + s.reverse().slice(0, 12).join("");
      return (this.encryptKey = i), !0;
    };
    if (!this.zcid || !this.zcid_ext) throw new Error("createEncryptKey: zcid or zcid_ext is null");
    try {
      let n = cryptojs.MD5(this.zcid_ext).toString().toUpperCase();
      if (t(n, this.zcid) || !(e < 3)) return !1;
      this.createEncryptKey(e + 1);
    } catch (n) {
      e < 3 && this.createEncryptKey(e + 1);
    }
    return !0;
  }
  getParams() {
    return this.zcid
      ? {
        zcid: this.zcid,
        zcid_ext: this.zcid_ext,
        enc_ver: this.enc_ver,
      }
      : null;
  }
  static processStr(e) {
    if (!e || "string" != typeof e)
      return {
        even: null,
        odd: null,
      };
    const [t, n] = [...e].reduce((e, t, n) => (e[n % 2].push(t), e), [[], []]);
    return {
      even: t,
      odd: n,
    };
  }
  static randomString(e, t) {
    const n = e || 6,
      a = t && e && t > e ? t : 12;
    let s = Math.floor(Math.random() * (a - n + 1)) + n;
    if (s > 12) {
      let e = "";
      for (; s > 0;)
        (e += Math.random()
          .toString(16)
          .substr(2, s > 12 ? 12 : s)),
          (s -= 12);
      return e;
    }
    return Math.random().toString(16).substr(2, s);
  }
  static encodeAES(e, message, type, uppercase, s = 0) {
    if (!message) return null;
    try {
      {
        const encoder = "hex" == type ? cryptojs.enc.Hex : cryptojs.enc.Base64;
        const key = cryptojs.enc.Utf8.parse(e);
        const cfg = {
          words: [0, 0, 0, 0],
          sigBytes: 16,
        };
        const encrypted = cryptojs.AES.encrypt(message, key, {
          iv: cfg,
          mode: cryptojs.mode.CBC,
          padding: cryptojs.pad.Pkcs7,
        }).ciphertext.toString(encoder);
        return uppercase ? encrypted.toUpperCase() : encrypted;
      }
    } catch (o) {
      return s < 3 ? ParamsEncryptor.encodeAES(e, message, type, uppercase, s + 1) : null;
    }
  }
}
export function decryptResp(key, data) {
  let n = null;
  try {
    n = decodeRespAES(key, data);
    const parsed = JSONBig.parse(n);
    return parsed;
  } catch (error) {
    return n;
  }
}
function decodeRespAES(key, data) {
  data = decodeURIComponent(data);
  const parsedKey = cryptojs.enc.Utf8.parse(key);
  const n = {
    words: [0, 0, 0, 0],
    sigBytes: 16,
  };
  return cryptojs.AES.decrypt(
    {
      ciphertext: cryptojs.enc.Base64.parse(data),
    },
    parsedKey,
    {
      iv: n,
      mode: cryptojs.mode.CBC,
      padding: cryptojs.pad.Pkcs7,
    }
  ).toString(cryptojs.enc.Utf8);
}
export function decodeBase64ToBuffer(data) {
  return Buffer.from(data, "base64");
}
export function decodeUnit8Array(data) {
  try {
    return new TextDecoder().decode(data);
  } catch (error) {
    return null;
  }
}
export function encodeAES(secretKey, data, t = 0) {
  try {
    const key = cryptojs.enc.Base64.parse(secretKey);
    return cryptojs.AES.encrypt(data, key, {
      iv: cryptojs.enc.Hex.parse("00000000000000000000000000000000"),
      mode: cryptojs.mode.CBC,
      padding: cryptojs.pad.Pkcs7,
    }).ciphertext.toString(cryptojs.enc.Base64);
  } catch (n) {
    return t < 3 ? encodeAES(secretKey, data, t + 1) : null;
  }
}
export function decodeAES(secretKey, data, t = 0) {
  try {
    data = decodeURIComponent(data);
    let key = cryptojs.enc.Base64.parse(secretKey);
    return cryptojs.AES.decrypt(
      {
        ciphertext: cryptojs.enc.Base64.parse(data),
      },
      key,
      {
        iv: cryptojs.enc.Hex.parse("00000000000000000000000000000000"),
        mode: cryptojs.mode.CBC,
        padding: cryptojs.pad.Pkcs7,
      }
    ).toString(cryptojs.enc.Utf8);
  } catch (n) {
    return t < 3 ? decodeAES(secretKey, data, t + 1) : null;
  }
}
function updateCookie(input) {
  // Khi login QR, cookie chưa có -> khởi tạo cookie mới thay vì throw
  if (!appContext.cookie) {
    appContext.cookie = "";
  }
  if (typeof input !== "string" && !Array.isArray(input)) return null;
  const cookieMap = new Map();
  const cookie = appContext.cookie;
  if (cookie) {
    cookie.split(";").forEach((c) => {
      const [key, ...rest] = c.split("=");
      if (key && key.trim()) {
        cookieMap.set(key.trim(), (rest.join("=") || "").trim());
      }
    });
  }
  let newCookie;
  if (Array.isArray(input)) newCookie = input.map((c) => c.split(";")[0]).join("; ");
  else newCookie = input;
  newCookie.split(";").forEach((c) => {
    const [key, ...rest] = c.split("=");
    if (key && key.trim()) {
      cookieMap.set(key.trim(), (rest.join("=") || "").trim());
    }
  });
  return Array.from(cookieMap.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}
export function getDefaultHeaders() {
  // Không throw khi cookie/userAgent chưa có (QR login flow)
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.9",
    "content-type": "application/x-www-form-urlencoded",
    Origin: "https://chat.zalo.me",
    Referer: "https://chat.zalo.me/",
  };
  if (appContext.cookie) headers.Cookie = appContext.cookie;
  if (appContext.userAgent) headers["User-Agent"] = appContext.userAgent;
  return headers;
}
export async function request(url, options) {
  const defaultHeaders = getDefaultHeaders();
  if (options) options.headers = mergeHeaders(options.headers || {}, defaultHeaders);
  else options = { headers: defaultHeaders };
  options.timeout = 6000;

  const response = await fetch(url, options);
  if (response.headers.has("set-cookie")) {
    const newCookie = updateCookie(response.headers.get("set-cookie"));
    if (newCookie) appContext.cookie = newCookie;
  }
  return response;
}
function mergeHeaders(headers, defaultHeaders) {
  return Object.assign(Object.assign({}, defaultHeaders), headers);
}
export async function getImageMetaData(filePath) {
  const fileData = await fs.promises.readFile(filePath);
  const imageData = await sharp(fileData).metadata();
  const fileName = filePath.split("/").pop();
  return {
    fileName,
    totalSize: imageData.size,
    width: imageData.width,
    height: imageData.height,
  };
}
export async function getFileSize(filePath) {
  return fs.promises.stat(filePath).then((s) => s.size);
}
export async function getGifDimensions(filePath) {
  let fileHandle;
  try {
    fileHandle = await fs.promises.open(filePath, "r");
    const fileData = await fileHandle.readFile();
    const detailData = await sharp(fileData).metadata();
    const fileName = path.basename(filePath);
    return {
      fileName,
      totalSize: detailData.size,
      width: detailData.width,
      height: detailData.height,
    };
  } finally {
    if (fileHandle) await fileHandle.close();
  }
}
export function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      const fileName = path.basename(filePath);
      resolve({
        fileName,
        totalSize: metadata.format.size,
        width: videoStream.width,
        height: videoStream.height,
        duration: videoStream.duration * 1000,
      });
    });
  });
}
export async function getFileInfoFromUrl(url) {
  try {
    const response = await axios.head(url);
    let fileName = '';
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename=["']?([^"']+)["']?/);
      if (filenameMatch && filenameMatch[1]) {
        fileName = filenameMatch[1];
      }
    }
    if (!fileName) {
      fileName = url.split('/').pop().split('?')[0] || 'unknownFile';
    }
    const fileSize = parseInt(response.headers['content-length']) || 0;
    return {
      fileName,
      fileSize
    };
  } catch (error) {
    console.error('Lỗi khi lấy thông tin file:', error.message);
    return {
      fileName: 'unknownFile',
      fileSize: 0
    };
  }
}
export async function decodeEventData(parsed, cipherKey) {
  if (!cipherKey) return;
  const eventData = parsed.data;
  const decodedEventDataBuffer = decodeBase64ToBuffer(decodeURIComponent(eventData));
  if (decodedEventDataBuffer.length >= 48) {
    const algorithm = {
      name: "AES-GCM",
      iv: decodedEventDataBuffer.subarray(0, 16),
      tagLength: 128,
      additionalData: decodedEventDataBuffer.subarray(16, 32),
    };
    const dataSource = decodedEventDataBuffer.subarray(32);
    const cryptoKey = await crypto.subtle.importKey("raw", decodeBase64ToBuffer(cipherKey), algorithm, false, [
      "decrypt",
    ]);
    const decryptedData = await crypto.subtle.decrypt(algorithm, cryptoKey, dataSource);
    const decompressedData = pako.inflate(decryptedData);
    const decodedData = decodeUnit8Array(decompressedData);
    if (!decodedData) return;
    return JSONBig.parse(decodedData);
  }
}
export function getMd5LargeFileObject(filePath, fileSize) {
  return new Promise(async (resolve, reject) => {
    let chunkSize = 2097152,
      chunks = Math.ceil(fileSize / chunkSize),
      currentChunk = 0,
      spark = new SparkMD5.ArrayBuffer(),
      buffer = await fs.promises.readFile(filePath);
    function loadNext() {
      let start = currentChunk * chunkSize,
        end = start + chunkSize >= fileSize ? fileSize : start + chunkSize;
      spark.append(buffer.subarray(start, end));
      currentChunk++;
      if (currentChunk < chunks) {
        loadNext();
      } else {
        resolve({
          currentChunk,
          data: spark.end(),
        });
      }
    }
    loadNext();
  });
}
export async function getMd5LargeFileFromUrl(url, fileSize) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await axios({
        url: url,
        method: 'GET',
        responseType: 'arraybuffer'
      });
      let chunkSize = 2097152,
        chunks = Math.ceil(fileSize / chunkSize),
        currentChunk = 0,
        spark = new SparkMD5.ArrayBuffer(),
        buffer = Buffer.from(response.data);
      function loadNext() {
        let start = currentChunk * chunkSize,
          end = start + chunkSize >= fileSize ? fileSize : start + chunkSize;
        spark.append(buffer.subarray(start, end));
        currentChunk++;
        if (currentChunk < chunks) {
          loadNext();
        } else {
          resolve({
            currentChunk,
            data: spark.end(),
          });
        }
      }
      loadNext();
    } catch (error) {
      reject(error);
    }
  });
}
export const logger = {
  verbose: (...args) => {
    console.log("\x1b[2mVERBOSE\x1b[0m", ...args);
  },
  info: (...args) => {
    console.log("\x1b[34mINFO\x1b[0m", ...args);
  },
  warn: (...args) => {
    console.log("\x1b[33mWARN\x1b[0m", ...args);
  },
  error: (...args) => {
    console.log("\x1b[31mERROR\x1b[0m", ...args);
  },
};
export function getClientMessageType(msgType) {
  if (msgType === "webchat") return 1;
  if (msgType === "chat.voice") return 31;
  if (msgType === "chat.photo") return 32;
  if (msgType === "chat.sticker") return 36;
  if (msgType === "chat.doodle") return 37;
  if (msgType === "chat.recommended") return 38;
  if (msgType === "chat.link") return 1; // don't know
  if (msgType === "chat.video.msg") return 44;
  if (msgType === "share.file") return 46;
  if (msgType === "chat.gif") return 49;
  if (msgType === "chat.location.new") return 43;
  return 1;
}
export function strPadLeft(e, t, n) {
  const a = (e = "" + e).length;
  return a === n ? e : a > n ? e.slice(-n) : t.repeat(n - a) + e;
}
export function getFullTimeFromMilisecond(e) {
  let t = new Date(e);
  return (
    strPadLeft(t.getHours(), "0", 2) +
    ":" +
    strPadLeft(t.getMinutes(), "0", 2) +
    " " +
    strPadLeft(t.getDate(), "0", 2) +
    "/" +
    strPadLeft(t.getMonth() + 1, "0", 2) +
    "/" +
    t.getFullYear()
  );
}
export function getFileExtension(e) {
  return path.extname(e).slice(1);
}
export function getFileName(e) {
  return path.basename(e);
}
export function removeUndefinedKeys(e) {
  for (let t in e) e[t] === undefined && delete e[t];
  return e;
}
export function getGroupEventType(act) {
  if (act == "join_request") return GroupEventType.JOIN_REQUEST;
  if (act == "join") return GroupEventType.JOIN;
  if (act == "leave") return GroupEventType.LEAVE;
  if (act == "remove_member") return GroupEventType.REMOVE_MEMBER;
  if (act == "block_member") return GroupEventType.BLOCK_MEMBER;
  if (act == "update_setting") return GroupEventType.UPDATE_SETTING;
  if (act == "update") return GroupEventType.UPDATE;
  if (act == "new_link") return GroupEventType.NEW_LINK;
  if (act == "add_admin") return GroupEventType.ADD_ADMIN;
  if (act == "remove_admin") return GroupEventType.REMOVE_ADMIN;
  if (act == "new_pin_topic") return GroupEventType.NEW_PIN_TOPIC;
  if (act == "update_topic") return GroupEventType.UPDATE_TOPIC;
  if (act == "update_board") return GroupEventType.UPDATE_BOARD;
  if (act == "reorder_pin_topic") return GroupEventType.REORDER_PIN_TOPIC;
  if (act == "unpin_topic") return GroupEventType.UNPIN_TOPIC;
  if (act == "remove_topic") return GroupEventType.REMOVE_TOPIC;
  return GroupEventType.UNKNOWN;
}
export async function handleZaloResponse(response) {
  const result = {
    data: null,
    error: null,
  };
  if (!response.ok) {
    result.error = {
      message: "Request failed with status code " + response.status,
    };
    return result;
  }
  try {
    const jsonData = await response.json();
    if (jsonData.error_code != 0) {
      result.error = {
        message: jsonData.error_message,
        code: jsonData.error_code,
      };
      return result;
    }
    const decodedData = JSONBig.parse(decodeAES(appContext.secretKey, jsonData.data));
    if (!decodedData) return result;
    if (decodedData.error_code != 0) {
      result.error = {
        message: decodedData.error_message,
        code: decodedData.error_code,
      };
      return result;
    }
    result.data = decodedData.data;
  } catch (error) {
    console.error(error);
    result.error = {
      message: "Failed to parse response data",
    };
  }
  return result;
}
export function analyzeLinks(content) {
  const urlRegex = /(?:@)?(?:https?:\/\/)?(?:www\.)?(?:[a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s\n]*)?/gi;

  const matches = content.match(urlRegex) || [];
  const normalizedLinks = matches
    .map((link) => {
      let normalizedLink = link.replace(/^@/, "");
      normalizedLink = normalizedLink.replace(/\/+$/, "");
      if (!normalizedLink.match(/^https?:\/\//i)) {
        return "https://" + normalizedLink;
      }
      return normalizedLink;
    })
    .filter((link) => {
      try {
        new URL(link);
        return true;
      } catch {
        return false;
      }
    });

  return {
    count: normalizedLinks.length,
    links: normalizedLinks,
  };
}

export function generateZaloUUID(userAgent) {
  return crypto.randomUUID() + "-" + cryptojs.MD5(userAgent).toString();
}
