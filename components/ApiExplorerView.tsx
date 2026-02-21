import React, { useMemo, useState } from 'react';
import { Search, Database, ArrowLeftRight, Info, Network } from 'lucide-react';
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

const normalizePathTokens = (path?: string) =>
  (path || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/\{[^}]+\}/g, ':param').toLowerCase());

const relationScore = (a: ApiEndpoint, b: ApiEndpoint) => {
  const ta = normalizePathTokens(a.path);
  const tb = normalizePathTokens(b.path);
  if (!ta.length || !tb.length) return 0;

  const prefix = ta[0] && tb[0] && ta[0] === tb[0] ? 2 : 0;
  const common = ta.filter((t) => tb.includes(t)).length;
  return prefix + common;
};

const ApiExplorerView: React.FC<{ content: string }> = ({ content }) => {
  const parsed = useMemo(() => parseApiJson(content), [content]);
  const endpoints = useMemo(() => (Array.isArray(parsed?.endpoints) ? parsed!.endpoints! : []), [parsed]);

  const [search, setSearch] = useState('');
  const [selectedPathKey, setSelectedPathKey] = useState<string>('');

  const filtered = useMemo(() => {
    if (!search.trim()) return endpoints;
    const q = search.toLowerCase();
    return endpoints.filter((ep) => `${ep.method || ''} ${ep.path || ''} ${ep.summary || ''}`.toLowerCase().includes(q));
  }, [endpoints, search]);

  const selected = useMemo(() => {
    if (selectedPathKey) {
      const found = filtered.find((ep) => `${(ep.method || '').toUpperCase()} ${ep.path || ''}` === selectedPathKey);
      if (found) return found;
    }
    return filtered[0] || endpoints[0];
  }, [filtered, endpoints, selectedPathKey]);

  const selectedKey = `${(selected?.method || '').toUpperCase()} ${selected?.path || ''}`;

  const related = useMemo(() => {
    if (!selected) return [] as Array<{ ep: ApiEndpoint; score: number }>;
    return endpoints
      .filter((ep) => ep !== selected)
      .map((ep) => ({ ep, score: relationScore(selected, ep) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [endpoints, selected]);

  const graphNodes = useMemo(() => {
    if (!selected) return [] as Array<{ id: string; label: string; method: string; x: number; y: number; center?: boolean; score?: number }>;
    const around = related.slice(0, 6);
    const cx = 460;
    const cy = 220;
    const radius = 150;
    const nodes = around.map((item, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(around.length, 1);
      return {
        id: `${(item.ep.method || '').toUpperCase()} ${item.ep.path || ''}`,
        label: item.ep.path || '/',
        method: (item.ep.method || 'GET').toUpperCase(),
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        score: item.score,
      };
    });

    nodes.push({
      id: selectedKey,
      label: selected.path || '/',
      method: (selected.method || 'GET').toUpperCase(),
      x: cx,
      y: cy,
      center: true,
    });

    return nodes;
  }, [selected, related, selectedKey]);

  if (!endpoints.length) {
    return <MarkdownRenderer content={content} />;
  }

  return (
    <div className="h-[calc(100vh-150px)] rounded-[2rem] border border-slate-200 bg-[#f8f9fd] overflow-hidden" dir="rtl">
      <div className="h-full grid grid-cols-12">
        <aside className="col-span-3 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-5 border-b border-slate-200 bg-blue-50/30">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              جزئیات ورودی / خروجی API
            </h3>
            <p className="text-xs text-slate-500 mt-1">برای endpoint انتخاب‌شده</p>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] border font-bold ${methodTone(selected?.method || 'GET')}`}>{(selected?.method || 'GET').toUpperCase()}</span>
                <span className="text-[10px] text-slate-400 font-mono">{selected?.source || 'source: -'}</span>
              </div>
              <p className="font-mono text-xs text-slate-800" dir="ltr">{selected?.path || '/'}</p>
              {selected?.summary && <p className="text-xs text-slate-500 mt-1">{selected.summary}</p>}
            </div>

            <section className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Request Fields</div>
              <div className="max-h-52 overflow-auto">
                {(selected?.requestBody?.fields || []).length === 0 ? (
                  <p className="text-xs text-slate-400 p-3">ورودی ساختاریافته ثبت نشده است.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-white text-slate-500">
                      <tr className="border-b border-slate-100">
                        <th className="p-2 text-right">Field</th>
                        <th className="p-2 text-right">Type</th>
                        <th className="p-2 text-right">Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected?.requestBody?.fields || []).map((f, i) => (
                        <tr key={`${f.name}-${i}`} className="border-b border-slate-50">
                          <td className="p-2 font-mono">{f.name || '-'}</td>
                          <td className="p-2">{f.type || 'unknown'}</td>
                          <td className="p-2">{f.required ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Response Fields</div>
              <div className="max-h-52 overflow-auto">
                {(selected?.response?.fields || []).length === 0 ? (
                  <p className="text-xs text-slate-400 p-3">خروجی ساختاریافته ثبت نشده است.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-white text-slate-500">
                      <tr className="border-b border-slate-100">
                        <th className="p-2 text-right">Field</th>
                        <th className="p-2 text-right">Type</th>
                        <th className="p-2 text-right">Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected?.response?.fields || []).map((f, i) => (
                        <tr key={`${f.name}-${i}`} className="border-b border-slate-50">
                          <td className="p-2 font-mono">{f.name || '-'}</td>
                          <td className="p-2">{f.type || 'unknown'}</td>
                          <td className="p-2">{f.required ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3" open>
              <summary className="text-xs font-bold cursor-pointer text-slate-700">Request / Response نمونه</summary>
              <div className="grid grid-cols-1 gap-2 mt-2">
                <pre className="text-[11px] bg-white border border-slate-200 rounded p-2 overflow-auto" dir="ltr">{asPrettyJson(selected?.requestExample || selected?.requestBody || {})}</pre>
                <pre className="text-[11px] bg-white border border-slate-200 rounded p-2 overflow-auto" dir="ltr">{asPrettyJson(selected?.responseExample || selected?.response || {})}</pre>
              </div>
            </details>

            {(selected?.errorResponses || []).length > 0 && (
              <section className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                <h5 className="text-xs font-bold text-rose-700 mb-2">Error Responses</h5>
                <div className="space-y-2">
                  {(selected?.errorResponses || []).map((err, idx) => (
                    <div key={idx} className="text-xs bg-white border border-rose-100 rounded p-2">
                      <p className="font-mono text-rose-700">{err.status || '-'} • {err.code || 'UNKNOWN'}</p>
                      <p className="text-slate-600 mt-1">{err.message || '-'}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </aside>

        <section className="col-span-6 border-r border-l border-slate-200 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.07)_0%,transparent_35%),radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.08)_0%,transparent_35%)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-4xl font-black text-slate-800">گراف روابط Endpointها</h2>
              <p className="text-slate-500 mt-1">روابط واقعی بر اساس شباهت مسیرها و ماژول‌های مشترک</p>
            </div>
            <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1 flex items-center gap-1">
              <Network className="w-3.5 h-3.5" />
              {related.length} ارتباط
            </div>
          </div>

          <div className="h-[500px] rounded-3xl border border-dashed border-blue-200 bg-white/60 overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 920 440">
              {graphNodes.filter((n) => !n.center).map((node, i) => (
                <g key={`edge-${i}`}>
                  <line x1={460} y1={220} x2={node.x} y2={node.y} stroke="#c4b5fd" strokeDasharray="6 6" strokeWidth="2" />
                  <text x={(460 + node.x) / 2} y={(220 + node.y) / 2 - 5} fill="#64748b" fontSize="11" textAnchor="middle">
                    score {node.score}
                  </text>
                </g>
              ))}

              {graphNodes.map((node) => (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.center ? 38 : 24}
                    fill="white"
                    stroke={node.center ? '#2563eb' : '#cbd5e1'}
                    strokeWidth={node.center ? 2.5 : 1.5}
                  />
                  <text x={node.x} y={node.y + 4} fill="#1e293b" fontSize={node.center ? 13 : 11} textAnchor="middle" fontWeight="700">
                    {node.center ? 'Selected API' : node.method}
                  </text>
                  <text x={node.x} y={node.y + (node.center ? 52 : 42)} fill="#64748b" fontSize="11" textAnchor="middle">
                    {(node.label || '/').slice(0, 34)}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
              <p className="text-[10px] text-slate-400">API انتخاب‌شده</p>
              <p className="text-sm font-bold text-slate-800 mt-1">{selected?.path || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
              <p className="text-[10px] text-slate-400">تعداد endpoint کل</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{endpoints.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
              <p className="text-[10px] text-slate-400">ارتباطات معتبر</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{related.length}</p>
            </div>
          </div>
        </section>

        <aside className="col-span-3 border-l border-slate-200 bg-[#f8f7ff] flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-violet-600" />
              لیست APIهای برنامه
            </h3>
            <div className="mt-3 relative">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو در endpointها..."
                className="w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2">
            {filtered.map((ep, idx) => {
              const key = `${(ep.method || '').toUpperCase()} ${ep.path || ''}`;
              const active = key === selectedKey;
              return (
                <button
                  key={`${key}-${idx}`}
                  onClick={() => setSelectedPathKey(key)}
                  className={`w-full text-right rounded-xl border p-3 transition-all ${active ? 'bg-white border-blue-300 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border font-mono ${methodTone(ep.method || '')}`}>{(ep.method || 'GET').toUpperCase()}</span>
                    <span className="text-[10px] text-slate-400">#{idx + 1}</span>
                  </div>
                  <p className="font-mono text-xs text-slate-800" dir="ltr">{ep.path || '/'}</p>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{ep.summary || 'بدون توضیح'}</p>
                </button>
              );
            })}
            {!filtered.length && <p className="text-xs text-slate-400 p-2">نتیجه‌ای پیدا نشد.</p>}
          </div>

          <div className="p-3 border-t border-slate-200 bg-white/60 text-xs text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 text-slate-400" />
            انتخاب هر API در این لیست، گراف روابط و جزئیات ورودی/خروجی را به‌روزرسانی می‌کند.
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ApiExplorerView;
