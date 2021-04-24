import * as React from 'react';
import { Button } from 'react-bootstrap';

/*
    Styled button for colour selection.
    Most of the trickery here is to get the hilight oval to look right.
*/
export function ColourButton(props: { colour: string | null | undefined; isSelected: boolean; onClick: () => void }) {
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
