import { assert } from 'chai';
import AhgoraService from '../ahgora-service';

let ahgoraService: AhgoraService;

describe('calc', () => {
  before(() => {
    this.options = {
      company: process.env.AHGORA_COMPANY,
      user: process.env.AHGORA_USER,
      pass: process.env.AHGORA_PASS,
      lunchAt: process.env.AHGORA_LUNCHAT || '11:30',
      lunchTime: +process.env.AHGORA_LUNCHTIME || 60,
      tolerance: +process.env.AHGORA_TOLERANCE || 10,
      workHours: +process.env.AHGORA_WORKHOURS || 8,
      showGrid: !!process.env.AHGORA_SHOWGRID || false,
      forceNocache: false,
      debug: false,
    };

    ahgoraService = new AhgoraService(this.options);
  });

  it('should suggest end time in case of overtime', () => {
    const result = ahgoraService.calc.apply(ahgoraService, [ '07:30', '11:30', '12:30', '16:41' ]);
    assert.include(result, '07:30 11:30 12:30 *16:30*');
  });

  it('should suggest end time in case of undertime', () => {
    const result = ahgoraService.calc.apply(ahgoraService, [ '07:30', '11:30', '12:30', '16:19' ]);
    assert.include(result, '07:30 11:30 12:30 *16:30*');
  });

  it('should suggest end time in case of a miss', () => {
    const result = ahgoraService.calc.apply(ahgoraService, [ '07:30', '11:30', '12:30' ]);
    assert.include(result, '07:30 11:30 12:30 *16:30*');
  });

  it('should suggest start time in case of a miss', () => {
    const result = ahgoraService.calc.apply(ahgoraService, [ '11:30', '12:30', '16:30' ]);
    assert.include(result, '*07:30* 11:30 12:30 16:30');
  });
});
