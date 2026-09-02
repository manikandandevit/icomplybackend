import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index.js";
import { requestLogger } from "./core/middleware/requestLogger.js";
import { errorHandler, notFoundHandler } from "./core/middleware/errorHandler.js";
import { success } from "./core/utils/response.js";
import { loginRouter } from "./modules/Login/index.js";
import { brandingRouter } from "./modules/Branding/index.js";
import { signOutRouter } from "./modules/SignOut/index.js";
import { companiesRouter } from "./modules/Companies/index.js";
import { countryRouter } from "./modules/Country/index.js";
import { pricingRouter } from "./modules/Pricing/index.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(
    cors({
      origin: config.clientOrigins,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.get("/api/health", (_req, res) => {
    return success(res, {
      message: "iComply API is healthy",
      data: { service: "icomply-backend", env: config.env },
    });
  });

  app.use("/api/login", loginRouter);
  app.use("/api/signout", signOutRouter);
  app.use("/api/companies", companiesRouter);
  app.use("/api/countries", countryRouter);
  app.use("/api/pricing", pricingRouter);
  app.use("/api/branding", brandingRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
