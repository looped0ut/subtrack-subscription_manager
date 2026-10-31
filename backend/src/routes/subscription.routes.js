import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  fromTemplateSchema,
  renewSchema,
  closeSchema,
} from '../validators/subscription.validators.js';
import * as c from '../controllers/subscription.controller.js';

const router = Router();

// Admin and staff manage subscriptions (customers use the portal routes later)
router.use(authenticate, requireRole('ADMIN', 'STAFF'));

router.get('/', c.listSubscriptions);
router.get('/:id', c.getSubscription);
router.post('/', validate(createSubscriptionSchema), c.createManual);
router.post('/from-template/:templateId', validate(fromTemplateSchema), c.createFromTemplate);
router.patch('/:id', validate(updateSubscriptionSchema), c.updateSubscription);
router.delete('/:id', c.deleteSubscription);

router.post('/:id/send-quote', c.sendQuote);
router.post('/:id/confirm', c.confirm);
router.post('/:id/activate', c.activate);
router.post('/:id/pause', c.pause);
router.post('/:id/resume', c.resume);
router.post('/:id/renew', validate(renewSchema), c.renew);
router.post('/:id/close', validate(closeSchema), c.close);

export default router;