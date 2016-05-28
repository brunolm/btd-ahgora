import AhgoraService, { IOptions } from './ahgora-service';

export default async function run(options: IOptions) {
  const service = new AhgoraService(options);

  await service.login();
  const data = await service.getTimes();

  if (options.showGrid) {
    const msg = Object.keys(data.times).reduce((grid, next) => {
      const time = data.times[next];
      if (time.beatsRaw) {
        grid += `${next} - ${time.beatsRaw}`;
        if (time.patch.wrong.time) {
          grid += ` (${time.patch.wrong.time} -> ${time.patch.correct.time})`;
        }
        grid += '\n';
      }
      return grid;
    }, '');
    console.log(msg);
    console.log('-----');
  }

  const result = await service.parseResult(data.times);
  console.log(`\n> ${result}`);
  console.log();
  console.log();
};
