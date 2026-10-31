import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
} from '../validators/catalog.validators.js';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  productPrice,
  createVariant,
} from '../controllers/product.controller.js';

const router = Router();
const staffUp = requireRole('ADMIN', 'STAFF');
const adminOnly = requireRole('ADMIN');

router.use(authenticate);

router.get('/', staffUp, listProducts);
router.get('/:id', staffUp, getProduct);
router.get('/:id/price', staffUp, productPrice);

router.post('/', adminOnly, validate(createProductSchema), createProduct);
router.patch('/:id', adminOnly, validate(updateProductSchema), updateProduct);
router.delete('/:id', adminOnly, deleteProduct);
router.post('/:id/variants', adminOnly, validate(createVariantSchema), createVariant);

export default router;