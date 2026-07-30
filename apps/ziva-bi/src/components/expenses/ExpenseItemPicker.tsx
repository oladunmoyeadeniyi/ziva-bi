"use client";

/**
 * ExpenseItemPicker — multi-step GL selection popup for the expense form.
 *
 * Handles all 5 coding levels:
 *   Level 1: Category → Subcategory → GL auto-picked (default), hidden from employee
 *   Level 2: Category → Subcategory → GL shown read-only, employee can flag as incorrect
 *   Level 3: Category → Subcategory → GL selected from subcategory's mapped list
 *             OR: Browse GL Group hierarchy ("By GL Group" tab, when fetchGLGroups is supplied)
 *   Level 4: Direct GL search (skip category/subcategory steps)
 *             OR: Browse GL Group hierarchy ("By GL Group" tab)
 *   Level 0: Never opened (Finance assigns GL during approval)
 *
 * The "By GL Group" tab navigates:
 *   GL Group → GL Subgroup (optional) → GL Sub-subgroup (optional) → GL account list
 * It is only shown for levels 3 and 4, and only when the fetchGLGroups and
 * searchGLFiltered props are provided by the parent page.
 *
 * Returns a PickerResult to the parent via onSelect; parent is responsible for
 * triggering the AI suggestions call after selection.
 */

import { useEffect, useRef, useState } from "react";

export interface PickerResult {
  gl_id: string;
  gl_number: string;
  gl_name: string;
  category_id: string | null;
  category_name: string;
  subcategory_id: string | null;
  subcategory_name: string;
  dimension_requirements: Array<{ dimension_id: string; requirement: string }>;
  flag_incorrect: boolean;
}

export interface GLSearchResult {
  gl_id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  dimension_requirements: Array<{ dimension_id: string; requirement: string }>;
  gl_group?: string | null;
  gl_subgroup?: string | null;
  gl_sub_subgroup?: string | null;
}

export interface GLMappingForForm {
  gl_id: string;
  gl_number: string;
  gl_name: string;
  is_default: boolean;
  dimension_requirements: Array<{ dimension_id: string; requirement: string }>;
}

export interface SubcategoryForForm {
  id: string;
  name: string;
  code: string | null;
  gl_mappings: GLMappingForForm[];
}

export interface CategoryForForm {
  id: string;
  name: string;
  code: string | null;
  subcategories: SubcategoryForForm[];
}

export interface GLGroupSubgroup {
  name: string;
  sub_subgroups: string[];
  account_count: number;
}

export interface GLGroupNode {
  name: string;
  subgroups: GLGroupSubgroup[];
  account_count: number;
}

export interface SearchGLFilters {
  q?: string;
  gl_group?: string;
  gl_subgroup?: string;
  gl_sub_subgroup?: string;
}

interface Props {
  codingLevel: number;
  categories: CategoryForForm[];
  onSelect: (result: PickerResult) => void;
  onClose: () => void;
  searchGL: (q: string) => Promise<GLSearchResult[]>;
  /** Required to show the "By GL Group" tab (levels 3 and 4 only) */
  fetchGLGroups?: () => Promise<GLGroupNode[]>;
  searchGLFiltered?: (filters: SearchGLFilters) => Promise<GLSearchResult[]>;
}

type Step = 1 | 2 | 3;
type ActiveTab = "category" | "gl_group";
type GroupView = "groups" | "subgroups" | "sub_subgroups" | "accounts";

export default function ExpenseItemPicker({
  codingLevel,
  categories,
  onSelect,
  onClose,
  searchGL,
  fetchGLGroups,
  searchGLFiltered,
}: Props) {
  // ── Category tab state ────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(codingLevel === 4 ? 3 : 1);
  const [selectedCategory, setSelectedCategory] = useState<CategoryForForm | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryForForm | null>(null);
  const [flagIncorrect, setFlagIncorrect] = useState(false);

  // Level 4 / search state
  const [glQuery, setGlQuery] = useState("");
  const [glResults, setGlResults] = useState<GLSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── GL Group tab state ────────────────────────────────────────────────────
  const showGroupTab = (codingLevel === 3 || codingLevel === 4) && !!fetchGLGroups && !!searchGLFiltered;
  const [activeTab, setActiveTab] = useState<ActiveTab>(codingLevel === 4 ? "category" : "category");
  const [groupView, setGroupView] = useState<GroupView>("groups");
  const [groupData, setGroupData] = useState<GLGroupNode[] | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedSubgroup, setSelectedSubgroup] = useState<string | null>(null);
  const [selectedSubSubgroup, setSelectedSubSubgroup] = useState<string | null>(null);
  const [groupAccounts, setGroupAccounts] = useState<GLSearchResult[]>([]);
  const [groupAccountsLoading, setGroupAccountsLoading] = useState(false);

  // ── Level 4: load initial GL list + debounce ──────────────────────────────
  useEffect(() => {
    if (codingLevel !== 4) return;
    setIsSearching(true);
    searchGL("").then((r) => { setGlResults(r); setIsSearching(false); }).catch(() => setIsSearching(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (codingLevel !== 4) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try { setGlResults(await searchGL(glQuery)); } finally { setIsSearching(false); }
    }, 300);
  }, [glQuery, codingLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GL Group tab: load groups on first open ───────────────────────────────
  useEffect(() => {
    if (activeTab !== "gl_group" || !fetchGLGroups) return;
    if (groupData !== null) return; // already loaded
    setGroupLoading(true);
    fetchGLGroups()
      .then((d) => { setGroupData(d); })
      .catch(() => { setGroupData([]); })
      .finally(() => setGroupLoading(false));
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Category tab: navigation ──────────────────────────────────────────────
  const goBack = () => {
    if (step === 3) { setStep(2); setSelectedSubcategory(null); setFlagIncorrect(false); }
    else if (step === 2) { setStep(1); setSelectedCategory(null); }
  };

  const handleSelectCategory = (cat: CategoryForForm) => {
    setSelectedCategory(cat);
    setStep(2);
  };

  const handleSelectSubcategory = (sub: SubcategoryForForm) => {
    setSelectedSubcategory(sub);
    if (codingLevel === 1) {
      const gl = sub.gl_mappings.find((m) => m.is_default) ?? sub.gl_mappings[0];
      onSelect({
        gl_id: gl?.gl_id ?? "",
        gl_number: gl?.gl_number ?? "",
        gl_name: gl?.gl_name ?? "",
        category_id: selectedCategory!.id,
        category_name: selectedCategory!.name,
        subcategory_id: sub.id,
        subcategory_name: sub.name,
        dimension_requirements: gl?.dimension_requirements ?? [],
        flag_incorrect: false,
      });
    } else {
      setStep(3);
    }
  };

  const handleSelectMappedGL = (gl: GLMappingForForm) => {
    onSelect({
      gl_id: gl.gl_id,
      gl_number: gl.gl_number,
      gl_name: gl.gl_name,
      category_id: selectedCategory?.id ?? null,
      category_name: selectedCategory?.name ?? "",
      subcategory_id: selectedSubcategory?.id ?? null,
      subcategory_name: selectedSubcategory?.name ?? "",
      dimension_requirements: gl.dimension_requirements,
      flag_incorrect: false,
    });
  };

  const handleConfirmLevel2 = () => {
    const sub = selectedSubcategory!;
    const gl = sub.gl_mappings.find((m) => m.is_default) ?? sub.gl_mappings[0];
    onSelect({
      gl_id: gl?.gl_id ?? "",
      gl_number: gl?.gl_number ?? "",
      gl_name: gl?.gl_name ?? "",
      category_id: selectedCategory!.id,
      category_name: selectedCategory!.name,
      subcategory_id: sub.id,
      subcategory_name: sub.name,
      dimension_requirements: flagIncorrect ? [] : (gl?.dimension_requirements ?? []),
      flag_incorrect: flagIncorrect,
    });
  };

  const handleSelectSearchedGL = (gl: GLSearchResult) => {
    onSelect({
      gl_id: gl.gl_id,
      gl_number: gl.gl_number,
      gl_name: gl.gl_name,
      category_id: null,
      category_name: "",
      subcategory_id: null,
      subcategory_name: "",
      dimension_requirements: gl.dimension_requirements,
      flag_incorrect: false,
    });
  };

  // ── GL Group tab: navigation ──────────────────────────────────────────────
  const handleSelectGroup = async (node: GLGroupNode) => {
    setSelectedGroup(node.name);
    setSelectedSubgroup(null);
    setSelectedSubSubgroup(null);

    if (node.subgroups.length > 0) {
      // Has subgroups — show them
      setGroupView("subgroups");
    } else {
      // No subgroups — load accounts directly
      await loadGroupAccounts({ gl_group: node.name });
    }
  };

  const handleSelectSubgroup = async (subgroup: GLGroupSubgroup) => {
    setSelectedSubgroup(subgroup.name);
    setSelectedSubSubgroup(null);

    if (subgroup.sub_subgroups.length > 0) {
      setGroupView("sub_subgroups");
    } else {
      await loadGroupAccounts({ gl_group: selectedGroup!, gl_subgroup: subgroup.name });
    }
  };

  const handleSelectSubSubgroup = async (name: string) => {
    setSelectedSubSubgroup(name);
    await loadGroupAccounts({ gl_group: selectedGroup!, gl_subgroup: selectedSubgroup!, gl_sub_subgroup: name });
  };

  const loadGroupAccounts = async (filters: SearchGLFilters) => {
    if (!searchGLFiltered) return;
    setGroupView("accounts");
    setGroupAccountsLoading(true);
    try {
      const accounts = await searchGLFiltered(filters);
      setGroupAccounts(accounts);
    } catch {
      setGroupAccounts([]);
    } finally {
      setGroupAccountsLoading(false);
    }
  };

  const goGroupBack = () => {
    if (groupView === "accounts") {
      if (selectedSubSubgroup) {
        setGroupView("sub_subgroups");
        setSelectedSubSubgroup(null);
      } else if (selectedSubgroup) {
        setGroupView("subgroups");
        setSelectedSubgroup(null);
      } else {
        setGroupView("groups");
        setSelectedGroup(null);
      }
    } else if (groupView === "sub_subgroups") {
      setGroupView("subgroups");
      setSelectedSubSubgroup(null);
    } else if (groupView === "subgroups") {
      setGroupView("groups");
      setSelectedGroup(null);
      setSelectedSubgroup(null);
    }
  };

  // ── Tab switch ────────────────────────────────────────────────────────────
  const handleTabSwitch = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "category") {
      // Reset group state when switching back
      setGroupView("groups");
      setSelectedGroup(null);
      setSelectedSubgroup(null);
      setSelectedSubSubgroup(null);
    }
  };

  // ── Header text ───────────────────────────────────────────────────────────
  const categoryStepTitle =
    step === 1 ? "Select Category"
    : step === 2 ? "Select Subcategory"
    : codingLevel === 4 ? "Search GL Account"
    : "Select GL Account";

  const categoryBreadcrumb =
    step === 2 ? selectedCategory?.name
    : step === 3 && codingLevel !== 4 ? `${selectedCategory?.name} / ${selectedSubcategory?.name ?? "…"}`
    : null;

  const groupTitle =
    groupView === "groups" ? "Browse by GL Group"
    : groupView === "subgroups" ? selectedGroup ?? "Subgroups"
    : groupView === "sub_subgroups" ? `${selectedGroup} / ${selectedSubgroup}`
    : `${selectedGroup}${selectedSubgroup ? ` / ${selectedSubgroup}` : ""}${selectedSubSubgroup ? ` / ${selectedSubSubgroup}` : ""}`;

  const groupBreadcrumb =
    groupView === "subgroups" ? selectedGroup
    : groupView === "sub_subgroups" ? `${selectedGroup} / ${selectedSubgroup}`
    : groupView === "accounts" ? groupTitle
    : null;

  const showCatBack = activeTab === "category" && step > 1 && codingLevel !== 4;
  const showGroupBack = activeTab === "gl_group" && groupView !== "groups";

  const headerTitle = activeTab === "category" ? categoryStepTitle : (groupView === "groups" ? "Browse by GL Group" : selectedGroup ?? "GL Accounts");
  const headerBreadcrumb = activeTab === "category" ? categoryBreadcrumb : (groupView !== "groups" ? groupBreadcrumb : null);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] sm:max-h-[80vh]">

        {/* Header */}
        <div className="px-4 pt-4 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {(showCatBack || showGroupBack) && (
                <button
                  type="button"
                  onClick={showCatBack ? goBack : goGroupBack}
                  className="text-gray-400 hover:text-gray-600 shrink-0 text-lg leading-none mr-1"
                >
                  ←
                </button>
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900">{headerTitle}</h2>
                {headerBreadcrumb && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{headerBreadcrumb}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-3 shrink-0"
            >
              ×
            </button>
          </div>

          {/* Tab bar — only for levels 3 and 4 when GL groups are available */}
          {showGroupTab && (
            <div className="flex border-b border-gray-200 -mx-4 px-4">
              <button
                type="button"
                onClick={() => handleTabSwitch("category")}
                className={`text-xs font-medium pb-2 mr-4 border-b-2 transition-colors ${
                  activeTab === "category"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {codingLevel === 4 ? "Search" : "By Category"}
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch("gl_group")}
                className={`text-xs font-medium pb-2 border-b-2 transition-colors ${
                  activeTab === "gl_group"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                By GL Group
              </button>
            </div>
          )}

          {/* Separator when no tabs */}
          {!showGroupTab && <div className="border-b border-gray-200 -mx-4" />}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* ── CATEGORY TAB ────────────────────────────────────────────── */}
          {activeTab === "category" && (
            <>
              {/* Step 1 — category cards */}
              {step === 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      {cat.code && (
                        <span className="block text-xs font-mono text-gray-400 mb-1">{cat.code}</span>
                      )}
                      <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                      <span className="block text-xs text-gray-400 mt-1">
                        {cat.subcategories.length} subcategories
                      </span>
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <p className="col-span-3 text-sm text-gray-400 text-center py-8">
                      No categories configured.
                    </p>
                  )}
                </div>
              )}

              {/* Step 2 — subcategory cards */}
              {step === 2 && selectedCategory && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedCategory.subcategories.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSelectSubcategory(sub)}
                      className="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      {sub.code && (
                        <span className="block text-xs font-mono text-gray-400 mb-1">{sub.code}</span>
                      )}
                      <span className="text-sm font-medium text-gray-800">{sub.name}</span>
                      <span className="block text-xs text-gray-400 mt-1">
                        {sub.gl_mappings.length} GL{sub.gl_mappings.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                  ))}
                  {selectedCategory.subcategories.length === 0 && (
                    <p className="col-span-3 text-sm text-gray-400 text-center py-8">
                      No subcategories found.
                    </p>
                  )}
                </div>
              )}

              {/* Step 3 — GL selection */}
              {step === 3 && (
                <>
                  {/* Level 4: text search */}
                  {codingLevel === 4 && (
                    <>
                      <div className="mb-3">
                        <input
                          type="text"
                          value={glQuery}
                          onChange={(e) => setGlQuery(e.target.value)}
                          placeholder="Search by GL number or name…"
                          autoFocus
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {isSearching && (
                        <p className="text-xs text-gray-400 text-center py-4">Searching…</p>
                      )}
                      {!isSearching && (
                        <ul className="divide-y divide-gray-100">
                          {glResults.map((gl) => (
                            <li key={gl.gl_id}>
                              <button
                                type="button"
                                onClick={() => handleSelectSearchedGL(gl)}
                                className="w-full text-left px-2 py-2.5 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                              >
                                <span className="font-mono text-xs text-gray-500 w-20 shrink-0">
                                  {gl.gl_number}
                                </span>
                                <span className="text-sm text-gray-800 flex-1">{gl.gl_name}</span>
                                <span className="text-xs text-gray-400 shrink-0">{gl.account_type}</span>
                              </button>
                            </li>
                          ))}
                          {glResults.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-8">No GL accounts found.</p>
                          )}
                        </ul>
                      )}
                    </>
                  )}

                  {/* Level 2: default GL + flag toggle */}
                  {codingLevel === 2 && selectedSubcategory && (() => {
                    const gl = selectedSubcategory.gl_mappings.find((m) => m.is_default) ?? selectedSubcategory.gl_mappings[0];
                    if (!gl) {
                      return (
                        <p className="text-sm text-gray-400 text-center py-8">
                          No GL mapped for this subcategory.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-4">
                        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 mb-1">Suggested GL Account</p>
                          <p className="text-sm font-mono font-semibold text-gray-900">{gl.gl_number}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{gl.gl_name}</p>
                        </div>
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={flagIncorrect}
                            onChange={(e) => setFlagIncorrect(e.target.checked)}
                            className="mt-0.5 rounded border-gray-300 accent-amber-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-800">
                              This GL code looks incorrect
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Finance will review and correct the assignment.
                            </p>
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={handleConfirmLevel2}
                          className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                          Confirm
                        </button>
                      </div>
                    );
                  })()}

                  {/* Level 3: selectable GL list from subcategory mappings */}
                  {codingLevel === 3 && selectedSubcategory && (
                    <ul className="divide-y divide-gray-100">
                      {selectedSubcategory.gl_mappings.map((gl) => (
                        <li key={gl.gl_id}>
                          <button
                            type="button"
                            onClick={() => handleSelectMappedGL(gl)}
                            className="w-full text-left px-2 py-2.5 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <span className="font-mono text-xs text-gray-500 w-20 shrink-0">
                              {gl.gl_number}
                            </span>
                            <span className="text-sm text-gray-800 flex-1">{gl.gl_name}</span>
                            {gl.is_default && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">
                                Default
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                      {selectedSubcategory.gl_mappings.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-8">No GL accounts mapped.</p>
                      )}
                    </ul>
                  )}
                </>
              )}
            </>
          )}

          {/* ── GL GROUP TAB ─────────────────────────────────────────────── */}
          {activeTab === "gl_group" && (
            <>
              {groupLoading && (
                <p className="text-xs text-gray-400 text-center py-8">Loading GL groups…</p>
              )}

              {!groupLoading && groupData !== null && (
                <>
                  {/* Groups list */}
                  {groupView === "groups" && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {groupData.map((node) => (
                        <button
                          key={node.name}
                          type="button"
                          onClick={() => handleSelectGroup(node)}
                          className="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-800 block">{node.name}</span>
                          <span className="text-xs text-gray-400 mt-1 block">
                            {node.account_count} account{node.account_count !== 1 ? "s" : ""}
                            {node.subgroups.length > 0 && ` · ${node.subgroups.length} subgroups`}
                          </span>
                        </button>
                      ))}
                      {groupData.length === 0 && (
                        <p className="col-span-3 text-sm text-gray-400 text-center py-8">
                          No GL groups configured. Add a GL Group to accounts in the Chart of Accounts.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Subgroups list */}
                  {groupView === "subgroups" && selectedGroup && (() => {
                    const node = groupData.find((n) => n.name === selectedGroup);
                    if (!node) return null;
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {/* "All accounts in group" shortcut */}
                        <button
                          type="button"
                          onClick={() => loadGroupAccounts({ gl_group: selectedGroup })}
                          className="col-span-2 sm:col-span-3 text-left px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                          <span className="text-xs text-gray-500">All accounts in</span>
                          <span className="text-xs font-medium text-gray-700">{selectedGroup}</span>
                        </button>
                        {node.subgroups.map((sg) => (
                          <button
                            key={sg.name}
                            type="button"
                            onClick={() => handleSelectSubgroup(sg)}
                            className="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                          >
                            <span className="text-sm font-medium text-gray-800 block">{sg.name}</span>
                            <span className="text-xs text-gray-400 mt-1 block">
                              {sg.account_count} account{sg.account_count !== 1 ? "s" : ""}
                              {sg.sub_subgroups.length > 0 && ` · ${sg.sub_subgroups.length} sub-groups`}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Sub-subgroups list */}
                  {groupView === "sub_subgroups" && selectedGroup && selectedSubgroup && (() => {
                    const node = groupData.find((n) => n.name === selectedGroup);
                    const sg = node?.subgroups.find((s) => s.name === selectedSubgroup);
                    if (!sg) return null;
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {/* "All accounts in subgroup" shortcut */}
                        <button
                          type="button"
                          onClick={() => loadGroupAccounts({ gl_group: selectedGroup, gl_subgroup: selectedSubgroup })}
                          className="col-span-2 sm:col-span-3 text-left px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                          <span className="text-xs text-gray-500">All accounts in</span>
                          <span className="text-xs font-medium text-gray-700">{selectedSubgroup}</span>
                        </button>
                        {sg.sub_subgroups.map((ssg) => (
                          <button
                            key={ssg}
                            type="button"
                            onClick={() => handleSelectSubSubgroup(ssg)}
                            className="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                          >
                            <span className="text-sm font-medium text-gray-800 block">{ssg}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Accounts list */}
                  {groupView === "accounts" && (
                    <>
                      {groupAccountsLoading && (
                        <p className="text-xs text-gray-400 text-center py-8">Loading accounts…</p>
                      )}
                      {!groupAccountsLoading && (
                        <ul className="divide-y divide-gray-100">
                          {groupAccounts.map((gl) => (
                            <li key={gl.gl_id}>
                              <button
                                type="button"
                                onClick={() => handleSelectSearchedGL(gl)}
                                className="w-full text-left px-2 py-2.5 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                              >
                                <span className="font-mono text-xs text-gray-500 w-20 shrink-0">
                                  {gl.gl_number}
                                </span>
                                <span className="text-sm text-gray-800 flex-1">{gl.gl_name}</span>
                                <span className="text-xs text-gray-400 shrink-0">{gl.account_type}</span>
                              </button>
                            </li>
                          ))}
                          {groupAccounts.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-8">No accounts found.</p>
                          )}
                        </ul>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
