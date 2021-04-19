import {
    EpycApiBase,
    Avatar,
    Context,
    HttpError,
    Person,
    Frame,
    Game,
    GetFramePlayDataParams,
    GetGameParams,
    PutFrameImageParams,
    PutFrameTitleParams,
    GetGamesParams,
} from './api';
import { ChannelModel, Db, BotTargetFromString, GameQuery } from './Db';
import { FramePlayData } from './api/models/FramePlayData';
import ImageStore from './ImageStore';
import { GameManagerProvider } from './GameManager';
import { Logger } from './Logger';

export class EpycApi extends EpycApiBase {
    constructor(private db: Db, private gameManagerProvider: GameManagerProvider) {
        super();
    }

    protected async getGames(params: GetGamesParams, context: Context): Promise<Game[]> {
        const gameQuery: GameQuery = { isComplete: true };
        if (params.channelId && params.channelService) {
            const botTarget = BotTargetFromString(params.channelService);
            if (botTarget) {
                gameQuery.channel = ChannelModel.create(params.channelId, '', botTarget);
            }
        }

        const gameModels = await this.db.getGames(gameQuery);

        // Don't return frames
        const games: Game[] = gameModels.map((game) => {
            return {
                name: game.name,
                frames: [],
                titleImage: game.titleImage?.toApi(),
            };
        });

        return games;
    }

    protected async getGame(params: GetGameParams, context: Context): Promise<Game> {
        const model = await this.db.getGame(params.gameName);
        if (!model || !model.isComplete) {
            throw new HttpError(401);
        }

        const game = model.toApi();

        // Attach Persons
        const fetchPersons = model.frames.map(async (frame, idx) => {
            const person = await this.db.getPerson(frame.personId);
            if (person) {
                game.frames[idx].person = person.toApi();
            }
        });

        await Promise.all(fetchPersons);
        return game;
    }

    private logError(error: Error) {
        Logger.exception(error, 'Error occurred in EPYC API implementation');
    }

    protected async getFramePlayData(params: GetFramePlayDataParams, context: Context): Promise<FramePlayData> {
        try {
            return await this.gameManagerProvider.gameManager.getFramePlayData(params.gameName, params.frameId);
        } catch (error) {
            this.logError(error);
            throw new HttpError(401);
        }
    }

    protected async putFrameTitle(params: PutFrameTitleParams, context: Context): Promise<void> {
        try {
            return await this.gameManagerProvider.gameManager.playTitleTurn(
                params.gameName,
                params.frameId,
                params.framePlayTitleRequest.title
            );
        } catch (error) {
            this.logError(error);
            throw new HttpError(401);
        }
    }

    protected async putFrameImage(params: PutFrameImageParams, context: Context): Promise<void> {
        try {
            return await this.gameManagerProvider.gameManager.playImageTurn(
                params.gameName,
                params.frameId,
                context.req
            );
        } catch (error) {
            this.logError(error);
            throw new HttpError(401);
        }
    }
}
