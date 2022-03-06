import * as React from 'react';
import GameList from './GameList';
import { useAsyncActionOnce } from './useAsyncAction';
import { EpycApi } from './Apis';
import { Container, Spinner } from 'react-bootstrap';
import { useParams } from 'react-router';

export default function AllGameList(props: {}) {
    const { channelId, service } = useParams();
    const [isFetchingGames, games, gamesErr] = useAsyncActionOnce(() =>
        EpycApi.getGames({
            channelId: channelId,
            channelService: service,
        })
    );
    return isFetchingGames ? (
        <Spinner animation="border" />
    ) : (
        <Container>
            <GameList games={games} />
        </Container>
    );
}
