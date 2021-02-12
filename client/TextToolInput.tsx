import * as React from 'react';

export default function TextToolInput(props: {
    font: string;
    lineHeight: number;
    top: number;
    left: number;
    onChange: (text: string) => void;
}) {
    const ref = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        ref.current?.focus();
    }, []);

    // Tricky stuff to size the textarea to its content
    const sizeToContent = React.useCallback(() => {
        if (ref.current) {
            ref.current.style.width = 'auto';
            ref.current.style.height = 'auto';
            ref.current.style.width = `${ref.current.scrollWidth}px`;
            ref.current.style.height = `${ref.current.scrollHeight}px`;
        }
    }, []);

    return (
        <textarea
            ref={ref}
            wrap="off"
            style={{
                font: props.font,
                lineHeight: `${props.lineHeight}px`,
                position: 'absolute',
                top: props.top,
                left: props.left,
                resize: 'none',
                overflow: 'hidden',
            }}
            onChange={(value) => {
                sizeToContent();
                props.onChange(value.target.value);
            }}
        />
    );
}
