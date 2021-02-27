import {
    EpycApi as EpycApiInterface,
    EpycApiRouter,
    Avatar,
    Context,
    Configuration,
    HttpError,
    Person,
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

class EpycApiImpl implements EpycApiInterface {
    constructor(private db: Db, private gameManagerProvider: GameManagerProvider) {}

    async getGames(context: Context): Promise<Array<Game>> {
        const gameModels = await this.db.getGames();
        return gameModels.filter((model) => model.isComplete).map((model) => model.toApi());
    }

    async getGame(params: GetGameParams, context: Context): Promise<Game> {
        const model = await this.db.getGame(params.gameName);
        if (!model || !model.isComplete) {
            throw new HttpError(401);
        }

        const game = model.toApi();

        // Attach avatars
        const fetchAvatars = model.frames.map(async (frame, idx) => {
            const avatar = await this.db.getAvatar(frame.person.id, frame.person.target);
            game.frames[idx].person.avatar = avatar?.toApi();
        });

        await Promise.all(fetchAvatars);

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

export const EpycApi = (db: Db, gameManagerProvider: GameManagerProvider, cfg: Configuration) => {
    return new EpycApiRouter(new EpycApiImpl(db, gameManagerProvider), cfg).router;
};
