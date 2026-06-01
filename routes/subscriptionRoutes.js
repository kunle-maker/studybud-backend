import { Router } from 'express';
import {
  getPaymentDetails,
  submitReceipt,
  getSubscription
} from '../controllers/subscriptionController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = Router();

router.use(protect);
router.get('/payment-details', getPaymentDetails);
router.post('/submit-receipt', upload.single('receipt'), submitReceipt);
router.get('/status', getSubscription);

export default router;
