import * as React from 'react';
import {
    Alert,
    Button,
    ButtonGroup,
    ButtonProps,
    Card,
    Overlay,
    OverlayTrigger,
    Popover,
    ToggleButton,
    ToggleButtonProps,
} from 'react-bootstrap';
import { ToolType } from './DrawTypes';
import { observer } from 'mobx-react-lite';
import DrawManager from './DrawManager';
import { HexColorPicker } from 'react-colorful';
import { useAsyncAction } from './useAsyncAction';
import { EpycApi } from './Apis';
import Icon, { IconType } from './Icon';

const lineWidths = [1, 3, 5, 10];

const rainbowStyle = {
    background: 'linear-gradient(to right, orange , yellow, green, cyan, blue, violet)',
    width: '5rem',
    height: '5rem',
};

function PopupOverlay(props: React.PropsWithChildren<{ tooltip: string }>) {
    return (
        <OverlayTrigger
            placement="top"
            delay={{ show: 250, hide: 250 }}
            overlay={
                <Popover id="draw-popover">
                    <Popover.Content>{props.tooltip}</Popover.Content>
                </Popover>
            }
        >
            {props.children}
        </OverlayTrigger>
    );
}

function ButtonIcon(props: { type: IconType }) {
    return <Icon type={props.type} style={{ height: '1rem' }} fill="currentColor" display="block" />;
}

interface ToolButtonBaseProps {
    tooltip: string;
    icon?: IconType;
}
function ToolButtonBase<ButtonProps>(
    Type: React.ComponentType<ButtonProps>,
    props: React.PropsWithChildren<ButtonProps & ToolButtonBaseProps>
) {
    const content = props.icon ? <Icon type={props.icon} /> : props.children;

    return (
        <OverlayTrigger
            placement="top"
            delay={{ show: 250, hide: 400 }}
            overlay={
                <Popover id="draw-popover">
                    <Popover.Content>{props.tooltip}</Popover.Content>
                </Popover>
            }
        >
            <Type {...props}>{content}</Type>
        </OverlayTrigger>
    );
}

const ToolButton = (props: React.PropsWithChildren<ButtonProps & ToolButtonBaseProps>) => ToolButtonBase(Button, props);

const ToolToggleButton = (props: React.PropsWithChildren<ToggleButtonProps & ToolButtonBaseProps>) =>
    ToolButtonBase(ToggleButton, props);

function ColourButton(props: { colour: string | null | undefined; isSelected: boolean; onClick: () => void }) {
    const style: React.CSSProperties = {
        width: '1.3rem',
        height: '1.3rem',
        position: 'relative',
    };

    const buttonStyle: React.CSSProperties = {
        padding: '0',
        overflow: 'hidden',
        backgroundColor: props.colour || 'white',
        flexGrow: 0,
    };

    const hilightNode = (
        <div
            style={{
                position: 'absolute',
                top: -3,
                bottom: -3,
                right: -3,
                left: -3,
                border: '3px solid #000000',
                borderRadius: '.2rem',
                zIndex: 5,
            }}
        />
    );

    const hilight = props.isSelected ? hilightNode : null;

    if (props.isSelected) {
        buttonStyle.overflow = 'inherit';
    }

    return (
        <Button key={props.colour} variant="outline-dark" style={buttonStyle} onClick={props.onClick}>
            <div style={style}>{hilight}</div>
        </Button>
    );
}

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
                    <ButtonGroup toggle size="sm" className="mr-1 mb-1">
                        {drawManager?.tools.map((tool) => {
                            return (
                                <PopupOverlay key={tool.type} tooltip={tool.name}>
                                    <ToggleButton
                                        type="radio"
                                        checked={tool.type === drawManager?.selectedTool.type}
                                        variant="outline-dark"
                                        onClick={() => {
                                            drawManager?.setSelectedTool(tool.type);
                                        }}
                                    >
                                        {tool.icon ? <ButtonIcon type={tool.icon} /> : tool.name}
                                    </ToggleButton>
                                </PopupOverlay>
                            );
                        })}
                    </ButtonGroup>

                    <ButtonGroup toggle size="sm" className="mr-1 mb-1">
                        <PopupOverlay tooltip="Select">
                            <ToggleButton
                                type="radio"
                                checked={drawManager?.selectedTool.type === ToolType.select}
                                variant="outline-dark"
                                onClick={() => {
                                    drawManager?.setSelectedTool(ToolType.select);
                                }}
                            >
                                <ButtonIcon type="select" />
                            </ToggleButton>
                        </PopupOverlay>

                        <PopupOverlay tooltip="Copy">
                            <Button
                                variant="outline-dark"
                                disabled={drawManager?.copySource === null}
                                onClick={() => {
                                    drawManager?.copy();
                                }}
                            >
                                <ButtonIcon type="copy" />
                            </Button>
                        </PopupOverlay>

                        <PopupOverlay tooltip="Paste">
                            <ToggleButton
                                type="radio"
                                checked={drawManager?.selectedTool.type === ToolType.paste}
                                variant="outline-dark"
                                disabled={drawManager?.copyData === null}
                                onClick={() => {
                                    drawManager?.setSelectedTool(ToolType.paste);
                                }}
                            >
                                <ButtonIcon type="paste" />
                            </ToggleButton>
                        </PopupOverlay>
                    </ButtonGroup>

                    <ButtonGroup size="sm" className="mr-1 mb-1">
                        <PopupOverlay tooltip="Undo">
                            <Button
                                disabled={(drawManager?.ops.length || 0) <= 0}
                                variant="outline-primary"
                                onClick={() => {
                                    drawManager?.undo();
                                }}
                            >
                                <ButtonIcon type="undo" />
                            </Button>
                        </PopupOverlay>

                        <PopupOverlay tooltip="Redo">
                            <Button
                                disabled={(drawManager?.redos.length || 0) <= 0}
                                variant="outline-primary"
                                onClick={() => {
                                    drawManager?.redo();
                                }}
                            >
                                <ButtonIcon type="redo" />
                            </Button>
                        </PopupOverlay>
                    </ButtonGroup>

                    <ButtonGroup toggle size="sm" className="mr-1 mb-1">
                        {lineWidths.map((lineWidth) => {
                            return (
                                <PopupOverlay key={lineWidth} tooltip="Line Width">
                                    <ToggleButton
                                        type="radio"
                                        variant="outline-dark"
                                        checked={drawManager?.lineWidth === lineWidth}
                                        onClick={() => {
                                            if (drawManager) drawManager.lineWidth = lineWidth;
                                        }}
                                    >
                                        <div className="d-flex align-items-center" style={{ height: '1rem' }}>
                                            <div
                                                style={{ width: '1.0rem', height: lineWidth, background: '#000000' }}
                                            />
                                        </div>
                                    </ToggleButton>
                                </PopupOverlay>
                            );
                        })}
                    </ButtonGroup>
                </div>

                <div className="mb-2 mt-2 d-flex">
                    <div className="colour-picker mr-2">
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
