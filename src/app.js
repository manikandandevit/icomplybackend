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
import { caCompaniesRouter } from "./modules/CACompanies/index.js";
import { caEstablishmentsRouter } from "./modules/CAEstablishments/index.js";
import { countryRouter } from "./modules/Country/index.js";
import { pricingRouter } from "./modules/Pricing/index.js";
import { onboardRouter } from "./modules/Onboard/index.js";
import { caUsersRouter } from "./modules/CAUsers/index.js";
import { caHrMasterRouter } from "./modules/CAHrMaster/index.js";
import { caEmployeesRouter } from "./modules/CAEmployees/index.js";

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
  app.use("/api/ca-companies", caCompaniesRouter);
  app.use("/api/ca-establishments", caEstablishmentsRouter);
  app.use("/api/ca-users", caUsersRouter);
  app.use("/api/ca-hr-master", caHrMasterRouter);
  app.use("/api/ca-employees", caEmployeesRouter);
  app.use("/api/countries", countryRouter);
  app.use("/api/pricing", pricingRouter);
  app.use("/api/onboard", onboardRouter);
  app.use("/api/branding", brandingRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
