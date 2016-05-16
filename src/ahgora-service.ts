import * as axios from 'axios';
import * as querystring from 'querystring';
import * as cheerio from 'cheerio';
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
  debug: boolean;
}

export default class AhgoraService {
  private url = 'https://www.ahgora.com.br';
  private cookie: string;

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

  public async getTimes() {
    this.debug('getTimes()');

    if (!this.cookie) {
      throw new Error('Not logged in');
    }

    const result = await axios.get(`${this.url}/externo/batidas?cache=${this.options.user}`, {
      headers: {
        'Cookie': this.cookie.split(';')[0],
      },
    });

    const $ = cheerio.load(result.data as string);
    $('#tableTotalize').remove();

    let tableTimes = $('#content table').text();
    tableTimes = tableTimes.replace(/\d{2}:\d{2}~\d{2}:\d{2}/g, '');

    const matchTime = /^\s+\d{2}[:]\d{2}(, \d{2}[:]\d{2}){0,3}/gm;
    const times = tableTimes.match(matchTime).map(time => time.trim());

    this.debug('times: ', times);

    return times;
  }

  public getToday(times: string[]) {
    this.debug('getToday()');
    const today = times[times.length - 1].split(', ');

    this.debug('Today: ', today);

    return today;
  }

  public parseResult(times: string[]) {
    this.debug('parseResult()');
    const today = this.getToday(times);
    const t1 = this.getTime(today[0]);
    const t2 = this.getTime(today[1]);
    const t3 = this.getTime(today[2]);

    switch (today.length) {
      case 1:
        this.debug('Before lunch');

        return `You can go to lunch at ${this.options.lunchAt}`;
      case 2:
        this.debug('During lunch');

        let backFromLunchAt = this.clone(t2);
        backFromLunchAt.setMinutes(backFromLunchAt.getMinutes() + this.options.lunchTime);
        return `You can come back from lunch at ${moment(backFromLunchAt).format('HH:mm')} (±${this.options.tolerance})`;
      case 3:
        this.debug('After lunch');

        let section = this.clone(t2);
        section.setHours(t2.getHours() - t1.getHours());
        section.setMinutes(t2.getMinutes() - t1.getMinutes());
        const first = section;

        let d = new Date();
        d.setSeconds(0);
        d.setMinutes(0);
        d.setHours(this.options.workHours);
        d.setHours(d.getHours() - first.getHours());
        d.setMinutes(d.getMinutes() - first.getMinutes());

        section = this.clone(t3);
        section.setHours(t3.getHours() + d.getHours());
        section.setMinutes(t3.getMinutes() + d.getMinutes());

        const beatTheDot = section;

        return `You can leave at ${moment(beatTheDot).format('HH:mm')} (±${this.options.tolerance})`;
      default:
        return 'All done for today!';
    }
  }

  private clone(d) {
    return new Date(+d);
  }

  private getTime(t: string) {
    if (!t) {
      return undefined;
    }
    const date = new Date();
    const [ h, m ] = t.split(':');
    date.setSeconds(0);
    date.setMinutes(+m);
    date.setHours(+h);
    return date;
  }

  private debug(msg?: string, ...args: any[]) {
    if (this.options.debug) {
      console.log(msg, ...args);
    }
  }
}
