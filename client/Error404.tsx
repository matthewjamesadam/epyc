import * as React from 'react';
import { EmojiPerson } from './EmojiPerson';

export default function Error404(): JSX.Element {
    return (
        <p className="mt-4 text-center display-1">
            <EmojiPerson type="shrugger" />
        </p>
    );
}
