import * as React from 'react';
import { DependencyList } from 'react';

export function useAsyncAction<Result>(
    action: () => Promise<Result>,
    initialState: boolean = false
): [() => void, boolean, Result | null, any] {
    const [isRunning, setIsRunning] = React.useState(initialState);
    const [result, setResult] = React.useState<Result | null>(null);
    const [error, setError] = React.useState<any>(null);

    const execute = async () => {
        setIsRunning(true);

        try {
            const res = await action();
            setResult(res);
        } catch (error) {
            if (error instanceof Error) {
                setError(error);
            }
        } finally {
            setIsRunning(false);
        }
    };

    return [execute, isRunning, result, error];
}

export function useAsyncActionNow<Result>(
    action: () => Promise<Result>,
    deps?: DependencyList
): [boolean, Result | null, Error | null] {
    const [execute, isRunning, result, error] = useAsyncAction(action, true);
    React.useEffect(execute, deps);

    return [isRunning, result, error];
}

export function useAsyncActionOnce<Result>(action: () => Promise<Result>): [boolean, Result | null, Error | null] {
    return useAsyncActionNow(action, []);
}
