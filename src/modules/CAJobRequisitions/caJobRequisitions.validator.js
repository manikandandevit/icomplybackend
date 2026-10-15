const required = (value, label, errors, key) => {
  const next = String(value ?? "").trim();
  if (!next) errors[key] = `${label} is required`;
  return next;
};

export const validateJobRequisitionBody = (body = {}) => {
  const errors = {};
  
  const position = required(body.position, "Position name", errors, "position");
  const department = required(body.department, "Department", errors, "department");
  const location = required(body.location, "Location", errors, "location");
  const type = required(body.type, "Type", errors, "type");
  const hiringManager = String(body.hiringManager ?? "").trim();
  const priority = required(body.priority, "Priority", errors, "priority");

  const positionsCount = parseInt(body.positionsCount, 10);
  if (isNaN(positionsCount) || positionsCount < 1) {
    errors.positionsCount = "Positions count must be at least 1";
  }

  const budget = String(body.budget ?? "").trim();
  const status = String(body.status ?? "Pending Approval").trim();
  const approvalStatus = String(body.approvalStatus ?? "Pending").trim();
  const targetDate = String(body.targetDate ?? "").trim();
  const experience = String(body.experience ?? "").trim();
  const skills = Array.isArray(body.skills) ? body.skills : [];

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: { 
      position, 
      department, 
      location, 
      type, 
      hiringManager,
      positionsCount: isNaN(positionsCount) ? 1 : positionsCount, 
      priority, 
      budget, 
      status, 
      approvalStatus,
      targetDate,
      experience,
      skills
    },
  };
};
