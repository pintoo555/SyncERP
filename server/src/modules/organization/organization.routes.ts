/**
 * Organization routes: Geography, Company, Branch, Capabilities, Locations, Departments, Designations, Permissions, Transfers.
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as ctrl from './organization.controller';

const router = Router();
router.use(requireAuth);

// ─── Geography ───
router.get('/countries', requirePermission('ORG.GEO.VIEW'), ctrl.listCountries);
router.post('/countries', requirePermission('ORG.GEO.EDIT'), ctrl.createCountry);
router.put('/countries/:id', requirePermission('ORG.GEO.EDIT'), ctrl.updateCountry);

router.get('/states', requirePermission('ORG.GEO.VIEW'), ctrl.listStates);
router.post('/states', requirePermission('ORG.GEO.EDIT'), ctrl.createState);
router.put('/states/:id', requirePermission('ORG.GEO.EDIT'), ctrl.updateState);

router.get('/tax-jurisdictions', requirePermission('ORG.GEO.VIEW'), ctrl.listTaxJurisdictions);
router.post('/tax-jurisdictions', requirePermission('ORG.GEO.EDIT'), ctrl.createTaxJurisdiction);
router.put('/tax-jurisdictions/:id', requirePermission('ORG.GEO.EDIT'), ctrl.updateTaxJurisdiction);

// ─── Companies ───
router.get('/companies', requirePermission('ORG.COMPANY.VIEW'), ctrl.listCompanies);
router.get('/companies/:id', requirePermission('ORG.COMPANY.VIEW'), ctrl.getCompany);
router.post('/companies', requirePermission('ORG.COMPANY.EDIT'), ctrl.createCompany);
router.put('/companies/:id', requirePermission('ORG.COMPANY.EDIT'), ctrl.updateCompany);

// ─── Branches ───
router.get('/branches', requirePermission('ORG.BRANCH.VIEW'), ctrl.listBranches);
router.get('/branches/:id', requirePermission('ORG.BRANCH.VIEW'), ctrl.getBranch);
router.post('/branches', requirePermission('ORG.BRANCH.EDIT'), ctrl.createBranch);
router.put('/branches/:id', requirePermission('ORG.BRANCH.EDIT'), ctrl.updateBranch);

// ─── Branch sub-resources ───
router.get('/branches/:id/companies', requirePermission('ORG.BRANCH.VIEW'), ctrl.listBranchCompanies);
router.post('/branches/:id/companies', requirePermission('ORG.BRANCH.EDIT'), ctrl.addBranchCompany);
router.delete('/branches/:id/companies/:mapId', requirePermission('ORG.BRANCH.EDIT'), ctrl.removeBranchCompany);

router.get('/branches/:id/departments', requirePermission('ORG.BRANCH.VIEW'), ctrl.listBranchDepartments);
router.post('/branches/:id/departments', requirePermission('ORG.BRANCH.EDIT'), ctrl.addBranchDepartment);
router.delete('/branches/:id/departments/:mapId', requirePermission('ORG.BRANCH.EDIT'), ctrl.removeBranchDepartment);

router.get('/capabilities', requirePermission('ORG.BRANCH.VIEW'), ctrl.listCapabilities);
router.get('/branches/:id/capabilities', requirePermission('ORG.BRANCH.VIEW'), ctrl.listBranchCapabilities);
router.post('/branches/:id/capabilities', requirePermission('ORG.BRANCH.EDIT'), ctrl.addBranchCapability);
router.delete('/branches/:id/capabilities/:mapId', requirePermission('ORG.BRANCH.EDIT'), ctrl.removeBranchCapability);

router.get('/branches/:id/locations', requirePermission('ORG.BRANCH.VIEW'), ctrl.listBranchLocations);
router.post('/branches/:id/locations', requirePermission('ORG.BRANCH.EDIT'), ctrl.createBranchLocation);
router.put('/branches/:id/locations/:locId', requirePermission('ORG.BRANCH.EDIT'), ctrl.updateBranchLocation);
router.delete('/branches/:id/locations/:locId', requirePermission('ORG.BRANCH.EDIT'), ctrl.deleteBranchLocation);

// ─── Departments & Designations (moved from HRMS) ───
router.get('/departments', requirePermission('ORG.VIEW'), ctrl.listOrgDepartments);
router.post('/departments', requirePermission('ORG.EDIT'), ctrl.createOrgDepartment);
router.put('/departments/:id', requirePermission('ORG.EDIT'), ctrl.updateOrgDepartment);
router.delete('/departments/:id', requirePermission('ORG.EDIT'), ctrl.deleteOrgDepartment);

router.get('/designations', requirePermission('ORG.VIEW'), ctrl.listOrgDesignations);
router.post('/designations', requirePermission('ORG.EDIT'), ctrl.createOrgDesignation);
router.put('/designations/:id', requirePermission('ORG.EDIT'), ctrl.updateOrgDesignation);
router.delete('/designations/:id', requirePermission('ORG.EDIT'), ctrl.deleteOrgDesignation);

// ─── Branch access / permissions ───
router.get('/branch-access/roles/:roleId', requirePermission('ORG.BRANCH.VIEW'), ctrl.getRoleBranchScope);
router.put('/branch-access/roles/:roleId', requirePermission('ORG.BRANCH.EDIT'), ctrl.upsertRoleBranchScope);

router.get('/branch-access/users/:userId', requirePermission('ORG.BRANCH.VIEW'), ctrl.listUserBranchAccess);
router.post('/branch-access/users/:userId', requirePermission('ORG.BRANCH.EDIT'), ctrl.addUserBranchAccess);
router.delete('/branch-access/users/:userId/:accessId', requirePermission('ORG.BRANCH.EDIT'), ctrl.removeUserBranchAccess);

router.get('/my-branches', ctrl.getUserAccessibleBranches);

// ─── Transfers ───
router.get('/transfers', requirePermission('ORG.TRANSFER.VIEW'), ctrl.listTransfers);
router.get('/transfers/:id', requirePermission('ORG.TRANSFER.VIEW'), ctrl.getTransfer);
router.post('/transfers', requirePermission('ORG.TRANSFER.EDIT'), ctrl.createTransfer);
router.post('/transfers/:id/approve', requirePermission('ORG.TRANSFER.APPROVE'), ctrl.approveTransfer);
router.post('/transfers/:id/dispatch', requirePermission('ORG.TRANSFER.EDIT'), ctrl.dispatchTransfer);
router.post('/transfers/:id/receive', requirePermission('ORG.TRANSFER.EDIT'), ctrl.receiveTransfer);
router.post('/transfers/:id/reject', requirePermission('ORG.TRANSFER.APPROVE'), ctrl.rejectTransfer);

export const organizationRoutes = router;
