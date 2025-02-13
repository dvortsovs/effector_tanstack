import {createEffect, createEvent, createStore, sample} from "effector";
import {
  QueryObserver,
  QueryKey,
  DefaultError,
  QueryClient,
  QueryObserverOptions
} from "@tanstack/query-core";
import {PaginationState} from "@tanstack/react-table";

export const effectorQuery = <TQueryFnData = unknown, TError = DefaultError, TData = TQueryFnData, TQueryData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
  getOptions: () => QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>
) => {
  const client = new QueryClient()
  const options = getOptions()
  const defaultedOptions = client.defaultQueryOptions(options)
  const observer = new QueryObserver<TQueryFnData, TError, TData, TQueryData , TQueryKey>(client, defaultedOptions)
  const event = createEvent<any>()
  const changeParams = createEffect((payload: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey, never>) => {
    const options = client.defaultQueryOptions(payload)
    const isNewQuery = !client.getQueryCache().get(options.queryHash)
    if (isNewQuery) {
      observer.setOptions(options)
    } else {
      event(observer.getOptimisticResult(options))
    }
  })
  observer.subscribe(event)

  const $store = createStore<TData | {}>(observer.getOptimisticResult(defaultedOptions))

  $store.on(event, (_, payload) => payload)

  return {data: $store, changeParams}
}

const fetchPosts = ({pageIndex, pageSize, filters}: {pageIndex: number, pageSize: number, filters: any[]}) => {
  return fetch(`https://jsonplaceholder.typicode.com/posts?_page=${pageIndex+1}&_limit=${pageSize}${filters.reduce(
    (acc, item) => {
      return acc + `&${item.id}=${item.value}`
    }, ''
  )}`).then((data) => data.json())
}


export const pagination = createStore<PaginationState>({pageIndex: 0, pageSize: 25})
export const setPagination = createEvent<any>()
export const filters = createStore<any>([])
export const setFilters = createEvent<any>()
filters.on(setFilters, (state, payload) => {
  const newPayload = payload(state)
  return newPayload
})
filters.watch(console.log)
export const store = effectorQuery(() =>({
  queryKey: ['posts', pagination.getState()],
  queryFn: () => fetchPosts({...pagination.getState(), filters: filters.getState()}),
}))

pagination.on(setPagination, (state, payload) => {
  const newPayload = payload(state)
  return newPayload
})

sample({
  clock: [pagination, filters],
  source: [pagination, filters],
  fn: ([pagination, filters]) => {
    console.log(filters)
    return ({
    queryFn: () => fetchPosts({...pagination, filters}),
    queryKey: ['posts', pagination, ...filters]
  })},
  target: store.changeParams
})