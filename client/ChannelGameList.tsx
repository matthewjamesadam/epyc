import * as React from 'react';
import GameList from './GameList';
import { useAsyncActionOnce } from './useAsyncAction';
import { EpycApi } from './Apis';
import { Container, Spinner } from 'react-bootstrap';

export default function AllGameList(props: { channelId: string; channelTarget: string }) {
    const [isFetchingGames, games, gamesErr] = useAsyncActionOnce(() =>
        EpycApi.getGames({
            channelId: props.channelId,
            channelService: props.channelTarget,
        })
    );
    return isFetchingGames ? (
        <Spinner />
    ) : (
        <Container>
            <GameList games={games} />
        </Container>
    );
}
