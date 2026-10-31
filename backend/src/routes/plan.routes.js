import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createPlanSchema, updatePlanSchema } from '../validators/plan.validators.js';
import { listPlans, getPlan, createPlan, updatePlan, deletePlan } from '../controllers/plan.controller.js';

const router = Router();
const staffUp = requireRole('ADMIN', 'STAFF');
const adminOnly = requireRole('ADMIN');

router.use(authenticate);

router.get('/', staffUp, listPlans);
router.get('/:id', staffUp, getPlan);
router.post('/', adminOnly, validate(createPlanSchema), createPlan);
router.patch('/:id', adminOnly, validate(updatePlanSchema), updatePlan);
router.delete('/:id', adminOnly, deletePlan);

export default router;