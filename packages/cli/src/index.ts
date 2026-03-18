import { Command } from 'commander';
import pc from 'picocolors';
import { APP_NAME } from '@nanoyunhu/shared';

const program = new Command();

program
  .name('my-cli')
  .description(`CLI tool for ${APP_NAME}`)
  .version('1.0.0');

program
  .command('start')
  .description('Start the awesome services')
  .action(() => {
    console.log(pc.green(`[SUCCESS] Started ${APP_NAME}!`));
    console.log(pc.cyan('Here you can also spin up an Express server to serve your Svelte WebUI build files.'));
  });

program.parse();