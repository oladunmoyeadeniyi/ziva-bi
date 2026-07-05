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

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

type Tab = "identity" | "structure" | "branding" | "config";

interface OrgConfig {
  tenant_id: string;
  // Legal
  legal_name?: string;
  rc_number?: string;
  date_of_registration?: string;
  commencement_date?: string;
  first_fiscal_year_end?: string;
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
  // Branding
  branding?: BrandingConfig;
  // Configuration tab
  org_configuration?: OrgConfiguration;
}

interface TaxItem {
  id: string;
  name: string;
  desc: string;
  rate: string;
  checked: boolean;
  tag?: "new" | "changed";
  custom?: boolean;
  category?: string;
}

interface OrgConfiguration {
  // Financial features
  use_dimensions: boolean;
  use_multi_currency: boolean;
  fx_rate_source?: string;
  fx_update_frequency?: string;
  use_intercompany: boolean;
  // Operations
  use_inventory_costing: boolean;
  inventory_costing_method?: string;
  use_budget_control: boolean;
  budget_exceeded_action?: string;
  // Tax
  is_tax_haven: boolean;
  tax_items: TaxItem[];
  // Governance
  use_audit_trail: boolean;
  use_multilevel_auth: boolean;
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

interface ChartEmployee {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  line_manager_id: string | null;
  approval_role_id: string | null;
  approval_role_name: string | null;
}

interface BrandingTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  sidebar: string;
  font_family: string;
  font_size: string;
  button_style: string;
  card_radius: string;
  email_header_bg: string;
  email_sender_name: string;
  logo_url: string;
  favicon_url: string;
}

interface BrandingConfig {
  active_theme_id: string;
  themes: BrandingTheme[];
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
const NODE_TYPES = ["Parent company", "Legal entity", "Division / Business unit", "Department", "Cost center"];

const PRESET_THEMES: Omit<BrandingTheme, "id">[] = [
  { name: "Corporate Blue",  primary: "#2563EB", secondary: "#64748B", accent: "#F59E0B", sidebar: "#1E293B", font_family: "Inter",          font_size: "default", button_style: "rounded", card_radius: "medium", email_header_bg: "#1E293B", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Forest Green",    primary: "#16A34A", secondary: "#4B7B5E", accent: "#F97316", sidebar: "#14532D", font_family: "Inter",          font_size: "default", button_style: "rounded", card_radius: "medium", email_header_bg: "#14532D", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Midnight Dark",   primary: "#8B5CF6", secondary: "#6D6D8A", accent: "#EC4899", sidebar: "#0F0F0F", font_family: "Inter",          font_size: "default", button_style: "pill",    card_radius: "large",  email_header_bg: "#0F0F0F", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Classic Red",     primary: "#DC2626", secondary: "#78716C", accent: "#FBBF24", sidebar: "#1C1917", font_family: "Inter",          font_size: "default", button_style: "rounded", card_radius: "medium", email_header_bg: "#1C1917", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Ocean Teal",      primary: "#0D9488", secondary: "#4B7B78", accent: "#F59E0B", sidebar: "#134E4A", font_family: "DM Sans",        font_size: "default", button_style: "rounded", card_radius: "large",  email_header_bg: "#134E4A", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Slate Modern",    primary: "#475569", secondary: "#94A3B8", accent: "#06B6D4", sidebar: "#1E293B", font_family: "IBM Plex Sans",  font_size: "default", button_style: "square",  card_radius: "sharp",  email_header_bg: "#1E293B", email_sender_name: "", logo_url: "", favicon_url: "" },
];

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
  "Parent company":               "building-skyscraper",
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
  const [expanded, setExpanded] = useState(depth === 0);
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
        {(node.node_type === "Legal entity" || node.node_type === "Parent company") && node.entity_code && (
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

// ── Role name helpers ─────────────────────────────────────────────────────────

/** Convert a role title to its initials. "Finance Director" → "FD", "National On Premise Manager" → "NOPM" */
function toInitials(name: string): string {
  return name
    .trim()
    .split(/[\s\/\-_]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join("");
}

// ── People View — role hierarchy chart ───────────────────────────────────────

interface OrgRole {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  parent_role_id: string | null;
  max_occupants: number | null; // null=unlimited, 1=solo, N=capped
  cost_center_id: string | null;
  cost_center_name: string | null;
  entity_node_id: string | null;
  entity_code: string | null;
  entity_name: string | null;
  designation: string | null;
  area: string | null;
  sub_area: string | null;
  employment_type: string | null;
}

interface CostCenterOption {
  id: string;
  name: string;
  code: string;
}

interface EntityOption {
  id: string;
  name: string;
  code: string;
  entity_code: string | null;
}

interface RoleTreeNode extends OrgRole {
  children: RoleTreeNode[];
  depth: number;
}

function buildRoleTree(roles: OrgRole[], parentId: string | null = null, depth = 0): RoleTreeNode[] {
  return roles
    .filter(r => r.parent_role_id === parentId)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
    .map(r => ({ ...r, depth, children: buildRoleTree(roles, r.id, depth + 1) }));
}

// Cost-centre–indexed colour palette (deterministic hash by CC id/name seed)
const CC_PALETTE = [
  { accent: "#1d4ed8", light: "#dbeafe" },
  { accent: "#0891b2", light: "#cffafe" },
  { accent: "#059669", light: "#d1fae5" },
  { accent: "#d97706", light: "#fef3c7" },
  { accent: "#7c3aed", light: "#ede9fe" },
  { accent: "#be185d", light: "#fce7f3" },
  { accent: "#b45309", light: "#fef9c3" },
  { accent: "#0f766e", light: "#ccfbf1" },
];

// Null / cross-functional roles get a neutral grey palette
const CC_NEUTRAL = { accent: "#475569", light: "#f1f5f9" };

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

function roleColor(node: OrgRole) {
  if (!node.cost_center_id) return CC_NEUTRAL;
  const idx = hashString(node.cost_center_id) % CC_PALETTE.length;
  return CC_PALETTE[idx];
}

const RC = "#e2e8f0"; // connector colour
const RW = 2;
const RH = 28;

function RoleChartNode({
  node,
  onAddChild,
  onDelete,
  onEdit,
  draggingId,
  dropTargetId,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  showFullName,
}: {
  node: RoleTreeNode;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string, name: string) => void;
  onEdit: (role: OrgRole) => void;
  draggingId: string | null;
  dropTargetId: string | null;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string | null) => void;
  onDragEnd: () => void;
  onDrop: (targetId: string | null) => void;
  showFullName: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isDragging  = draggingId === node.id;
  const isDropTarget = dropTargetId === node.id && draggingId !== node.id;

  const emp = node.employment_type ?? "permanent";

  const boxBg = isDropTarget
    ? "#dbeafe"
    : node.designation === "head_of_entity"     ? "#dbeafe"
    : node.designation === "head_of_department" ? "#ede9fe"
    : emp === "contract"   ? "#fffbeb"
    : emp === "outsourced" ? "#f8fafc"
    : "#ffffff";

  const borderColor = isDropTarget                                      ? "#3b82f6"
    : node.designation === "head_of_entity"     ? "#3b82f6"
    : node.designation === "head_of_department" ? "#7c3aed"
    : emp === "contract"                        ? "#d97706"
    : emp === "outsourced"                      ? "#94a3b8"
    : "#94a3b8";

  const borderStyle = emp === "contract" ? "dashed" : emp === "outsourced" ? "dotted" : "solid";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>

      {/* ── Organogram box ── */}
      <div
        draggable
        title={node.name}
        onDragStart={(e) => { e.stopPropagation(); onDragStart(node.id); }}
        onDragOver={(e)  => { e.preventDefault();  e.stopPropagation(); onDragEnter(node.id); }}
        onDragLeave={(e) => { e.stopPropagation(); if (dropTargetId === node.id) onDragEnter(null); }}
        onDrop={(e)      => { e.preventDefault();  e.stopPropagation(); onDrop(node.id); }}
        onDragEnd={onDragEnd}
        style={{
          background: boxBg,
          border: `1.5px ${borderStyle} ${borderColor}`,
          borderRadius: 3,
          width: 172,
          textAlign: "center",
          padding: "10px 12px 8px",
          opacity: isDragging ? 0.4 : 1,
          cursor: draggingId ? "copy" : "grab",
          boxShadow: isDropTarget
            ? "0 0 0 3px rgba(59,130,246,0.18)"
            : "0 1px 4px rgba(0,0,0,0.08)",
          transition: "border-color 0.1s, box-shadow 0.1s, opacity 0.1s",
          position: "relative",
        }}>

        {/* Collapse toggle */}
        {hasChildren && (
          <button type="button" onClick={() => setExpanded(v => !v)}
            style={{ position: "absolute", top: 4, right: 4, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2, lineHeight: 1 }}>
            <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} style={{ fontSize: 10 }} />
          </button>
        )}

        {/* Role name — initials by default, full name when toggled */}
        <div
          style={{ fontSize: showFullName ? 10 : 13, fontWeight: 700, color: "#0f172a", letterSpacing: showFullName ? 0.2 : 0.8, textTransform: "uppercase", lineHeight: 1.4 }}
        >
          {showFullName ? node.name : toInitials(node.name)}
        </div>

        {/* Designation */}
        {node.designation && (
          <div style={{
            fontSize: 9, fontWeight: 600, marginTop: 3, letterSpacing: 0.3,
            color: node.designation === "head_of_entity" ? "#1d4ed8" : "#6d28d9",
          }}>
            {node.designation === "head_of_entity" ? "HEAD OF ENTITY" : "HEAD OF DEPT"}
          </div>
        )}

        {/* Cost centre */}
        {node.cost_center_name && (
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>
            {node.cost_center_name}
          </div>
        )}

        {/* Area / sub_area */}
        {(node.area || node.sub_area) && (
          <div style={{ fontSize: 9, color: "#0369a1", marginTop: 2, fontStyle: "italic" }}>
            📍 {node.area}{node.area && node.sub_area ? " › " : ""}{node.sub_area}
          </div>
        )}

        {/* Employment type badge — only for non-permanent */}
        {emp !== "permanent" && (
          <div style={{
            display: "inline-block", marginTop: 4,
            fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
            padding: "1px 5px", borderRadius: 2,
            background: emp === "contract" ? "#fef3c7" : "#f1f5f9",
            color: emp === "contract" ? "#92400e" : "#475569",
            border: `1px ${borderStyle} ${borderColor}`,
          }}>
            {emp === "contract" ? "Contract" : "Outsourced"}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: "flex", gap: 4, marginTop: 8, justifyContent: "center" }}>
          <button type="button" onClick={() => onAddChild(node.id)} title="Add sub-role"
            style={{ fontSize: 10, fontWeight: 600, color: "#3b82f6", background: "none", border: "1px solid #bfdbfe", borderRadius: 3, padding: "2px 7px", cursor: "pointer" }}>
            + Sub-role
          </button>
          <button type="button" onClick={() => onEdit(node)} title="Edit"
            style={{ fontSize: 10, color: "#64748b", background: "none", border: "1px solid #e2e8f0", borderRadius: 3, padding: "2px 6px", cursor: "pointer" }}>
            <i className="ti ti-pencil" style={{ fontSize: 10 }} />
          </button>
          <button type="button" onClick={() => onDelete(node.id, node.name)} title="Delete"
            style={{ fontSize: 10, color: "#ef4444", background: "none", border: "1px solid #fecaca", borderRadius: 3, padding: "2px 6px", cursor: "pointer" }}>
            <i className="ti ti-trash" style={{ fontSize: 10 }} />
          </button>
        </div>
      </div>

      {/* ── Connector + children ── */}
      {expanded && hasChildren && (
        <>
          <div style={{ width: RW, height: RH, background: RC }} />
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            {node.children.map((child, i) => {
              const isFirst = i === 0;
              const isLast  = i === node.children.length - 1;
              const isOnly  = node.children.length === 1;
              return (
                <div key={child.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", padding: "0 18px" }}>
                  {!isOnly && !isFirst && <div style={{ position: "absolute", top: 0, left: 0, right: "50%", height: RW, background: RC }} />}
                  {!isOnly && !isLast  && <div style={{ position: "absolute", top: 0, left: "50%", right: 0, height: RW, background: RC }} />}
                  <div style={{ width: RW, height: RH, background: RC }} />
                  <RoleChartNode
                    node={child} onAddChild={onAddChild} onDelete={onDelete} onEdit={onEdit}
                    draggingId={draggingId} dropTargetId={dropTargetId}
                    onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd} onDrop={onDrop}
                    showFullName={showFullName}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function OrganisationPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const pathname = usePathname();

  const changeTab = (t: Tab) => {
    setTab(t);
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    p.delete("view"); // reset sub-tab when switching main tab
    router.replace(`${pathname}?${p.toString()}`);
  };

  const changeStructureView = (v: "edit" | "chart") => {
    setStructureView(v);
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", v);
    router.replace(`${pathname}?${p.toString()}`);
  };
  const initialTab = (searchParams.get("tab") as Tab) || "identity";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [org, setOrg] = useState<OrgConfig>({ tenant_id: "" });
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNode, setNewNode] = useState({ node_type: "", name: "", code: "", parent_id: "", cost_center_code: "", entity_code: "" });
  const [addingNode, setAddingNode] = useState(false);
  const [editNode, setEditNode] = useState<OrgNode | null>(null);
  const [editForm, setEditForm] = useState({ node_type: "", name: "", code: "", cost_center_code: "", entity_code: "", parent_id: undefined as string | undefined });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadResult, setUploadResult] = useState<{ imported: number; updated: number; errors: Array<{ row: number; reason: string }> } | null>(null);

  type BrandingSubTab = "themes" | "controls" | "preview";
  const [brandingTab, setBrandingTab] = useState<BrandingSubTab>("themes");

  function getDefaultTheme(): BrandingTheme {
    return {
      id: crypto.randomUUID(),
      name: "My Theme",
      primary: "#2563EB",
      secondary: "#64748B",
      accent: "#F59E0B",
      sidebar: "#1E293B",
      font_family: "Inter",
      font_size: "default",
      button_style: "rounded",
      card_radius: "medium",
      email_header_bg: "#1E293B",
      email_sender_name: org.legal_name ?? "",
      logo_url: "",
      favicon_url: "",
    };
  }

  function getLuminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  function getButtonTextColor(hex: string): string {
    return getLuminance(hex) > 0.179 ? "#1a1a1a" : "#ffffff";
  }

  const [editTheme, setEditTheme] = useState<BrandingTheme>(getDefaultTheme);

  const DEFAULT_CONFIG: OrgConfiguration = {
    use_dimensions: false,
    use_multi_currency: false,
    fx_rate_source: "Manual entry",
    fx_update_frequency: "Daily",
    use_intercompany: false,
    use_inventory_costing: false,
    inventory_costing_method: "Weighted average cost (AVCO)",
    use_budget_control: false,
    budget_exceeded_action: "Show warning, allow posting",
    is_tax_haven: false,
    tax_items: [],
    use_audit_trail: true,
    use_multilevel_auth: false,
  };

  const [config, setConfig] = useState<OrgConfiguration>(DEFAULT_CONFIG);

  // Load org config
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<OrgConfig>("/api/setup/org", { token: accessToken })
      .then(data => {
        setOrg(data);
        if (data.org_configuration) {
          setConfig(data.org_configuration);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  // Load org tree when Structure tab is active
  useEffect(() => {
    if (tab !== "structure" || !accessToken) return;
    apiFetch<{ nodes: OrgNode[] }>("/api/setup/org-structure", { token: accessToken })
      .then(d => setNodes(d.nodes))
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
      parent_id: node.parent_id ?? undefined,
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
          parent_id: editForm.parent_id || undefined,
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

  const flatNodes = useMemo(() => {
    const result: OrgNode[] = [];
    const flatten = (list: OrgNode[]) => {
      for (const n of list) {
        result.push(n);
        if (n.children?.length) flatten(n.children);
      }
    };
    flatten(nodes);
    return result;
  }, [nodes]);

  // People view state
  const initialView = (searchParams.get("view") as "edit" | "chart") || "edit";
  const [structureView, setStructureView] = useState<"edit" | "chart">(initialView);
  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([]);
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);

  // Add/edit modal state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const [roleParentId, setRoleParentId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", description: "", capacity: "" as "" | "single" | "multiple" | "unlimited" | "custom", customN: "2", costCenterId: "", entityNodeId: "", designation: "", area: "", sub_area: "", employment_type: "permanent" });
  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null); // "__root__" = root drop zone
  const [savingRole, setSavingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [showFullNames, setShowFullNames] = useState(false); // default: show initials
  const [chartZoom, setChartZoom] = useState(0.85);          // default zoom-out so wide trees fit
  const [chartFullscreen, setChartFullscreen] = useState(false);

  // Bulk upload state
  const roleUploadRef = useRef<HTMLInputElement>(null);
  const [roleUploadResult, setRoleUploadResult] = useState<{ created: number; updated: number; skipped: number; errors: Array<{ row: number; role: string; error: string }> } | null>(null);
  const [uploadingRoles, setUploadingRoles] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Close fullscreen on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setChartFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadRoles = async () => {
    if (!accessToken) return;
    const data = await apiFetch<OrgRole[]>("/api/approvals/roles", { token: accessToken }).catch(() => [] as OrgRole[]);
    setOrgRoles(data);
  };

  useEffect(() => {
    if (tab !== "structure" || structureView !== "chart" || !accessToken) return;
    setLoadingRoles(true);
    Promise.all([
      loadRoles(),
      apiFetch<CostCenterOption[]>("/api/hr/cost-centers/options", { token: accessToken }).catch(() => [] as CostCenterOption[]).then(setCostCenters),
      apiFetch<EntityOption[]>("/api/setup/entity-options", { token: accessToken }).catch(() => [] as EntityOption[]).then(setEntityOptions),
    ]).finally(() => setLoadingRoles(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, structureView, accessToken]);

  const roleTree = useMemo(() => buildRoleTree(orgRoles), [orgRoles]);

  // Returns all descendant IDs of a given role (to prevent cycle on drop)
  const getDescendantIds = useCallback((roleId: string): Set<string> => {
    const result = new Set<string>();
    const add = (id: string) => {
      orgRoles.filter(r => r.parent_role_id === id).forEach(child => {
        result.add(child.id);
        add(child.id);
      });
    };
    add(roleId);
    return result;
  }, [orgRoles]);

  const [clearingRoles, setClearingRoles] = useState(false);
  const [clearRolesError, setClearRolesError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<{ id: string; name: string } | null>(null);
  const clearAllRoles = async () => {
    if (!accessToken) return;
    setClearingRoles(true);
    setClearRolesError(null);
    setShowClearConfirm(false);
    const snapshot = [...orgRoles]; // capture list before any re-renders
    const errors: string[] = [];
    for (const r of snapshot) {
      try {
        await apiFetch(`/api/approvals/roles/${r.id}`, { method: "DELETE", token: accessToken });
      } catch (e: unknown) {
        errors.push(`${r.name}: ${(e as Error).message}`);
      }
    }
    await loadRoles(); // always reload regardless of individual errors
    if (errors.length) setClearRolesError(errors.join(" · "));
    setClearingRoles(false);
  };

  const handleRoleDragStart = (id: string) => { setDraggingId(id); setDropTargetId(null); };
  const handleRoleDragEnter = (id: string | null) => setDropTargetId(id);
  const handleRoleDragEnd   = () => { setDraggingId(null); setDropTargetId(null); };
  const handleRoleDrop = async (targetId: string | null) => {
    // targetId === "__root__" → make the role a root (parent_role_id = null)
    const newParentId = (targetId === "__root__") ? null : targetId;
    if (!draggingId || !accessToken) { handleRoleDragEnd(); return; }
    if (draggingId === newParentId) { handleRoleDragEnd(); return; }
    if (newParentId !== null && getDescendantIds(draggingId).has(newParentId)) {
      handleRoleDragEnd(); return; // would create a cycle
    }
    const prevDragging = draggingId;
    handleRoleDragEnd();
    try {
      await apiFetch(`/api/approvals/roles/${prevDragging}`, {
        method: "PATCH", token: accessToken,
        body: { parent_role_id: newParentId },
      });
      await loadRoles();
    } catch (_) {}
  };

  const openAddRole = (parentId: string | null) => {
    setEditingRole(null);
    setRoleParentId(parentId);
    // Cascade area: parent's sub_area becomes this child's area.
    // e.g. DPM has area="Lagos Region", sub_area="" → DPS inherits area="Lagos Region"
    //      DPS has area="Lagos Region", sub_area="Lagos Mainland" → Striker inherits area="Lagos Mainland"
    let inheritedArea = "";
    if (parentId) {
      const parent = orgRoles.find(r => r.id === parentId);
      if (parent) inheritedArea = parent.sub_area || parent.area || "";
    }
    setRoleForm({ name: "", description: "", capacity: "", customN: "2", costCenterId: "", entityNodeId: "", designation: "", area: inheritedArea, sub_area: "", employment_type: "permanent" });
    setShowRoleModal(true);
  };

  const openEditRole = (role: OrgRole) => {
    setEditingRole(role);
    setRoleParentId(role.parent_role_id);
    const cap = role.max_occupants === 1 ? "single" : role.max_occupants === null ? "unlimited" : "custom";
    setRoleForm({ name: role.name, description: role.description ?? "", capacity: cap as "single" | "multiple" | "unlimited" | "custom", customN: String(role.max_occupants ?? 2), costCenterId: role.cost_center_id ?? "", entityNodeId: role.entity_node_id ?? "", designation: role.designation ?? "regular", area: role.area ?? "", sub_area: role.sub_area ?? "", employment_type: role.employment_type ?? "permanent" });
    setShowRoleModal(true);
  };

  const saveRole = async () => {
    const needsParent = roleForm.designation !== "head_of_entity";
    if (!roleForm.name.trim() || !roleForm.costCenterId || !roleForm.capacity || !roleForm.designation || !roleForm.employment_type || (needsParent && !roleParentId) || !accessToken) return;
    setSavingRole(true);
    const maxOcc = roleForm.capacity === "single" ? 1 : (roleForm.capacity === "unlimited" || roleForm.capacity === "") ? null : parseInt(roleForm.customN) || null;
    const ccId = roleForm.costCenterId || null;
    const desig = (roleForm.designation === "regular" || !roleForm.designation) ? null : roleForm.designation;
    const empType = roleForm.employment_type || "permanent";
    const areaVal = roleForm.area.trim() || null;
    const subAreaVal = roleForm.sub_area.trim() || null;
    try {
      if (editingRole) {
        await apiFetch(`/api/approvals/roles/${editingRole.id}`, { method: "PATCH", token: accessToken, body: { name: roleForm.name.trim(), description: roleForm.description || null, max_occupants: maxOcc, cost_center_id: ccId, entity_node_id: roleForm.entityNodeId || null, designation: desig, employment_type: empType, area: areaVal, sub_area: subAreaVal } });
      } else {
        await apiFetch("/api/approvals/roles", { method: "POST", token: accessToken, body: { name: roleForm.name.trim(), description: roleForm.description || null, parent_role_id: roleParentId ?? undefined, max_occupants: maxOcc, cost_center_id: ccId, entity_node_id: roleForm.entityNodeId || null, designation: desig, employment_type: empType, area: areaVal, sub_area: subAreaVal } });
      }
      await loadRoles();
      setShowRoleModal(false);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSavingRole(false);
    }
  };

  const deleteRole = (id: string, name: string) => {
    setDeleteRoleTarget({ id, name });
  };
  const confirmDeleteRole = async () => {
    if (!deleteRoleTarget || !accessToken) return;
    const { id } = deleteRoleTarget;
    setDeleteRoleTarget(null);
    setDeletingRoleId(id);
    try {
      await apiFetch(`/api/approvals/roles/${id}`, { method: "DELETE", token: accessToken });
      await loadRoles();
    } catch (_) { /* ignore */ }
    setDeletingRoleId(null);
  };

  const downloadRoleTemplate = async () => {
    if (!accessToken) return;
    setTemplateError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/approvals/roles/template`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let detail = body;
        try { detail = JSON.parse(body)?.detail || body; } catch (_) {}
        setTemplateError(detail || `HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "roles_template.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setTemplateError((e as Error).message);
    }
  };

  const handleRoleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setUploadingRoles(true);
    setRoleUploadResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiFetch<{ created: number; updated: number; skipped: number; errors: Array<{ row: number; role: string; error: string }> }>(
        "/api/approvals/roles/bulk-upload",
        { method: "POST", token: accessToken, formData: form }
      );
      setRoleUploadResult(result);
      await loadRoles();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setUploadingRoles(false);
      if (roleUploadRef.current) roleUploadRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <PageContainer maxWidth="4xl">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="4xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      {returnTo && (
        <button
          type="button"
          onClick={() => router.push(decodeURIComponent(returnTo))}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-3 font-medium">
          <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
          Back to Dimensions
        </button>
      )}
      <PageHeading title="Organisation" />
      {tab === "identity" && (
        <p className="text-sm text-gray-500 mb-3">
          Configure your company identity, org structure, branding, and fiscal year.
        </p>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <TabBtn tab="identity" active={tab === "identity"} onClick={changeTab} label="Identity" />
        <TabBtn tab="structure" active={tab === "structure"} onClick={changeTab} label="Structure" />
        <TabBtn tab="branding" active={tab === "branding"} onClick={changeTab} label="Branding" />
        <TabBtn tab="config" active={tab === "config"} onClick={changeTab} label="Configuration" />
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
              <Input type="date" defaultValue={org.date_of_registration ?? ""} onBlur={e => setOrg(o => ({ ...o, date_of_registration: e.target.value }))} />
            </Field>
            <Field label="Business commencement date">
              <Input type="date" defaultValue={org.commencement_date ?? ""} onBlur={e => setOrg(o => ({ ...o, commencement_date: e.target.value }))} />
            </Field>
            <Field label="First fiscal year end" required>
              {(() => {
                const reg = org.date_of_registration;
                const comm = org.commencement_date;
                const anchorDate = reg && comm ? (reg < comm ? reg : comm) : (reg ?? comm ?? "");
                const maxFyEndDate = (() => {
                  if (!anchorDate) return "";
                  const d = new Date(anchorDate + "T00:00:00");
                  d.setFullYear(d.getFullYear() + 2);
                  d.setDate(d.getDate() - 1);
                  return d.toISOString().slice(0, 10);
                })();
                const earlierLabel = !reg ? "commencement" : !comm ? "registration" : reg <= comm ? "registration" : "commencement";
                const anchorFmt = anchorDate ? anchorDate.split("-").reverse().join("/") : "";
                return (
                  <>
                    <Input
                      key={`fye-${org.tenant_id}`}
                      type="date"
                      defaultValue={org.first_fiscal_year_end ?? ""}
                      min={anchorDate || undefined}
                      max={maxFyEndDate || undefined}
                      onBlur={e => {
                        if (e.target.value) setOrg(o => ({ ...o, first_fiscal_year_end: e.target.value }));
                      }}
                    />
                    {anchorDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        The last day of your first accounting year. Must be within two years of your {earlierLabel} date ({anchorFmt}).
                      </p>
                    )}
                  </>
                );
              })()}
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
            <Button
              variant="primary"
              onClick={() => save({
                legal_name: org.legal_name,
                rc_number: org.rc_number,
                date_of_registration: org.date_of_registration,
                commencement_date: org.commencement_date,
                first_fiscal_year_end: org.first_fiscal_year_end,
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
              loading={saving}
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save identity"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Structure tab ────────────────────────────────────────────────────── */}
      {tab === "structure" && (
        <div>
          {/* Sub-tab toggle */}
          <div className="flex items-center gap-0 border-b border-gray-200 mb-3">
            {(["edit", "chart"] as const).map(v => (
              <button key={v} type="button" onClick={() => changeStructureView(v)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${structureView === v ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {v === "edit" ? "Org Structure" : "Role Hierarchy"}
              </button>
            ))}
          </div>

          {/* ── Edit sub-tab ──────────────────────────────────────────────── */}
          {structureView === "edit" && (
            <>
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
                  <input ref={uploadRef} type="file" accept=".xlsx" className="hidden" onChange={handleStructureUpload} />
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
            </>
          )}

          {/* ── People view sub-tab ───────────────────────────────────────── */}
          {structureView === "chart" && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-sm font-semibold text-gray-800">Role hierarchy</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Zoom controls */}
                  <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                    <button type="button" onClick={() => setChartZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}
                      className="px-2 py-1.5 text-sm font-medium hover:bg-gray-50 border-r border-gray-300" title="Zoom out">
                      <i className="ti ti-minus" style={{ fontSize: 12 }} />
                    </button>
                    <button type="button" onClick={() => setChartZoom(1)}
                      className="px-2 py-1.5 text-xs font-medium hover:bg-gray-50 border-r border-gray-300 min-w-[42px] text-center" title="Reset zoom">
                      {Math.round(chartZoom * 100)}%
                    </button>
                    <button type="button" onClick={() => setChartZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
                      className="px-2 py-1.5 text-sm font-medium hover:bg-gray-50" title="Zoom in">
                      <i className="ti ti-plus" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setChartFullscreen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
                    title="Expand to full screen">
                    <i className="ti ti-arrows-maximize" style={{ fontSize: 13 }} />
                  </button>
                  <button type="button" onClick={() => setShowFullNames(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
                    title={showFullNames ? "Switch to initials view" : "Switch to full name view"}>
                    <i className="ti ti-text-size" style={{ fontSize: 13 }} />
                    {showFullNames ? "Initials" : "Full names"}
                  </button>
                  <button type="button" onClick={downloadRoleTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50">
                    <i className="ti ti-download" style={{ fontSize: 13 }} /> Template
                  </button>
                  <label className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer ${uploadingRoles ? "opacity-60 pointer-events-none" : ""}`}>
                    <i className="ti ti-upload" style={{ fontSize: 13 }} /> {uploadingRoles ? "Uploading…" : "Bulk upload"}
                    <input ref={roleUploadRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleRoleUpload} />
                  </label>
                  {orgRoles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(true)}
                      disabled={clearingRoles}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
                    >
                      <i className="ti ti-trash" style={{ fontSize: 13 }} /> {clearingRoles ? "Clearing…" : "Clear all"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openAddRole(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <i className="ti ti-plus" style={{ fontSize: 14 }} /> {orgRoles.length === 0 ? "Add top-level role" : "Add role"}
                  </button>
                </div>
              </div>

              {/* Bulk upload result banner */}
              {templateError && (
                <div className="mb-3 p-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  <span className="font-medium">Template error:</span> {templateError}
                  <button type="button" onClick={() => setTemplateError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
                </div>
              )}
              {roleUploadResult && (
                <div className={`mb-4 p-3 rounded-md text-sm ${roleUploadResult.errors.length ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                  <span className="font-medium">Upload complete:</span> {roleUploadResult.created} created · {roleUploadResult.updated} updated · {roleUploadResult.skipped} skipped
                  {roleUploadResult.errors.length > 0 && (
                    <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                      {roleUploadResult.errors.slice(0, 8).map((e, i) => <li key={i}>Row {e.row} ({e.role}): {e.error}</li>)}
                      {roleUploadResult.errors.length > 8 && <li>…and {roleUploadResult.errors.length - 8} more</li>}
                    </ul>
                  )}
                </div>
              )}

              {clearRolesError && (
                <div className="mb-3 p-3 rounded-md text-sm bg-red-50 border border-red-200 text-red-700 flex items-start justify-between gap-3">
                  <span><i className="ti ti-alert-circle mr-1.5" />{clearRolesError}</span>
                  <button type="button" onClick={() => setClearRolesError(null)} className="text-red-400 hover:text-red-600 shrink-0"><i className="ti ti-x" /></button>
                </div>
              )}

              {loadingRoles ? (
                <div className="flex items-start justify-center gap-10 py-10">
                  {[1, 2, 3].map(i => <div key={i} className="h-40 w-44 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : orgRoles.length === 0 ? (
                <div className="text-center py-16 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  <i className="ti ti-sitemap block mb-3" style={{ fontSize: 40, color: "#d1d5db" }} />
                  <p className="font-semibold text-gray-600 text-base mb-1">No roles yet</p>
                  <p className="text-xs mb-4">Start by adding your top-level role (e.g. General Manager, CEO)</p>
                  <button type="button" onClick={() => openAddRole(null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add first role
                  </button>
                </div>
              ) : (
                <>
                  {/* Root drop zone — visible only while dragging */}
                  {draggingId && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); handleRoleDragEnter("__root__"); }}
                      onDragLeave={() => { if (dropTargetId === "__root__") handleRoleDragEnter(null); }}
                      onDrop={(e) => { e.preventDefault(); handleRoleDrop("__root__"); }}
                      style={{
                        border: `2px dashed ${dropTargetId === "__root__" ? "#3b82f6" : "#d1d5db"}`,
                        borderRadius: 10,
                        padding: "7px 20px",
                        marginBottom: 10,
                        textAlign: "center",
                        fontSize: 11,
                        fontWeight: 600,
                        color: dropTargetId === "__root__" ? "#3b82f6" : "#9ca3af",
                        background: dropTargetId === "__root__" ? "#eff6ff" : "transparent",
                        transition: "all 0.12s",
                      }}
                    >
                      <i className="ti ti-arrow-up" style={{ marginRight: 5 }} />
                      Drop here to make top-level role
                    </div>
                  )}
                  <div style={{ overflowX: "auto", overflowY: "auto", paddingBottom: 32, paddingTop: 4, maxHeight: 520 }}>
                    <div style={{ display: "inline-flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "center", minWidth: "100%", gap: 32, padding: "4px 16px 0", transform: `scale(${chartZoom})`, transformOrigin: "top center", transition: "transform 0.15s" }}>
                      {roleTree.map(root => (
                        <RoleChartNode
                          key={root.id}
                          node={root}
                          onAddChild={openAddRole}
                          onDelete={deleteRole}
                          onEdit={openEditRole}
                          draggingId={draggingId}
                          dropTargetId={dropTargetId}
                          onDragStart={handleRoleDragStart}
                          onDragEnter={handleRoleDragEnter}
                          onDragEnd={handleRoleDragEnd}
                          onDrop={handleRoleDrop}
                          showFullName={showFullNames}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-5 flex-wrap text-xs text-gray-500">
                    <span><i className="ti ti-user-star mr-1.5 text-blue-400" /><strong className="text-gray-700">{orgRoles.length}</strong> roles defined</span>
                    <span><i className="ti ti-user mr-1.5 text-emerald-400" /><strong className="text-gray-700">{orgRoles.filter(r => r.max_occupants === 1).length}</strong> single-occupant</span>
                    <span><i className="ti ti-users mr-1.5 text-violet-400" /><strong className="text-gray-700">{orgRoles.filter(r => r.max_occupants !== 1).length}</strong> multi-occupant</span>
                  </div>
                </>
              )}

              {/* ── Fullscreen chart overlay ── */}
              {chartFullscreen && (
                <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#f8fafc", display: "flex", flexDirection: "column" }}>
                  {/* Fullscreen toolbar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid #e2e8f0", background: "#fff", flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Role Hierarchy</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button type="button" onClick={() => setShowFullNames(v => !v)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 13, fontWeight: 500, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
                        <i className="ti ti-text-size" style={{ fontSize: 13 }} />
                        {showFullNames ? "Initials" : "Full names"}
                      </button>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #d1d5db", borderRadius: 6, overflow: "hidden" }}>
                        <button type="button" onClick={() => setChartZoom(z => Math.max(0.2, +(z - 0.1).toFixed(1)))}
                          style={{ padding: "5px 9px", fontSize: 13, background: "#fff", border: "none", borderRight: "1px solid #d1d5db", cursor: "pointer" }} title="Zoom out">
                          <i className="ti ti-minus" />
                        </button>
                        <button type="button" onClick={() => setChartZoom(1)}
                          style={{ padding: "5px 8px", fontSize: 12, background: "#fff", border: "none", borderRight: "1px solid #d1d5db", cursor: "pointer", minWidth: 46, textAlign: "center" }} title="Reset zoom">
                          {Math.round(chartZoom * 100)}%
                        </button>
                        <button type="button" onClick={() => setChartZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
                          style={{ padding: "5px 9px", fontSize: 13, background: "#fff", border: "none", cursor: "pointer" }} title="Zoom in">
                          <i className="ti ti-plus" />
                        </button>
                      </div>
                      <button type="button" onClick={() => setChartZoom(0.6)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", fontSize: 13, fontWeight: 500, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}
                        title="Fit all roles on screen">
                        <i className="ti ti-arrows-minimize" style={{ fontSize: 13 }} /> Fit
                      </button>
                      <button type="button" onClick={() => setChartFullscreen(false)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, border: "1px solid #e2e8f0", borderRadius: 6, background: "#0f172a", color: "#fff", cursor: "pointer" }}>
                        <i className="ti ti-arrows-minimize" style={{ fontSize: 13 }} /> Close view
                      </button>
                    </div>
                  </div>
                  {/* Fullscreen chart area */}
                  <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
                    <div style={{ display: "inline-flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "center", minWidth: "100%", gap: 32, padding: "4px 16px 0", transform: `scale(${chartZoom})`, transformOrigin: "top center", transition: "transform 0.15s" }}>
                      {roleTree.map(root => (
                        <RoleChartNode
                          key={root.id}
                          node={root}
                          onAddChild={openAddRole}
                          onDelete={deleteRole}
                          onEdit={openEditRole}
                          draggingId={draggingId}
                          dropTargetId={dropTargetId}
                          onDragStart={handleRoleDragStart}
                          onDragEnter={handleRoleDragEnter}
                          onDragEnd={handleRoleDragEnd}
                          onDrop={handleRoleDrop}
                          showFullName={showFullNames}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Fullscreen legend */}
                  <div style={{ padding: "10px 20px", borderTop: "1px solid #e2e8f0", background: "#fff", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", fontSize: 11, color: "#64748b", flexShrink: 0 }}>
                    <span><i className="ti ti-user-star" style={{ marginRight: 4, color: "#60a5fa" }} /><strong style={{ color: "#374151" }}>{orgRoles.length}</strong> roles</span>
                    <span><i className="ti ti-user" style={{ marginRight: 4, color: "#34d399" }} /><strong style={{ color: "#374151" }}>{orgRoles.filter(r => r.max_occupants === 1).length}</strong> single-occupant</span>
                    <span><i className="ti ti-users" style={{ marginRight: 4, color: "#a78bfa" }} /><strong style={{ color: "#374151" }}>{orgRoles.filter(r => r.max_occupants !== 1).length}</strong> multi-occupant</span>
                    <span style={{ marginLeft: "auto", color: "#94a3b8" }}>Press Esc or click Close view to exit</span>
                  </div>
                </div>
              )}

              {/* ── Clear-all confirm modal ── */}
              {showClearConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Clear all roles?</h3>
                    <p className="text-sm text-gray-500 mb-5">
                      This will permanently delete all {orgRoles.length} role{orgRoles.length !== 1 ? "s" : ""}.
                      Sub-role relationships will be removed too. This cannot be undone.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button type="button" onClick={() => setShowClearConfirm(false)}
                        className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                      <button type="button" onClick={clearAllRoles}
                        className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                        Delete all
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Single-role delete confirm modal ── */}
              {deleteRoleTarget && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Remove role?</h3>
                    <p className="text-sm text-gray-500 mb-5">
                      <strong className="text-gray-800">"{deleteRoleTarget.name}"</strong> will be deleted.
                      Any sub-roles will be detached but not deleted.
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button type="button" onClick={() => setDeleteRoleTarget(null)}
                        className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                      <button type="button" onClick={confirmDeleteRole}
                        className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add / Edit role modal */}
              {showRoleModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: "90vh" }}>
                    {/* Scrollable body */}
                    <div className="overflow-y-auto flex-1 p-6">
                    <h3 className="text-base font-semibold mb-4">
                      {editingRole ? "Edit role" : roleParentId ? "Add sub-role" : "Add top-level role"}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Role name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={roleForm.name}
                          onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="e.g. General Manager"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                      {/* Parent role — required unless Head of Entity */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Parent role{roleForm.designation !== "head_of_entity" && roleForm.designation ? <span className="text-red-500 ml-0.5">*</span> : null}
                        </label>
                        {roleParentId ? (
                          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
                            {orgRoles.find(r => r.id === roleParentId)?.name ?? "—"}
                          </div>
                        ) : (
                          <div className={`px-3 py-2 rounded-md text-sm ${roleForm.designation && roleForm.designation !== "head_of_entity" ? "bg-red-50 border border-red-200 text-red-600" : "bg-gray-50 border border-gray-200 text-gray-400 italic"}`}>
                            {roleForm.designation && roleForm.designation !== "head_of_entity"
                              ? "⚠ No parent — use '+ Sub-role' on an existing node to set one"
                              : "Top-level (no parent — only valid for Head of Entity)"}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                        <input
                          type="text"
                          value={roleForm.description}
                          onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Brief description of this role"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {entityOptions.length > 0 && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Entity <span className="text-red-500">*</span></label>
                          <select
                            value={roleForm.entityNodeId}
                            onChange={e => setRoleForm(f => ({ ...f, entityNodeId: e.target.value }))}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— Select entity —</option>
                            {entityOptions.map(e => (
                              <option key={e.id} value={e.id}>{e.name}{e.entity_code ? ` (${e.entity_code})` : ` (${e.code})`}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Cost centre <span className="text-red-500">*</span></label>
                        <select
                          value={roleForm.costCenterId}
                          onChange={e => setRoleForm(f => ({ ...f, costCenterId: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— Select cost centre —</option>
                          {costCenters.map(cc => (
                            <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Capacity <span className="text-red-500">*</span></label>
                        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                          {([
                            { value: "single",    label: "Single person" },
                            { value: "unlimited", label: "Multiple persons" },
                            { value: "custom",    label: "Fixed count" },
                          ] as const).map((opt, idx) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRoleForm(f => ({ ...f, capacity: opt.value }))}
                              className={`flex-1 px-3 py-2 font-medium transition-colors ${roleForm.capacity === opt.value ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"} ${idx > 0 ? "border-l border-gray-300" : ""}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {roleForm.capacity === "custom" && (
                          <input
                            type="number"
                            min={2}
                            value={roleForm.customN}
                            onChange={e => setRoleForm(f => ({ ...f, customN: e.target.value }))}
                            className="w-full mt-2 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Max number of persons"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Designation <span className="text-red-500">*</span></label>
                        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                          {([
                            { value: "regular",            label: "Regular" },
                            { value: "head_of_department", label: "Head of Dept" },
                            { value: "head_of_entity",     label: "Head of Entity" },
                          ] as const).map((opt, idx) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRoleForm(f => ({ ...f, designation: opt.value }))}
                              className={`flex-1 px-3 py-2 font-medium transition-colors ${
                                roleForm.designation === opt.value
                                  ? opt.value === "head_of_entity" ? "bg-amber-500 text-white"
                                  : opt.value === "head_of_department" ? "bg-violet-600 text-white"
                                  : "bg-gray-500 text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-50"
                              } ${idx > 0 ? "border-l border-gray-300" : ""}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Employment Type <span className="text-red-500">*</span></label>
                        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                          {([
                            { value: "permanent",  label: "Permanent" },
                            { value: "contract",   label: "Contract" },
                            { value: "outsourced", label: "Outsourced" },
                          ] as const).map((opt, idx) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRoleForm(f => ({ ...f, employment_type: opt.value }))}
                              className={`flex-1 px-3 py-2 font-medium transition-colors ${
                                roleForm.employment_type === opt.value
                                  ? opt.value === "contract"   ? "bg-amber-500 text-white"
                                  : opt.value === "outsourced" ? "bg-slate-500 text-white"
                                  : "bg-green-600 text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-50"
                              } ${idx > 0 ? "border-l border-gray-300" : ""}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Area / Location <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
                        <input
                          type="text"
                          value={roleForm.area}
                          onChange={e => setRoleForm(f => ({ ...f, area: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. Lagos Region, On Premise, Key Accounts, Energy Drinks"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Sub Area <span className="text-xs text-gray-400 font-normal">(optional — more specific scope within Area)</span></label>
                        <input
                          type="text"
                          value={roleForm.sub_area}
                          onChange={e => setRoleForm(f => ({ ...f, sub_area: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. Lagos Mainland, Modern Trade, SME Segment"
                        />
                      </div>
                    </div>
                    </div>{/* end scrollable body */}
                    {/* Sticky footer */}
                    <div className="flex gap-2 px-6 py-4 justify-end border-t border-gray-100 flex-shrink-0">
                      <button type="button" onClick={() => setShowRoleModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                        Cancel
                      </button>
                      <button type="button" onClick={saveRole} disabled={savingRole || !roleForm.name.trim() || !roleForm.costCenterId || !roleForm.capacity || !roleForm.designation || !roleForm.employment_type || (roleForm.designation !== "head_of_entity" && !roleParentId)}
                        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                        {savingRole ? "Saving…" : editingRole ? "Save changes" : "Add role"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Add node modal */}
          {showAddNode && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
                  {(newNode.node_type === "Legal entity" || newNode.node_type === "Parent company") && (
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
                  <Button variant="secondary" className="flex-1" onClick={() => setShowAddNode(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={addNode} disabled={addingNode || !newNode.name || !newNode.code || !newNode.node_type} loading={addingNode}>
                    {addingNode ? "Adding…" : "Add node"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Edit node modal */}
          {editNode && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
                  <Field label="Parent node">
                    <Select
                      value={editForm.parent_id ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, parent_id: e.target.value || undefined }))}
                    >
                      <option value="">— Top level —</option>
                      {flatNodes
                        .filter(n => n.id !== editNode?.id)
                        .map(n => (
                          <option key={n.id} value={n.id}>
                            {n.name} ({n.code})
                          </option>
                        ))}
                    </Select>
                  </Field>
                  {editForm.node_type === "Cost center" && (
                    <Field label="Cost center code">
                      <Input value={editForm.cost_center_code} onChange={e => setEditForm(f => ({ ...f, cost_center_code: e.target.value }))} />
                    </Field>
                  )}
                  {(editForm.node_type === "Legal entity" || editForm.node_type === "Parent company") && (
                    <Field label="Entity code (optional)">
                      <Input value={editForm.entity_code} onChange={e => setEditForm(f => ({ ...f, entity_code: e.target.value }))} placeholder="e.g. N22341" />
                    </Field>
                  )}
                </div>
                <div className="flex gap-2 mt-5">
                  <Button variant="secondary" className="flex-1" onClick={() => setEditNode(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={saveEdit} disabled={savingEdit || !editForm.name || !editForm.node_type} loading={savingEdit}>
                    {savingEdit ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Branding tab ─────────────────────────────────────────────────────── */}
      {tab === "branding" && (
        <div className="space-y-0">

          {/* Sub-tab bar */}
          <div className="flex gap-0 border-b border-gray-200 mb-5">
            {(["themes", "controls", "preview"] as BrandingSubTab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setBrandingTab(t)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  brandingTab === t
                    ? "border-blue-600 text-gray-900 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "themes" ? "Themes" : t === "controls" ? "Branding controls" : "Preview"}
              </button>
            ))}
          </div>

          {/* ── THEMES sub-tab ── */}
          {brandingTab === "themes" && (
            <div className="space-y-5">

              {/* Active theme */}
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Active theme</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-md flex-shrink-0"
                      style={{ background: org.branding?.themes?.find(t => t.id === org.branding?.active_theme_id)?.primary ?? "#2563EB" }}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {org.branding?.themes?.find(t => t.id === org.branding?.active_theme_id)?.name ?? "None set"}
                      </p>
                      <p className="text-xs text-gray-500">Currently applied to the portal</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => {
                      const active = org.branding?.themes?.find(t => t.id === org.branding?.active_theme_id);
                      if (active) setEditTheme(active);
                      setBrandingTab("controls");
                    }} className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">
                      Edit theme
                    </button>
                    <button type="button" onClick={() => setBrandingTab("preview")}
                      className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50">
                      Preview
                    </button>
                  </div>
                </div>
              </div>

              {/* Preset themes */}
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Preset themes</p>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_THEMES.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const newTheme: BrandingTheme = { ...preset, id: crypto.randomUUID() };
                        setEditTheme(newTheme);
                        setBrandingTab("controls");
                      }}
                      className="text-left p-3 border border-gray-200 rounded-md hover:border-blue-400 transition-colors"
                    >
                      <div className="flex gap-1 mb-2">
                        <div className="w-4 h-4 rounded-sm" style={{ background: preset.primary }} />
                        <div className="w-4 h-4 rounded-sm" style={{ background: preset.sidebar }} />
                        <div className="w-4 h-4 rounded-sm" style={{ background: preset.accent }} />
                      </div>
                      <p className="text-xs font-medium text-gray-800">{preset.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Saved themes */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Saved themes <span className="font-normal normal-case">({(org.branding?.themes ?? []).length} of 10)</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTheme(getDefaultTheme());
                      setBrandingTab("controls");
                    }}
                    className="text-xs px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    + New theme
                  </button>
                </div>
                {(org.branding?.themes ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No saved themes yet. Apply a preset or create a new one.</p>
                ) : (
                  <div className="space-y-2">
                    {(org.branding?.themes ?? []).map(theme => (
                      <div key={theme.id} className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-md">
                        <div className="flex gap-1 flex-shrink-0">
                          <div className="w-3.5 h-3.5 rounded-sm" style={{ background: theme.primary }} />
                          <div className="w-3.5 h-3.5 rounded-sm" style={{ background: theme.sidebar }} />
                          <div className="w-3.5 h-3.5 rounded-sm" style={{ background: theme.accent }} />
                        </div>
                        <p className="text-sm font-medium text-gray-900 flex-1">{theme.name}</p>
                        {theme.id === org.branding?.active_theme_id && (
                          <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">Active</span>
                        )}
                        <div className="flex gap-1">
                          <button type="button" onClick={() => { setEditTheme(theme); setBrandingTab("controls"); }}
                            className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">Edit</button>
                          {theme.id !== org.branding?.active_theme_id && (
                            <button type="button" onClick={async () => {
                              const updated = { ...org.branding!, active_theme_id: theme.id };
                              setOrg(o => ({ ...o, branding: updated }));
                              await save({ branding: updated });
                            }} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">Apply</button>
                          )}
                          {theme.id !== org.branding?.active_theme_id && (
                            <button type="button" onClick={() => {
                              const updated = { ...org.branding!, themes: org.branding!.themes.filter(t => t.id !== theme.id) };
                              setOrg(o => ({ ...o, branding: updated }));
                            }} className="text-xs px-2 py-1 text-red-500 border border-gray-200 rounded hover:bg-red-50">Delete</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── BRANDING CONTROLS sub-tab ── */}
          {brandingTab === "controls" && (
            <div className="space-y-5 max-w-2xl">

              {/* Theme name */}
              <div className="border border-gray-200 rounded-lg p-4">
                <Field label="Theme name">
                  <Input value={editTheme.name} onChange={e => setEditTheme(t => ({ ...t, name: e.target.value }))} placeholder="e.g. Corporate Blue" />
                </Field>
              </div>

              {/* Logo & Favicon */}
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Logo & Favicon</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Company logo</label>
                    <div className="border border-dashed border-gray-300 rounded-md p-5 text-center bg-gray-50 cursor-pointer hover:bg-gray-100">
                      <p className="text-xs text-gray-500">Drop or click to upload</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, SVG, WEBP · Max 2MB</p>
                    </div>
                    {editTheme.logo_url && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{editTheme.logo_url}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Favicon</label>
                    <div className="border border-dashed border-gray-300 rounded-md p-5 text-center bg-gray-50 cursor-pointer hover:bg-gray-100">
                      <p className="text-xs text-gray-500">Drop or click to upload</p>
                      <p className="text-xs text-gray-400 mt-1">ICO, PNG · 32×32px</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colours */}
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Colours</p>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    ["primary",   "Primary",   "Buttons, links, active states."],
                    ["secondary", "Secondary", "Secondary actions and muted UI."],
                    ["accent",    "Accent",    "Badges, highlights, alerts."],
                    ["sidebar",   "Sidebar",   "Navigation sidebar background."],
                  ] as [keyof BrandingTheme, string, string][]).map(([key, label, hint]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={(editTheme[key] as string) || "#000000"}
                          onChange={e => setEditTheme(t => ({ ...t, [key]: e.target.value }))}
                          className="w-9 h-9 rounded-md border border-gray-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={(editTheme[key] as string) || ""}
                          onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setEditTheme(t => ({ ...t, [key]: e.target.value })); }}
                          className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-mono"
                          maxLength={7}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{hint}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-2.5 bg-blue-50 border border-blue-100 rounded-md">
                  <p className="text-xs text-blue-700">Button text colour is auto-calculated for WCAG AA contrast — no manual adjustment needed.</p>
                </div>
              </div>

              {/* Typography */}
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Typography</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Interface font">
                    <Select value={editTheme.font_family} onChange={e => setEditTheme(t => ({ ...t, font_family: e.target.value }))}>
                      {["Inter", "DM Sans", "Nunito", "Poppins", "Roboto", "Open Sans", "Lato", "IBM Plex Sans"].map(f => (
                        <option key={f} value={f}>{f}{f === "Inter" ? " (default)" : ""}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Base font size">
                    <Select value={editTheme.font_size} onChange={e => setEditTheme(t => ({ ...t, font_size: e.target.value }))}>
                      <option value="small">Small (13px)</option>
                      <option value="default">Default (14px)</option>
                      <option value="large">Large (16px)</option>
                    </Select>
                  </Field>
                </div>
              </div>

              {/* Button & corner style */}
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Button & corner style</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Button style</label>
                    <div className="flex gap-2">
                      {(["rounded", "pill", "square"] as const).map(s => (
                        <button key={s} type="button"
                          onClick={() => setEditTheme(t => ({ ...t, button_style: s }))}
                          className={`flex-1 py-1.5 text-xs border capitalize transition-colors ${
                            editTheme.button_style === s
                              ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                          style={{ borderRadius: s === "rounded" ? 6 : s === "pill" ? 999 : 2 }}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Card radius</label>
                    <div className="flex gap-2">
                      {(["sharp", "medium", "large"] as const).map(r => (
                        <button key={r} type="button"
                          onClick={() => setEditTheme(t => ({ ...t, card_radius: r }))}
                          className={`flex-1 py-1.5 text-xs border capitalize transition-colors ${
                            editTheme.card_radius === r
                              ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                          style={{ borderRadius: r === "sharp" ? 2 : r === "medium" ? 6 : 14 }}
                        >{r}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Email header */}
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Email header</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Header background</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={editTheme.email_header_bg || "#1E293B"}
                        onChange={e => setEditTheme(t => ({ ...t, email_header_bg: e.target.value }))}
                        className="w-9 h-9 rounded-md border border-gray-300 cursor-pointer p-0.5" />
                      <input type="text" value={editTheme.email_header_bg || ""}
                        onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setEditTheme(t => ({ ...t, email_header_bg: e.target.value })); }}
                        className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-mono" maxLength={7} />
                    </div>
                  </div>
                  <Field label="Email sender name">
                    <Input value={editTheme.email_sender_name}
                      onChange={e => setEditTheme(t => ({ ...t, email_sender_name: e.target.value }))}
                      placeholder="e.g. Acme Finance Team" />
                  </Field>
                </div>
                {/* Email preview */}
                <div className="mt-3 border border-gray-200 rounded-md overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3" style={{ background: editTheme.email_header_bg || "#1E293B" }}>
                    <span className="text-sm font-medium text-white">{editTheme.email_sender_name || "Your Company"}</span>
                  </div>
                  <div className="px-4 py-3 bg-gray-50">
                    <p className="text-sm text-gray-800">Your expense report has been approved.</p>
                    <p className="text-xs text-gray-500 mt-1">Preview of how system emails will appear.</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => setBrandingTab("preview")}
                  className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                  Preview
                </button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setBrandingTab("themes")}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={async () => {
                    if ((org.branding?.themes ?? []).length >= 10 &&
                        !org.branding?.themes?.find(t => t.id === editTheme.id)) {
                      alert("Maximum 10 themes reached. Delete one first.");
                      return;
                    }
                    const existing = org.branding?.themes ?? [];
                    const idx = existing.findIndex(t => t.id === editTheme.id);
                    const updated = idx >= 0
                      ? existing.map((t, i) => i === idx ? editTheme : t)
                      : [...existing, editTheme];
                    const newBranding: BrandingConfig = {
                      active_theme_id: org.branding?.active_theme_id ?? editTheme.id,
                      themes: updated,
                    };
                    setOrg(o => ({ ...o, branding: newBranding }));
                    await save({ branding: newBranding });
                    setBrandingTab("themes");
                  }} disabled={saving} loading={saving}>
                    {saving ? "Saving..." : "Save theme"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW sub-tab */}
          {brandingTab === "preview" && (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Portal preview</p>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                </div>
                <div className="flex" style={{ height: 340 }}>
                  <div className="w-36 flex-shrink-0 py-4" style={{ background: editTheme.sidebar }}>
                    <div className="px-3 pb-3 mb-2" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.1)" }}>
                      <p className="text-xs font-medium text-white">ZivaBI</p>
                    </div>
                    <div className="px-0">
                      <p className="text-xs px-3 mb-1 mt-2" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.05em" }}>COMMON DATA</p>
                      <div className="px-3 py-1.5 mb-0.5" style={{ background: "rgba(255,255,255,0.12)" }}>
                        <p className="text-xs font-medium text-white">Organisation</p>
                      </div>
                      <div className="px-3 py-1.5">
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Modules</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 p-4 overflow-auto bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Organisation</p>
                        <p className="text-xs text-gray-500">Configure your company identity</p>
                      </div>
                      <button type="button" style={{
                        background: editTheme.primary,
                        color: getButtonTextColor(editTheme.primary),
                        borderRadius: editTheme.button_style === "rounded" ? 6 : editTheme.button_style === "pill" ? 999 : 2,
                        border: "none", padding: "6px 14px", fontSize: 12, cursor: "default",
                      }}>Save changes</button>
                    </div>
                    <div className="bg-white border border-gray-200 p-3 mb-3"
                      style={{ borderRadius: editTheme.card_radius === "sharp" ? 2 : editTheme.card_radius === "medium" ? 8 : 16 }}>
                      <p className="text-xs font-medium text-gray-500 mb-2">LEGAL</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Legal name</p>
                          <div className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800">{org.legal_name || "Acme Corporation"}</div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">RC number</p>
                          <div className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800">RC1234567</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-xs text-blue-700">This is a simulated preview. Full live theming is planned for a future milestone.</p>
              </div>
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setBrandingTab("controls")}>
                  Back to edit
                </Button>
                <Button variant="primary" onClick={async () => {
                  const existing = org.branding?.themes ?? [];
                  const idx = existing.findIndex(t => t.id === editTheme.id);
                  const updated = idx >= 0
                    ? existing.map((t, i) => i === idx ? editTheme : t)
                    : [...existing, editTheme];
                  const newBranding: BrandingConfig = {
                    active_theme_id: editTheme.id,
                    themes: updated,
                  };
                  setOrg(o => ({ ...o, branding: newBranding }));
                  await save({ branding: newBranding });
                  setBrandingTab("themes");
                }} disabled={saving} loading={saving}>
                  {saving ? "Saving..." : "Save & apply"}
                </Button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Configuration tab */}
      {tab === "config" && (
        <div className="space-y-0">
          <div className="space-y-0 max-w-2xl">

            {/* Dimensions */}
            <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Analytical dimensions <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded ml-1">Recommended</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Tag transactions with cost center, project, brand, or region to slice reports beyond just the GL account.</p>
                {config.use_dimensions && (
                  <p className="text-xs text-blue-600 mt-1.5">Dimensions page is now visible in the sidebar.</p>
                )}
              </div>
              <label className="relative w-9 h-5 cursor-pointer flex-shrink-0 mt-0.5">
                <input type="checkbox" className="sr-only" checked={config.use_dimensions}
                  onChange={e => setConfig(c => ({ ...c, use_dimensions: e.target.checked }))} />
                <span className={`absolute inset-0 rounded-full transition-colors ${config.use_dimensions ? "bg-blue-600" : "bg-gray-300"}`} />
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.use_dimensions ? "translate-x-4" : ""}`} />
              </label>
            </div>

            {/* Multi-currency */}
            <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Multi-currency <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded ml-1">Recommended</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Enable if your organisation transacts in foreign currencies.</p>
                {config.use_multi_currency && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <Field label="FX rate source">
                      <Select value={config.fx_rate_source ?? "Manual entry"} onChange={e => setConfig(c => ({ ...c, fx_rate_source: e.target.value }))}>
                        {["Manual entry","Central bank feed","Custom API"].map(o => <option key={o}>{o}</option>)}
                      </Select>
                    </Field>
                    <Field label="Rate update frequency">
                      <Select value={config.fx_update_frequency ?? "Daily"} onChange={e => setConfig(c => ({ ...c, fx_update_frequency: e.target.value }))}>
                        {["Daily","Weekly","Monthly"].map(o => <option key={o}>{o}</option>)}
                      </Select>
                    </Field>
                  </div>
                )}
              </div>
              <label className="relative w-9 h-5 cursor-pointer flex-shrink-0 mt-0.5">
                <input type="checkbox" className="sr-only" checked={config.use_multi_currency}
                  onChange={e => setConfig(c => ({ ...c, use_multi_currency: e.target.checked }))} />
                <span className={`absolute inset-0 rounded-full transition-colors ${config.use_multi_currency ? "bg-blue-600" : "bg-gray-300"}`} />
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.use_multi_currency ? "translate-x-4" : ""}`} />
              </label>
            </div>

            {/* Intercompany */}
            <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Intercompany transactions</p>
                <p className="text-xs text-gray-500 mt-0.5">Enable if this entity transacts with other group entities.</p>
              </div>
              <label className="relative w-9 h-5 cursor-pointer flex-shrink-0 mt-0.5">
                <input type="checkbox" className="sr-only" checked={config.use_intercompany}
                  onChange={e => setConfig(c => ({ ...c, use_intercompany: e.target.checked }))} />
                <span className={`absolute inset-0 rounded-full transition-colors ${config.use_intercompany ? "bg-blue-600" : "bg-gray-300"}`} />
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.use_intercompany ? "translate-x-4" : ""}`} />
              </label>
            </div>

            {/* Inventory costing */}
            <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Inventory costing method <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded ml-1">Required for inventory</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Choose how inventory cost is calculated. Irreversible after go-live (IAS 2).</p>
                {config.use_inventory_costing && (
                  <div className="mt-2">
                    <Field label="Costing method">
                      <Select value={config.inventory_costing_method ?? ""} onChange={e => setConfig(c => ({ ...c, inventory_costing_method: e.target.value }))}>
                        <option>Weighted average cost (AVCO)</option>
                        <option>First in, first out (FIFO)</option>
                        <option>Standard cost</option>
                      </Select>
                    </Field>
                  </div>
                )}
              </div>
              <label className="relative w-9 h-5 cursor-pointer flex-shrink-0 mt-0.5">
                <input type="checkbox" className="sr-only" checked={config.use_inventory_costing}
                  onChange={e => setConfig(c => ({ ...c, use_inventory_costing: e.target.checked }))} />
                <span className={`absolute inset-0 rounded-full transition-colors ${config.use_inventory_costing ? "bg-blue-600" : "bg-gray-300"}`} />
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.use_inventory_costing ? "translate-x-4" : ""}`} />
              </label>
            </div>

            {/* Budget control */}
            <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Budget control</p>
                <p className="text-xs text-gray-500 mt-0.5">Control what happens when a transaction exceeds the approved budget.</p>
                {config.use_budget_control && (
                  <div className="mt-2">
                    <Field label="When budget is exceeded">
                      <Select value={config.budget_exceeded_action ?? ""} onChange={e => setConfig(c => ({ ...c, budget_exceeded_action: e.target.value }))}>
                        <option>Show warning, allow posting</option>
                        <option>Block posting -- hard stop</option>
                        <option>Require approval to override</option>
                      </Select>
                    </Field>
                  </div>
                )}
              </div>
              <label className="relative w-9 h-5 cursor-pointer flex-shrink-0 mt-0.5">
                <input type="checkbox" className="sr-only" checked={config.use_budget_control}
                  onChange={e => setConfig(c => ({ ...c, use_budget_control: e.target.checked }))} />
                <span className={`absolute inset-0 rounded-full transition-colors ${config.use_budget_control ? "bg-blue-600" : "bg-gray-300"}`} />
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.use_budget_control ? "translate-x-4" : ""}`} />
              </label>
            </div>

            <div className="pt-4 flex justify-end">
              <Button variant="primary" onClick={() => save({ org_configuration: config })} disabled={saving} loading={saving}>
                {saving ? "Saving..." : saved ? "Saved" : "Save features"}
              </Button>
            </div>
          </div>

          <hr className="my-6 border-gray-200" />

          <div className="space-y-0 max-w-2xl">

            {/* Audit trail */}
            <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Full audit trail</p>
                <p className="text-xs text-gray-500 mt-0.5">Log every create, edit, and delete action. Required for SOX and ISO 27001.</p>
              </div>
              <label className="relative w-9 h-5 cursor-pointer flex-shrink-0 mt-0.5">
                <input type="checkbox" className="sr-only" checked={config.use_audit_trail}
                  onChange={e => setConfig(c => ({ ...c, use_audit_trail: e.target.checked }))} />
                <span className={`absolute inset-0 rounded-full transition-colors ${config.use_audit_trail ? "bg-blue-600" : "bg-gray-300"}`} />
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.use_audit_trail ? "translate-x-4" : ""}`} />
              </label>
            </div>

            {/* Multi-level auth */}
            <div className="flex items-start justify-between gap-4 py-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Multi-level payment authorisation</p>
                <p className="text-xs text-gray-500 mt-0.5">Require sequential approval by multiple authorisers on payments above defined thresholds.</p>
              </div>
              <label className="relative w-9 h-5 cursor-pointer flex-shrink-0 mt-0.5">
                <input type="checkbox" className="sr-only" checked={config.use_multilevel_auth}
                  onChange={e => setConfig(c => ({ ...c, use_multilevel_auth: e.target.checked }))} />
                <span className={`absolute inset-0 rounded-full transition-colors ${config.use_multilevel_auth ? "bg-blue-600" : "bg-gray-300"}`} />
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.use_multilevel_auth ? "translate-x-4" : ""}`} />
              </label>
            </div>

            <div className="pt-4 flex justify-end border-t border-gray-100">
              <Button variant="primary" onClick={() => save({ org_configuration: config })} disabled={saving} loading={saving}>
                {saving ? "Saving..." : saved ? "Saved" : "Save governance settings"}
              </Button>
            </div>
          </div>

        </div>
      )}
    </PageContainer>
  );
}

export default function OrganisationPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading...</div>}>
      <OrganisationPage />
    </Suspense>
  );
}
