import * as React from 'react';
import { Card, CardDeck, Container, Row, Col, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAsyncActionOnce } from './useAsyncAction';
import { EpycApi, Game } from './Apis';

function EmptyGameCard() {
    return (
        <div className="border-bottom position-relative">
            <div style={{ width: '100%', height: '0px', paddingBottom: '50%' }} />
            <div
                className="position-absolute d-flex justify-content-center align-items-center"
                style={{
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                }}
            >
                <h1>🧑🏼‍🎨</h1>
            </div>
        </div>
    );
}

function GameCard(props: { game: Game }) {
    const gameUrl = `/game/${props.game.name}`;
    const height = Math.random() * 50;

    const imageContent = props.game.titleImage ? (
        <Card.Img variant="top" className="border-bottom" src={props.game.titleImage?.imageUrl} />
    ) : (
        EmptyGameCard()
    );

    return (
        <Link to={gameUrl}>
            <Card>
                {imageContent}
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
                    <Col key={game.name} lg={3} md={4} sm={6} xs={12} className="mb-5">
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
