import * as React from 'react';
import { Route, Switch, Redirect } from 'react-router';
import { LinkContainer } from 'react-router-bootstrap';
import { Nav, Navbar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
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
                <Navbar.Brand as={Link} to="/">
                    EPYC
                </Navbar.Brand>

                <Nav variant="pills">
                    <LinkContainer to="/" exact={true}>
                        <Nav.Link active={false}>Games</Nav.Link>
                    </LinkContainer>

                    <LinkContainer to="/about" exact={true}>
                        <Nav.Link active={false}>About</Nav.Link>
                    </LinkContainer>
                </Nav>

                <Nav className="ml-auto">
                    <Nav.Link href="https://github.com/matthewjamesadam/epyc">
                        <Icon type="github" width="24" height="24" fill="currentColor" />
                    </Nav.Link>
                </Nav>
            </Navbar>

            {/* Routes */}
            <Switch>
                <Route path="/about" exact={true}>
                    <About />
                </Route>

                {/* Route for testing the drawing UI */}
                <Route
                    path="/play/testdraw"
                    render={(props) => {
                        return <Draw gameName="" frameId="" title="Nothing" onDone={() => alert('Submit your turn')} />;
                    }}
                />

                {/* Route for testing the drawing UI */}
                <Route
                    path="/play/testtitle"
                    render={(props) => {
                        return (
                            <Title
                                gameName=""
                                frameId=""
                                imageUrl="https://epyc-images.s3-us-west-2.amazonaws.com/hiatism/6054be49-e876-4d09-8899-43cc05733840.png"
                                onDone={() => alert('Submit your turn')}
                            />
                        );
                    }}
                />

                <Route path="/play/:gameName/:frameId/done">
                    <PlayDone />
                </Route>

                <Route
                    path="/play/:gameName/:frameId"
                    render={(props) => {
                        return <Play gameName={props.match.params.gameName} frameId={props.match.params.frameId} />;
                    }}
                />

                <Route
                    path="/game/:gameName"
                    render={(props) => {
                        return <Game gameName={props.match.params.gameName} />;
                    }}
                />

                <Route
                    path="/games/:service/:channelId"
                    render={(props) => {
                        return (
                            <ChannelGameList
                                channelId={props.match.params.channelId}
                                channelTarget={props.match.params.service}
                            />
                        );
                    }}
                />

                <Route path="/" exact={true}>
                    <AllGameList />
                </Route>

                <Route path="*">
                    <Error404 />
                </Route>
            </Switch>
        </div>
    );
}
