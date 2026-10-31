import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
} from '../validators/customer.validators.js';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller.js';

const router = Router();

// Admin and staff only (customers use the portal routes we build later)
router.use(authenticate, requireRole('ADMIN', 'STAFF'));

router.get('/', listCustomers);
router.get('/:id', getCustomer);
router.post('/', validate(createCustomerSchema), createCustomer);
router.patch('/:id', validate(updateCustomerSchema), updateCustomer);
router.delete('/:id', requireRole('ADMIN'), deleteCustomer); // admin only

export default router;