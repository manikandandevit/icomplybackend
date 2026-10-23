export const caOffersValidator = {
  validateCreate(payload) {
    if (!payload?.candidate_name?.trim()) {
      return "Candidate name is required";
    }
    if (!payload?.role?.trim()) {
      return "Role is required";
    }
    return null;
  },

  validateUpdateStatus(status) {
    if (!status || typeof status !== "string") {
      return "Valid status string is required";
    }
    return null;
  },
};
