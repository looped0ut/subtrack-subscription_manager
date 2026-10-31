import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  updateVariantSchema,
  createOptionSchema,
  updateOptionSchema,
} from '../validators/catalog.validators.js';
import {
  updateVariant,
  deleteVariant,
  createOption,
  updateOption,
  deleteOption,
} from '../controllers/product.controller.js';

const router = Router();

// All variant changes are ADMIN only
router.use(authenticate, requireRole('ADMIN'));

router.patch('/:id', validate(updateVariantSchema), updateVariant);
router.delete('/:id', deleteVariant);
router.post('/:id/options', validate(createOptionSchema), createOption);
router.patch('/:id/options/:optionId', validate(updateOptionSchema), updateOption);
router.delete('/:id/options/:optionId', deleteOption);

export default router;