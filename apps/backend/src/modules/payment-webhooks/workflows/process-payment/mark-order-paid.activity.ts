/**
 * Mark Order Paid Activity
 *
 * Looks up an order by order number and marks it as paid
 */
import { Context } from '@temporalio/activity';
import { createModuleLogger } from '../../../../lib/logger.js';
import type { PaymentWebhookInput } from './payment-webhook.workflow.js';
import {
  findOrderByOrderNumber,
  markOrderAsPaid,
} from '../../repositories/orders-payment.repository.js';

const logger = createModuleLogger('payment-webhook-activity');

/**
 * Mark an order as paid based on Stripe payment event
 *
 * @param input Payment webhook input
 * @returns Promise<void>
 */
export async function markOrderPaidActivity(input: PaymentWebhookInput): Promise<void> {
  const activityContext = Context.current();

  activityContext.log.info('Processing payment webhook', {
    clientReferenceId: input.clientReferenceId,
    paymentIntentId: input.paymentIntentId,
  });

  const order = await findOrderByOrderNumber(input.clientReferenceId);

  if (!order) {
    logger.warn(
      { clientReferenceId: input.clientReferenceId },
      'Order not found for payment webhook'
    );
    return;
  }

  if (order.status === 'paid') {
    activityContext.log.info('Order already paid, skipping', { orderId: order.id });
    return;
  }

  await markOrderAsPaid(order.id, input.paymentIntentId);

  activityContext.log.info('Order marked as paid', {
    orderId: order.id,
    paymentIntentId: input.paymentIntentId,
  });
}
