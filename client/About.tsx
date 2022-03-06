import * as React from 'react';
import { Quote } from './Quote';
import { EmojiPerson } from './EmojiPerson';
import { ResizingImg } from './ResizingImg';
import { Button } from 'react-bootstrap';
import Icon from './Icon';

const SampleImage1 = require('./epyc-sample-1.png');
const SampleImage2 = require('./epyc-sample-2.png');

function AboutFrame(props: { person: 'writer' | 'artist'; children: React.ReactNode }) {
    return (
        <div className="d-flex flex-row align-items-start mb-5">
            <p className="about-quote-person">
                <EmojiPerson type={props.person} />
            </p>
            <Quote>{props.children}</Quote>
        </div>
    );
}

export default function About() {
    return (
        <div>
            <h3>What Is This??</h3>
            <p className="mb-5">
                This is an online version of the pencil-and-paper game Eat Poop You Cat, which is described{' '}
                <a href="https://steemit.com/gaming/@danmaruschak/an-illustrated-guide-to-playing-the-folk-pencil-and-paper-drawing-game-eat-poop-you-cat">
                    here
                </a>
                . It is kind of like the kid's game of Telephone, only with phrases alternating with pictures. You can
                play the game with your friends on a Slack or Discord server. Here is an example game:
            </p>

            <h5>The first player starts the game with a phrase they think up:</h5>

            <AboutFrame person="writer">
                <p>Inside of a dog, it's too dark to read!</p>
            </AboutFrame>

            <h5>The next player makes a drawing of that phrase:</h5>

            <AboutFrame person="artist">
                <ResizingImg src={SampleImage1} />
            </AboutFrame>

            <h5>The next player describes the drawing with another phrase:</h5>

            <AboutFrame person="writer">
                <p>Snoopy has no love for the written word.</p>
            </AboutFrame>

            <h5>The next player makes a drawing of that phrase:</h5>

            <AboutFrame person="artist">
                <ResizingImg src={SampleImage2} />
            </AboutFrame>

            <h3>Sounds Great, How Do I Play?</h3>

            <p>You can add the bot to your Slack or Discord server by clicking on one of these two links:</p>

            <div className="mb-4 d-flex align-items-center">
                <Button href="/slack/install" className="me-3 d-flex align-items-center" variant="outline-primary">
                    <Icon type="slack" style={{ height: '1.3rem' }} fill="currentColor" className="me-2" />
                    Install into Slack Workspace
                </Button>
                or
                <Button href="/discord/install" className="ms-3 d-flex align-items-center" variant="outline-primary">
                    <Icon type="discord" style={{ height: '1.3rem' }} fill="currentColor" className="me-2" />
                    Install into Discord Server
                </Button>
            </div>

            <p>Once the bot is in your server, you can talk to the bot:</p>

            <p>
                <code className="border">@epyc help</code> -- get a list of commands.
            </p>

            <p>
                <code className="border">@epyc start @player1 @player2 ...</code> -- start a new game.
            </p>
        </div>
    );
}
