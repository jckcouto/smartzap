/**
 * Service Exports
 * 
 */

// ============================================================================
// DATABASE SERVICES
// ============================================================================
export { campaignService } from './campaignService';
export { contactService } from './contactService';
export { templateService } from './templateService';
// ============================================================================
// SETTINGS SERVICE (Uses Redis for credentials)
// ============================================================================
export { settingsService } from './settingsService';
