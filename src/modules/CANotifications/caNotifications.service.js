import { DEFAULT_NOTIFICATION_MODULES, getDefaultSettings } from "./caNotifications.constants.js";
import { caNotificationsRepository } from "./caNotifications.repository.js";

const calculateStats = (channels, notifications) => {
  let totalItems = 0;
  let emailSavedCount = 0;
  let whatsAppSavedCount = 0;

  for (const group of DEFAULT_NOTIFICATION_MODULES) {
    for (const item of group.items) {
      totalItems++;
      const current = notifications?.[item.id];
      if (current?.email) emailSavedCount++;
      if (current?.whatsapp) whatsAppSavedCount++;
    }
  }

  return {
    totalItems,
    email: {
      isChannelOn: Boolean(channels?.email),
      savedCount: emailSavedCount,
      totalCount: totalItems,
    },
    whatsapp: {
      isChannelOn: Boolean(channels?.whatsapp),
      savedCount: whatsAppSavedCount,
      totalCount: totalItems,
    },
  };
};

const mergeWithDefaults = (notifications, templates) => {
  const mergedNotifications = { ...(notifications || {}) };
  const mergedTemplates = { ...(templates || {}) };
  let hasNew = false;

  const validItemIds = new Set();
  for (const group of DEFAULT_NOTIFICATION_MODULES) {
    for (const item of group.items) {
      validItemIds.add(item.id);
      if (!mergedNotifications[item.id]) {
        hasNew = true;
        mergedNotifications[item.id] = {
          email: item.defaultEmail,
          whatsapp: item.defaultWhatsApp,
        };
      }
      if (!mergedTemplates[item.id]) {
        hasNew = true;
        mergedTemplates[item.id] = {
          emailSubject: item.emailTemplate.subject,
          emailBody: item.emailTemplate.body,
          whatsAppBody: item.whatsAppTemplate.body,
        };
      }
    }
  }

  // Purge any legacy/obsolete notification keys no longer in DEFAULT_NOTIFICATION_MODULES
  for (const key of Object.keys(mergedNotifications)) {
    if (!validItemIds.has(key)) {
      delete mergedNotifications[key];
      hasNew = true;
    }
  }
  for (const key of Object.keys(mergedTemplates)) {
    if (!validItemIds.has(key)) {
      delete mergedTemplates[key];
      hasNew = true;
    }
  }

  return { mergedNotifications, mergedTemplates, hasNew };
};

export const caNotificationsService = {
  async getSettings(companyId) {
    const settings = await caNotificationsRepository.getSettings(companyId);
    const { mergedNotifications, mergedTemplates, hasNew } = mergeWithDefaults(
      settings.notifications,
      settings.templates
    );

    if (hasNew) {
      await caNotificationsRepository.saveSettings(companyId, {
        channels: settings.channels,
        notifications: mergedNotifications,
        templates: mergedTemplates,
      });
    }

    const stats = calculateStats(settings.channels, mergedNotifications);

    return {
      channels: settings.channels,
      notifications: mergedNotifications,
      templates: mergedTemplates,
      modules: DEFAULT_NOTIFICATION_MODULES,
      stats,
      updatedAt: settings.updatedAt,
    };
  },

  async updateSettings(companyId, payload) {
    const { channels, notifications, templates } = payload;
    const settings = await caNotificationsRepository.saveSettings(companyId, {
      channels,
      notifications,
      templates,
    });
    const stats = calculateStats(settings.channels, settings.notifications);

    return {
      channels: settings.channels,
      notifications: settings.notifications,
      templates: settings.templates,
      modules: DEFAULT_NOTIFICATION_MODULES,
      stats,
      updatedAt: settings.updatedAt,
    };
  },

  async resetSettings(companyId) {
    const settings = await caNotificationsRepository.resetSettings(companyId);
    const stats = calculateStats(settings.channels, settings.notifications);

    return {
      channels: settings.channels,
      notifications: settings.notifications,
      templates: settings.templates,
      modules: DEFAULT_NOTIFICATION_MODULES,
      stats,
      updatedAt: settings.updatedAt,
    };
  },

  async updateTemplate(companyId, key, templateData) {
    const settings = await caNotificationsRepository.updateTemplate(companyId, key, templateData);
    const stats = calculateStats(settings.channels, settings.notifications);

    return {
      channels: settings.channels,
      notifications: settings.notifications,
      templates: settings.templates,
      modules: DEFAULT_NOTIFICATION_MODULES,
      stats,
      updatedAt: settings.updatedAt,
    };
  },
};
