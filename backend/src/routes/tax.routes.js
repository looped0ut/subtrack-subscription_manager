import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTaxSchema, updateTaxSchema } from '../validators/catalog.validators.js';
import { listTaxes, createTax, updateTax, deleteTax } from '../controllers/tax.controller.js';

const router = Router();
const adminOnly = requireRole('ADMIN');

router.use(authenticate);

router.get('/', requireRole('ADMIN', 'STAFF'), listTaxes);
router.post('/', adminOnly, validate(createTaxSchema), createTax);
router.patch('/:id', adminOnly, validate(updateTaxSchema), updateTax);
router.delete('/:id', adminOnly, deleteTax);

export default router;