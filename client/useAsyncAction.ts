import * as React from 'react';
import { DependencyList } from 'react';

export function useAsyncAction<Result>(
    action: () => Promise<Result>
): [() => void, boolean, Result | null, Error | null] {
    const [isRunning, setIsRunning] = React.useState(false);
    const [result, setResult] = React.useState<Result | null>(null);
    const [error, setError] = React.useState<Error | null>(null);

    const execute = () => {
        setIsRunning(true);
        action()
            .then(res => {
                setResult(res);
            })
            .catch(err => {
                setError(err);
            })
            .finally(() => {
                setIsRunning(false);
            });
    };

    return [execute, isRunning, result, error];
}

export function useAsyncActionNow<Result>(
    action: () => Promise<Result>,
    deps?: DependencyList
): [boolean, Result | null, Error | null] {

    const [execute, isRunning, result, error] = useAsyncAction(action);
    React.useEffect(execute, deps);

    return [ isRunning, result, error] ;
}

export function useAsyncActionOnce<Result>(
    action: () => Promise<Result>
): [boolean, Result | null, Error | null] {

    return useAsyncActionNow(action, []);
}