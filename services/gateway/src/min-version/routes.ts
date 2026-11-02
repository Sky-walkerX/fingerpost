import type { FastifyInstance } from 'fastify';
import type { MinVersionSource } from './source.ts';

export interface ConfigDeps {
  minVersionSource: MinVersionSource;
  cloudEnabled: () => Promise<boolean>;
}

export function registerConfigRoute(app: FastifyInstance, d: ConfigDeps): void {
  app.options('/v1/config', async (_req, reply) =>
    reply
      .header('access-control-allow-origin', '*')
      .header('access-control-allow-methods', 'GET, OPTIONS')
      .header('access-control-allow-headers', 'content-type')
      .code(204)
      .send()
  );

  app.get('/v1/config', async (_req, reply) => {
    reply.header('access-control-allow-origin', '*');
    reply.header('cache-control', 'public, max-age=30');

    const minVersion = await d.minVersionSource.getMinVersion();
    const cloudEnabled = await d.cloudEnabled();
    return { minVersion, cloudEnabled };
  });
}

