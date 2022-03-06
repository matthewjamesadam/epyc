import React = require('react');
import { Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router';
import { FramePlayData } from './api/models/FramePlayData';
import { EpycApi } from './Apis';
import Draw from './Draw';
import Error404 from './Error404';
import Title from './Title';
import { useAsyncActionOnce } from './useAsyncAction';

export default function Play(props: {}) {
    const navigate = useNavigate();
    const { gameName, frameId } = useParams();

    const [isFetchingFrame, frame, frameError] = useAsyncActionOnce<FramePlayData | undefined>(async () => {
        if (gameName && frameId) {
            return EpycApi.getFramePlayData({ gameName: gameName, frameId: frameId });
        }
    });

    const doneCb = React.useCallback(() => {
        navigate(`/play/${gameName}/${frameId}/done`);
    }, [gameName, frameId]);

    if (isFetchingFrame) {
        return <Spinner animation="border" />;
    }

    if (frameError || !frame || !gameName || !frameId) {
        return <Error404 />;
    }

    // Previous frame was a title, show it and ask for an image
    if (frame.title) {
        return <Draw gameName={gameName} frameId={frameId} title={frame.title} onDone={doneCb} />;
    }

    // Previous frame was a picture, or the first frame. ask for the next title
    return <Title gameName={gameName} frameId={frameId} imageUrl={frame.image?.imageUrl} onDone={doneCb} />;
}
