"use client";

/**
 * Organisation page — M8.2 Fixes.
 *
 * Identity tab: expanded to 3 sections (Legal, Contact, Group & Currency).
 * Structure tab: Add node, Download template, Upload structure, tree view.
 * Branding tab: unchanged.
 * Fiscal year tab: saves correctly, Generate periods, periods table.
 *
 * Route: /dashboard/business/setup/organisation
 */

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

type Tab = "identity" | "structure" | "branding" | "fiscal";

interface OrgConfig {
  tenant_id: string;
  // Legal
  legal_name?: string;
  rc_number?: string;
  date_of_registration?: string;
  commencement_date?: string;
  company_type?: string;
  industry?: string;
  tin?: string;
  vat_reg_number?: string;
  // Contact
  country?: string;
  registered_address?: string;
  operating_address?: string;
  company_phone?: string;
  company_email?: string;
  website?: string;
  external_auditor?: string;
  // Group & currency
  group_structure?: string;
  parent_company_name?: string;
  functional_currency?: string;
  reporting_currency?: string;
  authorised_share_capital?: number;
  // Fiscal
  fiscal_year_start_month?: number;
  fiscal_year_start_day?: number;
  fiscal_year_name_format?: string;
  period_closing_frequency?: string;
  // Branding
  branding?: { logo_url?: string; primary_colour?: string; button_style?: string };
}

interface OrgNode {
  id: string;
  parent_id?: string;
  node_type: string;
  name: string;
  code: string;
  cost_center_code?: string;
  entity_code?: string;
  is_active: boolean;
  sort_order: number;
  children: OrgNode[];
}

interface FiscalPeriod {
  id: string;
  fiscal_year: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: "open" | "current" | "closed";
}

const COMPANY_TYPES = [
  "Private Limited (Ltd)", "Public Limited (PLC)", "Partnership",
  "Sole Trader", "NGO / Non-profit", "Government / Public sector", "Other",
];
const INDUSTRIES = [
  "FMCG / Consumer goods", "Manufacturing", "Logistics / 3PL",
  "Professional services", "Healthcare", "Telecommunications",
  "Banking & finance", "Technology", "Construction & engineering",
  "Hospitality", "Retail", "Multinational", "Other",
];
const GROUP_STRUCTURES = ["Standalone", "Subsidiary", "Parent / Holding company", "Branch"];
const PERIOD_FREQS = ["Monthly", "Quarterly", "Annual"];
const FY_FORMATS = ["FY{YYYY}", "{YYYY}/{YYYY+1}", "{Mon YYYY} — {Mon YYYY}"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const NODE_TYPES = ["Legal entity", "Division / Business unit", "Department", "Cost center"];

// ── Small shared components ────────────────────────────────────────────────────

function TabBtn({ tab, active, onClick, label }: { tab: Tab; active: boolean; onClick: (t: Tab) => void; label: string }) {
  return (
    <button type="button" onClick={() => onClick(tab)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >{label}</button>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 ${props.className ?? ""}`}
    />
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className={`w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${props.className ?? ""}`}
    >{children}</select>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-5 first:mt-0">{title}</h3>;
}

// ── Tree node renderer ──────────────────────────────────────────────────────────

const NODE_TYPE_ICON: Record<string, string> = {
  "Legal entity":          "building",
  "Division / Business unit": "folders",
  "Department":            "folder",
  "Cost center":           "folder",
};

function TreeNode({
  node,
  depth = 0,
  onEdit,
  onDelete,
  deletingId,
}: {
  node: OrgNode;
  depth?: number;
  onEdit: (node: OrgNode) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const icon = NODE_TYPE_ICON[node.node_type] ?? "folder";
  const isDeleting = deletingId === node.id;

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 group">
        {hasChildren ? (
          <button type="button" onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600">
            <i className={`ti ti-chevron-${expanded ? "down" : "right"}`} style={{ fontSize: 12 }} />
          </button>
        ) : <span className="w-3" />}
        <i className={`ti ti-${icon} text-gray-500`} style={{ fontSize: 14 }} />
        <span className="text-sm text-gray-800">{node.name}</span>
        <span className="text-xs text-gray-400 font-mono">{node.code}</span>
        {node.node_type === "Cost center" && node.cost_center_code && (
          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono">
            {node.cost_center_code}
          </span>
        )}
        {node.node_type === "Legal entity" && node.entity_code && (
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">
            {node.entity_code}
          </span>
        )}
        <span className="text-[10px] text-gray-400 ml-1 opacity-0 group-hover:opacity-100">
          {node.node_type}
        </span>
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
            title="Edit node"
          >
            <i className="ti ti-edit" style={{ fontSize: 13 }} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            disabled={isDeleting}
            className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
            title="Delete node"
          >
            <i className={`ti ti-${isDeleting ? "loader" : "trash"}`} style={{ fontSize: 13 }} />
          </button>
        </div>
      </div>
      {expanded && node.children?.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrganisationPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("identity");
  const [org, setOrg] = useState<OrgConfig>({ tenant_id: "" });
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [genLabel, setGenLabel] = useState("FY2026");
  const [generating, setGenerating] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNode, setNewNode] = useState({ node_type: "", name: "", code: "", parent_id: "", cost_center_code: "", entity_code: "" });
  const [addingNode, setAddingNode] = useState(false);
  const [editNode, setEditNode] = useState<OrgNode | null>(null);
  const [editForm, setEditForm] = useState({ node_type: "", name: "", code: "", cost_center_code: "", entity_code: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadResult, setUploadResult] = useState<{ imported: number; updated: number; errors: Array<{ row: number; reason: string }> } | null>(null);

  // Load org config
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<OrgConfig>("/api/setup/org", { token: accessToken })
      .then(setOrg)
      .catch(() => {});
  }, [accessToken]);

  // Load org tree when Structure tab is active
  useEffect(() => {
    if (tab !== "structure" || !accessToken) return;
    apiFetch<{ nodes: OrgNode[] }>("/api/setup/org-structure", { token: accessToken })
      .then(d => setNodes(d.nodes))
      .catch(() => {});
  }, [tab, accessToken]);

  // Load fiscal periods when Fiscal tab is active
  useEffect(() => {
    if (tab !== "fiscal" || !accessToken) return;
    apiFetch<FiscalPeriod[]>("/api/setup/fiscal-periods", { token: accessToken })
      .then(setPeriods)
      .catch(() => {});
  }, [tab, accessToken]);

  const save = async (patch: Partial<OrgConfig>) => {
    if (!accessToken) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await apiFetch<OrgConfig>("/api/setup/org", {
        method: "PATCH",
        token: accessToken,
        body: patch,
      });
      setOrg(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const generatePeriods = async () => {
    if (!accessToken) return;
    setGenerating(true);
    try {
      const result = await apiFetch<FiscalPeriod[]>("/api/setup/fiscal-periods/generate", {
        method: "POST",
        token: accessToken,
        body: { fiscal_year_label: genLabel },
      });
      setPeriods(result);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadStructureTemplate = async () => {
    if (!accessToken) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/setup/org-structure/template`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "org_structure_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStructureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const result = await apiFetch<{ imported: number; updated: number; errors: Array<{ row: number; reason: string }> }>(
        "/api/setup/org-structure/upload",
        { method: "POST", token: accessToken, formData: fd }
      );
      setUploadResult(result);
      // Refresh tree
      const treeData = await apiFetch<{ nodes: OrgNode[] }>("/api/setup/org-structure", { token: accessToken });
      setNodes(treeData.nodes);
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const addNode = async () => {
    if (!accessToken || !newNode.name || !newNode.code || !newNode.node_type) return;
    setAddingNode(true);
    try {
      await apiFetch("/api/setup/org-structure", {
        method: "POST",
        token: accessToken,
        body: {
          node_type: newNode.node_type,
          name: newNode.name,
          code: newNode.code,
          parent_id: newNode.parent_id || undefined,
          cost_center_code: newNode.cost_center_code || undefined,
          entity_code: newNode.entity_code || undefined,
        },
      });
      setShowAddNode(false);
      setNewNode({ node_type: "", name: "", code: "", parent_id: "", cost_center_code: "", entity_code: "" });
      const treeData = await apiFetch<{ nodes: OrgNode[] }>("/api/setup/org-structure", { token: accessToken });
      setNodes(treeData.nodes);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setAddingNode(false);
    }
  };

  const openEdit = (node: OrgNode) => {
    setEditNode(node);
    setEditForm({
      node_type: node.node_type,
      name: node.name,
      code: node.code,
      cost_center_code: node.cost_center_code ?? "",
      entity_code: node.entity_code ?? "",
    });
  };

  const saveEdit = async () => {
    if (!accessToken || !editNode) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/setup/org-structure/${editNode.id}`, {
        method: "PATCH",
        token: accessToken,
        body: {
          name: editForm.name,
          node_type: editForm.node_type,
          cost_center_code: editForm.cost_center_code || undefined,
          entity_code: editForm.entity_code || undefined,
        },
      });
      setEditNode(null);
      const treeData = await apiFetch<{ nodes: OrgNode[] }>("/api/setup/org-structure", { token: accessToken });
      setNodes(treeData.nodes);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteNode = async (nodeId: string) => {
    if (!accessToken) return;
    if (!confirm("Delete this node? This cannot be undone.")) return;
    setDeletingId(nodeId);
    try {
      await apiFetch(`/api/setup/org-structure/${nodeId}`, {
        method: "DELETE",
        token: accessToken,
      });
      const treeData = await apiFetch<{ nodes: OrgNode[] }>("/api/setup/org-structure", { token: accessToken });
      setNodes(treeData.nodes);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  // Flatten tree for parent dropdown
  const flattenTree = (items: OrgNode[]): OrgNode[] =>
    items.flatMap(n => [n, ...flattenTree(n.children ?? [])]);

  const flatNodes = flattenTree(nodes);

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Organisation</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure your company identity, org structure, branding, and fiscal year.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <TabBtn tab="identity" active={tab === "identity"} onClick={setTab} label="Identity" />
        <TabBtn tab="structure" active={tab === "structure"} onClick={setTab} label="Structure" />
        <TabBtn tab="branding" active={tab === "branding"} onClick={setTab} label="Branding" />
        <TabBtn tab="fiscal" active={tab === "fiscal"} onClick={setTab} label="Fiscal year" />
      </div>

      {/* ── Identity tab ─────────────────────────────────────────────────────── */}
      {tab === "identity" && (
        <div className="space-y-4">
          <SectionHeading title="Legal & registration" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Legal name" required>
              <Input value={org.legal_name ?? ""} onChange={e => setOrg(o => ({ ...o, legal_name: e.target.value }))} placeholder="e.g. Red Bull Nigeria Limited" />
            </Field>
            <Field label="RC / Company registration number">
              <Input value={org.rc_number ?? ""} onChange={e => setOrg(o => ({ ...o, rc_number: e.target.value }))} placeholder="e.g. RC 1234567" />
            </Field>
            <Field label="Date of registration">
              <Input type="date" value={org.date_of_registration ?? ""} onChange={e => setOrg(o => ({ ...o, date_of_registration: e.target.value }))} />
            </Field>
            <Field label="Business commencement date">
              <Input type="date" value={org.commencement_date ?? ""} onChange={e => setOrg(o => ({ ...o, commencement_date: e.target.value }))} />
            </Field>
            <Field label="Company type">
              <Select value={org.company_type ?? ""} onChange={e => setOrg(o => ({ ...o, company_type: e.target.value }))}>
                <option value="">— Select —</option>
                {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Industry">
              <Select value={org.industry ?? ""} onChange={e => setOrg(o => ({ ...o, industry: e.target.value }))}>
                <option value="">— Select —</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </Select>
            </Field>
            <Field label="Tax identification number / TIN">
              <Input value={org.tin ?? ""} onChange={e => setOrg(o => ({ ...o, tin: e.target.value }))} placeholder="e.g. 12345678-0001" />
            </Field>
            <Field label="VAT registration number (optional)">
              <Input value={org.vat_reg_number ?? ""} onChange={e => setOrg(o => ({ ...o, vat_reg_number: e.target.value }))} placeholder="e.g. 02345678-0001" />
            </Field>
          </div>

          <SectionHeading title="Contact & address" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Registered address">
              <Input value={org.registered_address ?? ""} onChange={e => setOrg(o => ({ ...o, registered_address: e.target.value }))} placeholder="Full registered address" />
            </Field>
            <Field label="Operating address (optional)">
              <Input value={org.operating_address ?? ""} onChange={e => setOrg(o => ({ ...o, operating_address: e.target.value }))} placeholder="If different from registered" />
            </Field>
            <Field label="Company phone">
              <Input value={org.company_phone ?? ""} onChange={e => setOrg(o => ({ ...o, company_phone: e.target.value }))} placeholder="+234 1 234 5678" />
            </Field>
            <Field label="Company email">
              <Input type="email" value={org.company_email ?? ""} onChange={e => setOrg(o => ({ ...o, company_email: e.target.value }))} placeholder="info@company.com" />
            </Field>
            <Field label="Website (optional)">
              <Input value={org.website ?? ""} onChange={e => setOrg(o => ({ ...o, website: e.target.value }))} placeholder="https://www.company.com" />
            </Field>
            <Field label="External auditor name (optional)">
              <Input value={org.external_auditor ?? ""} onChange={e => setOrg(o => ({ ...o, external_auditor: e.target.value }))} placeholder="e.g. Deloitte Nigeria" />
            </Field>
          </div>

          <SectionHeading title="Group & currency" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Group structure">
              <Select value={org.group_structure ?? ""} onChange={e => setOrg(o => ({ ...o, group_structure: e.target.value }))}>
                <option value="">— Select —</option>
                {GROUP_STRUCTURES.map(g => <option key={g} value={g}>{g}</option>)}
              </Select>
            </Field>
            {(org.group_structure === "Subsidiary" || org.group_structure === "Branch") && (
              <Field label="Parent company name">
                <Input value={org.parent_company_name ?? ""} onChange={e => setOrg(o => ({ ...o, parent_company_name: e.target.value }))} placeholder="Parent company legal name" />
              </Field>
            )}
            <Field label="Functional currency (read-only)">
              <Input value={org.functional_currency ?? "NGN"} readOnly disabled placeholder="Set during signup" />
            </Field>
            <Field label="Reporting currency (optional)">
              <Select value={org.reporting_currency ?? ""} onChange={e => setOrg(o => ({ ...o, reporting_currency: e.target.value }))}>
                <option value="">Same as functional currency</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="NGN">NGN — Nigerian Naira</option>
                <option value="GHS">GHS — Ghanaian Cedi</option>
                <option value="KES">KES — Kenyan Shilling</option>
                <option value="ZAR">ZAR — South African Rand</option>
                <option value="AED">AED — UAE Dirham</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="AUD">AUD — Australian Dollar</option>
                <option value="SGD">SGD — Singapore Dollar</option>
                <option value="INR">INR — Indian Rupee</option>
                <option value="JPY">JPY — Japanese Yen</option>
                <option value="CNY">CNY — Chinese Yuan</option>
                <option value="CHF">CHF — Swiss Franc</option>
              </Select>
            </Field>
            <Field label="Authorised share capital (optional)">
              <Input type="number" value={org.authorised_share_capital ?? ""} onChange={e => setOrg(o => ({ ...o, authorised_share_capital: parseFloat(e.target.value) || undefined }))} placeholder="e.g. 10000000" />
            </Field>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => save({
                legal_name: org.legal_name,
                rc_number: org.rc_number,
                date_of_registration: org.date_of_registration,
                commencement_date: org.commencement_date,
                company_type: org.company_type,
                industry: org.industry,
                tin: org.tin,
                vat_reg_number: org.vat_reg_number,
                registered_address: org.registered_address,
                operating_address: org.operating_address,
                company_phone: org.company_phone,
                company_email: org.company_email,
                website: org.website,
                external_auditor: org.external_auditor,
                group_structure: org.group_structure,
                parent_company_name: org.parent_company_name,
                reporting_currency: org.reporting_currency,
                authorised_share_capital: org.authorised_share_capital,
              })}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save identity"}
            </button>
          </div>
        </div>
      )}

      {/* ── Structure tab ────────────────────────────────────────────────────── */}
      {tab === "structure" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={() => setShowAddNode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50">
              <i className="ti ti-plus" style={{ fontSize: 14 }} /> Add node
            </button>
            <button type="button" onClick={downloadStructureTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50">
              <i className="ti ti-download" style={{ fontSize: 14 }} /> Download template
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
              <i className="ti ti-upload" style={{ fontSize: 14 }} /> Upload structure
              <input ref={uploadRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleStructureUpload} />
            </label>
          </div>

          {uploadResult && (
            <div className={`mb-4 p-3 rounded-md text-sm ${uploadResult.errors.length ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
              Imported {uploadResult.imported} · Updated {uploadResult.updated} · {uploadResult.errors.length} error(s)
              {uploadResult.errors.length > 0 && (
                <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                  {uploadResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.reason}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Org tree */}
          {nodes.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              <i className="ti ti-building block mb-2" style={{ fontSize: 28 }} />
              <p>No org structure yet. Add nodes or upload a template.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              {nodes.map(n => (
                <TreeNode
                  key={n.id}
                  node={n}
                  onEdit={openEdit}
                  onDelete={deleteNode}
                  deletingId={deletingId}
                />
              ))}
            </div>
          )}

          {/* Add node modal */}
          {showAddNode && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-base font-semibold mb-4">Add org node</h3>
                <div className="space-y-3">
                  <Field label="Node type" required>
                    <Select value={newNode.node_type} onChange={e => setNewNode(n => ({ ...n, node_type: e.target.value }))}>
                      <option value="">— Select type —</option>
                      {NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="Name" required>
                    <Input value={newNode.name} onChange={e => setNewNode(n => ({ ...n, name: e.target.value }))} placeholder="e.g. Nigeria Finance" />
                  </Field>
                  <Field label="Code" required>
                    <Input value={newNode.code} onChange={e => setNewNode(n => ({ ...n, code: e.target.value.toUpperCase() }))} placeholder="e.g. NG_FIN" />
                  </Field>
                  <Field label="Parent node">
                    <Select value={newNode.parent_id} onChange={e => setNewNode(n => ({ ...n, parent_id: e.target.value }))}>
                      <option value="">— Top level —</option>
                      {flatNodes.map(n => <option key={n.id} value={n.id}>{n.name} ({n.code})</option>)}
                    </Select>
                  </Field>
                  {newNode.node_type === "Cost center" && (
                    <Field label="Cost center code">
                      <Input value={newNode.cost_center_code} onChange={e => setNewNode(n => ({ ...n, cost_center_code: e.target.value }))} placeholder="Must match dimension value code" />
                    </Field>
                  )}
                  {newNode.node_type === "Legal entity" && (
                    <Field label="Entity code (optional)">
                      <Input
                        value={newNode.entity_code}
                        onChange={e => setNewNode(n => ({ ...n, entity_code: e.target.value }))}
                        placeholder="e.g. N22341 (ERP profit centre code)"
                      />
                    </Field>
                  )}
                </div>
                <div className="flex gap-2 mt-5">
                  <button type="button" onClick={() => setShowAddNode(false)}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="button" onClick={addNode} disabled={addingNode || !newNode.name || !newNode.code || !newNode.node_type}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                    {addingNode ? "Adding…" : "Add node"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit node modal */}
          {editNode && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-base font-semibold mb-4">Edit org node</h3>
                <div className="space-y-3">
                  <Field label="Node type" required>
                    <Select value={editForm.node_type} onChange={e => setEditForm(f => ({ ...f, node_type: e.target.value }))}>
                      <option value="">— Select type —</option>
                      {NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="Name" required>
                    <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
                    <Input value={editForm.code} disabled className="bg-gray-100 text-gray-500 cursor-not-allowed" />
                    <p className="text-xs text-gray-400 mt-1">Code cannot be changed after creation.</p>
                  </div>
                  {editForm.node_type === "Cost center" && (
                    <Field label="Cost center code">
                      <Input value={editForm.cost_center_code} onChange={e => setEditForm(f => ({ ...f, cost_center_code: e.target.value }))} />
                    </Field>
                  )}
                  {editForm.node_type === "Legal entity" && (
                    <Field label="Entity code (optional)">
                      <Input value={editForm.entity_code} onChange={e => setEditForm(f => ({ ...f, entity_code: e.target.value }))} placeholder="e.g. N22341" />
                    </Field>
                  )}
                </div>
                <div className="flex gap-2 mt-5">
                  <button type="button" onClick={() => setEditNode(null)}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="button" onClick={saveEdit} disabled={savingEdit || !editForm.name || !editForm.node_type}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                    {savingEdit ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Branding tab ─────────────────────────────────────────────────────── */}
      {tab === "branding" && (
        <div className="space-y-4 max-w-md">
          <Field label="Logo URL">
            <Input value={org.branding?.logo_url ?? ""} onChange={e => setOrg(o => ({ ...o, branding: { ...o.branding, logo_url: e.target.value } }))} placeholder="https://..." />
          </Field>
          <Field label="Primary colour (hex)">
            <Input value={org.branding?.primary_colour ?? ""} onChange={e => setOrg(o => ({ ...o, branding: { ...o.branding, primary_colour: e.target.value } }))} placeholder="#2563EB" />
          </Field>
          <Field label="Button style">
            <Select value={org.branding?.button_style ?? ""} onChange={e => setOrg(o => ({ ...o, branding: { ...o.branding, button_style: e.target.value } }))}>
              <option value="">Default</option>
              <option value="rounded">Rounded</option>
              <option value="pill">Pill</option>
              <option value="square">Square</option>
            </Select>
          </Field>
          <button type="button" onClick={() => save({ branding: org.branding })} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save branding"}
          </button>
        </div>
      )}

      {/* ── Fiscal year tab ───────────────────────────────────────────────────── */}
      {tab === "fiscal" && (
        <div className="space-y-4 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Fiscal year start month">
              <Select value={org.fiscal_year_start_month ?? ""} onChange={e => setOrg(o => ({ ...o, fiscal_year_start_month: parseInt(e.target.value) || undefined }))}>
                <option value="">— Select —</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Fiscal year start day">
              <Input type="number" min={1} max={31} value={org.fiscal_year_start_day ?? ""} onChange={e => setOrg(o => ({ ...o, fiscal_year_start_day: parseInt(e.target.value) || undefined }))} placeholder="1" />
            </Field>
            <Field label="Fiscal year name format">
              <Select value={org.fiscal_year_name_format ?? ""} onChange={e => setOrg(o => ({ ...o, fiscal_year_name_format: e.target.value }))}>
                <option value="">— Select —</option>
                {FY_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
            </Field>
            <Field label="Period closing frequency">
              <Select value={org.period_closing_frequency ?? ""} onChange={e => setOrg(o => ({ ...o, period_closing_frequency: e.target.value }))}>
                <option value="">— Select —</option>
                {PERIOD_FREQS.map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
            </Field>
          </div>

          <p className="text-xs text-gray-500 italic">
            Period closing frequency controls when periods are formally closed for accounting purposes.
            It does not restrict report generation — reports can be generated for any date range at any time.
          </p>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => save({
              fiscal_year_start_month: org.fiscal_year_start_month,
              fiscal_year_start_day: org.fiscal_year_start_day,
              fiscal_year_name_format: org.fiscal_year_name_format,
              period_closing_frequency: org.period_closing_frequency,
            })} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save fiscal year settings"}
            </button>
          </div>

          {/* Generate periods */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-800 mb-3">Generate fiscal periods</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={genLabel}
                onChange={e => setGenLabel(e.target.value)}
                placeholder="e.g. FY2026 or 2025/2026"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={generatePeriods} disabled={generating || !org.fiscal_year_start_month}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 rounded-md disabled:opacity-50">
                <i className="ti ti-refresh" style={{ fontSize: 14 }} />
                {generating ? "Generating…" : `Generate periods for ${genLabel}`}
              </button>
            </div>
            {!org.fiscal_year_start_month && (
              <p className="mt-1 text-xs text-amber-600">Set fiscal year start month and save first.</p>
            )}
          </div>

          {/* Periods table */}
          {periods.length > 0 && (
            <div className="overflow-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Period name", "Opens", "Closes", "Status"].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periods.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{p.period_name}</td>
                      <td className="px-4 py-2 text-gray-600">{p.start_date}</td>
                      <td className="px-4 py-2 text-gray-600">{p.end_date}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === "current" ? "bg-blue-100 text-blue-700" :
                          p.status === "closed"  ? "bg-gray-100 text-gray-500" :
                          "bg-green-100 text-green-700"
                        }`}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
