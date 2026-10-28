import { writeFileSync, mkdirSync } from 'node:fs';
import { buildOpenApi } from '../src/docs/openapi';

// יוצר את docs/openapi.json מתוך אותו תיעוד שמוצג ב־/api-docs
mkdirSync('docs', { recursive: true });
writeFileSync('docs/openapi.json', JSON.stringify(buildOpenApi(), null, 2));
// eslint-disable-next-line no-console
console.log('docs/openapi.json נוצר');
