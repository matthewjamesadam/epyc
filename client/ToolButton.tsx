import * as React from 'react';
import { Button, ButtonProps, OverlayTrigger, Popover, ToggleButton, ToggleButtonProps } from 'react-bootstrap';
import { IconType } from './DrawTypes';
import Icon from './Icon';

/*
    Styled buttons for tools in the drawing UI.
    These buttons wrap the standard Button and ToggleButton with a tooltip, and
    automatically add a content icon.
*/

interface ToolButtonBaseProps extends React.HTMLAttributes<HTMLElement> {
    tooltip: string;
    icon?: IconType;
}

function ToolButtonBase<Props>(
    Type: React.ComponentType<Props>,
    props: React.PropsWithChildren<Props & ToolButtonBaseProps>
) {
    const content = props.icon ? (
        <Icon type={props.icon} style={{ height: '1rem' }} fill="currentColor" display="block" />
    ) : (
        props.children
    );

    return (
        <OverlayTrigger
            placement="top"
            delay={{ show: 250, hide: 250 }}
            overlay={
                <Popover id="draw-popover">
                    <Popover.Body>{props.tooltip}</Popover.Body>
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

export { ToolButton, ToolToggleButton };
