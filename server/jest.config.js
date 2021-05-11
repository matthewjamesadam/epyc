module.exports = {
    testMatch: ['**/?(*.)+(spec|test).+(ts|tsx|js)'],
    testPathIgnorePatterns: ['/node_modules/', '/.build'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
};
