import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import { caFcmRepository } from "./caFcm.repository.js";

let fcmApp = null;

const initFirebaseAdmin = () => {
  if (fcmApp) return fcmApp;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    fcmApp = existingApps[0];
    return fcmApp;
  }

  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
      let credentials;
      if (serviceAccountKey.trim().startsWith("{")) {
        credentials = JSON.parse(serviceAccountKey);
      } else {
        const resolvedPath = path.resolve(process.cwd(), serviceAccountKey);
        if (fs.existsSync(resolvedPath)) {
          credentials = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
        } else {
          console.warn(`[FCM] Service account file not found at: ${resolvedPath}`);
        }
      }

      if (credentials) {
        fcmApp = initializeApp({
          credential: cert(credentials),
          projectId: credentials.project_id || process.env.FIREBASE_PROJECT_ID || "icomply-f5936",
        });
        console.log("[FCM] Firebase Admin SDK initialized successfully.");
        return fcmApp;
      }
    }

    // Fallback: check if standard firebase-service-account.json exists in root
    const defaultJsonPath = path.resolve(process.cwd(), "firebase-service-account.json");
    if (fs.existsSync(defaultJsonPath)) {
      const credentials = JSON.parse(fs.readFileSync(defaultJsonPath, "utf-8"));
      fcmApp = initializeApp({
        credential: cert(credentials),
        projectId: credentials.project_id || "icomply-f5936",
      });
      console.log("[FCM] Firebase Admin SDK initialized with firebase-service-account.json.");
      return fcmApp;
    }

    console.warn(
      "[FCM] Firebase Admin credentials not provided in FIREBASE_SERVICE_ACCOUNT_KEY or firebase-service-account.json."
    );
    return null;
  } catch (error) {
    console.error("[FCM] Failed to initialize Firebase Admin SDK:", error?.message || error);
    return null;
  }
};

export const caFcmService = {
  async registerToken({ companyId, userType, userId, userEmail, token, deviceType = "web" }) {
    if (!token) return null;
    return caFcmRepository.saveToken({
      companyId,
      userType,
      userId,
      userEmail,
      token,
      deviceType,
    });
  },

  async unregisterToken(token) {
    if (!token) return 0;
    return caFcmRepository.removeToken(token);
  },

  async sendPushNotification(tokens = [], { title, body, icon = "/branding/tabbar.png", data = {} }) {
    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    if (!uniqueTokens.length) {
      console.log("[FCM] No recipient tokens found for push notification.");
      return { success: false, reason: "NO_TOKENS" };
    }

    const app = initFirebaseAdmin();
    if (!app) {
      console.log(`[FCM SIMULATION] Notification queued for ${uniqueTokens.length} device(s):`, {
        title,
        body,
        data,
      });
      return { success: true, simulated: true, count: uniqueTokens.length };
    }

    try {
      const messaging = getMessaging(app);

      const stringifiedData = Object.entries(data).reduce((acc, [key, value]) => {
        acc[key] = typeof value === "string" ? value : JSON.stringify(value);
        return acc;
      }, {});

      const message = {
        tokens: uniqueTokens,
        notification: {
          title,
          body,
        },
        data: stringifiedData,
        webpush: {
          notification: {
            title,
            body,
            icon,
            badge: icon,
            requireInteraction: true,
          },
          fcmOptions: {
            link: stringifiedData.url || "/companyadmin/attendance?tab=requests",
          },
        },
      };

      const response = await messaging.sendEachForMulticast(message);
      console.log(
        `[FCM] Sent notifications: ${response.successCount} succeeded, ${response.failureCount} failed.`
      );

      // Clean up invalid or stale tokens
      if (response.failureCount > 0) {
        const deadTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (
              errCode === "messaging/registration-token-not-registered" ||
              errCode === "messaging/invalid-registration-token" ||
              errCode === "messaging/invalid-argument"
            ) {
              deadTokens.push(uniqueTokens[idx]);
            }
          }
        });
        if (deadTokens.length > 0) {
          console.log(`[FCM] Purging ${deadTokens.length} dead token(s) from database.`);
          await caFcmRepository.deleteTokens(deadTokens);
        }
      }

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (err) {
      console.error("[FCM] Error sending multicast push notification:", err);
      return { success: false, error: err?.message || err };
    }
  },

  async notifyAdminsOfRegularizationRequest({ companyId, employee, record }) {
    try {
      const adminTokens = await caFcmRepository.getAdminTokens(companyId);
      const employeeName = employee?.name || record?.employeeName || "Employee";
      const empCode = employee?.employeeCode || record?.employeeCode;
      const formattedDate = record?.date ? String(record.date).slice(0, 10) : "N/A";

      const title = "New Attendance Regularization";
      const body = `${employeeName}${empCode ? ` (${empCode})` : ""} has submitted an attendance regularization request for ${formattedDate}.`;

      // 1. Store in-app notification for admin dashboard popup
      await caFcmRepository.saveInAppNotification({
        companyId,
        targetUserType: "admin",
        title,
        body,
        data: {
          type: "REGULARIZATION_REQUEST",
          attendanceId: String(record?.id || ""),
          employeeId: String(employee?.id || ""),
          employeeName,
          date: formattedDate,
          url: "/companyadmin/attendance?tab=requests",
        },
      });

      // 2. Trigger FCM push notification to admin devices
      if (adminTokens.length > 0) {
        await this.sendPushNotification(adminTokens, {
          title,
          body,
          data: {
            type: "REGULARIZATION_REQUEST",
            attendanceId: String(record?.id || ""),
            employeeId: String(employee?.id || ""),
            employeeName,
            date: formattedDate,
            url: "/companyadmin/attendance?tab=requests",
          },
        });
      }
    } catch (error) {
      console.error("[FCM] notifyAdminsOfRegularizationRequest error:", error?.message || error);
    }
  },

  async notifyEmployeeOfRegularizationStatus({ companyId, employeeId, status, date, reviewerName, adminReply }) {
    try {
      const employeeTokens = await caFcmRepository.getEmployeeTokens(companyId, employeeId);
      const formattedDate = date ? String(date).slice(0, 10) : "N/A";
      const isApproved = status === "Approved";
      const title = isApproved ? "Regularization Approved" : "Regularization Rejected";
      const body = `Your regularization request for ${formattedDate} has been ${status.toLowerCase()} by ${reviewerName || "Admin"}.${adminReply ? ` Note: "${adminReply}"` : ""}`;

      // 1. Store in-app notification for employee dashboard popup
      await caFcmRepository.saveInAppNotification({
        companyId,
        targetUserType: "employee",
        targetUserId: String(employeeId),
        title,
        body,
        data: {
          type: "REGULARIZATION_STATUS_UPDATE",
          status,
          date: formattedDate,
          url: "/employeeadmin/dashboard",
        },
      });

      // 2. Trigger FCM push notification to employee devices
      if (employeeTokens.length > 0) {
        await this.sendPushNotification(employeeTokens, {
          title,
          body,
          data: {
            type: "REGULARIZATION_STATUS_UPDATE",
            status,
            date: formattedDate,
            url: "/employeeadmin/dashboard",
          },
        });
      }
    } catch (error) {
      console.error("[FCM] notifyEmployeeOfRegularizationStatus error:", error?.message || error);
    }
  },

  async notifyApproversOfLeaveRequest({ companyId, employee, request }) {
    try {
      const employeeName = employee?.name || request?.employeeName || "Employee";
      const empCode = employee?.employeeCode || request?.employeeCode;
      const leaveTypeName = request?.leaveTypeName || "Leave";
      const startDate = request?.startDate ? String(request.startDate).slice(0, 10) : "";
      const endDate = request?.endDate ? String(request.endDate).slice(0, 10) : "";
      const days = request?.days || "1";
      const reportingToId = request?.reportingToId || employee?.details?.reportingToId || null;

      const title = "New Leave Application";
      const body = `${employeeName}${empCode ? ` (${empCode})` : ""} has applied for ${days} day(s) ${leaveTypeName} (${startDate} to ${endDate}).`;

      // 1. Notification to Reporting Manager (if assigned)
      if (reportingToId) {
        await caFcmRepository.saveInAppNotification({
          companyId,
          targetUserType: "employee",
          targetUserId: String(reportingToId),
          title: "Leave Request From Team",
          body,
          data: {
            type: "LEAVE_REQUEST",
            requestId: String(request?.id || ""),
            employeeId: String(employee?.id || ""),
            employeeName,
            startDate,
            endDate,
            days: String(days),
            url: "/companyadmin/leave",
          },
        });

        const managerTokens = await caFcmRepository.getEmployeeTokens(companyId, reportingToId);
        if (managerTokens.length > 0) {
          await this.sendPushNotification(managerTokens, {
            title: "Leave Request From Team",
            body,
            data: {
              type: "LEAVE_REQUEST",
              requestId: String(request?.id || ""),
              employeeId: String(employee?.id || ""),
              employeeName,
              url: "/companyadmin/leave",
            },
          });
        }
      }

      // 2. Notification to Company Admin / HR (Global Oversight)
      await caFcmRepository.saveInAppNotification({
        companyId,
        targetUserType: "admin",
        title,
        body,
        data: {
          type: "LEAVE_REQUEST",
          requestId: String(request?.id || ""),
          employeeId: String(employee?.id || ""),
          employeeName,
          startDate,
          endDate,
          days: String(days),
          url: "/companyadmin/leave",
        },
      });

      const adminTokens = await caFcmRepository.getAdminTokens(companyId);
      if (adminTokens.length > 0) {
        await this.sendPushNotification(adminTokens, {
          title,
          body,
          data: {
            type: "LEAVE_REQUEST",
            requestId: String(request?.id || ""),
            employeeId: String(employee?.id || ""),
            employeeName,
            url: "/companyadmin/leave",
          },
        });
      }
    } catch (error) {
      console.error("[FCM] notifyApproversOfLeaveRequest error:", error?.message || error);
    }
  },

  async notifyEmployeeOfLeaveStatus({ companyId, employeeId, status, leaveTypeName, startDate, endDate, reviewedByName, rejectReason }) {
    try {
      const employeeTokens = await caFcmRepository.getEmployeeTokens(companyId, employeeId);
      const isApproved = status === "Approved";
      const title = isApproved ? "Leave Request Approved" : "Leave Request Rejected";
      const formattedStart = startDate ? String(startDate).slice(0, 10) : "";
      const formattedEnd = endDate ? String(endDate).slice(0, 10) : "";
      const dateRange = formattedStart === formattedEnd ? formattedStart : `${formattedStart} - ${formattedEnd}`;
      const body = `Your ${leaveTypeName || "leave"} request (${dateRange}) has been ${status.toLowerCase()} by ${reviewedByName || "Approver"}.${rejectReason ? ` Reason: "${rejectReason}"` : ""}`;

      // 1. In-app notification for employee
      await caFcmRepository.saveInAppNotification({
        companyId,
        targetUserType: "employee",
        targetUserId: String(employeeId),
        title,
        body,
        data: {
          type: "LEAVE_STATUS_UPDATE",
          status,
          dateRange,
          url: "/companyadmin/leave",
        },
      });

      // 2. FCM Push Notification
      if (employeeTokens.length > 0) {
        await this.sendPushNotification(employeeTokens, {
          title,
          body,
          data: {
            type: "LEAVE_STATUS_UPDATE",
            status,
            dateRange,
            url: "/companyadmin/leave",
          },
        });
      }
    } catch (error) {
      console.error("[FCM] notifyEmployeeOfLeaveStatus error:", error?.message || error);
    }
  },

  async notifyApproversOfOtRequest({ companyId, employee, otRequest }) {
    try {
      const employeeName = employee?.name || otRequest?.employeeName || "Employee";
      const empCode = employee?.employeeCode || otRequest?.employeeCode;
      const dateStr = otRequest?.date ? String(otRequest.date).slice(0, 10) : "";
      const hours = otRequest?.hours || otRequest?.otHours || "0";
      const reportingToId = otRequest?.reportingToId || employee?.details?.reportingToId || null;

      const title = "New Overtime Request";
      const body = `${employeeName}${empCode ? ` (${empCode})` : ""} has applied for ${hours} hrs Overtime on ${dateStr}.`;

      // 1. Notification to Reporting Manager (if assigned)
      if (reportingToId) {
        await caFcmRepository.saveInAppNotification({
          companyId,
          targetUserType: "employee",
          targetUserId: String(reportingToId),
          title: "Overtime Request From Team",
          body,
          data: {
            type: "OT_REQUEST",
            requestId: String(otRequest?.id || ""),
            employeeId: String(employee?.id || ""),
            employeeName,
            date: dateStr,
            hours: String(hours),
            url: "/companyadmin/ot",
          },
        });

        const managerTokens = await caFcmRepository.getEmployeeTokens(companyId, reportingToId);
        if (managerTokens.length > 0) {
          await this.sendPushNotification(managerTokens, {
            title: "Overtime Request From Team",
            body,
            data: {
              type: "OT_REQUEST",
              requestId: String(otRequest?.id || ""),
              employeeId: String(employee?.id || ""),
              employeeName,
              url: "/companyadmin/ot",
            },
          });
        }
      }

      // 2. Notification to Company Admin
      await caFcmRepository.saveInAppNotification({
        companyId,
        targetUserType: "admin",
        title,
        body,
        data: {
          type: "OT_REQUEST",
          requestId: String(otRequest?.id || ""),
          employeeId: String(employee?.id || ""),
          employeeName,
          date: dateStr,
          hours: String(hours),
          url: "/companyadmin/ot",
        },
      });

      const adminTokens = await caFcmRepository.getAdminTokens(companyId);
      if (adminTokens.length > 0) {
        await this.sendPushNotification(adminTokens, {
          title,
          body,
          data: {
            type: "OT_REQUEST",
            requestId: String(otRequest?.id || ""),
            employeeId: String(employee?.id || ""),
            employeeName,
            url: "/companyadmin/ot",
          },
        });
      }
    } catch (error) {
      console.error("[FCM] notifyApproversOfOtRequest error:", error?.message || error);
    }
  },

  async notifyEmployeeOfOtStatus({ companyId, employeeId, status, date, hours, otTypeName, reviewedByName, rejectReason }) {
    try {
      const employeeTokens = await caFcmRepository.getEmployeeTokens(companyId, employeeId);
      const isApproved = status === "Approved";
      const title = isApproved ? "Overtime Request Approved" : "Overtime Request Rejected";
      const dateStr = date ? String(date).slice(0, 10) : "";
      const body = isApproved
        ? `Your Overtime request (${hours || "—"} hrs on ${dateStr}${otTypeName ? ` · ${otTypeName}` : ""}) has been approved by ${reviewedByName || "Approver"}.`
        : `Your Overtime request (${hours || "—"} hrs on ${dateStr}) has been rejected by ${reviewedByName || "Approver"}.${rejectReason ? ` Reason: "${rejectReason}"` : ""}`;

      // 1. In-app notification
      await caFcmRepository.saveInAppNotification({
        companyId,
        targetUserType: "employee",
        targetUserId: String(employeeId),
        title,
        body,
        data: {
          type: "OT_STATUS_UPDATE",
          status,
          date: dateStr,
          hours: String(hours || ""),
          url: "/companyadmin/ot",
        },
      });

      // 2. Push Notification
      if (employeeTokens.length > 0) {
        await this.sendPushNotification(employeeTokens, {
          title,
          body,
          data: {
            type: "OT_STATUS_UPDATE",
            status,
            date: dateStr,
            hours: String(hours || ""),
            url: "/companyadmin/ot",
          },
        });
      }
    } catch (error) {
      console.error("[FCM] notifyEmployeeOfOtStatus error:", error?.message || error);
    }
  },
};
