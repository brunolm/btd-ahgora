import * as moment from 'moment';
import * as querystring from 'querystring';

import { JSDOM } from 'jsdom';
import axios from 'axios';

export interface IOptions {
  company: string;
  user: string;
  pass: string;
  lunchAt: string;
  lunchTime: number;
  tolerance: number;
  monthYear: string;
  workHours: string;
  verbose: boolean;
  forceNocache: boolean;
  debug: boolean;
}

export interface ITimes {
  [dateStr: string]: {
    date: any;
    beats: string[];
    beatsRaw: string;
    total: string;
    patch: {
      correct: ITimePatch;
      wrong: ITimePatch;
    },
  };
}

export interface ITimePatch {
  time: string;
  type: string;
  reason: string;
}

export default class AhgoraService {
  private url = 'https://www.ahgora.com.br';
  private cookie: string;
  private hourMinuteFormat = 'HH:mm';
  private hoursUnity = 'hours';
  private minutesUnity = 'minutes';

  constructor(private options: IOptions) {
    if (!/^\d{2}:\d{2}$/.test(options.workHours)) {
      options.workHours = `${`0${options.workHours}`.slice(-2)}:00`;
    }
    this.debug('Options', options);
  }

  public async login() {
    this.debug('login()');
    const loginData = await axios.post(`${this.url}/externo/login`, querystring.stringify({
      empresa: this.options.company,
      matricula: this.options.user,
      senha: this.options.pass,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

    this.cookie = loginData.headers['set-cookie'][0];
    this.debug('Cookie: ', this.cookie);

    return this.cookie;
  }

  nextOfKind<T extends HTMLElement>(from: T, tagName: string) {
    let next = from;
    while ((next = next.nextSibling as T)) {
      if (next.nodeName === tagName) {
        return next;
      }
    }

    return undefined;
  }

  public parseHTML(html: string): Promise<{ summary: string, times: ITimes }> {
    return new Promise((resolve, reject) => {
      const dom = new JSDOM(html);
      const window = dom.window;
      const document = window.document;

      const tableTotalize = document.querySelector('#tableTotalize') as HTMLTableElement;

      const summary = tableTotalize.textContent
        .replace(/ {2,}/g, ' ')
        .replace(/(\s?\n){2,}/g, '\n').trim();

      const timetable: HTMLTableElement = this.nextOfKind(tableTotalize, 'TABLE');

      const times = {};
      const trs = timetable.querySelectorAll('tbody > tr') as NodeListOf<HTMLElement>;

      for (const element of trs) {
        const key = element.querySelector('td[rowspan]').textContent.trim();

        if (key) {
          const beatsRaw = element.querySelector('td:nth-child(3)').textContent.trim();

          times[key] = {
            date: moment(key, 'DD/MM/YYYY'),
            beats: beatsRaw.length ? beatsRaw.split(/\s*,\s*/g) : [],
            beatsRaw: beatsRaw,
            total: element.querySelector('td:nth-child(7)').textContent.trim(),
          };

          times[key].patch = {
            correct: {
              time: element.querySelector('td:nth-child(4)').textContent.trim(),
              type: element.querySelector('td:nth-child(5)').textContent.trim(),
              reason: element.querySelector('td:nth-child(6)').textContent.trim(),
            },
            wrong: {
              time: '',
              type: '',
              reason: '',
            },
          };

          const nextRow = this.nextOfKind(element, 'TR');
          const nextHasInfo = nextRow && nextRow.querySelectorAll('td').length <= 3;

          if (nextHasInfo) {
            times[key].patch.wrong = {
              time: nextRow.querySelector('td:nth-child(1)').textContent.trim(),
              type: nextRow.querySelector('td:nth-child(2)').textContent.trim(),
              reason: nextRow.querySelector('td:nth-child(3)').textContent.trim(),
            };

            if (/esquecimento/i.test(times[key].patch.wrong.reason)) {
              const wrong = times[key].patch.wrong;
              times[key].patch.wrong = times[key].patch.correct;
              times[key].patch.correct = wrong;
            }
          }
        }
      }

      return resolve({
        summary,
        times
      });
    });
  }

  public async getTimes() {
    this.debug('getTimes()');

    if (!this.cookie) {
      throw new Error('Not logged in');
    }

    const monthYear = this.options.monthYear || '';

    const breaker = this.options.forceNocache ? Math.random() : 0;
    const result = await axios.get(`${this.url}/externo/batidas/${monthYear}?cache=${this.options.user}&breaker=${breaker}`, {
      headers: {
        'Cookie': this.cookie.split(';')[0],
      },
    });

    const parsedData = await this.parseHTML(result.data);

    this.debug('times: ', parsedData.times);

    return parsedData;
  }

  public getToday(times: ITimes) {
    this.debug('getToday()');
    const today = times[moment().format('DD/MM/YYYY')];

    this.debug('Today: ', today);

    return today;
  }

  public parseResult(times: ITimes) {
    this.debug('parseResult()');
    const today = this.getToday(times) || { beats: [] };
    const t1 = moment(today.beats[0], this.hourMinuteFormat);
    const t2 = moment(today.beats[1], this.hourMinuteFormat);
    const t3 = moment(today.beats[2], this.hourMinuteFormat);

    switch (today.beats.length) {
      case 1:
        this.debug('Before lunch');

        return `You can go to lunch at ${this.options.lunchAt}`;
      case 2:
        this.debug('During lunch');

        let backFromLunchAt = moment(t2);
        backFromLunchAt.add(this.options.lunchTime, 'minutes');
        return `You can come back from lunch at ${moment(backFromLunchAt).format(this.hourMinuteFormat)} (±${this.options.tolerance})`;
      case 3:
        this.debug('After lunch');

        let section = moment(t2);
        section.add(-t1.hour(), 'hours');
        section.add(-t1.minute(), 'minutes');

        const d = moment(`${this.options.workHours}00`.slice(-6), 'HHmmss');
        d.add(-section.hour(), 'hours');
        d.add(-section.minute(), 'minutes');

        section = moment(t3);
        section.add(d.hour(), 'hours');
        section.add(d.minute(), 'minutes');

        return `You can leave at ${moment(section).format(this.hourMinuteFormat)} (±${this.options.tolerance})`;
      case 4:
        return 'All done for today!';
      default:
        return 'No beats registered today!';
    }
  }

  public parseGrid(times: ITimes) {
    return Object.keys(times).reduce((grid, next) => {
      const time = times[next];

      if (time.beatsRaw) {
        grid += `${next} - ${time.beatsRaw} (${time.total.match(/\d{2}:\d{2}/)})`;
        if (time.patch.wrong.time) {
          grid += ` (${time.patch.wrong.time} -> ${time.patch.correct.time})`;
        }
        grid += '\n';

        if (this.options.verbose) {
          const scenarios = this.calc.apply(this, time.beatsRaw.match(/\d{2}:\d{2}/g)) as string[];
          if (scenarios.length) {
            grid += '  ' + scenarios.join('\n  ');
            grid += '\n';
          }
        }
      }
      return grid;
    }, '');
  }

  public calc(time1: string, time2: string, time3: string, time4: string) {
    const [t1, t2, t3, t4] = [
      moment(time1, this.hourMinuteFormat),
      moment(time2, this.hourMinuteFormat),
      moment(time3, this.hourMinuteFormat),
      moment(time4, this.hourMinuteFormat),
    ];

    const scenarios = [];

    const day = moment(this.options.workHours, this.hourMinuteFormat);
    const morning = this.subTime(t2, t1);
    const afternoon = this.subTime(t4, t3);

    const workedHours = t4.isValid()
      ? moment(morning).add(afternoon.hour() as any, this.hoursUnity).add(afternoon.minute() as any, this.minutesUnity)
      : moment(morning);

    if (t4.isValid()) {
      if (workedHours.isAfter(moment(day).add(this.options.tolerance as any, this.minutesUnity))) {
        const timeToRemove = this.subTime(workedHours, day);
        {
          // Scenario 1 - Remove from end of the day
          const newEndTime = this.subTime(t4, timeToRemove);
          scenarios.push(`${time1} ${time2} ${time3} *${newEndTime.format(this.hourMinuteFormat)}*`);
        }
      }
      else if (workedHours.isBefore(moment(day).add(-this.options.tolerance as any, this.minutesUnity))) {
        const timeToAdd = this.subTime(day, workedHours);
        {
          // Scenario 1 - Add to the end of the day
          const newEndTime = this.addTime(t4, timeToAdd);
          scenarios.push(`${time1} ${time2} ${time3} *${newEndTime.format(this.hourMinuteFormat)}*`);
        }
      }
    }
    else if (t3.isValid()) {
      {
        // Scenario 1 - Predict end of the day
        const newEndTime = this.addTime(t3, this.subTime(day, morning));
        scenarios.push(`${time1} ${time2} ${time3} *${newEndTime.format(this.hourMinuteFormat)}*`);
      }
      {
        // Scenario 2 - Predict beginning of the day
        const section = this.subTime(t1, this.subTime(day, this.subTime(t3, t2)));
        scenarios.push(`*${section.format(this.hourMinuteFormat)}* ${time1} ${time2} ${time3}`);
      }
    }

    return scenarios;
  }

  private addTime(target: moment.Moment, date: moment.Moment) {
    return moment(target)
      .add(date.hour() as any, this.hoursUnity)
      .add(date.minute() as any, this.minutesUnity);
  }

  private subTime(target: moment.Moment, date: moment.Moment) {
    return moment(target)
      .add(-date.hour() as any, this.hoursUnity)
      .add(-date.minute() as any, this.minutesUnity);
  }

  private debug(msg?: string, ...args: any[]) {
    if (this.options.debug) {
      console.log(msg, ...args);
    }
  }
}
