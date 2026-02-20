/**
 * Client module route definitions (with dashboard).
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as ctrl from './clients.controller';

/* ─── Client routes ─── */
const clientRouter = Router();
clientRouter.use(requireAuth);

// List & Create
clientRouter.get('/', requirePermission('CLIENT.VIEW'), ctrl.listClients);
clientRouter.post('/', requirePermission('CLIENT.CREATE'), ctrl.createClient);

// Dashboard (must be above /:id to avoid route conflict)
clientRouter.get('/dashboard', requirePermission('CLIENT.VIEW'), ctrl.getDashboard);
clientRouter.get('/india-geojson', requirePermission('CLIENT.VIEW'), ctrl.getIndiaGeoJson);

// GST Verification (must be above /:id to avoid route conflict)
clientRouter.post('/verify-gst', requirePermission('CLIENT.CREATE'), ctrl.verifyGst);

// Client 360 (must be above /:id to avoid route conflict)
clientRouter.get('/360/by-client/:id', requirePermission('CLIENT.360.VIEW'), ctrl.get360ByClient);
clientRouter.get('/360/by-group/:groupId', requirePermission('CLIENT.360.VIEW'), ctrl.get360ByGroup);

// Groups (must be above /:id to avoid route conflict)
clientRouter.get('/groups', requirePermission('CLIENT.GROUP.VIEW'), ctrl.listGroups);
clientRouter.post('/groups', requirePermission('CLIENT.GROUP.EDIT'), ctrl.createGroup);
clientRouter.get('/groups/:groupId', requirePermission('CLIENT.GROUP.VIEW'), ctrl.getGroup);
clientRouter.post('/groups/:groupId/members', requirePermission('CLIENT.GROUP.EDIT'), ctrl.addGroupMember);
clientRouter.patch('/groups/:groupId/members/:memberId/status', requirePermission('CLIENT.GROUP.EDIT'), ctrl.toggleMemberStatus);

// Single client operations
clientRouter.get('/:id', requirePermission('CLIENT.VIEW'), ctrl.getClient);
clientRouter.put('/:id', requirePermission('CLIENT.EDIT'), ctrl.updateClient);
clientRouter.patch('/:id/status', requirePermission('CLIENT.EDIT'), ctrl.patchClientStatus);
clientRouter.post('/:id/merge', requirePermission('CLIENT.MERGE'), ctrl.mergeClient);
clientRouter.post('/:id/link', requirePermission('CLIENT.EDIT'), ctrl.linkClient);
clientRouter.get('/:id/aliases', requirePermission('CLIENT.VIEW'), ctrl.getAliases);

// Addresses
clientRouter.get('/:id/addresses', requirePermission('CLIENT.VIEW'), ctrl.listAddresses);
clientRouter.post('/:id/addresses', requirePermission('CLIENT.EDIT'), ctrl.createAddress);
clientRouter.put('/:id/addresses/:addrId', requirePermission('CLIENT.EDIT'), ctrl.updateAddress);
clientRouter.patch('/:id/addresses/:addrId/status', requirePermission('CLIENT.EDIT'), ctrl.toggleAddressStatus);

// Contacts
clientRouter.get('/:id/contacts', requirePermission('CLIENT.VIEW'), ctrl.listContacts);
clientRouter.post('/:id/contacts', requirePermission('CLIENT.EDIT'), ctrl.createContact);
clientRouter.put('/:id/contacts/:contactId', requirePermission('CLIENT.EDIT'), ctrl.updateContact);
clientRouter.post('/:id/contacts/:contactId/deactivate', requirePermission('CLIENT.EDIT'), ctrl.deactivateContact);
clientRouter.post('/:id/contacts/:contactId/verify-whatsapp', requirePermission('CLIENT.EDIT'), ctrl.verifyWhatsAppContact);
clientRouter.get('/:id/contacts/suggest-replacement/:contactId', requirePermission('CLIENT.VIEW'), ctrl.suggestReplacement);

// Contact Remarks
clientRouter.get('/:id/contacts/:contactId/remarks', requirePermission('CLIENT.VIEW'), ctrl.listContactRemarks);
clientRouter.post('/:id/contacts/:contactId/remarks', requirePermission('CLIENT.EDIT'), ctrl.createContactRemark);
clientRouter.delete('/:id/contacts/:contactId/remarks/:remarkId', requirePermission('CLIENT.EDIT'), ctrl.deleteContactRemark);

/* ─── Industry routes ─── */
const industryRouter = Router();
industryRouter.use(requireAuth);

industryRouter.get('/', requirePermission('CLIENT.INDUSTRY.VIEW'), ctrl.listIndustries);
industryRouter.post('/', requirePermission('CLIENT.INDUSTRY.EDIT'), ctrl.createIndustry);
industryRouter.put('/:id', requirePermission('CLIENT.INDUSTRY.EDIT'), ctrl.updateIndustry);
industryRouter.patch('/:id/status', requirePermission('CLIENT.INDUSTRY.EDIT'), ctrl.toggleIndustryStatus);

export { clientRouter as clientRoutes, industryRouter as industryRoutes };
