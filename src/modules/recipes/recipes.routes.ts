import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { managerOnly, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParam } from '../../shared/schemas';
import { asyncHandler as h } from '../../utils/asyncHandler';
import { badRequest } from '../../utils/httpError';
import * as c from './recipes.controller';
import { createRecipeSchema, listRecipesQuery, recipeDetailQuery, statusSchema, updateRecipeSchema, wheelQuery } from './recipes.schemas';

export const recipeRoutes = Router();

// קובץ אחד בשדה image, עד 2MB, נשמר בזיכרון ואז במסד
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 5 } });
const singleImage = (req: Request, res: Response, next: NextFunction) =>
  upload.single('image')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'התמונה גדולה מ־2MB' : 'שליחת הקובץ נכשלה. שולחים קובץ אחד בשדה image';
      return next(badRequest(msg, [{ field: 'image', message: msg }]));
    }
    next(err);
  });

// התמונה פתוחה בלי token (תגית img לא שולחת כותרות)
recipeRoutes.get('/:id/image', validate('params', idParam), h(c.getImage));

recipeRoutes.use(requireAuth);
recipeRoutes.get('/', validate('query', listRecipesQuery), h(c.list));
recipeRoutes.get('/wheel', validate('query', wheelQuery), h(c.wheel));
recipeRoutes.get('/:id', validate('params', idParam), validate('query', recipeDetailQuery), h(c.detail));
recipeRoutes.post('/', managerOnly, validate('body', createRecipeSchema), h(c.create));
recipeRoutes.put('/:id', managerOnly, validate('params', idParam), validate('body', updateRecipeSchema), h(c.update));
recipeRoutes.patch('/:id/status', managerOnly, validate('params', idParam), validate('body', statusSchema), h(c.setStatus));
recipeRoutes.post('/:id/image', managerOnly, validate('params', idParam), singleImage, h(c.uploadImage));
recipeRoutes.delete('/:id/image', managerOnly, validate('params', idParam), h(c.removeImage));
recipeRoutes.post('/:id/vote', validate('params', idParam), h(c.vote));
recipeRoutes.delete('/:id/vote', validate('params', idParam), h(c.unvote));
recipeRoutes.post('/:id/favorite', validate('params', idParam), h(c.favorite));
recipeRoutes.delete('/:id/favorite', validate('params', idParam), h(c.unfavorite));
