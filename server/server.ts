import Express from 'express';
import cors from 'cors';
import { EpycApi } from './EpycApiImpl';
import { Configuration } from './api';
import { Db } from './Db';
import path from 'path';
import expressStaticGzip from 'express-static-gzip';
import CookieParser from 'cookie-parser';
import { DiscordBot } from './DiscordBot';
import { GameManager, GameManagerProvider } from './GameManager';

let startDiscord = async (gameManager: GameManagerProvider): Promise<DiscordBot> => {
    console.log('*** Starting Discord Bot');

    let bot = new DiscordBot(gameManager);
    await bot.init();
    return bot;
};

let startDb = async () => {
    console.log('*** Starting Database');

    let db = Db.create();
    return db;
};

let startServer = async (db: Db, gameManagerProvider: GameManagerProvider) => {
    console.log('*** Starting Server');

    let corsDomains = new Set<string>(['http://epyc.phlegmatic.ca', 'https://epyc.phlegmatic.ca']);

    if (process.env.NODE_ENV === 'development') {
        corsDomains = new Set<string>(['http://localhost:8080', 'http://localhost:3000']);
    }

    const corsMiddleware = cors({
        origin: (origin, callback) => {
            if (!origin || corsDomains.has(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Not allowed (CORS)`));
            }
        },
        credentials: true,
    });

    const app = Express();

    app.use(Express.json());

    app.use('/api', corsMiddleware);
    app.use(CookieParser());

    const cfg = new Configuration(
        async (string) => null,
        async () => ''
    );

    app.use('/api', EpycApi(db, gameManagerProvider, cfg));

    app.use('/api', (req, res, next) => {
        res.sendStatus(404);
    });

    app.use('/', expressStaticGzip(path.join(__dirname, 'public'), {}));

    app.get('*', (req, res) => {
        res.sendFile(__dirname + '/public/index.html');
    });

    app.listen(process.env.PORT || 3001);

    console.log('*** Server Started');
};

let bootup = async () => {
    try {
        let gameManagerProvider = new GameManagerProvider();

        const db = await startDb();
        const discordBot = await startDiscord(gameManagerProvider);
        await startServer(db, gameManagerProvider);

        gameManagerProvider._gameManager = new GameManager(db, discordBot);
    } catch (e) {
        console.error(`Error occurred on startup: ${e}`);
    }
};

bootup();
