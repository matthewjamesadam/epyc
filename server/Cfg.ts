interface Configuration {
    isProduction: boolean;

    baseWebPath: string;

    dbName: string;
    imageStoreAwsBucket: string;

    corsDomains: string[];
}

/* Debug dev against dev data sources */
const devConfiguration: Configuration = {
    isProduction: false,

    baseWebPath: 'http://localhost:8080',

    dbName: 'EpycDev',
    imageStoreAwsBucket: 'epyc-dev-images',

    corsDomains: ['http://localhost:8080', 'http://localhost:3000'],
};

/* Debug dev against prod data sources */
const devAgainstProdConfiguration: Configuration = {
    isProduction: false,

    baseWebPath: 'http://localhost:8080',

    dbName: 'Epyc',
    imageStoreAwsBucket: 'epyc-images',

    corsDomains: ['http://localhost:8080', 'http://localhost:3000'],
};

/* Prod data sources */
const prodConfiguration: Configuration = {
    isProduction: true,

    baseWebPath: 'https://epyc.phlegmatic.ca',

    dbName: 'Epyc',
    imageStoreAwsBucket: 'epyc-images',

    corsDomains: ['http://epyc.phlegmatic.ca', 'https://epyc.phlegmatic.ca'],
};

let cfg = prodConfiguration; // default

const buildType = process.env['BUILD_TYPE'];

switch (buildType) {
    case 'DEV':
        cfg = devConfiguration;
        break;

    case 'DEV-AGAINST-PROD':
        cfg = devAgainstProdConfiguration;
        break;
}

const Cfg = cfg;
export default Cfg;
