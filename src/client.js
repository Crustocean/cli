import { CrustoceanAPIError } from './errors.js';

export class CrustoceanClient {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.token = token;
  }

  async _request(method, path, body) {
    const url = `${this.apiUrl}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const opts = { method, headers };
    if (body && method !== 'GET') {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
      const msg = (typeof data === 'object' && data?.error) ? data.error : `HTTP ${res.status}`;
      throw new CrustoceanAPIError(res.status, msg, data);
    }
    return data;
  }

  get(path) { return this._request('GET', path); }
  post(path, body) { return this._request('POST', path, body); }
  patch(path, body) { return this._request('PATCH', path, body); }
  delete(path, body) { return this._request('DELETE', path, body); }
}
