import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { enforcePolicy } from '../middleware/enforcePolicy.js';
import { Alert } from '../models/Alert.js';
import { Employee } from '../models/Employee.js';
import { generateAlerts } from '../modules/alerts/index.js';
import { resolveEmployeeScopeIds } from '../services/scopeService.js';

const router = Router();

// Endpoint 1: Generate & Gather Alerts via Aggregation
router.get('/alerts', requireAuth, enforcePolicy("read", "dashboard"), async (req, res) => {
  try {
    await generateAlerts();

    const scoped = await resolveEmployeeScopeIds(req.user);
    const employeeMatch = { status: { $ne: 'TERMINATED' } };
    if (scoped.scope !== 'all') {
      employeeMatch._id = { $in: scoped.employeeIds || [] };
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
    const scoped = await resolveEmployeeScopeIds(req.user);
    const scopedFilter =
      scoped.scope === 'all'
        ? {}
        : { _id: { $in: scoped.employeeIds || [] } };

    const baseFilter = {
      status: { $ne: 'TERMINATED' },
      ...scopedFilter,
    };

    const pipeline = [
      { $match: baseFilter },
      {
        $group: {
           _id: null,
           totalEmployees: { $sum: 1 },
           totalPayroll: { $sum: "$financial.baseSalary" }
        }
      }
    ];

    const statsQuery = Employee.aggregate(pipeline);

    const today = new Date();
    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const salaryQuery = Employee.countDocuments({
      ...baseFilter,
      nextReviewDate: { $gte: today, $lte: thirtyDays }
    });

    const sixtyDays = new Date(today);
    sixtyDays.setDate(sixtyDays.getDate() + 60);

    const idQuery = Employee.countDocuments({
      ...baseFilter,
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
