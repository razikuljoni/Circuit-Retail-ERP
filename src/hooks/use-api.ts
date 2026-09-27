'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** Simple fetch-state hook with manual refetch. Polls when pollMs provided. */
export function useApi<T>(url: string | null, opts?: { pollMs?: number }) {
  const [state, setState] = useState<UseApiState<T>>({ data: null, loading: true, error: null })
  const urlRef = useRef(url)
  urlRef.current = url
  const mounted = useRef(true)

  const fetchData = useCallback(async (silent = false) => {
    const u = urlRef.current
    if (!u) return
    if (!silent) setState((s) => ({ ...s, loading: true }))
    try {
      const data = await api.get<T>(u)
      if (mounted.current) setState({ data, loading: false, error: null })
    } catch (e) {
      if (mounted.current)
        setState((s) => ({ data: silent ? s.data : null, loading: false, error: e instanceof Error ? e.message : 'Failed' }))
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void fetchData()
    return () => {
      mounted.current = false
    }
  }, [url, fetchData])

  useEffect(() => {
    if (!opts?.pollMs || !url) return
    const t = setInterval(() => void fetchData(true), opts.pollMs)
    return () => clearInterval(t)
  }, [opts?.pollMs, url, fetchData])

  const refetch = useCallback(() => fetchData(true), [fetchData])
  return { ...state, refetch, setData: (d: T) => setState((s) => ({ ...s, data: d })) }
}

/** Mutation helper: wraps async fn with pending state + error surfacing */
export function useMutation<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>) {
  const [pending, setPending] = useState(false)
  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setPending(true)
      try {
        return await fn(...args)
      } finally {
        setPending(false)
      }
    },
    [fn]
  )
  return { run, pending }
}
