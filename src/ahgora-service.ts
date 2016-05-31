import * as axios from 'axios';
import * as querystring from 'querystring';
import * as jquery from 'jquery';
import * as jsdom from 'jsdom';
import * as moment from 'moment';

export interface IOptions {
  company: string;
  user: string;
  pass: string;
  lunchAt: string;
  lunchTime: number;
  tolerance: number;
  workHours: number;
  showGrid: boolean;
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

  public parseHTML(html: string): Promise<{ summary: string, times: ITimes }> {
    return new Promise((resolve, reject) => {
      jsdom.env(html, (err, window) => {
        const $: JQueryStatic = <any>jquery(window);

        const summary = $('#tableTotalize').text()
          .replace(/ {2,}/g, ' ')
          .replace(/(\s?\n){2,}/g, '\n').trim();

        const timetable = $('#tableTotalize').nextAll('table:first');

        const times = {};
        timetable.find('tbody > tr').each((i, element) => {
          const key = $(element).find('td[rowspan]:first').text().trim();

          if (key) {
            const beatsRaw = $('td:eq(2)', element).text().trim();
            times[key] = {
              date: moment(key, 'DD/MM/YYYY'),
              beats: beatsRaw.length ? beatsRaw.split(/\s*,\s*/g) : [],
              beatsRaw: beatsRaw,
              total: $('td:eq(6)', element).text().trim(),
            };
            times[key].patch = {
              correct: {
                time: $('td:eq(3)', element).text().trim(),
                type: $('td:eq(4)', element).text().trim(),
                reason: $('td:eq(5)', element).text().trim(),
              },
              wrong: {
                time: '',
                type: '',
                reason: '',
              },
            };

            const nextHasInfo = $(element).next('tr').length && $(element).next('tr').find('td').length <= 3;

            if (nextHasInfo) {
              const extraInfo = $(element).next('tr');
              times[key].patch.wrong = {
                time: $('td:eq(0)', extraInfo).text().trim(),
                type: $('td:eq(1)', extraInfo).text().trim(),
                reason: $('td:eq(2)', extraInfo).text().trim(),
              };
            }
          }
        });

        return resolve({
          summary,
          times
        });
      });
    });
  }

  public async getTimes() {
    this.debug('getTimes()');

    if (!this.cookie) {
      throw new Error('Not logged in');
    }

    const breaker = this.options.forceNocache ? Math.random() : 0;
    const result = await axios.get<string>(`${this.url}/externo/batidas?cache=${this.options.user}&breaker=${breaker}`, {
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
    const today = this.getToday(times);
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

        const d = moment(`0${this.options.workHours}0000`.slice(-6), 'HHmmss');
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

  public calc(time1: string, time2: string, time3: string, time4: string) {
    const [ t1, t2, t3, t4 ] = [
      moment(time1, this.hourMinuteFormat),
      moment(time2, this.hourMinuteFormat),
      moment(time3, this.hourMinuteFormat),
      moment(time4, this.hourMinuteFormat),
    ];

    const scenarios = [];

    const day = moment(`0${this.options.workHours}00`.slice(-4), this.hourMinuteFormat);

    const morning = this.subTime(t2, t1);

    const afternoon = this.subTime(t4, t3);

    const workedHours = t4.isValid()
      ? moment(morning).add(afternoon.hour(), this.hoursUnity).add(afternoon.minute(), this.minutesUnity)
      : moment(morning);

    if (t4.isValid()) {
      if (workedHours.isAfter(moment(day).add(10, this.minutesUnity))) {
        const timeToRemove = this.subTime(workedHours, day);
        {
          // Scenario 1 - Remove from end of the day
          const newEndTime = this.subTime(t4, timeToRemove);
          scenarios.push(`${time1} ${time2} ${time3} *${newEndTime.format(this.hourMinuteFormat)}*`);
        }
      }
      else if (workedHours.isBefore(moment(day).add(-10, this.minutesUnity))) {
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
      .add(date.hour(), this.hoursUnity)
      .add(date.minute(), this.minutesUnity);
  }

  private subTime(target: moment.Moment, date: moment.Moment) {
    return moment(target)
      .add(-date.hour(), this.hoursUnity)
      .add(-date.minute(), this.minutesUnity);
  }

  private debug(msg?: string, ...args: any[]) {
    if (this.options.debug) {
      console.log(msg, ...args);
    }
  }
}
