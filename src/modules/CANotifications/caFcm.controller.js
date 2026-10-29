import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { success, fail } from "../../core/utils/response.js";
import { caFcmService } from "./caFcm.service.js";
import { caFcmRepository } from "./caFcm.repository.js";

export const caFcmController = {
  saveFcmToken: asyncHandler(async (req, res) => {
    const { token, deviceType = "web" } = req.body || {};
    if (!token) {
      return fail(res, { status: 400, message: "FCM token is required", code: "TOKEN_REQUIRED" });
    }

    const companyId = req.companyId;
    let userType = "company";
    let userId = req.companyId;

    if (req.employeeId) {
      userType = "employee";
      userId = req.employeeId;
    } else if (req.caUserId) {
      userType = "ca_user";
      userId = req.caUserId;
    } else if (req.isCompanyOwner) {
      userType = "company";
      userId = req.companyId;
    }

    const record = await caFcmService.registerToken({
      companyId,
      userType,
      userId,
      userEmail: req.user?.email || null,
      token,
      deviceType,
    });

    return success(res, {
      status: 200,
      message: "FCM token registered successfully",
      data: { registered: true, id: record?.id },
    });
  }),

  deleteFcmToken: asyncHandler(async (req, res) => {
    const token = req.body?.token || req.query?.token;
    if (!token) {
      return fail(res, { status: 400, message: "Token is required", code: "TOKEN_REQUIRED" });
    }

    await caFcmService.unregisterToken(token);
    return success(res, {
      status: 200,
      message: "FCM token unregistered successfully",
      data: { unregistered: true },
    });
  }),

  getUnreadAlerts: asyncHandler(async (req, res) => {
    const companyId = req.companyId;
    const userType = req.employeeId ? "employee" : "admin";
    const userId = req.employeeId || null;

    const notifications = await caFcmRepository.getUnreadInAppNotifications({
      companyId,
      userType,
      userId,
    });

    return success(res, {
      status: 200,
      message: "Unread alerts retrieved",
      data: { notifications },
    });
  }),

  markAlertRead: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const companyId = req.companyId;

    await caFcmRepository.markInAppNotificationRead(id, companyId);
    return success(res, {
      status: 200,
      message: "Notification marked as read",
      data: { read: true },
    });
  }),
};
