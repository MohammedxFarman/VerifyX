import { verifyUrl } from '../src/server/verification';
const result = await verifyUrl('https://example.com');
console.log(JSON.stringify(result.analysis, null, 2));
if(result.analysis.network.status !== 'completed') process.exitCode = 1;
