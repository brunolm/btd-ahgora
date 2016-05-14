import AhgoraService, { IOptions } from './ahgora-service';

export default async function run(options: IOptions) {
  const service = new AhgoraService(options);

  await service.login();
  const times = await service.getTimes();

  if (options.showGrid) {
    console.log(times);
    console.log('-----');
  }

  const result = await service.parseResult(times);
  console.log(`\n> ${result}`);
  console.log();
  console.log();
};
