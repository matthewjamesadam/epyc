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

export function RandomEmoji(type: 'artist' | 'writer' | 'shrugger'): string {
    function randomChar(str: string[]) {
        return str[Math.floor(Math.random() * str.length)];
    }

    switch (type) {
        case 'artist':
            return randomChar(artists);
        case 'writer':
            return randomChar(writers);
        case 'shrugger':
            return randomChar(shruggers);
    }
}
