"use client";

/**
 * ExpenseItemPicker — multi-step GL selection popup for the expense form.
 *
 * Handles all 5 coding levels:
 *   Level 1: Category → Subcategory → GL auto-picked (default), hidden from employee
 *   Level 2: Category → Subcategory → GL shown read-only, employee can flag as incorrect
 *   Level 3: Category → Subcategory → GL selected from subcategory's mapped list
 *   Level 4: Direct GL search (skip category/subcategory steps)
 *   Level 0: Never opened (Finance assigns GL during approval)
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

interface Props {
  codingLevel: number;
  categories: CategoryForForm[];
  onSelect: (result: PickerResult) => void;
  onClose: () => void;
  searchGL: (q: string) => Promise<GLSearchResult[]>;
}

type Step = 1 | 2 | 3;

export default function ExpenseItemPicker({ codingLevel, categories, onSelect, onClose, searchGL }: Props) {
  const [step, setStep] = useState<Step>(codingLevel === 4 ? 3 : 1);
  const [selectedCategory, setSelectedCategory] = useState<CategoryForForm | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryForForm | null>(null);
  const [flagIncorrect, setFlagIncorrect] = useState(false);
  const [glQuery, setGlQuery] = useState("");
  const [glResults, setGlResults] = useState<GLSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Level 4: load initial GL list and debounce search
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
      // Auto-pick default GL without showing it to the employee
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

  const stepTitle = step === 1 ? "Select Category" : step === 2 ? "Select Subcategory" : codingLevel === 4 ? "Search GL Account" : "Select GL Account";
  const breadcrumb = step === 2 ? selectedCategory?.name : step === 3 && codingLevel !== 4 ? `${selectedCategory?.name} / ${selectedSubcategory?.name ?? "…"}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] sm:max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {step > 1 && codingLevel !== 4 && (
              <button type="button" onClick={goBack} className="text-gray-400 hover:text-gray-600 shrink-0 text-lg leading-none mr-1">←</button>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">{stepTitle}</h2>
              {breadcrumb && <p className="text-xs text-gray-400 truncate mt-0.5">{breadcrumb}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-3 shrink-0">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* Step 1 — category cards */}
          {step === 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map((cat) => (
                <button key={cat.id} type="button" onClick={() => handleSelectCategory(cat)}
                  className="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  {cat.code && <span className="block text-xs font-mono text-gray-400 mb-1">{cat.code}</span>}
                  <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                  <span className="block text-xs text-gray-400 mt-1">{cat.subcategories.length} subcategories</span>
                </button>
              ))}
              {categories.length === 0 && (
                <p className="col-span-3 text-sm text-gray-400 text-center py-8">No categories configured.</p>
              )}
            </div>
          )}

          {/* Step 2 — subcategory cards */}
          {step === 2 && selectedCategory && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {selectedCategory.subcategories.map((sub) => (
                <button key={sub.id} type="button" onClick={() => handleSelectSubcategory(sub)}
                  className="text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  {sub.code && <span className="block text-xs font-mono text-gray-400 mb-1">{sub.code}</span>}
                  <span className="text-sm font-medium text-gray-800">{sub.name}</span>
                  <span className="block text-xs text-gray-400 mt-1">{sub.gl_mappings.length} GL{sub.gl_mappings.length !== 1 ? "s" : ""}</span>
                </button>
              ))}
              {selectedCategory.subcategories.length === 0 && (
                <p className="col-span-3 text-sm text-gray-400 text-center py-8">No subcategories found.</p>
              )}
            </div>
          )}

          {/* Step 3 — GL selection */}
          {step === 3 && (
            <>
              {/* Level 4: search */}
              {codingLevel === 4 && (
                <>
                  <div className="mb-3">
                    <input type="text" value={glQuery} onChange={(e) => setGlQuery(e.target.value)}
                      placeholder="Search by GL number or name…" autoFocus
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {isSearching && <p className="text-xs text-gray-400 text-center py-4">Searching…</p>}
                  {!isSearching && (
                    <ul className="divide-y divide-gray-100">
                      {glResults.map((gl) => (
                        <li key={gl.gl_id}>
                          <button type="button" onClick={() => handleSelectSearchedGL(gl)}
                            className="w-full text-left px-2 py-2.5 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-500 w-20 shrink-0">{gl.gl_number}</span>
                            <span className="text-sm text-gray-800 flex-1">{gl.gl_name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{gl.account_type}</span>
                          </button>
                        </li>
                      ))}
                      {glResults.length === 0 && !isSearching && (
                        <p className="text-sm text-gray-400 text-center py-8">No GL accounts found.</p>
                      )}
                    </ul>
                  )}
                </>
              )}

              {/* Level 2: default GL + flag toggle */}
              {codingLevel === 2 && selectedSubcategory && (() => {
                const gl = selectedSubcategory.gl_mappings.find((m) => m.is_default) ?? selectedSubcategory.gl_mappings[0];
                if (!gl) return <p className="text-sm text-gray-400 text-center py-8">No GL mapped for this subcategory.</p>;
                return (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                      <p className="text-xs text-gray-500 mb-1">Suggested GL Account</p>
                      <p className="text-sm font-mono font-semibold text-gray-900">{gl.gl_number}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{gl.gl_name}</p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input type="checkbox" checked={flagIncorrect} onChange={(e) => setFlagIncorrect(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 accent-amber-500" />
                      <div>
                        <span className="text-sm font-medium text-gray-800">This GL code looks incorrect</span>
                        <p className="text-xs text-gray-500 mt-0.5">Finance will review and correct the assignment.</p>
                      </div>
                    </label>
                    <button type="button" onClick={handleConfirmLevel2}
                      className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
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
                      <button type="button" onClick={() => handleSelectMappedGL(gl)}
                        className="w-full text-left px-2 py-2.5 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500 w-20 shrink-0">{gl.gl_number}</span>
                        <span className="text-sm text-gray-800 flex-1">{gl.gl_name}</span>
                        {gl.is_default && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">Default</span>}
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
        </div>
      </div>
    </div>
  );
}
