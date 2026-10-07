import { caEcrSlabsService } from "./caEcrSlabs.service.js";

export const caEcrSlabsController = {
  async list(req, res, next) {
    try {
      const data = await caEcrSlabsService.list(req.companyId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const data = await caEcrSlabsService.create(req.companyId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const data = await caEcrSlabsService.update(req.params.id, req.companyId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await caEcrSlabsService.delete(req.params.id, req.companyId);
      res.json({ success: true, message: "Deleted successfully" });
    } catch (err) {
      next(err);
    }
  },

  async bulkSave(req, res, next) {
    try {
      const { wageType, slabs } = req.body;
      const data = await caEcrSlabsService.bulkSave(req.companyId, wageType, slabs);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
};
