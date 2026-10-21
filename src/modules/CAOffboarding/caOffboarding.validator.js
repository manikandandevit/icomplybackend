export const caOffboardingValidator = {
  validateInitiate(payload) {
    if (!payload?.employeeId) {
      return "Employee ID is required";
    }
    return null;
  },

  validateSections(sections) {
    if (!Array.isArray(sections)) {
      return "Sections must be an array";
    }
    return null;
  },

  validateSaveTemplates(payload) {
    if (!payload?.templates && (!payload?.templateKey || !Array.isArray(payload?.sections))) {
      return "Missing templates or templateKey/sections";
    }
    return null;
  },
};
