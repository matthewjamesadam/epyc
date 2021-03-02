import { Db } from './Db';
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

    console.log('*** Sending Notifications');
    await gameManagerProvider.gameManager.notifyPlayers();
    console.log('*** Done Sending Notifications');

    await discordBot.deinit();
    await db.deinit();
};

notify();
