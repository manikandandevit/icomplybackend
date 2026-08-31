const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateLoginBody = (body = {}) => {
  const errors = {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) {
    errors.email = "Email is required";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid corporate email address";
  }

  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: { email, password },
  };
};
