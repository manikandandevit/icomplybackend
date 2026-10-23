import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { brandingService } from "./branding.service.js";

const sendImage = async (res, loader) => {
  try {
    const file = await loader();
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    file.body.pipe(res);
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return res.status(404).end();
    }
    throw err;
  }
};

export const brandingController = {
  logo: asyncHandler(async (_req, res) => {
    await sendImage(res, brandingService.getLogo);
  }),
  tabbar: asyncHandler(async (_req, res) => {
    await sendImage(res, brandingService.getTabbar);
  }),
};
