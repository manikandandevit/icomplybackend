export const caOnboardingValidator = {
  validateNotifyTask(payload) {
    const { assigneeName, taskTitle, candidateName } = payload || {};
    if (!assigneeName || !taskTitle || !candidateName) {
      return "assigneeName, taskTitle, and candidateName are required";
    }
    return null;
  },

  validateNotifyBatch(payload) {
    const { tasks } = payload || {};
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return "A non-empty tasks array is required";
    }
    return null;
  },

  validateSaveTemplates(payload) {
    const { templates, templateKey, sections } = payload || {};
    if (!templates && (!templateKey || !Array.isArray(sections))) {
      return "Missing templates or templateKey/sections";
    }
    return null;
  },

  validateSaveProgress(payload) {
    const { candidateId, sections, allProgress } = payload || {};
    if (!allProgress && (!candidateId || !Array.isArray(sections))) {
      return "Missing candidateId or sections";
    }
    return null;
  },
};
