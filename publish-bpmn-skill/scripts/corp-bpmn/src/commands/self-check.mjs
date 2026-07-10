import { fileURLToPath } from 'node:url';
import { runSelfCheck } from '../core/self-check.mjs';

export async function selfCheckCommand() {
  const result = await runSelfCheck();
  console.log(`Self-check passed: ${result.schemas} schemas, ${result.capabilities} capabilities, ${result.requiredFiles} required files`);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  selfCheckCommand().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
