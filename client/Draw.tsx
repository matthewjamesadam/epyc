import * as React from 'react';
import { Alert, Button, ButtonGroup, Card } from 'react-bootstrap';
import { ToolType } from './DrawTypes';
import { observer } from 'mobx-react-lite';
import DrawManager from './DrawManager';
import { HexColorPicker } from 'react-colorful';
import { useAsyncAction } from './useAsyncAction';
import { EpycApi } from './Apis';
import { ToolButton, ToolToggleButton } from './ToolButton';
import { ColourButton } from './ColourButton';

const lineWidths = [1, 3, 5, 10];

function Draw(props: { gameName: string; frameId: string; title: string; onDone: () => void }) {
    const [drawManager] = React.useState<DrawManager>(() => new DrawManager(props.gameName, props.frameId));
    const canvasRef = React.useCallback((r) => {
        drawManager.setCanvasRef(r);
    }, []);

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

                <div className="d-flex flex-wrap align-items-start">
                    <ButtonGroup size="sm" className="me-1 mb-1">
                        {drawManager?.tools.map((tool) => {
                            return (
                                <ToolToggleButton
                                    value={tool.type}
                                    key={tool.type}
                                    tooltip={tool.name}
                                    type="radio"
                                    icon={tool.icon}
                                    checked={tool.type === drawManager?.selectedTool.type}
                                    variant="outline-dark"
                                    onClick={() => {
                                        drawManager?.setSelectedTool(tool.type);
                                    }}
                                />
                            );
                        })}
                    </ButtonGroup>

                    <ButtonGroup size="sm" className="me-1 mb-1">
                        <ToolToggleButton
                            value=""
                            tooltip="Select"
                            icon="select"
                            type="radio"
                            checked={drawManager?.selectedTool.type === ToolType.select}
                            variant="outline-dark"
                            onClick={() => {
                                drawManager?.setSelectedTool(ToolType.select);
                            }}
                        />

                        <ToolButton
                            tooltip="Copy"
                            icon="copy"
                            variant="outline-dark"
                            disabled={drawManager?.copySource === null}
                            onClick={() => {
                                drawManager?.copy();
                            }}
                        />

                        <ToolToggleButton
                            value="paste"
                            tooltip="Paste"
                            type="radio"
                            icon="paste"
                            checked={drawManager?.selectedTool.type === ToolType.paste}
                            variant="outline-dark"
                            disabled={drawManager?.copyData === null}
                            onClick={() => {
                                drawManager?.setSelectedTool(ToolType.paste);
                            }}
                        />
                    </ButtonGroup>

                    <ButtonGroup size="sm" className="me-1 mb-1">
                        <ToolButton
                            tooltip="Undo"
                            icon="undo"
                            disabled={(drawManager?.ops.length || 0) <= 0}
                            variant="outline-primary"
                            onClick={() => {
                                drawManager?.undo();
                            }}
                        />

                        <ToolButton
                            tooltip="Redo"
                            icon="redo"
                            disabled={(drawManager?.redos.length || 0) <= 0}
                            variant="outline-primary"
                            onClick={() => {
                                drawManager?.redo();
                            }}
                        />
                    </ButtonGroup>

                    <ButtonGroup size="sm" className="me-1 mb-1">
                        {lineWidths.map((lineWidth) => {
                            return (
                                <ToolToggleButton
                                    value={lineWidth}
                                    key={lineWidth}
                                    tooltip="Line Width"
                                    type="radio"
                                    variant="outline-dark"
                                    checked={drawManager?.lineWidth === lineWidth}
                                    onClick={() => {
                                        if (drawManager) drawManager.lineWidth = lineWidth;
                                    }}
                                >
                                    <div className="d-flex align-items-center" style={{ height: '1rem' }}>
                                        <div style={{ width: '1.0rem', height: lineWidth, background: '#000000' }} />
                                    </div>
                                </ToolToggleButton>
                            );
                        })}
                    </ButtonGroup>
                </div>

                <div className="mb-2 mt-2 d-flex">
                    <div className="colour-picker me-2">
                        <HexColorPicker
                            color={drawManager?.strokeColour}
                            onChange={(colour) => {
                                if (drawManager) drawManager.strokeColour = colour;
                            }}
                        />
                    </div>

                    <div className="d-flex flex-column">
                        <ButtonGroup size="sm" className="align-self-start flex-wrap align-content-start mb-2">
                            {drawManager?.fixedColours.map((colour, idx) => {
                                return (
                                    <ColourButton
                                        key={idx}
                                        colour={colour}
                                        isSelected={drawManager.strokeColour === colour}
                                        onClick={() => {
                                            if (drawManager) drawManager.strokeColour = colour;
                                        }}
                                    />
                                );
                            })}
                        </ButtonGroup>

                        <ButtonGroup size="sm" className="align-self-start flex-wrap align-content-start">
                            {drawManager?.colours.map((colour, idx) => {
                                return (
                                    <ColourButton
                                        key={idx}
                                        colour={colour}
                                        isSelected={drawManager.strokeColour === colour}
                                        onClick={() => {
                                            if (colour && drawManager) drawManager.strokeColour = colour;
                                        }}
                                    />
                                );
                            })}
                        </ButtonGroup>
                    </div>
                </div>

                <div className="d-flex flex-column align-items-end">
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
