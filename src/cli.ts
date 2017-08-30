import AhgoraService, { IOptions } from './ahgora-service';

export default async function run(options: IOptions) {
  const service = new AhgoraService(options);

  await service.login();
  const data = await service.getTimes();

  if (options.verbose) {
    const msg = service.parseGrid(data.times);

    console.log(msg);
    console.log('-----');
  }

  const result = await service.parseResult(data.times);
  console.log(`\n> ${result}`);
  console.log();
  console.log();
};
