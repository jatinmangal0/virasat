import { startServer } from './test/helpers.js';
const t = await startServer();
for (const tb of ['facts', 'quiz_questions', 'timeline_events', 'greetings', 'heritage_places']) await t.db.query(`UPDATE ${tb} SET status='verified'`);
console.log('BASE', t.base);
setInterval(() => {}, 1e9);
