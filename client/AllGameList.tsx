import * as React from 'react';
import GameList from './GameList';
import { useAsyncActionOnce } from './useAsyncAction';
import { EpycApi } from './Apis';
import { Container, Row, Col, Nav, Spinner } from 'react-bootstrap';

export default function AllGameList() {
    const [isFetchingGames, games, gamesErr] = useAsyncActionOnce(() => EpycApi.getGames({ sampleSize: 5 }));

    // WRONG
    if (isFetchingGames) {
        return <Spinner />;
    }

    return (
        <Container>
            <Row className="mb-3">
                <Col>
                    <Nav variant="pills">
                        <Nav.Item>
                            <Nav.Link active={true}>Blah</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link>Blahzz</Nav.Link>
                        </Nav.Item>
                    </Nav>
                </Col>
            </Row>

            <Row>
                <Col>
                    <GameList games={games} />
                </Col>
            </Row>
        </Container>
    );
}
