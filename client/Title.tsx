import React = require('react');
import { Button, Card, Form, Image } from 'react-bootstrap';
import { EpycApi } from './Apis';
import { useAsyncAction } from './useAsyncAction';

export default function Title(props: { gameName: string; frameId: string; imageUrl?: string; onDone: () => void }) {
    const [title, setTitle] = React.useState('');

    const [submitTitle, isSubmittingTitle, submitTitleResult, submitTitleError] = useAsyncAction(async () => {
        // FIXME: Use streamed API for larger images
        await EpycApi.putFrameTitle({
            gameName: props.gameName,
            frameId: props.frameId,
            framePlayTitleRequest: { title: title },
        });

        props.onDone();
    });

    const image = (
        <Card.Body className="text-center">
            <Image className="border" rounded src={props.imageUrl} />
        </Card.Body>
    );

    const text = props.imageUrl
        ? 'Describe the picture above in a sentence or two.'
        : 'Start the game off with a sentence or two describing something.';

    return (
        <Card className="mt-5">
            {props.imageUrl && image}

            <Card.Body>
                <div className="d-flex flex-column">
                    <Card.Text>{text}</Card.Text>

                    <Card.Body>
                        <Form.Group>
                            <Form.Control
                                as="textarea"
                                autoFocus
                                rows={5}
                                value={title}
                                style={{ resize: 'none' }}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.currentTarget.value)}
                            />
                        </Form.Group>
                    </Card.Body>

                    <Button className="align-self-end" onClick={submitTitle} disabled={isSubmittingTitle}>
                        Done
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
}
