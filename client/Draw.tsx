import * as React from 'react';
import { Alert, Button, ButtonGroup, Card, Overlay, Popover, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import { DrawTool, ToolType } from './DrawTypes';
import { observer } from 'mobx-react-lite';
import DrawManager from './DrawManager';
import { HexColorPicker } from 'react-colorful';
import { useAsyncAction } from './useAsyncAction';
import { EpycApi } from './Apis';

const fixedColours = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff'];

const lineWidths = [1, 3, 5, 10];

const rainbowStyle = {
    background: 'linear-gradient(to right, orange , yellow, green, cyan, blue, violet)',
    width: '5rem',
    height: '5rem',
};

function Draw(props: { gameName: string; frameId: string; title: string; onDone: () => void }) {
    const [drawManager] = React.useState<DrawManager>(() => new DrawManager(props.gameName, props.frameId));
    const canvasRef = React.useCallback((r) => {
        drawManager.setCanvasRef(r);
    }, []);
    const buttonTarget = React.useRef<HTMLButtonElement>(null);
    const [isStrokeColourOpen, setIsStrokeColourOpen] = React.useState(false);

    const [uploadImage, isUploadingImage, uploadImageResult, uploadImageError] = useAsyncAction(async () => {
        const imageBlob = await drawManager?.getImage();
        if (!imageBlob) {
            return;
        }

        // FIXME: Use streamed API for larger images
        await EpycApi.putFrameImage({
            gameName: props.gameName,
            frameId: props.frameId,
            body: imageBlob,
        });

        // FIXME: clear local storage

        props.onDone();
    });

    return (
        <Card className="mt-5">
            <Card.Body>
                <Card.Title>Draw the following:</Card.Title>
                <Card.Text>{props.title}</Card.Text>
            </Card.Body>

            <Card.Body>
                <div className="position-relative">
                    {/* FIXME: Size to width/height for mobile and more space on desktop? */}
                    <canvas ref={canvasRef} className="border border-dark rounded" width="650" height="500" />
                    {drawManager?.toolChildren}
                </div>

                <div className="mb-1">
                    <ToggleButtonGroup
                        type="radio"
                        name="tools"
                        size="sm"
                        value={drawManager?.selectedTool.type}
                        className="mr-1"
                    >
                        {drawManager?.tools.map((tool) => {
                            return (
                                <ToggleButton
                                    key={tool.type}
                                    value={tool.type}
                                    variant="outline-dark"
                                    onClick={() => {
                                        drawManager?.setSelectedTool(tool.type);
                                    }}
                                >
                                    {tool.name}
                                </ToggleButton>
                            );
                        })}
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        type="radio"
                        name="clipboard-tools"
                        size="sm"
                        value={drawManager?.selectedTool.type}
                        className="mr-1"
                    >
                        <ToggleButton
                            value={ToolType.select}
                            variant="outline-dark"
                            onClick={() => {
                                drawManager?.setSelectedTool(ToolType.select);
                            }}
                        >
                            Select
                        </ToggleButton>

                        <Button
                            variant="outline-dark"
                            disabled={drawManager?.copySource === null}
                            onClick={() => {
                                drawManager?.copy();
                            }}
                        >
                            Copy
                        </Button>

                        <ToggleButton
                            value={ToolType.paste}
                            variant="outline-dark"
                            disabled={drawManager?.copyData === null}
                            onClick={() => {
                                drawManager?.setSelectedTool(ToolType.paste);
                            }}
                        >
                            Paste
                        </ToggleButton>
                    </ToggleButtonGroup>

                    <ButtonGroup type="radio" name="tools" size="sm">
                        <Button
                            disabled={(drawManager?.ops.length || 0) <= 0}
                            variant="outline-primary"
                            onClick={() => {
                                drawManager?.undo();
                            }}
                        >
                            Undo
                        </Button>

                        <Button
                            disabled={(drawManager?.redos.length || 0) <= 0}
                            variant="outline-primary"
                            onClick={() => {
                                drawManager?.redo();
                            }}
                        >
                            Redo
                        </Button>
                    </ButtonGroup>
                </div>

                <div className="mb-1">
                    <Button size="sm" className="mr-1" ref={buttonTarget} onClick={() => setIsStrokeColourOpen(true)}>
                        <div style={{ width: '1rem', height: '1rem', background: drawManager?.strokeColour }} />
                    </Button>

                    <Overlay
                        target={buttonTarget.current}
                        show={isStrokeColourOpen}
                        rootClose={true}
                        onHide={() => setIsStrokeColourOpen(false)}
                        placement="top"
                    >
                        <Popover>
                            <div className="colour-picker">
                                <HexColorPicker
                                    color={drawManager?.strokeColour}
                                    onChange={(colour) => {
                                        if (drawManager) drawManager.strokeColour = colour;
                                    }}
                                />
                            </div>
                        </Popover>
                    </Overlay>

                    <ButtonGroup name="colour" size="sm" className="mr-1">
                        {fixedColours.map((colour) => {
                            const style = {
                                background: colour,
                                width: '1rem',
                                height: '1rem',
                            };
                            return (
                                <Button
                                    key={colour}
                                    variant="outline-dark"
                                    onClick={() => {
                                        if (drawManager) drawManager.strokeColour = colour;
                                    }}
                                >
                                    <div style={style} />
                                </Button>
                            );
                        })}
                    </ButtonGroup>

                    <ToggleButtonGroup type="radio" name="colour" size="sm" value={drawManager?.lineWidth}>
                        {lineWidths.map((lineWidth) => {
                            return (
                                <ToggleButton
                                    variant="outline-dark"
                                    value={lineWidth}
                                    onClick={() => {
                                        if (drawManager) drawManager.lineWidth = lineWidth;
                                    }}
                                >
                                    <div className="d-flex align-items-center" style={{ height: '1.0rem' }}>
                                        <div style={{ width: '1.0rem', height: lineWidth, background: '#000000' }} />
                                    </div>
                                </ToggleButton>
                            );
                        })}
                    </ToggleButtonGroup>
                </div>

                <div>
                    <Button onClick={uploadImage} disabled={isUploadingImage}>
                        Done!
                    </Button>

                    {uploadImageError && (
                        <Alert variant="danger" className="mt-1">
                            An error occurred completing your turn! Oops!
                        </Alert>
                    )}
                </div>
            </Card.Body>
        </Card>
    );
}

export default observer(Draw);
