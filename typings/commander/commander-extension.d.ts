declare namespace commander {
  interface IExportedCommand extends ICommand {
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
}