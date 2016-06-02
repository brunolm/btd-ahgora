declare namespace commander {
  interface IExportedCommand extends ICommand {
    company: string;
    user: string;
    pass: string;
    lunchAt: string;
    lunchTime: number;
    tolerance: number;
    monthYear: string;
    workHours: string;
    showGrid: boolean;
    verbose: boolean;
    forceNocache: boolean;
    debug: boolean;
  }
}