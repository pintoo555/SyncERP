import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as rbacController from './rbac.controller';

const router = Router();
router.use(requireAuth);

router.get('/roles', requirePermission('RBAC.ROLES.VIEW'), rbacController.listRoles);
router.get('/permissions', requirePermission('RBAC.PERMISSIONS.VIEW'), rbacController.listPermissions);
router.get('/roles/:roleId/permissions', requirePermission('RBAC.ROLES.VIEW'), rbacController.getRolePermissions);
router.put('/roles/:roleId/permissions', requirePermission('RBAC.ROLES.EDIT'), rbacController.setRolePermissions);

router.get('/audit-overview', requirePermission('RBAC.USERROLES.VIEW'), rbacController.getAuditOverview);
router.get('/user-roles/:userId', requirePermission('RBAC.USERROLES.VIEW'), rbacController.getUserRoles);
router.post('/user-roles/assign', requirePermission('RBAC.USERROLES.ASSIGN'), rbacController.assignUserRole);
router.post('/user-roles/revoke', requirePermission('RBAC.USERROLES.REVOKE'), rbacController.revokeUserRole);
router.post('/user-roles/bulk-assign', requirePermission('RBAC.USERROLES.ASSIGN'), rbacController.bulkAssignRoles);
router.post('/user-roles/bulk-revoke', requirePermission('RBAC.USERROLES.REVOKE'), rbacController.bulkRevokeRoles);
router.post('/user-permissions/bulk-add', requirePermission('RBAC.USERROLES.ASSIGN'), rbacController.bulkAddPermissions);

router.get('/user-permissions/:userId', requirePermission('RBAC.USERROLES.VIEW'), rbacController.getUserPermissions);
router.put('/user-permissions/:userId', requirePermission('RBAC.USERROLES.ASSIGN'), rbacController.setUserPermissions);

export const rbacRoutes = router;
