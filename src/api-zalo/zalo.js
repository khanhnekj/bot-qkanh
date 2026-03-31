import { getOwnId } from "./apis/getOwnId.js";
import { Listener } from "./apis/listen.js";
import { getServerInfo, login } from "./apis/login.js";
import { appContext } from "./context.js";
import { logger, makeURL, encodeAES, request as apiRequest, handleZaloResponse } from "./utils.js";
import { addReactionFactory } from "./apis/addReaction.js";
import { addUserToGroupFactory } from "./apis/addUserToGroup.js";
import { changeGroupAvatarFactory } from "./apis/changeGroupAvatar.js";
import { changeGroupNameFactory } from "./apis/changeGroupName.js";
import { createGroupFactory } from "./apis/createGroup.js";
import { findUserFactory } from "./apis/findUser.js";
import { getGroupInfoFactory } from "./apis/getGroupInfo.js";
import { getStickersFactory } from "./apis/getStickers.js";
import { getStickersDetailFactory } from "./apis/getStickersDetail.js";
import { removeUserFromGroupFactory } from "./apis/removeUserFromGroup.js";
import { sendStickerFactory } from "./apis/sendSticker.js";
import { undoMessageFactory } from "./apis/undoMessage.js";
import { uploadAttachmentFactory } from "./apis/uploadAttachment.js";
import { checkUpdate } from "./update.js";
import { sendMessageFactory } from "./apis/sendMessage.js";
import { getCookieFactory } from "./apis/getCookie.js";
import { removeMessageFactory } from "./apis/deleteMessage.js";
import { getUserInfoFactory } from "./apis/getUserInfo.js";
import { sendVideoFactory } from "./apis/sendVideo.js";
import { getAllFriendsFactory } from "./apis/fetchAllFriend.js";
import { getAllGroupsFactory } from "./apis/fetchAllGroups.js";
import { changeGroupSettingFactory } from "./apis/changeGroupSetting.js";
import { blockUsersInGroupFactory } from "./apis/blockUsersInGroup.js";
import { addGroupAdminsFactory } from "./apis/addGroupAdmins.js";
import { removeGroupAdminsFactory } from "./apis/removeGroupAdmins.js";
import { getQRLinkFactory } from "./apis/getQRZalo.js";
import { sendBusinessCardFactory } from "./apis/sendBusinessCard.js";
import { sendFriendRequestFactory } from "./apis/sendFriendRequest.js";
import { setBotId } from "../index.js";
import { getGroupMembersJoinRequestFactory } from "./apis/getGroupMembersJoinRequest.js";
import { handleGroupPendingMembersFactory } from "./apis/handleGroupPendingMembers.js";
import { changeGroupOwnerFactory } from "./apis/changeGroupOwner.js";
import { leaveGroupFactory } from "./apis/leaveGroup.js";
import { sendCustomStickerFactory } from "./apis/sendCustomerSticker.js";
import { changeGroupLinkFactory } from "./apis/changeGroupLink.js";
import { sendToDoFactory } from "./apis/sendToDo.js";
import { getRecentMessageFactory } from "./apis/getRecentMessage.js";
import { parseLinkFactory } from "./apis/parseLink.js";
import { sendLinkFactory } from "./apis/sendLink.js";
import { sendVoiceFactory } from "./apis/sendVoice.js";
import { sendMessagePrivateFactory } from "./apis/sendMessagePrivate.js";
import { joinGroupByLinkFactory } from "./apis/joinGroupByLink.js";
import { getInfoGroupByLinkFactory } from "./apis/getGroupInfoByLink.js";
import { sendBankCardFactory } from "./apis/sendBankCard.js";
import { sendGifFactory } from "./apis/sendGif.js";
import { getGroupMembersFactory } from "./apis/getGroupMembers.js";
import { checkImageFactory } from "./apis/checkImage.js";
import { sendImageFactory } from "./apis/sendImage.js";
import { sendFileFactory } from "./apis/sendFile.js";
import { uploadThumbnailFactory } from "./apis/uploadThumbnail.js";
import { sendMessageForwardFactory } from "./apis/sendMessageForward.js";
import { sendVoiceUnifiedFactory } from "./apis/sendVoiceUnified.js";
import { sendTypingEventFactory } from "./apis/sendTypingEvent.js";
import { findUserByUsernameFactory } from "./apis/findUserByUsername.js";
import { getAvatarUrlProfileFactory } from "./apis/getAvatarUrlProfile.js";
import { getFriendOnlinesFactory } from "./apis/getFriendOnlines.js";
import { searchStickerFactory } from "./apis/searchSticker.js";
import { getGroupChatHistoryFactory } from "./apis/getGroupChatHistory.js";
import { getGroupInvitesFactory } from "./apis/getGroupInvites.js";
import { handleGroupInviteFactory } from "./apis/handleGroupInvite.js";
import { getBlockedUsersInGroupFactory } from "./apis/getBlockedUsersInGroup.js";
import { unblockUsersInGroupFactory } from "./apis/unblockUsersInGroup.js";

class Zalo {
  constructor(options = {}) {
    this.options = options;
    this.enableEncryptParam = true;
    if (options) Object.assign(appContext.options, options);
  }

  parseCookies(cookie) {
    if (typeof cookie === "string") return cookie;
    const cookieArr = Array.isArray(cookie) ? cookie : cookie.cookies;
    const cookieString = cookieArr.map((c) => `${c.name || c.key}=${c.value}`).join("; ");
    return cookieString;
  }

  validateParams(credentials) {
    if (!credentials.imei || !credentials.cookie || !credentials.userAgent) {
      throw new Error("Missing required params");
    }
  }

  async login(credentials) {
    this.validateParams(credentials);
    appContext.imei = credentials.imei;
    appContext.cookie = this.parseCookies(credentials.cookie);
    appContext.userAgent = credentials.userAgent;
    appContext.language = credentials.language || "vi";
    appContext.timeMessage = credentials.timeMessage || 0;
    appContext.secretKey = null;

    await checkUpdate();
    const loginData = await login(this.enableEncryptParam);
    const serverInfo = await getServerInfo(this.enableEncryptParam);
    if (!loginData || !serverInfo) throw new Error("Failed to login");
    appContext.secretKey = loginData.data.zpw_enk;
    appContext.uid = loginData.data.uid;

    // Tìm UIN (mã ngắn) của Bot
    let uin = loginData.data.zpw_uin || loginData.data.uin;
    if (!uin) {
      // Ưu tiên zfamily.viewer_key vì nó chứa ID 453xxx (như đã thấy trong log)
      const vks = [loginData.data.zfamily?.viewer_key, loginData.data.viewerkey].filter(Boolean);
      for (const vk of vks) {
        const parts = vk.split(".");
        // Tìm phần có độ dài vừa phải (thường là ID, không phải hash dài hay timestamp)
        const idPart = parts.find(p => /^\d+$/.test(p) && p.length < 12);
        if (idPart) {
          uin = idPart;
          break;
        }
      }
    }
    appContext.uin = uin;

    logger.info(`Đã đăng nhập: UID=${appContext.uid} | UIN=${appContext.uin || "Không xác định"}`);

    setBotId(loginData.data.uid);
    appContext.settings = serverInfo.setttings || serverInfo.settings;
    return new API(
      appContext.secretKey,
      loginData.data.zpw_service_map_v3,
      makeURL(`${loginData.data.zpw_ws[0]}`, {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        t: Date.now(),
      })
    );
  }

  async loginQR(options, callback) {
    const { loginQR: _loginQR } = await import("./apis/loginQR.js");
    const result = await _loginQR(options, callback);
    return this.login(result);
  }
}

Zalo.API_TYPE = 30;
Zalo.API_VERSION = 671;

class API {
  constructor(secretKey, zpwServiceMap, wsUrl) {
    this.secretKey = secretKey;
    this.zpwServiceMap = zpwServiceMap;
    this.listener = new Listener(wsUrl);
    this.getOwnId = getOwnId;
    this.getStickers = getStickersFactory(this);
    this.getStickersDetail = getStickersDetailFactory(this);
    this.findUser = findUserFactory(this);
    this.uploadAttachment = uploadAttachmentFactory(this);
    this.uploadThumbnail = uploadThumbnailFactory(this);
    this.getGroupInfo = getGroupInfoFactory(this);
    this.createGroup = createGroupFactory(this);
    this.changeGroupAvatar = changeGroupAvatarFactory(this);
    this.removeUserFromGroup = removeUserFromGroupFactory(this);
    this.addUserToGroup = addUserToGroupFactory(this);
    this.changeGroupName = changeGroupNameFactory(this);
    this.getUserInfo = getUserInfoFactory(this);
    this.addReaction = addReactionFactory(this);
    this.sendSticker = sendStickerFactory(this);
    this.undoMessage = undoMessageFactory(this);
    this.undo = this.undoMessage;
    this.unsend = this.undoMessage;
    this.sendMessage = sendMessageFactory(this);
    this.getCookie = getCookieFactory();
    this.deleteMessage = removeMessageFactory(this);
    this.sendVideo = sendVideoFactory(this);
    this.getAllFriends = getAllFriendsFactory(this);
    this.getAllGroups = getAllGroupsFactory(this);
    this.changeGroupSetting = changeGroupSettingFactory(this);
    this.blockUsers = blockUsersInGroupFactory(this);
    this.addGroupAdmins = addGroupAdminsFactory(this);
    this.removeGroupAdmins = removeGroupAdminsFactory(this);
    this.getQRLink = getQRLinkFactory(this);
    this.sendBusinessCard = sendBusinessCardFactory(this);
    this.sendFriendRequest = sendFriendRequestFactory(this);
    this.getGroupPendingMembers = getGroupMembersJoinRequestFactory(this);
    this.getPendingGroupMembers = this.getGroupPendingMembers;
    this.handleGroupPendingMembers = handleGroupPendingMembersFactory(this);
    this.reviewPendingMemberRequest = this.handleGroupPendingMembers;
    this.enableGroupLink = async (groupId) => {
      // Zalo doesn't have a direct "enable" link API easily accessible here, 
      // but we can ensure addMemberOnly: 0 allows link access.
      // Or call changeGroupLink to ensure a link exists.
      const link = await this.changeGroupLink(groupId);
      await this.changeGroupSetting(groupId, { addMemberOnly: 0 });
      return link;
    };
    this.disableGroupLink = async (groupId) => {
      return await this.changeGroupSetting(groupId, { addMemberOnly: 1 });
    };
    this.changeGroupOwner = changeGroupOwnerFactory(this);
    this.leaveGroup = leaveGroupFactory(this);
    this.sendCustomSticker = sendCustomStickerFactory(this);
    this.changeGroupLink = changeGroupLinkFactory(this);
    this.sendTodo = sendToDoFactory(this);
    this.getRecentMessages = getRecentMessageFactory(this);
    this.parseLink = parseLinkFactory(this);
    this.sendLink = sendLinkFactory(this);
    this.sendVoice = sendVoiceFactory(this);
    this.sendPrivate = sendMessagePrivateFactory(this);
    this.getGroupInfoByLink = getInfoGroupByLinkFactory(this);
    this.joinGroup = joinGroupByLinkFactory(this);
    this.sendBankCard = sendBankCardFactory(this);
    this.sendGif = sendGifFactory(this);
    this.getGroupMembers = getGroupMembersFactory(this);
    this.checkImage = checkImageFactory();
    this.sendImage = sendImageFactory(this);
    this.sendFile = sendFileFactory(this);
    this.sendVoiceUnified = sendVoiceUnifiedFactory(this);
    this.sendMessageForward = sendMessageForwardFactory(this);
    this.sendTypingEvent = sendTypingEventFactory(this);
    this.findUserByUsername = findUserByUsernameFactory(this);
    this.getAvatarUrlProfile = getAvatarUrlProfileFactory(this);
    this.getFriendOnlines = getFriendOnlinesFactory(this);
    this.searchSticker = searchStickerFactory(this);
    this.getGroupChatHistory = getGroupChatHistoryFactory(this);
    this.getGroupInvites = getGroupInvitesFactory(this);
    this.handleGroupInvite = handleGroupInviteFactory(this);
    this.getBlockedUsers = getBlockedUsersInGroupFactory(this);
    this.unblockUsers = unblockUsersInGroupFactory(this);
  }

  custom(name, fn) {
    this[name] = (props) => fn({
      ctx: appContext,
      utils: {
        makeURL: (baseURL, params) => makeURL(baseURL, params),
        encodeAES: (data, t) => encodeAES(appContext.secretKey, data, t),
        request: (url, options) => apiRequest(url, options),
        resolve: (response) => handleZaloResponse(response),
      },
      props
    });
  }

  getContext() {
    return appContext;
  }
}

export { Zalo, API };
