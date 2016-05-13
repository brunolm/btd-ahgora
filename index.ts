import querystring = require('querystring');
import axios = require('axios');
import cheerio = require('cheerio');
import moment = require('moment');
import commander = require('commander');

commander
  .option('-c, --company [code]', 'AHGora company code')
  .option('-u, --user [user]', 'AHGora user code')
  .option('-p, --pass [pass]', 'AHGora pass code')
  .option('-t, --tolerance [minutes]', 'Tolerance minutes', (v, def) => +v || def, 10)
  .option('-a, --lunch-at [HH:mm]', 'Lunch time', /^\d{2}:\d{2}$/, '11:30')
  .option('-l, --lunch-time [minutes]', 'Lunch minutes', (v, def) => +v || def, 60)
  .option('-w, --work-hours [hours]', 'Total work hours a day', (v, def) => +v, 8)
  .option('-s, --show-grid', 'Shows whole month grid')
  .parse(process.argv);

const options = {
  company: commander.company || process.env.AHGORA_COMPANY,
  user: commander.user || process.env.AHGORA_USER,
  pass: commander.pass || process.env.AHGORA_PASS,
  lunchAt: commander.lunchAt || process.env.AHGORA_LUNCHAT || '11:30',
  lunchTime: commander.lunchTime || +process.env.AHGORA_LUNCHTIME || 60,
  tolerance: commander.tolerance || +process.env.AHGORA_TOLERANCE || 10,
  workHours: commander.workHours || +process.env.AHGORA_WORKHOURS || 8,
  showGrid: commander.showGrid || !!process.env.AHGORA_SHOWGRID || false,
};

const clone = d => new Date(+d);

const getTime = t => {
  if (!t) {
    return undefined;
  }
  const date = new Date();
  const [ h, m ] = t.split(':');
  date.setSeconds(0);
  date.setMinutes(m);
  date.setHours(h);
  return date;
};

const url = 'https://www.ahgora.com.br';

axios.post(`${url}/externo/login`, querystring.stringify({
  empresa: options.company,
  matricula: options.user,
  senha: options.pass,
}), {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
}).then(loginData => {
  const cookie = loginData.headers['set-cookie'][0];

  axios.get(`${url}/externo/batidas`, {
    headers: {
      'Cookie': cookie.split(';')[0],
    },
  }).then(data => {
    const $ = cheerio.load(data.data as string);
    $('#tableTotalize').remove();

    let tableTimes = $('#content table').text();

    tableTimes = tableTimes.replace(/\d{2}:\d{2}~\d{2}:\d{2}/g, '');

    const matchTime = /^\s+\d{2}[:]\d{2}(, \d{2}[:]\d{2}){0,3}/gm;

    const times = tableTimes.match(matchTime).map(time => time.trim());

    if (options.showGrid) {
      console.log(times);
      console.log('--------------------------------');
    }

    const today = times[times.length - 1].split(', ');
    const t1 = getTime(today[0]);
    const t2 = getTime(today[1]);
    const t3 = getTime(today[2]);

    console.log('');
    console.log(today);

    switch (today.length) {
      case 1:
        console.log(`You can go to lunch at ${options.lunchAt}`);
        break;
      case 2:
        let backFromLunchAt = clone(t2);
        backFromLunchAt.setMinutes(backFromLunchAt.getMinutes() + options.lunchTime);
        console.log(`You can come back from lunch at ${moment(backFromLunchAt).format('HH:mm')} (±${options.tolerance})`);
        break;
      case 3:
        let section = clone(t2);
        section.setHours(t2.getHours() - t1.getHours());
        section.setMinutes(t2.getMinutes() - t1.getMinutes());
        const first = section;

        let d = new Date();
        d.setSeconds(0);
        d.setMinutes(0);
        d.setHours(options.workHours);
        d.setHours(d.getHours() - first.getHours());
        d.setMinutes(d.getMinutes() - first.getMinutes());

        section = clone(t3);
        section.setHours(t3.getHours() + d.getHours());
        section.setMinutes(t3.getMinutes() + d.getMinutes());

        const beatTheDot = section;

        console.log(`\n> You can leave at ${moment(beatTheDot).format('HH:mm')} (±${options.tolerance})`);
        break;
    }

    console.log('\n\n');
  });
});
