import { AuditLog } from '../models/AuditLog.js';

/**
 * Creates an audit log entry for a critical operation
 * @param {Object} params - Audit parameters
 * @param {string} params.entityType - Type of entity ('Employee', 'Department', etc.)
 * @param {string} params.entityId - ID of the entity
 * @param {string} params.operation - Operation type ('CREATE', 'UPDATE', 'DELETE')
 * @param {Object} params.changes - What changed (for updates)
 * @param {Object} params.previousValues - Previous values (for updates)
 * @param {Object} params.newValues - New values
 * @param {string} params.reason - Reason for change
 * @param {string} params.performedBy - User email who performed the operation
 * @param {string} params.ipAddress - IP address
 * @param {string} params.userAgent - User agent string
 */
export async function createAuditLog(params) {
  try {
    const auditEntry = new AuditLog({
      entityType: params.entityType,
      entityId: params.entityId,
      operation: params.operation,
      changes: params.changes || {},
      previousValues: params.previousValues || {},
      newValues: params.newValues || {},
      reason: params.reason || '',
      performedBy: params.performedBy,
      ipAddress: params.ipAddress || '',
      userAgent: params.userAgent || ''
    });
    
    await auditEntry.save();
    return auditEntry;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking main operation
  }
}

/**
 * Helper function to detect changes between two objects
 * @param {Object} previous - Previous state
 * @param {Object} current - Current state
 * @returns {Object} - Object with changed fields
 */
export function detectChanges(previous, current) {
  const changes = {};
  const previousValues = {};
  const newValues = {};
  
  for (const key in current) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      changes[key] = true;
      previousValues[key] = previous[key];
      newValues[key] = current[key];
    }
  }
  
  return { changes, previousValues, newValues };
}
