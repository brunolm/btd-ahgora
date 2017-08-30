#!/usr/bin/env node

import * as commander from 'commander';

import { IOptions } from './ahgora-service';
import run from './cli';

commander
  .option('-c, --company [code]', 'AHGora company code')
  .option('-u, --user [user]', 'AHGora user code')
  .option('-p, --pass [pass]', 'AHGora pass code')
  .option('-t, --tolerance [minutes]', 'Tolerance minutes', (v, def) => +v || def, 10)
  .option('-a, --lunch-at [HH:mm]', 'Lunch time', /^\d{2}:\d{2}$/, '11:30')
  .option('-l, --lunch-time [minutes]', 'Lunch minutes', (v, def) => +v || def, 60)
  .option('-w, --work-hours [hours]', 'Total work hours a day')
  .option('-m, --month-year [mm-yyyy]', 'Month and year to fetch (MM-YYYY format)')
  .option('-v, --verbose', 'Calculates and predicts times')
  .option('-f, --force-nocache', 'Try to force no-cache')
  .option('-d, --debug', 'Show debug information')
  .parse(process.argv);

const options: IOptions = {
  company: commander.company || process.env.AHGORA_COMPANY,
  user: commander.user || process.env.AHGORA_USER,
  pass: commander.pass || process.env.AHGORA_PASS,
  lunchAt: commander.lunchAt || process.env.AHGORA_LUNCHAT || '11:30',
  lunchTime: commander.lunchTime || +process.env.AHGORA_LUNCHTIME || 60,
  tolerance: commander.tolerance || +process.env.AHGORA_TOLERANCE || 10,
  monthYear: commander.monthYear,
  workHours: commander.workHours || process.env.AHGORA_WORKHOURS || '08:00',
  verbose: commander.verbose || !!process.env.AHGORA_VERBOSE || false,
  forceNocache: !!commander.forceNocache,
  debug: !!commander.debug,
};

const nameof = exp => exp.toString().match(/[.](\w+)/)[1];

const check = exp => {
  const field = nameof(exp);

  if (!options[field]) {
    console.error(`Missing ${field}`);
    process.exit(-1);
  }
};

check(() => options.company);
check(() => options.user);
check(() => options.pass);

run(options);
