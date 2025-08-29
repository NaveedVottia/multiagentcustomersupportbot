// Offline playground to test agents without starting the HTTP server
// Usage: node scripts/playground.mjs

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Import compiled Mastra instance (does not start Express server)
  const mastraModule = await import('file:///home/ec2-user/sanden-repair-system/dist/mastra/index.js');
  const mastra = await mastraModule.mastra;
  const agent = mastra.getAgentById('repair-workflow-orchestrator');

  console.log('--- Playground: Orchestrator main menu ---');
  const res1 = await agent.generate([{ role: 'user', content: '修理' }]);
  console.log(res1.text);

  console.log('\n--- Select 1 (start repair workflow) ---');
  const res2 = await agent.generate([
    { role: 'user', content: '修理' },
    { role: 'assistant', content: res1.text },
    { role: 'user', content: '1' },
  ]);
  console.log(res2.text);
}

main().catch((err) => {
  console.error('Playground error:', err);
  process.exit(1);
});


