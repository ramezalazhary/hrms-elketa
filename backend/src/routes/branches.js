import { Router } from "express";
import { Branch } from "../models/Branch.js";
import { Employee } from "../models/Employee.js";
import { requireAuth } from "../middleware/auth.js";
import { enforcePolicy } from "../middleware/enforcePolicy.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, BadRequestError } from "../utils/ApiError.js";
import { strictLimiter } from "../middleware/security.js";

const router = Router();

// GET /api/branches - List all branches
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const branches = await Branch.find();
    res.json(branches);
  })
);

// POST /api/branches - Create a new branch (Admin/HR only)
router.post(
  "/",
  requireAuth,
  enforcePolicy("manage", "branches"),
  strictLimiter,
  asyncHandler(async (req, res) => {
    const { name, code, location, city, country, managerId, status } = req.body;

    if (!name || !code) {
      throw new BadRequestError("Branch name and code are required");
    }

    const existingCode = await Branch.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      throw new BadRequestError("Branch code already exists");
    }

    const newBranch = new Branch({
      name,
      code: code.toUpperCase(),
      location,
      city,
      country,
      managerId,
      status: status || "ACTIVE",
    });

    await newBranch.save();
    res.status(201).json(newBranch);
  })
);

// PUT /api/branches/:id - Update a branch
router.put(
  "/:id",
  requireAuth,
  enforcePolicy("manage", "branches"),
  strictLimiter,
  asyncHandler(async (req, res) => {
    const { name, code, location, city, country, managerId, status } = req.body;
    
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }

    if (code && code.toUpperCase() !== branch.code) {
      const existingCode = await Branch.findOne({ code: code.toUpperCase() });
      if (existingCode) {
        throw new BadRequestError("Branch code already exists");
      }
      branch.code = code.toUpperCase();
    }

    const oldName = branch.name;

    if (name !== undefined) branch.name = name;
    if (location !== undefined) branch.location = location;
    if (city !== undefined) branch.city = city;
    if (country !== undefined) branch.country = country;
    if (managerId !== undefined) branch.managerId = managerId;
    if (status !== undefined) branch.status = status;

    await branch.save();

    // If branch name changed, we update the Employee cache workLocation
    if (name && name !== oldName) {
       await Employee.updateMany(
         { branchId: branch._id },
         { $set: { workLocation: name } }
       );
    }

    res.json(branch);
  })
);

// DELETE /api/branches/:id - Delete a branch
router.delete(
  "/:id",
  requireAuth,
  enforcePolicy("delete", "branches"),
  strictLimiter,
  asyncHandler(async (req, res) => {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }

    // Check if branch is assigned to any employees
    const employeeCount = await Employee.countDocuments({ branchId: branch._id });
    if (employeeCount > 0) {
      throw new BadRequestError(`Cannot delete branch. ${employeeCount} employee(s) are assigned to it.`);
    }

    await branch.deleteOne();
    res.json({ message: "Branch deleted successfully" });
  })
);

export default router;
