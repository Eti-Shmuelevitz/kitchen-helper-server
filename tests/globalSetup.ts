import { execSync } from 'node:child_process';

// לפני כל הבדיקות: מסד הבדיקות נמחק, המיגרציות רצות מחדש ונתוני ההדגמה נטענים
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/kitchen_test?schema=public';
  execSync('npx prisma migrate reset --force --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' },
  });
}
