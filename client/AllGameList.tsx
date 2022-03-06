import * as React from 'react';
import GameList from './GameList';
import { useAsyncActionNow } from './useAsyncAction';
import { EpycApi, Game, GameFromJSON, GameToJSON } from './Apis';
import { Container, Row, Col, Nav, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router';

type AllGameTypes = 'random' | 'recent';

function DecodeGames(state: any): Game[] | undefined {
    if (!state || !Array.isArray(state)) {
        return undefined;
    }

    return state.map(GameFromJSON);
}

function EncodeGames(games: Game[]): any {
    return games.map(GameToJSON);
}

export default function AllGameList() {
    const navigate = useNavigate();
    const [type, setType] = React.useState<AllGameTypes>('random');
    const location = useLocation();

    // This action fetches a set of random games from the service for display on the main page.  The problem is
    // that this means when you navigate back and forth, a different set of games is displayed, which feels wrong.
    // This block stores the fetched games in the state for the current history entry, which we can then
    // reuse whenever we re-render this page.
    const [isFetchingGames, games, gamesErr] = useAsyncActionNow(async () => {
        // See if we previously stored games for this history -- if so, reuse it
        const state: any = location.state;
        const decodedState = DecodeGames(state?.[type]);

        if (decodedState) {
            return decodedState;
        }

        // No previously stored games.  Fetch from the service and store in history
        const query = type === 'random' ? { sampleSize: 25 } : { limit: 10 };
        const games = await EpycApi.getGames(query);

        const encodedState: any = {};
        encodedState[type] = EncodeGames(games);

        navigate(location.pathname, { replace: true, state: encodedState });
        return games;
    }, [type]);

    let content = (
        <Row>
            <Col>
                <GameList games={games} />
            </Col>
        </Row>
    );

    if (isFetchingGames) {
        content = <Spinner animation="border" />;
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
