import { EpycApi, Configuration, ConfigurationParameters, FetchParams, RequestContext } from './api';

let cfgParams: ConfigurationParameters = {};

declare var BUILD_CONFIG: {
    API_BASE?: string;
};

const buildCfg = BUILD_CONFIG;

cfgParams.basePath = buildCfg.API_BASE;

cfgParams.middleware = [
    {
        pre: async (context: RequestContext): Promise<FetchParams | void> => {
            let init = context.init;
            init.credentials = 'include';
            return {
                url: context.url,
                init,
            };
        },
    },
];

let cfg = new Configuration(cfgParams);
export { cfg as Configuration };

let epycApi = new EpycApi(cfg);

export { epycApi as EpycApi };
export * from './api/models';
