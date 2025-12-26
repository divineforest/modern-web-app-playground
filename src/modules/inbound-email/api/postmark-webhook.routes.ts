import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { createModuleLogger } from '../../../lib/logger.js';
import { createTemporalClient, TASK_QUEUE } from '../../../shared/workflows/index.js';
import type { PostmarkWebhookPayload } from '../services/postmark-webhook-processor.js';
import { postmarkInboundEmailWorkflow } from '../workflows/postmark-inbound-email.workflow.js';

const logger = createModuleLogger('postmark-webhook');

export async function postmarkWebhookRoutes(fastify: FastifyInstance) {
  // Postmark inbound email webhook endpoint
  fastify.post('/api/v2/webhooks/postmark/inbound', async (request, reply) => {
    const startTime = Date.now();
    const requestId = randomUUID();

    logger.info(
      {
        requestId,
        messageId: (request.body as PostmarkWebhookPayload)?.MessageID,
        ip: request.ip,
      },
      'Received Postmark webhook'
    );

    try {
      // Parse request payload (no additional validation)
      const payload = request.body as PostmarkWebhookPayload;

      // Start Temporal workflow for background processing
      const client = await createTemporalClient();
      // Use MessageID as workflow ID for deduplication - prevents processing same email twice
      const workflowId = `postmark-email-${payload.MessageID}`;

      const handle = await client.workflow.start(postmarkInboundEmailWorkflow, {
        taskQueue: TASK_QUEUE,
        args: [payload],
        workflowId,
      });

      logger.info(
        {
          requestId,
          messageId: payload.MessageID,
          workflowId: handle.workflowId,
          processingTimeMs: Date.now() - startTime,
        },
        'Temporal workflow started for Postmark email'
      );

      // Return immediate success response to Postmark
      // Processing will continue in background via Temporal
      return reply.status(200).send({
        success: true,
        messageId: payload.MessageID,
        workflowId: handle.workflowId,
        message: 'Email queued for background processing',
      });
    } catch (error) {
      logger.error(
        {
          requestId,
          error: error instanceof Error ? error.message : String(error),
          processingTimeMs: Date.now() - startTime,
        },
        'Failed to queue Postmark email workflow'
      );

      // Return 500 so Postmark will retry the webhook
      return reply.status(500).send({
        success: false,
        error: 'Failed to queue email for processing',
        requestId,
      });
    }
  });
}
