import Express from 'express';
import cors from 'cors';
import { EpycApi } from './EpycApi';
import { Db } from './Db';
import path from 'path';
import expressStaticGzip from 'express-static-gzip';
import CookieParser from 'cookie-parser';
import { DiscordBot } from './DiscordBot';
import { GameManager, GameManagerProvider } from './GameManager';
import { SlackBot } from './SlackBot';
import { Logger } from './Logger';

let startDiscord = async (gameManager: GameManagerProvider): Promise<DiscordBot> => {
    Logger.log('*** Starting Discord Bot');

    let bot = new DiscordBot(gameManager);
    await bot.init();
    return bot;
};

let startSlack = async (db: Db, gameManager: GameManagerProvider): Promise<SlackBot> => {
    Logger.log('*** Starting Slack Bot');

    let bot = new SlackBot(db, gameManager);
    await bot.init();
    return bot;
};

let startDb = async () => {
    Logger.log('*** Starting Database');

    let db = Db.create();
    return db;
};

let startServer = async (
    db: Db,
    gameManagerProvider: GameManagerProvider,
    slackBot: SlackBot,
    discordBot: DiscordBot
) => {
    Logger.log('*** Starting Server');

    let corsDomains = new Set<string>(['http://epyc.phlegmatic.ca', 'https://epyc.phlegmatic.ca']);

    if (process.env.NODE_ENV === 'development') {
        corsDomains = new Set<string>(['http://localhost:8080', 'http://localhost:3001']);
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

    // Answer Slack API challenges
    // app.post('/slack/events', (req, res, next) => {
    //     if (req.body && req.body.challenge) {
    //         res.send(req.body.challenge);
    //     }
    // });

    const slackMiddleware = slackBot.requestListener;
    if (slackMiddleware) {
        app.use('/slack/events', slackMiddleware);
    }

    app.get('/slack/install', (req, res) => {
        slackBot.installOAuth(req, res);
    });

    app.get('/slack/oauth', (req, res) => {
        slackBot.handleOAuthRequest(req, res);
    });

    app.get('/discord/install', (req, res) => {
        discordBot.installOAuth(req, res);
    });

    app.use('/api', Express.json());

    app.use('/api', corsMiddleware);
    app.use(CookieParser());

    const epycApi = new EpycApi(db, gameManagerProvider);
    app.use('/api', epycApi.router);

    app.use('/api', (req, res, next) => {
        res.sendStatus(404);
    });

    app.use('/', expressStaticGzip(path.join(__dirname, 'public'), {}));

    app.get('*', (req, res) => {
        res.sendFile(__dirname + '/public/index.html');
    });

    app.listen(process.env.PORT || 3001);

    Logger.log('*** Server Started');
};

let bootup = async () => {
    try {
        let gameManagerProvider = new GameManagerProvider();

        const db = await startDb();
        const discordBot = await startDiscord(gameManagerProvider);
        const slackBot = await startSlack(db, gameManagerProvider);
        await startServer(db, gameManagerProvider, slackBot, discordBot);

        gameManagerProvider._gameManager = new GameManager(db, discordBot, slackBot);
    } catch (e) {
        Logger.exception(e, 'Error occurred on startup');
    }
};

bootup();
