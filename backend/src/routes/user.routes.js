import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createStaffSchema, updateUserSchema } from '../validators/user.validators.js';
import { listUsers, createStaff, updateUser } from '../controllers/user.controller.js';

const router = Router();

// Every route in this file is ADMIN only
router.use(authenticate, requireRole('ADMIN'));

router.get('/', listUsers);
router.post('/', validate(createStaffSchema), createStaff);
router.patch('/:id', validate(updateUserSchema), updateUser);

export default router;