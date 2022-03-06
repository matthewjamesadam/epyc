import * as React from 'react';
import { Route, Routes } from 'react-router';
import { Container, Nav, Navbar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { LinkContainer } from './LinkContainer';
import Error404 from './Error404';
import { useAsyncActionOnce } from './useAsyncAction';
import { EpycApi } from './Apis';
import AllGameList from './AllGameList';
import Draw from './Draw';
import Play from './Play';
import PlayDone from './PlayDone';
import Game from './Game';
import About from './About';
import Title from './Title';
import Icon from './Icon';
import ChannelGameList from './ChannelGameList';

export default function () {
    return (
        <div>
            {/* Navbar */}
            <Navbar variant="dark" bg="dark" className="my-3">
                <Container>
                    <Navbar.Brand as={Link} to="/">
                        EPYC
                    </Navbar.Brand>

                    <Nav variant="pills" className="me-auto">
                        <LinkContainer to="/">
                            <Nav.Link active={false}>Games</Nav.Link>
                        </LinkContainer>

                        <LinkContainer to="/about">
                            <Nav.Link active={false}>About</Nav.Link>
                        </LinkContainer>
                    </Nav>

                    <Nav>
                        <Nav.Link href="https://github.com/matthewjamesadam/epyc">
                            <Icon type="github" width="24" height="24" fill="currentColor" />
                        </Nav.Link>
                    </Nav>
                </Container>
            </Navbar>

            {/* Routes */}
            <Routes>
                <Route path="about" element={<About />} />
                <Route path="/" element={<AllGameList />} />
                <Route path="*" element={<Error404 />} />

                {/* Route for testing the drawing UI */}
                <Route path="play">
                    {/* Route for testing the drawing UI */}
                    <Route
                        path="testdraw"
                        element={
                            <Draw gameName="" frameId="" title="Nothing" onDone={() => alert('Submit your turn')} />
                        }
                    />

                    {/* Route for testing the title UI */}
                    <Route
                        path="testtitle"
                        element={
                            <Title
                                gameName=""
                                frameId=""
                                imageUrl="https://epyc-images.s3-us-west-2.amazonaws.com/hiatism/6054be49-e876-4d09-8899-43cc05733840.png"
                                onDone={() => alert('Submit your turn')}
                            />
                        }
                    />

                    <Route path=":gameName/:frameId/done" element={<PlayDone />} />
                    <Route path=":gameName/:frameId" element={<Play />} />
                </Route>

                <Route path="game/:gameName" element={<Game />} />
                <Route path="/games/:service/:channelId" element={<ChannelGameList />} />
            </Routes>
        </div>
    );
}
