const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateCAUserBody = (body, { passwordRequired = false } = {}) => {
  const errors = {};
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = typeof body?.role === "string" && body.role.trim() ? body.role.trim() : "User";
  const designationId = body?.designationId != null ? String(body.designationId).trim() : "";
  const companyAccess = typeof body?.companyAccess === "string" && body.companyAccess.trim() ? body.companyAccess.trim() : "All Companies";
  const allowedModules = Array.isArray(body?.allowedModules) && body.allowedModules.length > 0
    ? body.allowedModules.map((m) => String(m).trim()).filter(Boolean)
    : ["all"];
  const status = body?.status === "Inactive" ? "Inactive" : "Active";

  if (!name) {
    errors.name = "Username is required";
  }

  if (!email) {
    errors.email = "Email address is required";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Valid email address is required";
  }

  if (passwordRequired && !password.trim()) {
    errors.password = "Password is required";
  } else if (password && password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      email,
      password: password.trim() || "",
      role,
      designationId,
      companyAccess: companyAccess || "All Companies",
      allowedModules,
      status,
    },
  };
};

