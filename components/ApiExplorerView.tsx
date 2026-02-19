import React, { useMemo, useState } from 'react';
import { Search, ZoomIn, ZoomOut, Code2, Share2, Bookmark, ArrowLeft, Info, Network, Database, FolderOpen, Folder, Download } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

type ApiField = { name?: string; type?: string; required?: boolean; desc?: string };
type ApiEndpoint = {
  method?: string;
  path?: string;
  summary?: string;
  source?: string;
  requestBody?: { fields?: ApiField[] };
  requestExample?: unknown;
  response?: { fields?: ApiField[] };
  responseExample?: unknown;
  errorResponses?: Array<{ status?: number; code?: string; message?: string; example?: unknown }>;
};

const parseApiJson = (raw: string): { endpoints?: ApiEndpoint[] } | null => {
  const direct = (raw || '').trim();
  if (!direct) return null;

  const candidates: string[] = [direct];
  const fenceMatch = direct.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  const firstObj = direct.indexOf('{');
  const lastObj = direct.lastIndexOf('}');
  if (firstObj >= 0 && lastObj > firstObj) candidates.push(direct.slice(firstObj, lastObj + 1));
  if (/^"?endpoints"?\s*:/i.test(direct)) candidates.push(`{${direct}}`);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // noop
    }
  }
  return null;
};

const methodTone = (method: string) => {
  const m = (method || '').toUpperCase();
  if (m === 'GET') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (m === 'POST') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (m === 'PUT' || m === 'PATCH') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (m === 'DELETE') return 'bg-rose-50 text-rose-700 border-rose-100';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const asPrettyJson = (value: unknown) => {
  if (value === undefined || value === null) return '{}';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const ApiExplorerView: React.FC<{ content: string }> = ({ content }) => {
  const parsed = useMemo(() => parseApiJson(content), [content]);
  const endpoints = useMemo(() => (Array.isArray(parsed?.endpoints) ? parsed!.endpoints! : []), [parsed]);

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snippetLang, setSnippetLang] = useState<'curl' | 'node' | 'python'>('curl');

  const filtered = useMemo(() => {
    if (!search.trim()) return endpoints;
    const q = search.toLowerCase();
    return endpoints.filter((ep) =>
      `${ep.method || ''} ${ep.path || ''} ${ep.summary || ''}`.toLowerCase().includes(q)
    );
  }, [endpoints, search]);

  const selected = filtered[selectedIndex] || filtered[0] || endpoints[0];

  const schemaObjects = useMemo(() => {
    const map: Record<string, ApiField[]> = {};
    endpoints.forEach((ep) => {
      if (ep.requestBody?.fields?.length) map['Request'] = [...(map['Request'] || []), ...ep.requestBody.fields];
      if (ep.response?.fields?.length) map['Response'] = [...(map['Response'] || []), ...ep.response.fields];
    });
    return Object.entries(map).map(([name, fields]) => ({
      name,
      fields: fields.filter((f, idx, arr) => f.name && arr.findIndex((x) => x.name === f.name) === idx).slice(0, 12),
    }));
  }, [endpoints]);

  const relatedEndpoints = useMemo(() => {
    if (!selected?.path) return [] as ApiEndpoint[];
    const root = selected.path.split('/').filter(Boolean)[0] || '';
    return endpoints
      .filter((ep) => ep.path !== selected.path && (ep.path || '').split('/').filter(Boolean)[0] === root)
      .slice(0, 3);
  }, [selected, endpoints]);

  const pathForCode = selected?.path || '/resource';
  const methodForCode = (selected?.method || 'GET').toUpperCase();
  const url = `https://api.example.com${pathForCode.replace(/\{(.*?)\}/g, '123')}`;
  const sampleBody = asPrettyJson(selected?.requestExample || selected?.requestBody?.fields?.reduce((acc: Record<string, unknown>, f) => {
    if (!f.name) return acc;
    acc[f.name] = f.type === 'number' ? 0 : f.type === 'boolean' ? true : 'value';
    return acc;
  }, {}));

  const snippet = {
    curl: `curl --request ${methodForCode} \\\n  --url "${url}" \\\n  --header 'Authorization: Bearer YOUR_TOKEN' \\\n  --header 'Content-Type: application/json'${methodForCode === 'GET' ? '' : ` \\\n  --data '${sampleBody.replace(/\n/g, '')}'`}`,
    node: `const res = await fetch('${url}', {\n  method: '${methodForCode}',\n  headers: {\n    'Authorization': 'Bearer YOUR_TOKEN',\n    'Content-Type': 'application/json'\n  },\n  ${methodForCode === 'GET' ? '' : `body: JSON.stringify(${sampleBody}),`}\n});\nconst data = await res.json();`,
    python: `import requests\n\nresp = requests.request(\n    '${methodForCode}',\n    '${url}',\n    headers={\n        'Authorization': 'Bearer YOUR_TOKEN',\n        'Content-Type': 'application/json'\n    },\n    ${methodForCode === 'GET' ? '' : `json=${sampleBody.replace(/\n/g, '\n    ')},`}\n)\nprint(resp.json())`,
  };

  if (!endpoints.length) {
    return <MarkdownRenderer content={content} />;
  }

  return (
    <div className="h-[calc(100vh-150px)] rounded-[2rem] border border-slate-200 bg-[#fdfbfc] overflow-hidden" dir="rtl">
      <div className="h-full grid grid-cols-12">
        <aside className="col-span-3 border-l border-slate-200 bg-[#f8f7ff] flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2"><Database className="w-4 h-4 text-violet-500" /> ساختار داده (Schema)</h3>
            <div className="mt-3 relative">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }} placeholder="جستجو در endpointها..." className="w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 py-2 text-xs" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {schemaObjects.map((obj, idx) => (
              <div key={`${obj.name}-${idx}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {idx === 0 ? <FolderOpen className="w-4 h-4 text-slate-400" /> : <Folder className="w-4 h-4 text-slate-400" />}
                    <p className="text-sm font-bold text-slate-700">{obj.name} Object</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">object</span>
                </div>
                <div className="mr-5 border-r border-slate-200 pr-3 space-y-1">
                  {obj.fields.map((f, i) => (
                    <div key={`${f.name}-${i}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-700">{f.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{f.type || 'unknown'}</span>
                      </div>
                      {f.desc && <p className="text-[10px] text-slate-400">{f.desc}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="col-span-6 relative bg-[radial-gradient(circle_at_15%_50%,rgba(139,92,246,0.06)_0%,transparent_35%),radial-gradient(circle_at_85%_30%,rgba(14,165,233,0.06)_0%,transparent_35%)]">
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-4xl font-black text-slate-800">نقشه کهکشانی سرویس‌ها</h2>
                <p className="text-slate-500 mt-2">نمای بصری از ارتباطات بین endpointهای API</p>
              </div>
              <div className="flex gap-2">
                <button className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center"><ZoomIn className="w-4 h-4 text-slate-500" /></button>
                <button className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center"><ZoomOut className="w-4 h-4 text-slate-500" /></button>
              </div>
            </div>

            <div className="h-[420px] rounded-3xl border border-dashed border-violet-200/70 relative overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 900 420">
                <path d="M450 210 L300 130" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="8 8" />
                <path d="M450 210 L600 130" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="8 8" />
                <path d="M450 210 L450 320" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="8 8" />
                <circle cx="450" cy="210" r="38" fill="white" stroke="#8b5cf6" strokeWidth="2" />
                <text x="450" y="217" textAnchor="middle" fontSize="18" fill="#334155" fontWeight="700">Core API</text>
                <circle cx="300" cy="130" r="25" fill="white" stroke="#e2e8f0" /><circle cx="300" cy="130" r="7" fill="#7dd3fc" />
                <text x="300" y="172" textAnchor="middle" fontSize="14" fill="#64748b">Identity</text>
                <circle cx="600" cy="130" r="25" fill="white" stroke="#e2e8f0" /><circle cx="600" cy="130" r="7" fill="#c4b5fd" />
                <text x="600" y="172" textAnchor="middle" fontSize="14" fill="#64748b">Users</text>
                <circle cx="450" cy="320" r="25" fill="white" stroke="#e2e8f0" /><circle cx="450" cy="320" r="7" fill="#fde68a" />
                <text x="450" y="362" textAnchor="middle" fontSize="14" fill="#64748b">Storage</text>
              </svg>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4"><p className="text-[10px] text-slate-400">اندپوینت‌های فعال</p><p className="text-2xl font-black text-slate-800">{endpoints.length}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4"><p className="text-[10px] text-slate-400">دسته‌بندی مسیرها</p><p className="text-2xl font-black text-slate-800">{new Set(endpoints.map((e) => (e.path || '').split('/').filter(Boolean)[0])).size}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4"><p className="text-[10px] text-slate-400">وضعیت مرجع API</p><p className="text-2xl font-black text-emerald-600">Ready</p></div>
            </div>
          </div>
        </section>

        <aside className="col-span-3 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-5 border-b border-slate-200 bg-violet-50/30">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded text-[10px] border font-bold ${methodTone(selected?.method || 'GET')}`}>{(selected?.method || 'GET').toUpperCase()}</span>
              <span className="text-[11px] text-slate-400 font-mono">v2.1.0</span>
            </div>
            <h3 className="mt-2 text-xl font-black text-slate-800 font-mono" dir="ltr">{selected?.path || '/'}</h3>
            <p className="text-sm text-slate-500 mt-1">{selected?.summary || 'جزئیات endpoint انتخاب‌شده'}</p>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2"><Code2 className="w-4 h-4 text-violet-500" /> نمونه کد پیاده‌سازی</h4>
                <div className="bg-slate-100 p-1 rounded-lg text-[10px] font-bold">
                  {(['curl', 'node', 'python'] as const).map((lang) => (
                    <button key={lang} onClick={() => setSnippetLang(lang)} className={`px-2 py-1 rounded ${snippetLang === lang ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500'}`}>{lang === 'node' ? 'Node.js' : lang}</button>
                  ))}
                </div>
              </div>
              <pre className="rounded-xl bg-slate-900 text-emerald-300 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap" dir="ltr">{snippet[snippetLang]}</pre>
            </section>

            <section>
              <h4 className="text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-2"><Network className="w-4 h-4 text-amber-500" /> اندپوینت‌های مرتبط</h4>
              <div className="space-y-2">
                {relatedEndpoints.map((ep, i) => (
                  <button key={`${ep.path}-${i}`} onClick={() => { const idx = filtered.findIndex((x) => x.path === ep.path && x.method === ep.method); if (idx >= 0) setSelectedIndex(idx); }} className="w-full text-right rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-violet-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border font-mono ${methodTone(ep.method || '')}`}>{(ep.method || '').toUpperCase()}</span>
                      <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <p className="font-mono text-xs text-slate-700" dir="ltr">{ep.path}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{ep.summary || '-'}</p>
                  </button>
                ))}
                {!relatedEndpoints.length && <p className="text-xs text-slate-400">اندپوینت مرتبطی یافت نشد.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
              <h5 className="text-xs font-extrabold text-violet-700 mb-2">جزئیات تکمیلی</h5>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-start gap-2"><Info className="w-4 h-4 text-violet-500 mt-0.5" /> تعداد فیلدهای ورودی: {(selected?.requestBody?.fields || []).length}</li>
                <li className="flex items-start gap-2"><Info className="w-4 h-4 text-violet-500 mt-0.5" /> تعداد فیلدهای خروجی: {(selected?.response?.fields || []).length}</li>
                <li className="flex items-start gap-2"><Info className="w-4 h-4 text-violet-500 mt-0.5" /> تعداد خطاهای مستندشده: {(selected?.errorResponses || []).length}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h5 className="text-xs font-extrabold text-slate-700">Request / Response</h5>
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <summary className="text-xs font-bold cursor-pointer">Request Example</summary>
                <pre className="mt-2 text-[11px] font-mono overflow-x-auto" dir="ltr">{asPrettyJson(selected?.requestExample || selected?.requestBody || {})}</pre>
              </details>
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-3" open>
                <summary className="text-xs font-bold cursor-pointer">Response Example</summary>
                <pre className="mt-2 text-[11px] font-mono overflow-x-auto" dir="ltr">{asPrettyJson(selected?.responseExample || selected?.response || {})}</pre>
              </details>
            </section>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold">آخرین تغییر</p>
              <p className="text-xs text-slate-600">از خروجی api_ref تولیدشده</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-500 hover:text-violet-600"><Share2 className="w-4 h-4" /></button>
              <button className="p-2 text-slate-500 hover:text-violet-600"><Bookmark className="w-4 h-4" /></button>
              <button className="p-2 text-slate-500 hover:text-violet-600"><Download className="w-4 h-4" /></button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ApiExplorerView;
