import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import Stripe from 'stripe';
import { createModuleLogger } from '../../../lib/logger.js';
import { env } from '../../../lib/env.js';
import { createTemporalClient, TASK_QUEUE } from '../../../shared/workflows/index.js';
import { paymentWebhookWorkflow } from '../index.js';

const logger = createModuleLogger('payment-webhook');

const stripeClient = new Stripe(env.STRIPE_WEBHOOK_SECRET);

export function paymentWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v2/webhooks/payments', async (request: FastifyRequest, reply) => {
    const startTime = Date.now();
    const requestId = randomUUID();

    logger.info(
      {
        requestId,
        ip: request.ip,
      },
      'Received payment webhook'
    );

    try {
      const signature = request.headers['stripe-signature'];

      if (!signature) {
        logger.warn({ requestId }, 'Missing stripe-signature header');
        return reply.status(400).send({
          success: false,
          error: 'Invalid webhook signature',
        });
      }

      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
      if (!rawBody) {
        logger.error({ requestId }, 'Raw body not available');
        return reply.status(500).send({
          success: false,
          error: 'Failed to process webhook',
        });
      }

      let event: Stripe.Event;
      try {
        event = stripeClient.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        const error = err as Error;
        logger.warn(
          {
            requestId,
            error: error.message,
          },
          'Stripe signature verification failed'
        );
        return reply.status(400).send({
          success: false,
          error: 'Invalid webhook signature',
        });
      }

      if (event.type !== 'checkout.session.completed') {
        logger.info(
          {
            requestId,
            eventType: event.type,
          },
          'Event type not handled'
        );
        return reply.status(200).send({
          success: true,
          message: 'Event type not handled',
        });
      }

      const session = event.data.object;

      if (session.payment_status !== 'paid') {
        logger.info(
          {
            requestId,
            eventId: event.id,
            paymentStatus: session.payment_status,
          },
          'Payment not completed, skipping'
        );
        return reply.status(200).send({
          success: true,
          message: 'Payment not completed',
        });
      }

      const clientReferenceId = session.client_reference_id;
      if (!clientReferenceId) {
        logger.warn(
          {
            requestId,
            eventId: event.id,
          },
          'Missing client_reference_id'
        );
        return reply.status(200).send({
          success: true,
          message: 'Missing client_reference_id',
        });
      }

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? '');

      const client = await createTemporalClient();
      const workflowId = `stripe-payment-${event.id}`;

      const handle = await client.workflow.start(paymentWebhookWorkflow, {
        taskQueue: TASK_QUEUE,
        args: [
          {
            eventId: event.id,
            clientReferenceId,
            paymentIntentId,
          },
        ],
        workflowId,
      });

      logger.info(
        {
          requestId,
          eventId: event.id,
          workflowId: handle.workflowId,
          processingTimeMs: Date.now() - startTime,
        },
        'Temporal workflow started for payment webhook'
      );

      return reply.status(200).send({
        success: true,
        eventId: event.id,
      });
    } catch (err) {
      const error = err as Error;
      logger.error(
        {
          requestId,
          error: error.message,
          processingTimeMs: Date.now() - startTime,
        },
        'Failed to queue payment webhook workflow'
      );

      return reply.status(500).send({
        success: false,
        error: 'Failed to process webhook',
        requestId,
      });
    }
  });
}
