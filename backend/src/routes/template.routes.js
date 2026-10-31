import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTemplateSchema, updateTemplateSchema } from '../validators/plan.validators.js';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/template.controller.js';

const router = Router();

// Sales staff and admins can manage quotation templates
router.use(authenticate, requireRole('ADMIN', 'STAFF'));

router.get('/', listTemplates);
router.get('/:id', getTemplate);
router.post('/', validate(createTemplateSchema), createTemplate);
router.patch('/:id', validate(updateTemplateSchema), updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;