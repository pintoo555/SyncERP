import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as hrmsController from './hrms.controller';

const router = Router();
router.use(requireAuth);

router.get('/departments', hrmsController.listDepartments);
router.get('/designations', hrmsController.listDesignations);

// Department and Designation CRUD moved to /api/organization/departments and /api/organization/designations

router.get('/org/teams', requirePermission('HRMS.VIEW'), hrmsController.listOrgTeams);
router.get('/org/teams/:id', requirePermission('HRMS.VIEW'), hrmsController.getOrgTeam);
router.post('/org/teams', requirePermission('HRMS.EDIT'), hrmsController.createOrgTeam);
router.put('/org/teams/:id', requirePermission('HRMS.EDIT'), hrmsController.updateOrgTeam);
router.delete('/org/teams/:id', requirePermission('HRMS.EDIT'), hrmsController.deleteOrgTeam);
router.get('/org/teams/:id/members', requirePermission('HRMS.VIEW'), hrmsController.listOrgTeamMembers);
router.post('/org/teams/:id/members', requirePermission('HRMS.EDIT'), hrmsController.addOrgTeamMember);

router.post('/org/employees/:userId/move-team', requirePermission('HRMS.EDIT'), hrmsController.moveUserToTeam);
router.get('/org/tree', requirePermission('HRMS.VIEW'), hrmsController.getOrgTree);
router.get('/org/unassigned-users', requirePermission('HRMS.VIEW'), hrmsController.listUnassignedUsers);

router.post('/org/employees/:userId/promotion', requirePermission('HRMS.EDIT'), hrmsController.recordPromotion);
router.get('/org/employees/:userId/promotion-history', hrmsController.listPromotionHistory);

router.get('/employees', requirePermission('HRMS.VIEW'), hrmsController.listEmployees);
router.get('/employees/:userId', hrmsController.getEmployee);
router.put('/employees/:userId/profile', hrmsController.updateProfile);

router.post('/employees/:userId/family', hrmsController.addFamilyMember);
router.put('/employees/:userId/family/:id', hrmsController.updateFamilyMember);
router.delete('/employees/:userId/family/:id', hrmsController.deleteFamilyMember);

router.put('/employees/:userId/bank', hrmsController.upsertBank);

router.get('/employees/:userId/contact-numbers', hrmsController.listContactNumbers);
router.post('/employees/:userId/contact-numbers', requirePermission('HRMS.EDIT'), hrmsController.addContactNumber);
router.put('/employees/:userId/contact-numbers/:id', requirePermission('HRMS.EDIT'), hrmsController.updateContactNumber);
router.delete('/employees/:userId/contact-numbers/:id', requirePermission('HRMS.EDIT'), hrmsController.deleteContactNumber);

router.post('/employees/:userId/whatsapp/send-otp', hrmsController.sendWhatsAppOtpForEmployee);
router.post('/employees/:userId/whatsapp/verify-otp', hrmsController.verifyWhatsAppOtpForEmployee);
router.delete('/employees/:userId/whatsapp', hrmsController.clearWhatsAppNumberForEmployee);
router.post('/employees/:userId/whatsapp/send-test', hrmsController.sendWhatsAppTestForEmployee);

router.post('/whatsapp/send-otp', hrmsController.sendWhatsAppOtp);
router.post('/whatsapp/verify-otp', hrmsController.verifyWhatsAppOtp);
router.delete('/whatsapp', hrmsController.clearWhatsAppNumber);

router.get('/users/search', requirePermission('HRMS.VIEW'), hrmsController.listUsersForSearch);
router.get('/users/activity', requirePermission('HRMS.VIEW'), hrmsController.getUserActivity);

export const hrmsRoutes = router;
