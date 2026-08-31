import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { brandingService } from "./branding.service.js";

const sendImage = async (res, loader) => {
  const file = await loader();
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  file.body.pipe(res);
};

export const brandingController = {
  logo: asyncHandler(async (_req, res) => {
    await sendImage(res, brandingService.getLogo);
  }),
  tabbar: asyncHandler(async (_req, res) => {
    await sendImage(res, brandingService.getTabbar);
  }),
};
