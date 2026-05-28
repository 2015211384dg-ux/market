import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export function useApi(url, options = {}) {
  const { deps = [], skip = false } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetch = useCallback(async () => {
    if (!url || skip) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(url);
      setData(res.data);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [url, skip, ...deps]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch, updatedAt };
}

export async function postApi(url, body) {
  const res = await axios.post(url, body);
  return res.data;
}

export async function getApi(url) {
  const res = await axios.get(url);
  return res.data;
}
