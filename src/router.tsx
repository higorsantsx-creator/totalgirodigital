import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { logDiagnostic } from "./lib/debug-diagnostics";

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        logDiagnostic(
          "query.error",
          {
            queryKey: query.queryKey,
            state: query.state.status,
            fetchStatus: query.state.fetchStatus,
            failureCount: query.state.fetchFailureCount,
          },
          error,
        );
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, _context, mutation) => {
        logDiagnostic(
          "mutation.error",
          {
            mutationKey: mutation.options.mutationKey,
            variables,
          },
          error,
        );
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
