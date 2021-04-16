import { Db } from './Db';
import { DiscordBot } from './DiscordBot';
import { GameManager, GameManagerProvider } from './GameManager';
import { Logger } from './Logger';
import { SlackBot } from './SlackBot';

const startDiscord = async (gameManager: GameManagerProvider): Promise<DiscordBot> => {
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

const startDb = async () => {
    Logger.log('*** Starting Database');

    let db = Db.create();
    return db;
};

const notify = async () => {
    const gameManagerProvider = new GameManagerProvider();

    const db = await startDb();
    const discordBot = await startDiscord(gameManagerProvider);
    const slackBot = await startSlack(db, gameManagerProvider);

    gameManagerProvider._gameManager = new GameManager(db, discordBot, slackBot);

    Logger.log('*** Sending Notifications');
    await gameManagerProvider.gameManager.notifyPlayers();
    Logger.log('*** Done Sending Notifications');

    await discordBot.deinit();
    await db.deinit();
};

notify();
