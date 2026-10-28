import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, env } from './config/env';
import { prisma } from './db/prisma';
import { buildOpenApi } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';
import { shabbatGuard } from './middleware/shabbatGuard';
import { asyncHandler } from './utils/asyncHandler';
import './shared/zodHebrew';
import { authRoutes } from './modules/auth/auth.routes';
import { calendarRoutes } from './modules/calendar/calendar.routes';
import { householdRoutes } from './modules/household/household.routes';
import { ingredientRoutes } from './modules/ingredients/ingredients.routes';
import { menuRoutes } from './modules/menu/menu.routes';
import { notificationRoutes } from './modules/notifications/notifications.routes';
import { pantryRoutes } from './modules/pantry/pantry.routes';
import { recipeRoutes } from './modules/recipes/recipes.routes';
import { shoppingRoutes } from './modules/shopping/shopping.routes';
import { taskRoutes, templateRoutes } from './modules/tasks/tasks.routes';
import { todayRoutes } from './modules/today/today.routes';

export function createApp(options: { now?: () => Date } = {}) {
  const app = express();
  app.set('trust proxy', 1);

  // Swagger UI צריך סקריפטים משלו, ולכן CSP מוגדר בהתאם. אין פנייה לשום אתר חיצוני.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // כדי שתמונות המתכונים יוצגו באתר בריאקט
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        // בקשות בלי origin (Swagger מאותו שרת, curl) מותרות
        if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
    }),
  );
  app.use(express.json({ limit: '200kb' }));

  // השלב הראשון: האתר סגור בשבת ובחג (חוץ מ־/api/health)
  app.use('/api', shabbatGuard(options.now));

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'ok', time: new Date().toISOString() });
    }),
  );

  const openapi = buildOpenApi();
  app.get('/api-docs.json', (_req, res) => {
    res.json(openapi);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'מה מבשלים היום? API' }));

  app.use('/api', rateLimit(env.NODE_ENV === 'test' ? 100_000 : 100));
  app.use('/api/auth', authRoutes);
  app.use('/api/today', todayRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/household', householdRoutes);
  app.use('/api/ingredients', ingredientRoutes);
  app.use('/api/pantry', pantryRoutes);
  app.use('/api/recipes', recipeRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/shopping', shoppingRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/task-templates', templateRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
