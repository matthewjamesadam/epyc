import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Main from './Main';

import './styles.scss';

interface Props {}

interface State {
    loading: boolean;
}

function App(props: {}) {
    return (
        <BrowserRouter>
            <div className="container-md">
                <Main />
            </div>
        </BrowserRouter>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
