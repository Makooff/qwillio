import { ContractService } from '../src/services/contract.service.js';
import * as fs from 'fs';
import * as path from 'path';

const dir = path.join('C:', 'Users', 'matpo', 'Documents', 'Pulse', 'contracts-demo');
fs.mkdirSync(dir, { recursive: true });

const cs = new ContractService();

const contracts = [
  { clientName: 'Dr. Sophie Martin', clientEmail: 'sophie.martin@example.com', clientBusinessName: 'Cabinet Dentaire Martin', planType: 'starter' as const, monthlyFee: 497, setupFee: 0, trialEndDate: '2026-04-14', ipAddress: '82.66.x.x', userAgent: 'Demo' },
  { clientName: 'Jean-Pierre Dubois', clientEmail: 'jp.dubois@example.com', clientBusinessName: 'Dubois Immobilier', planType: 'pro' as const, monthlyFee: 1297, setupFee: 0, trialEndDate: '2026-04-10', ipAddress: '91.168.x.x', userAgent: 'Demo' },
  { clientName: 'Marie Leclerc', clientEmail: 'marie.leclerc@example.com', clientBusinessName: 'Leclerc Assurances', planType: 'enterprise' as const, monthlyFee: 2497, setupFee: 0, trialEndDate: '2026-04-01', ipAddress: '176.x.x.x', userAgent: 'Demo' },
];

async function main() {
  for (const c of contracts) {
    const pdf = await cs.generateContract(c);
    const name = c.planType + '-contract.pdf';
    fs.writeFileSync(path.join(dir, name), pdf);
    console.log(`Generated: ${name} (${pdf.length} bytes)`);
  }
  console.log(`\nAll 3 PDFs saved to: ${dir}`);
}

main().catch(console.error);
