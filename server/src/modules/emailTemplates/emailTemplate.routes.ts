import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as ctrl from './emailTemplate.controller';

const router = Router();
router.use(requireAuth);

router.get('/categories', requirePermission('EMAIL_TEMPLATE.VIEW'), ctrl.listCategories);
router.post('/ai/generate', requirePermission('EMAIL_TEMPLATE.AI'), ctrl.aiGenerate);
router.post('/ai/improve', requirePermission('EMAIL_TEMPLATE.AI'), ctrl.aiImprove);
router.post('/ai/suggest-subjects', requirePermission('EMAIL_TEMPLATE.AI'), ctrl.aiSuggestSubjects);

router.get('/', requirePermission('EMAIL_TEMPLATE.VIEW'), ctrl.listTemplates);
router.post('/', requirePermission('EMAIL_TEMPLATE.CREATE'), ctrl.createTemplate);
router.get('/:id', requirePermission('EMAIL_TEMPLATE.VIEW'), ctrl.getTemplate);
router.put('/:id', requirePermission('EMAIL_TEMPLATE.EDIT'), ctrl.updateTemplate);
router.delete('/:id', requirePermission('EMAIL_TEMPLATE.DELETE'), ctrl.deleteTemplate);
router.post('/:id/duplicate', requirePermission('EMAIL_TEMPLATE.CREATE'), ctrl.duplicateTemplate);

export { router as emailTemplateRoutes };
