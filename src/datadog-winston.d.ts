declare module 'datadog-winston' {
  import * as winston from 'winston';

  interface DatadogTransportOptions {
    apiKey: string;
    hostname?: string;
    service?: string;
    ddsource?: string;
    ddtags?: string;
    intakeRegion?: string;
    level?: string;
  }

  class DatadogTransport extends winston.transports.Http {
    constructor(options: DatadogTransportOptions);
  }

  export = DatadogTransport;
}
