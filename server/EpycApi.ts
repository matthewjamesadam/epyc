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
} from './api';
import { Db, FrameModel, GameModel } from './Db';
import { FramePlayData } from './api/models/FramePlayData';
import ImageStore from './ImageStore';
import { GameManagerProvider } from './GameManager';

export class EpycApi extends EpycApiBase {
    constructor(private db: Db, private gameManagerProvider: GameManagerProvider) {
        super();
    }

    async getGames(context: Context): Promise<Array<Game>> {
        const gameModels = await this.db.getGames({ isComplete: true });

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

    async getGame(params: GetGameParams, context: Context): Promise<Game> {
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
        console.log(`Caught error: ${error}`);
        if (error.stack) {
            console.log(error.stack);
        }
    }

    async getFramePlayData(params: GetFramePlayDataParams, context: Context): Promise<FramePlayData> {
        try {
            return await this.gameManagerProvider.gameManager.getFramePlayData(params.gameName, params.frameId);
        } catch (error) {
            this.logError(error);
            throw new HttpError(401);
        }
    }

    async putFrameTitle(params: PutFrameTitleParams, context: Context): Promise<void> {
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

    async putFrameImage(params: PutFrameImageParams, context: Context): Promise<void> {
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
