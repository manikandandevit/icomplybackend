import express from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caSeparationController } from "./caSeparation.controller.js";

export const caSeparationRouter = express.Router();

// Employee submits resignation
caSeparationRouter.post(
  "/apply",
  authenticateToken,
  requireCompanyAdmin,
  caSeparationController.apply
);

// Employee fetches their active resignation & review history chart
caSeparationRouter.get(
  "/my-request",
  authenticateToken,
  requireCompanyAdmin,
  caSeparationController.myRequest
);

// Manager / Admin lists separation requests
caSeparationRouter.get(
  "/requests",
  authenticateToken,
  requireCompanyAdmin,
  caSeparationController.list
);

// Reviewer approves & forwards request to another department & employee
caSeparationRouter.post(
  "/requests/:id/approve",
  authenticateToken,
  requireCompanyAdmin,
  caSeparationController.approveAndForward
);

// Reviewer retains employee (closes resignation)
caSeparationRouter.post(
  "/requests/:id/retain",
  authenticateToken,
  requireCompanyAdmin,
  caSeparationController.retain
);

// Reviewer / Admin finalizes offboarding & marks employee Inactive
caSeparationRouter.post(
  "/requests/:id/offboard",
  authenticateToken,
  requireCompanyAdmin,
  caSeparationController.offboard
);

// Employee withdraws resignation request
caSeparationRouter.post(
  "/requests/:id/withdraw",
  authenticateToken,
  requireCompanyAdmin,
  caSeparationController.withdraw
);

