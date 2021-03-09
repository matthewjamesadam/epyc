import * as React from 'react';

const style: React.CSSProperties = {
    maxWidth: '100%',
    height: 'auto',
    objectFit: 'contain',
};

// Img that sizes to width
export function ResizingImg(props: { src: string; width?: number; height?: number }) {
    return <img style={style} src={props.src} width={props.width} height={props.height} />;
}
