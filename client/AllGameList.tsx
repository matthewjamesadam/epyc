import * as React from 'react';
import GameList from './GameList';
import { useAsyncActionNow } from './useAsyncAction';
import { EpycApi } from './Apis';
import { Container, Row, Col, Nav, Spinner } from 'react-bootstrap';

type AllGameTypes = 'random' | 'recent';

export default function AllGameList() {
    const [type, setType] = React.useState<AllGameTypes>('random');
    const [isFetchingGames, games, gamesErr] = useAsyncActionNow(() => {
        const query = type === 'random' ? { sampleSize: 25 } : { limit: 10 };
        return EpycApi.getGames(query);
    }, [type]);

    let content = (
        <Row>
            <Col>
                <GameList games={games} />
            </Col>
        </Row>
    );

    if (isFetchingGames) {
        content = <Spinner />;
    }

    return (
        <Container>
            {/* Re-add when we support time-based ordering */}
            {/* <Row className="mb-3">
                <Col>
                    <Nav variant="pills" activeKey={type} onSelect={(type: AllGameTypes) => setType(type)}>
                        <Nav.Item>
                            <Nav.Link className="nav-link-small" eventKey="random">
                                <small>Random</small>
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link className="nav-link-small" eventKey="recent">
                                <small>Recent</small>
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                </Col>
            </Row> */}

            {content}
        </Container>
    );
}
