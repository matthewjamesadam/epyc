import * as React from 'react';
import { Route, Switch, Redirect } from 'react-router';
import { LinkContainer } from 'react-router-bootstrap';
import { Card, Container, Row, Col, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Error404 from './Error404';
import { useAsyncActionOnce } from './useAsyncAction';
import { EpycApi } from './Apis';
import GameList from './GameList';
import Draw from './Draw';
import Play from './Play';
import PlayDone from './PlayDone';
import Game from './Game';

export default function () {
    return (
        <Switch>
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

            <Route path="/" exact={true}>
                <GameList />
            </Route>

            <Route path="*">
                <Error404 />
            </Route>
        </Switch>
    );
}
