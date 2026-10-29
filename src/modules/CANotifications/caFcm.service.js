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
};
