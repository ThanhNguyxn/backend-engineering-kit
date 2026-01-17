/**
 * Health check routes
 */

import type { FastifyPluginAsync } from 'fastify';

interface HealthResponse {
    status: 'ok' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
    app.get<{ Reply: HealthResponse }>(
        '/health',
        {
            schema: {
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
                            timestamp: { type: 'string', format: 'date-time' },
                            uptime: { type: 'number' },
                            version: { type: 'string' },
                        },
                    },
                },
            },
        },
        async () => {
            return {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '0.1.0',
            };
        }
    );

    app.get('/ready', async () => {
        // Add readiness checks here (database, cache, etc.)
        return { ready: true };
    });

    app.get('/live', async () => {
        return { alive: true };
    });
};
