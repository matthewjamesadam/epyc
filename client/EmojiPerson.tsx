import * as React from 'react';

const artists = [
    '🧑🏻‍🎨',
    '🧑🏼‍🎨',
    '🧑🏽‍🎨',
    '🧑🏾‍🎨',
    '🧑🏿‍🎨',
    '👨🏻‍🎨',
    '👨🏼‍🎨',
    '👨🏽‍🎨',
    '👨🏾‍🎨',
    '👨🏿‍🎨',
    '👩🏻‍🎨',
    '👩🏼‍🎨',
    '👩🏽‍🎨',
    '👩🏾‍🎨',
    '👩🏿‍🎨',
];
const writers = ['💁🏻', '💁🏼', '💁🏽', '💁🏾', '💁🏿', '💁🏻‍♂️', '💁🏼‍♂️', '💁🏽‍♂️', '💁🏾‍♂️', '💁🏿‍♂️', '💁🏻‍♀️', '💁🏼‍♀️', '💁🏽‍♀️', '💁🏾‍♀️', '💁🏿‍♀️'];
const shruggers = ['🤷🏻', '🤷🏼', '🤷🏽', '🤷🏾', '🤷🏿', '🤷🏻‍♂️', '🤷🏼‍♂️', '🤷🏽‍♂️', '🤷🏾‍♂️', '🤷🏿‍♂️', '🤷🏻‍♀️', '🤷🏼‍♀️', '🤷🏽‍♀️', '🤷🏾‍♀️', '🤷🏿‍♀️'];

export function EmojiPerson(props: { type: 'artist' | 'writer' | 'shrugger' }): JSX.Element {
    function randomChar(str: string[]) {
        return str[Math.floor(Math.random() * str.length)];
    }

    switch (props.type) {
        case 'artist':
            return <>{randomChar(artists)}</>;
        case 'writer':
            return <>{randomChar(writers)}</>;
        case 'shrugger':
            return <>{randomChar(shruggers)}</>;
    }
}
