import * as React from 'react';
import { Card, Col, Row, Spinner } from 'react-bootstrap';
import { EpycApi, Frame, Game, Person } from './Apis';
import Error404 from './Error404';
import { useAsyncActionOnce } from './useAsyncAction';
import { ResizingImg } from './ResizingImg';
import { useParams } from 'react-router';

function GameFrameAvatar(props: { person: Person }) {
    const avatar = props.person.avatar;

    if (!avatar) {
        return (
            <div>
                <span className="p-1 display-4 rounded-lg border bg-white">🧑🏼‍🎨</span>
            </div>
        );
    }

    const style: React.CSSProperties = {
        maxWidth: '64px',
        height: 'auto',
        objectFit: 'contain',
    };

    return <img className="rounded-lg" src={avatar.url} style={style} width={avatar.width} height={avatar.height} />;
}

function GameFrame(props: { idx: number; frame: Frame }) {
    let content = null;

    if (props.frame.playData.title) {
        content = props.frame.playData.title;
    } else if (props.frame.playData.image) {
        content = (
            <ResizingImg
                src={props.frame.playData.image.imageUrl}
                width={props.frame.playData.image.width}
                height={props.frame.playData.image.height}
            />
        );
    }

    return (
        <Card key={props.idx} className="large-size-layout mb-2">
            <Card.Header className="border-0 text-center">
                <div className="mb-2">{props.frame.person.name}</div>
                <div>
                    <GameFrameAvatar person={props.frame.person} />
                </div>
            </Card.Header>
            <Card.Body>{content}</Card.Body>
        </Card>
    );
}

export default function (props: {}) {
    const { gameName } = useParams();
    const [isFetchingGame, game, gameErr] = useAsyncActionOnce(() => EpycApi.getGame({ gameName: gameName || '' }));

    if (isFetchingGame) {
        return <Spinner animation="border" />;
    }

    if (gameErr || !game) {
        return <Error404 />;
    }

    const cards = game.frames.map((frame, idx) => <GameFrame key={idx} idx={idx} frame={frame} />);

    return <div className="mt-5">{cards}</div>;
}
