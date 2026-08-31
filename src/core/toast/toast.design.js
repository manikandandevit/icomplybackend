export const TOAST_TYPES = Object.freeze({
  success: "success",
  error: "error",
  warning: "warning",
  info: "info",
});

export const TOAST_VARIANTS = Object.freeze({
  light: "light",
  filled: "filled",
});

export const toastDesign = Object.freeze({
  width: 252,
  radius: 8,
  fontSize: 12,
  iconSize: 16,
  closeSize: 12,
  progressHeight: 3,
  durationMs: 3200,
  colors: {
    success: { accent: "#43A047", filled: "#43A047", progressSoft: "rgba(255,255,255,0.45)" },
    error: { accent: "#E57373", filled: "#E57373", progressSoft: "rgba(255,255,255,0.45)" },
    warning: { accent: "#F0C014", filled: "#F0C014", progressSoft: "rgba(255,255,255,0.45)" },
    info: { accent: "#42A5F5", filled: "#42A5F5", progressSoft: "rgba(255,255,255,0.45)" },
  },
});

export const toastTypeForStatus = (status = 400) => {
  if (status === 429) {
    return TOAST_TYPES.warning;
  }

  return TOAST_TYPES.error;
};

export const createToast = ({ type = TOAST_TYPES.error, variant = TOAST_VARIANTS.light, message }) => ({
  type,
  variant,
  message,
});
