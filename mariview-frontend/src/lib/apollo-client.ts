import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

// Error link: log errors but do NOT aggressively redirect on 401.
// We let AuthContext handle session expiry gracefully via /api/auth/me checks.
// Only redirect on CONFIRMED 401 after multiple consecutive failures.
let consecutive401Count = 0;
const MAX_401_BEFORE_REDIRECT = 3;

const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
        graphQLErrors.forEach(({ message }) =>
            console.error(`[GraphQL Error]: ${message}`)
        );
    }
    if (networkError) {
        const statusCode = 'statusCode' in networkError ? (networkError as any).statusCode : null;
        if (statusCode === 401) {
            consecutive401Count++;
            console.warn(`[Auth] 401 received (${consecutive401Count}/${MAX_401_BEFORE_REDIRECT})`);
            // Only redirect after multiple consecutive 401s (not a transient blip)
            if (consecutive401Count >= MAX_401_BEFORE_REDIRECT && window.location.pathname !== '/login') {
                console.warn('[Auth] Session confirmed expired — redirecting to login');
                window.location.href = '/login';
            }
            return;
        }
        // Reset counter on non-401 errors (server is reachable, auth works)
        consecutive401Count = 0;
        console.error(`[Network Error]: ${networkError.message}`);
    }
});

// HTTP link: uses relative URL (proxied by nginx in prod, Vite in dev)
const httpLink = new HttpLink({
    uri: '/api/graphql',
    credentials: 'include', // Send HttpOnly cookies
});

const client = new ApolloClient({
    link: from([errorLink, httpLink]),
    cache: new InMemoryCache(),
    defaultOptions: {
        watchQuery: {
            // Use no-cache for polling queries so live positions always update
            fetchPolicy: 'no-cache',
        },
    },
});

export default client;
