/**
 * {{projectName}} - {{description}}
 * Production-ready backend service
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { logger } from './logger.js';
import { healthRoutes } from './routes/health.js';

const app = Fastify({ logger });

async function main() {
    // Register plugins
    await app.register(cors, { origin: config.corsOrigin });

    await app.register(swagger, {
        openapi: {
            info: {
                title: '{{projectName}}',
                description: '{{description}}',
                version: '0.1.0',
            },
        },
    });

    await app.register(swaggerUi, {
        routePrefix: '/docs',
    });

    // Register routes
    await app.register(healthRoutes, { prefix: '/api' });

    // Start server
    try {
        await app.listen({ port: config.port, host: '0.0.0.0' });
        logger.info(`Server running at http://localhost:${config.port}`);
        logger.info(`API docs at http://localhost:${config.port}/docs`);
    } catch (err) {
        logger.error(err);
        process.exit(1);
    }
}

main();
