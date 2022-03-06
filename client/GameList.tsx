import * as React from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Game } from './Apis';
import Error404 from './Error404';

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

export default function GameList(props: { games: Game[] | null }) {
    if (!props.games || props.games.length === 0) return <Error404 />;

    return (
        <Row lg={4} md={3} sm={2} xs={1}>
            {props.games.map((game) => (
                <Col key={game.name} className="mb-5">
                    <GameCard game={game} />
                </Col>
            ))}
        </Row>
    );
}
