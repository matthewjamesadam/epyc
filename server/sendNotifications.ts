import Express from 'express';
import cors from 'cors';
import { EpycApi } from './EpycApiImpl';
import { Configuration } from './api';
import { Db, GameModel } from './Db';
import path from 'path';
import expressStaticGzip from 'express-static-gzip';
import CookieParser from 'cookie-parser';
import { DiscordBot } from './DiscordBot';
import { GameManager, GameManagerProvider } from './GameManager';

const startDiscord = async (gameManager: GameManagerProvider): Promise<DiscordBot> => {
    console.log('*** Starting Discord Bot');

    let bot = new DiscordBot(gameManager);
    await bot.init();
    return bot;
};

const startDb = async () => {
    console.log('*** Starting Database');

    let db = Db.create();
    return db;
};

const notify = async () => {
    const gameManagerProvider = new GameManagerProvider();

    const db = await startDb();
    const discordBot = await startDiscord(gameManagerProvider);

    gameManagerProvider._gameManager = new GameManager(db, discordBot);

    await gameManagerProvider.gameManager.notifyPlayers();
};

notify();
