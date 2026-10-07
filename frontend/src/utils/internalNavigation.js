import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const INTERNAL_BACK_STACK_STATE_KEY = 'internalBackStack';

export const getLocationPath = (location = {}) => {
  const pathname = location.pathname || '/';
  const search = location.search || '';
  const hash = location.hash || '';

  return `${pathname}${search}${hash}`;
};

const isInternalPath = (path) => (
  typeof path === 'string' &&
  path.startsWith('/') &&
  !path.startsWith('//')
);

const normalizeBackStack = (stack) => {
  if (!Array.isArray(stack)) return [];

  return stack.filter(isInternalPath);
};

export const createInternalNavigationState = (location, state = {}) => {
  const currentPath = getLocationPath(location);
  const currentStack = normalizeBackStack(location.state?.[INTERNAL_BACK_STACK_STATE_KEY]);
  const nextStack = [...currentStack];

  if (isInternalPath(currentPath) && nextStack[nextStack.length - 1] !== currentPath) {
    nextStack.push(currentPath);
  }

  return {
    ...state,
    [INTERNAL_BACK_STACK_STATE_KEY]: nextStack,
  };
};

export function useInternalNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback((to, options = {}) => {
    if (!to) return;

    const target = String(to);
    const currentPath = getLocationPath(location);

    if (target === currentPath) return;

    navigate(target, {
      ...options,
      state: createInternalNavigationState(location, options.state),
    });
  }, [location, navigate]);
}

export function useInternalBack(fallback = '/chat') {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const currentPath = getLocationPath(location);
    const stack = normalizeBackStack(location.state?.[INTERNAL_BACK_STACK_STATE_KEY])
      .filter((path) => path !== currentPath);
    const target = stack[stack.length - 1];

    if (target) {
      navigate(target, {
        replace: true,
        state: {
          [INTERNAL_BACK_STACK_STATE_KEY]: stack.slice(0, -1),
        },
      });
      return;
    }

    navigate(fallback, { replace: true });
  }, [fallback, location, navigate]);
}
