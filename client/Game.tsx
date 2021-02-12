import * as React from 'react';
import { Card, Col, Row, Spinner } from 'react-bootstrap';
import { EpycApi, Frame, Game } from './Apis';
import Error404 from './Error404';
import { useAsyncActionOnce } from './useAsyncAction';

function GameFrame(props: { idx: number; frame: Frame }) {
    let content = null;

    if (props.frame.playData.title) {
        content = props.frame.playData.title;
    } else if (props.frame.playData.image) {
        content = (
            <img
                src={props.frame.playData.image.imageUrl}
                width={props.frame.playData.image.width}
                height={props.frame.playData.image.height}
            />
        );
    }

    return (
        <Card key={props.idx} className="flex-row mb-2">
            <Card.Header className="border-0">{props.frame.person.name}</Card.Header>
            <Card.Body>{content}</Card.Body>
        </Card>
    );
}

export default function (props: { gameName: string }) {
    const [isFetchingGame, game, gameErr] = useAsyncActionOnce(() => EpycApi.getGame({ gameName: props.gameName }));

    if (isFetchingGame) {
        return <Spinner />;
    }

    if (gameErr || !game) {
        return <Error404 />;
    }

    const cards = game.frames.map((frame, idx) => <GameFrame idx={idx} frame={frame} />);

    return <div className="mt-5">{cards}</div>;
}
