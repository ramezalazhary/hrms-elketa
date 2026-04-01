import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveEmployeeAccess } from '../services/accessService.js';
import { Alert } from '../models/Alert.js';
import { Employee } from '../models/Employee.js';
import { generateAlerts } from '../modules/alerts/index.js';

const router = Router();

// Endpoint 1: Generate & Gather Alerts via Aggregation
router.get('/alerts', requireAuth, async (req, res) => {
  try {
    // Attempt generation run (Asynchronous scan - keeps documents updated)
    await generateAlerts();

    const access = await resolveEmployeeAccess(req.user);

    // Build filter base allowing Managers to only see their department
    const employeeMatch = { status: { $ne: 'TERMINATED' } };
    if (access.scope === 'department') {
       const userEmp = await Employee.findOne({ email: req.user.email });
       if (userEmp) employeeMatch.department = userEmp.department;
    }

    const relevantEmployees = await Employee.find(employeeMatch).select('_id').lean();
    const relevantIds = relevantEmployees.map(e => e._id);

    const alertCounts = await Alert.aggregate([
      { $match: { employeeId: { $in: relevantIds }, resolved: false } },
      { $group: { _id: { type: "$type", severity: "$severity" }, count: { $sum: 1 } } }
    ]);

    const result = {
      idExpiredCount: 0,
      idExpirySoon: 0,
      salaryIncreaseSoon: 0,
      recentTransfers: 0,
      contractExpirySoon: 0
    };

    alertCounts.forEach(c => {
      const { type, severity } = c._id;
      if (type === 'ID_EXPIRY') {
        if (severity === 'critical') result.idExpiredCount = c.count;
        else result.idExpirySoon = c.count;
      }
      if (type === 'SALARY_INCREASE') result.salaryIncreaseSoon = c.count;
      if (type === 'TRANSFER') result.recentTransfers = c.count;
      if (type === 'CONTRACT_EXPIRY') result.contractExpirySoon = c.count;
    });

    res.json(result);
  } catch (err) {
    console.error("Dashboard Alerts Error:", err);
    res.status(500).json({ error: "Failed to load dashboard alerts." });
  }
});

// Endpoint 2: Gather Financial/Headcount Metrics
router.get('/metrics', requireAuth, async (req, res) => {
  try {
    const access = await resolveEmployeeAccess(req.user);
    
    const pipeline = [];
    if (access.scope === 'department') {
       const userEmp = await Employee.findOne({ email: req.user.email });
       if (userEmp) pipeline.push({ $match: { department: userEmp.department } });
    }
    pipeline.push({ $match: { status: { $ne: 'TERMINATED' } } });

    // Branch 1: Stats summary
    const statsQuery = Employee.aggregate([
      ...pipeline,
      {
        $group: {
           _id: null,
           totalEmployees: { $sum: 1 },
           totalPayroll: { $sum: "$financial.baseSalary" }
        }
      }
    ]);

    // Branch 2: Upcoming Salary Extractor
    const today = new Date();
    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const salaryQuery = Employee.countDocuments({
      status: { $ne: 'TERMINATED' },
      ...(access.scope === 'department' ? { department: req.user.department } : {}), // approximate sync, we'll keep simple
      yearlySalaryIncreaseDate: { $gte: today, $lte: thirtyDays }
    });

    // Branch 3: ID Expiring Extractor
    const sixtyDays = new Date(today);
    sixtyDays.setDate(sixtyDays.getDate() + 60);

    const idQuery = Employee.countDocuments({
      status: { $ne: 'TERMINATED' },
      nationalIdExpiryDate: { $gte: today, $lte: sixtyDays }
    });

    const [statsRes, upcomingSalaryIncreases, idExpiringSoon] = await Promise.all([
      statsQuery, salaryQuery, idQuery
    ]);

    const stats = statsRes[0] || { totalEmployees: 0, totalPayroll: 0 };
    const avgSalary = stats.totalEmployees > 0 ? (stats.totalPayroll / stats.totalEmployees) : 0;

    res.json({
      totalEmployees: stats.totalEmployees,
      totalPayroll: stats.totalPayroll,
      avgSalary: Math.round(avgSalary),
      upcomingSalaryIncreases,
      idExpiringSoon
    });
  } catch (err) {
    console.error("Dashboard Metrics Error:", err);
    res.status(500).json({ error: "Failed to load HR metrics." });
  }
});

export default router;
