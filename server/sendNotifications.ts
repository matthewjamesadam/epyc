import { Db } from './Db';
import { DiscordBot } from './DiscordBot';
import { GameManager, GameManagerProvider } from './GameManager';
import { SlackBot } from './SlackBot';

const startDiscord = async (gameManager: GameManagerProvider): Promise<DiscordBot> => {
    console.log('*** Starting Discord Bot');

    let bot = new DiscordBot(gameManager);
    await bot.init();
    return bot;
};

let startSlack = async (db: Db, gameManager: GameManagerProvider): Promise<SlackBot> => {
    console.log('*** Starting Slack Bot');

    let bot = new SlackBot(db, gameManager);
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
    const slackBot = await startSlack(db, gameManagerProvider);

    gameManagerProvider._gameManager = new GameManager(db, discordBot, slackBot);

    console.log('*** Sending Notifications');
    await gameManagerProvider.gameManager.notifyPlayers();
    console.log('*** Done Sending Notifications');

    await discordBot.deinit();
    await db.deinit();
};

notify();
