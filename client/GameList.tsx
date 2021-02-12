import * as React from 'react';
import { Card, Container, Row, Col, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAsyncActionOnce } from './useAsyncAction';
import { EpycApi, Game } from './Apis';

function GameCard(props: { game: Game }) {
    const gameUrl = `/game/${props.game.name}`;
    return (
        <Link to={gameUrl}>
            <Card className="h-100">
                <Card.Body>{props.game.name}</Card.Body>
            </Card>
        </Link>
    );
}

function GameList(props: { games: Game[] | null }) {
    if (!props.games) return null;

    return (
        <Container>
            <Row>
                {props.games.map((game) => (
                    <Col lg={6} md={12} className="mb-5">
                        <GameCard game={game} />
                    </Col>
                ))}
            </Row>
        </Container>
    );
}

export default function () {
    const [isFetchingGames, games, gamesErr] = useAsyncActionOnce(() => EpycApi.getGames());

    return (
        <div>
            <h1>EAT POOP YOU CAT</h1>

            {isFetchingGames ? <Spinner /> : <GameList games={games} />}
        </div>
    );
}
