import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { enforcePolicy } from '../middleware/enforcePolicy.js';
import { Alert } from '../models/Alert.js';
import { Employee } from '../models/Employee.js';
import { generateAlerts } from '../modules/alerts/index.js';

const router = Router();

// Endpoint 1: Generate & Gather Alerts via Aggregation
router.get('/alerts', requireAuth, enforcePolicy("read", "dashboard"), async (req, res) => {
  try {
    await generateAlerts();

    const decision = req.authzDecision;
    const employeeMatch = { status: { $ne: 'TERMINATED' } };
    if (decision.scope === 'department') {
       const userEmp = await Employee.findOne({ email: req.user.email });
       if (userEmp?.departmentId) employeeMatch.departmentId = userEmp.departmentId;
       else if (userEmp?.department) employeeMatch.department = userEmp.department;
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
router.get('/metrics', requireAuth, enforcePolicy("read", "dashboard"), async (req, res) => {
  try {
    const decision = req.authzDecision;
    let deptFilter = {};
    if (decision.scope === 'department') {
       const userEmp = await Employee.findOne({ email: req.user.email });
       if (userEmp?.departmentId) deptFilter = { departmentId: userEmp.departmentId };
       else if (userEmp?.department) deptFilter = { department: userEmp.department };
    }

    const pipeline = [];
    if (Object.keys(deptFilter).length) pipeline.push({ $match: deptFilter });
    pipeline.push({ $match: { status: { $ne: 'TERMINATED' } } });

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

    const today = new Date();
    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const salaryQuery = Employee.countDocuments({
      status: { $ne: 'TERMINATED' },
      ...deptFilter,
      nextReviewDate: { $gte: today, $lte: thirtyDays }
    });

    const sixtyDays = new Date(today);
    sixtyDays.setDate(sixtyDays.getDate() + 60);

    const idQuery = Employee.countDocuments({
      status: { $ne: 'TERMINATED' },
      ...deptFilter,
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
