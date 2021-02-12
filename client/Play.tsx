import React = require('react');
import { Spinner } from 'react-bootstrap';
import { useHistory } from 'react-router';
import { FramePlayData } from './api/models/FramePlayData';
import { EpycApi } from './Apis';
import Draw from './Draw';
import Error404 from './Error404';
import Title from './Title';
import { useAsyncActionOnce } from './useAsyncAction';

export default function Play(props: { gameName: string; frameId: string }) {
    const history = useHistory();
    const [isFetchingFrame, frame, frameError] = useAsyncActionOnce<FramePlayData>(async () => {
        return EpycApi.getFramePlayData({ gameName: props.gameName, frameId: props.frameId });
    });

    const doneCb = React.useCallback(() => {
        history.push(`/play/${props.gameName}/${props.frameId}/done`);
    }, []);

    if (isFetchingFrame) {
        return <Spinner />;
    }

    if (frameError || !frame) {
        return <Error404 />;
    }

    // Previous frame was a title, show it and ask for an image
    if (frame.title) {
        return <Draw gameName={props.gameName} frameId={props.frameId} title={frame.title} onDone={doneCb} />;
    }

    // Previous frame was a picture, or the first frame. ask for the next title
    return <Title gameName={props.gameName} frameId={props.frameId} imageUrl={frame.image?.imageUrl} onDone={doneCb} />;
}
