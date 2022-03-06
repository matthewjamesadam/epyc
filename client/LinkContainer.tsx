import { Children, cloneElement, ReactElement, useCallback } from 'react';
import { useMatch, useNavigate } from 'react-router';

interface Props {
    children: ReactElement;
    to: string;
}

export const LinkContainer = ({ children, to }: Props) => {
    const navigate = useNavigate();
    const isActive = useMatch(to);
    const child = Children.only(children);

    const handleClick = useCallback(
        (event) => {
            event.preventDefault();
            navigate(to);
        },
        [to]
    );

    return cloneElement(child, {
        //   href,
        active: isActive,
        onClick: handleClick,
    });
};
