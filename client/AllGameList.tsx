import * as React from 'react';
import GameList from './GameList';
import { useAsyncActionOnce } from './useAsyncAction';
import { EpycApi } from './Apis';
import { Spinner } from 'react-bootstrap';

export default function AllGameList() {
    const [isFetchingGames, games, gamesErr] = useAsyncActionOnce(() => EpycApi.getGames({}));
    return isFetchingGames ? <Spinner /> : <GameList games={games} />;
}
