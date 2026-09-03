const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateCAUserBody = (body, { passwordRequired = true } = {}) => {
  const errors = {};
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = typeof body?.role === "string" ? body.role.trim() : "Viewer";
  const companyAccess = typeof body?.companyAccess === "string" ? body.companyAccess.trim() : "All Companies";
  const status = body?.status === "Inactive" ? "Inactive" : "Active";

  if (!name) {
    errors.name = "Full name is required";
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

  if (!role) {
    errors.role = "Role is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      email,
      password: password.trim() || "",
      role,
      companyAccess: companyAccess || "All Companies",
      status,
    },
  };
};
