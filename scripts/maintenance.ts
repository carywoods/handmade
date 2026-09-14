import 'dotenv/config';
import {
  runDailyAddition,
  runWeeklyMaintenanceScan,
  generateWeeklyLog,
  checkAndRunScheduledMaintenance,
  getIsoWeekInfo,
} from '../src/lib/maintenance.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--check';

  console.log(`\n======================================================`);
  console.log(` itsmadebyhand.com Maintenance Worker CLI`);
  console.log(` Command: ${command}`);
  console.log(`======================================================\n`);

  if (command === '--daily') {
    const count = parseInt(args[1] || '0', 10) || undefined;
    const result = await runDailyAddition(count);
    console.log('\n[SUCCESS] Daily addition completed:');
    console.log(`- Items added: ${result.added.length}`);
    console.log(`- Total catalog size: ${result.totalCatalogSize}`);
    console.log(`- Weekly log updated for ${result.weekId}`);
  } else if (command === '--weekly') {
    const result = await runWeeklyMaintenanceScan();
    console.log('\n[SUCCESS] Weekly link-rot scan completed:');
    console.log(`- Checked items: ${result.checkedCount}`);
    console.log(`- Verified active: ${result.okCount}`);
    console.log(`- Deactivated: ${result.deadCount}`);
    console.log(`- Weekly log finalized for ${result.weekId}`);
  } else if (command === '--log') {
    const weekId = args[1] || getIsoWeekInfo().weekId;
    const result = generateWeeklyLog(weekId);
    console.log(`\n--- Single Weekly Log (${weekId}) ---\n`);
    console.log(result.content);
    console.log(`\nSaved to: ${result.filePath}`);
  } else if (command === '--check' || command === '--run') {
    const result = await checkAndRunScheduledMaintenance();
    console.log('\n[SCHEDULE CHECK FINISHED]');
    console.log(`- Daily addition executed: ${result.dailyRan ? 'YES' : 'NO (already completed today)'}`);
    console.log(`- Weekly scan executed: ${result.weeklyRan ? 'YES' : 'NO (not due)'}`);
    console.log(`- Current week: ${result.currentWeekId}`);
  } else {
    console.log('Available options:');
    console.log('  --daily [count]   Add 2 to 4 verified handmade items');
    console.log('  --weekly          Execute weekly link-rot scan');
    console.log('  --check           Run autonomous schedule evaluation');
    console.log('  --log [week-id]   Display and regenerate weekly log');
  }
}

main().catch((err) => {
  console.error('\n[FATAL ERROR in maintenance worker]:', err);
  process.exit(1);
});
