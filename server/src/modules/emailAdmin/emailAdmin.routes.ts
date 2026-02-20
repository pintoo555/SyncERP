/**
 * hMailServer Email Admin API - proxy to bridge with permission checks.
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as ctrl from './emailAdmin.controller';

const router = Router();
router.use(requireAuth);

// Recipients (for Compose TO/CC/BCC autocomplete; any authenticated user)
router.get('/recipients', ctrl.listRecipients);

// Domains
router.get('/domains', requirePermission('EMAIL_ADMIN.VIEW'), ctrl.listDomains);
router.post('/domains', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.createDomain);
router.put('/domains/:id', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.updateDomain);
router.delete('/domains/:id', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.deleteDomain);

// Accounts
router.get('/domains/:domainId/accounts', requirePermission('EMAIL_ADMIN.VIEW'), ctrl.listAccounts);
router.post('/domains/:domainId/accounts', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.createAccount);
router.put('/accounts/:id', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.updateAccount);
router.put('/accounts/:id/password', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.changeAccountPassword);
router.delete('/accounts/:id', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.deleteAccount);

// Aliases
router.get('/domains/:domainId/aliases', requirePermission('EMAIL_ADMIN.VIEW'), ctrl.listAliases);
router.post('/domains/:domainId/aliases', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.createAlias);
router.put('/aliases/:id', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.updateAlias);
router.delete('/aliases/:id', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.deleteAlias);

// Distribution Lists
router.get('/domains/:domainId/distributionlists', requirePermission('EMAIL_ADMIN.VIEW'), ctrl.listDistributionLists);
router.post('/domains/:domainId/distributionlists', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.createDistributionList);
router.put('/distributionlists/:id', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.updateDistributionList);
router.delete('/distributionlists/:id', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.deleteDistributionList);
router.get('/distributionlists/:id/recipients', requirePermission('EMAIL_ADMIN.VIEW'), ctrl.listDistributionListRecipients);
router.post('/distributionlists/:id/recipients', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.addDistributionListRecipient);
router.delete('/distributionlists/:id/recipients/:address', requirePermission('EMAIL_ADMIN.EDIT'), ctrl.removeDistributionListRecipient);

export const emailAdminRoutes = router;
