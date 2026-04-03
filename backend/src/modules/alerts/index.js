import { Alert } from '../../models/Alert.js';
import { Employee } from '../../models/Employee.js';

export async function generateAlerts() {
  try {
    const today = new Date();
    
    // Exact Thresholds specified by UX criteria
    const expiryThreshold = new Date(today);
    expiryThreshold.setDate(expiryThreshold.getDate() + 60);

    const salaryThreshold = new Date(today);
    salaryThreshold.setDate(salaryThreshold.getDate() + 30);

    // Ensure we ignore Terminated Employees (as requested by User)
    const employees = await Employee.find({ status: { $ne: 'TERMINATED' } });

    for (const emp of employees) {
      // 1. National ID Expiry Rule
      if (emp.nationalIdExpiryDate) {
        const idDate = new Date(emp.nationalIdExpiryDate);
        if (idDate <= expiryThreshold) {
           const isExpired = idDate < today;
           await createAlertIfNotExists(
              'ID_EXPIRY', 
              emp._id, 
              isExpired 
                ? `CRITICAL: National ID EXPIRED on ${idDate.toLocaleDateString()}`
                : `National ID expires soon (on ${idDate.toLocaleDateString()})`,
              isExpired ? 'critical' : 'high'
           );
        }
      }

      // 2. Salary Increase Rule (<30 days)
      if (emp.nextReviewDate) {
         const increaseDate = new Date(emp.nextReviewDate);
         if (increaseDate <= salaryThreshold) { // We catch even if slightly past due
            await createAlertIfNotExists(
               'SALARY_INCREASE',
               emp._id,
               `Yearly salary increase due (on ${increaseDate.toLocaleDateString()})`,
               'medium'
            );
         }
      }
    }
    console.log("[AlertEngine] Evaluation complete.");
  } catch (err) {
    console.error("[AlertEngine] Error generating alerts:", err);
  }
}

export async function createAlertIfNotExists(type, employeeId, message, severity) {
   const existing = await Alert.findOne({ type, employeeId, resolved: false });
   if (!existing) {
      await Alert.create({ type, employeeId, message, severity });
   }
}

export async function logTransferAlert(employeeId, message) {
   await Alert.create({ type: 'TRANSFER', employeeId, message, severity: 'low' });
}

export async function resolveAlertsForEmployee(employeeId, type) {
   await Alert.updateMany({ employeeId, type, resolved: false }, { $set: { resolved: true } });
}
