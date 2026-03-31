import { Zalo, ZaloApiError } from "../index.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function changeGroupSettingFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/setting/update`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });
  /**
   * Update group settings by ID.
   *
   * blockName: Không cho phép user đổi tên & ảnh đại diện nhóm
   * signAdminMsg: Đánh dấu tin nhắn từ chủ/phó nhóm
   * addMemberOnly: Chỉ thêm members (Khi tắt link tham gia nhóm)
   * setTopicOnly: Cho phép members ghim (tin nhắn, ghi chú, bình chọn)
   * enableMsgHistory: Cho phép new members đọc tin nhắn gần nhất
   * lockCreatePost: Không cho phép members tạo ghi chú, nhắc hẹn
   * lockCreatePoll: Không cho phép members tạo bình chọn
   * joinAppr: Chế độ phê duyệt thành viên
   * bannFeature: Default (No description)
   * dirtyMedia: Default (No description)
   * banDuration: Default (No description)
   * lockSendMsg: Không cho phép members gửi tin nhắn
   * lockViewMember: Không cho phép members xem thành viên nhóm
   * blocked_members: Danh sách members bị chặn
   *
   * Warning:
   * Other settings will default value if not set. See `defaultMode`
   *
   * @param {string|number} groupId - Group ID to update settings
   * @param {Object} settings - Group settings options
   *
   * @throws {ZaloApiError}
   */
  return async function changeGroupSetting(groupId, settings = {}) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");

    const params = {
      blockName: settings.blockName ?? 0,
      signAdminMsg: settings.signAdminMsg ?? 1,
      addMemberOnly: settings.addMemberOnly ?? 1,
      setTopicOnly: settings.setTopicOnly ?? 1,
      enableMsgHistory: settings.enableMsgHistory ?? 1,
      lockCreatePost: settings.lockCreatePost ?? 1,
      lockCreatePoll: settings.lockCreatePoll ?? 1,
      joinAppr: settings.joinAppr ?? 1,
      bannFeature: settings.bannFeature ?? 0,
      dirtyMedia: settings.dirtyMedia ?? 0,
      banDuration: settings.banDuration ?? 0,
      lockSendMsg: settings.lockSendMsg ?? 0,
      lockViewMember: settings.lockViewMember ?? 0,
      blocked_members: settings.blocked_members ?? [],
      grid: groupId.toString(),
      imei: appContext.imei,
    };

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

    const response = await request(serviceURL, {
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
