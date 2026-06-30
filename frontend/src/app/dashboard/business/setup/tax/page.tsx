"use client";

/**
 * Tax & Statutory page — M8.2 Implementation Portal (updated BRIEF-0).
 *
 * 5 tabs: Tax applicability | VAT | WHT | PAYE | Other statutory
 *
 * Tax applicability is always the first/default tab. VAT, WHT, and PAYE are
 * only shown when the corresponding tax type is marked applicable. Other
 * statutory is always visible (catch-all for levies that don't map to a
 * single type).
 *
 * Applicability saves to PATCH /api/setup/org (org_configuration JSONB).
 * VAT / WHT / PAYE / Other save to PATCH /api/setup/tax.
 *
 * Route: /dashboard/business/setup/tax
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "applicability" | "vat" | "wht" | "paye" | "other";

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

interface TaxGroup {
  title: string;
  items: TaxItem[];
}

interface VatConfig {
  vat_registered?: boolean;
  standard_rate?: number;
  vat_gl?: string;
  input_vat_gl?: string;
  reverse_vat?: boolean;
  self_account_vat?: boolean;
  categories?: { name: string; rate: number; applies_to: string; effective_from: string; status: string }[];
}

interface WhtConfig {
  categories?: { vendor_category: string; rate: number; gl_account: string; applies_to: string; effective_from: string }[];
  non_resident_rate?: number;
  wht_gl?: string;
}

interface PayeConfig {
  bands?: { income_from: number; income_to: number; rate: number; effective_from: string }[];
  employee_pension_rate?: number;
  employer_pension_rate?: number;
  employee_pension_gl?: string;
  employer_pension_gl?: string;
  nhf_rate?: number;
  nsitf_rate?: number;
}

interface OtherStatutory {
  levies?: { name: string; rate: number; base: string; gl_account: string; effective_from: string }[];
}

interface TaxConfig {
  vat_config?: VatConfig;
  wht_config?: WhtConfig;
  paye_config?: PayeConfig;
  other_statutory?: OtherStatutory;
}

interface OrgApplicabilityLoad {
  country?: string;
  org_configuration?: {
    is_tax_haven?: boolean;
    tax_items?: TaxItem[];
    [key: string]: unknown;
  };
}

// ── Tax jurisdiction profiles (moved from organisation/page.tsx) ───────────────

function makeTax(id: string, name: string, desc: string, rate: string, checked: boolean, tag?: "new" | "changed"): TaxItem {
  return { id, name, desc, rate, checked, tag };
}

const TAX_PROFILES: Record<string, TaxGroup[]> = {
  NG: [
    { title: "Indirect taxes", items: [
      makeTax("ng_vat",    "VAT (Value Added Tax)",           "On supply of taxable goods and services. Essential goods zero-rated. E-invoicing via FIRS-sanctioned systems mandatory.", "7.5% — NTA 2025 (input VAT now recoverable on services and capex)", true, "changed"),
      makeTax("ng_excise", "Excise duty",                     "On alcohol, tobacco, fuel, and luxury items.", "Varies — NTA 2025 (Excise schedule)", false),
      makeTax("ng_customs","Customs & import duty",            "On goods imported into Nigeria.", "Varies — Nigeria Customs Service Tariff Schedule", false),
      makeTax("ng_stamp",  "Stamp duty",                      "On legal instruments and dutiable transactions. Consolidated under NTA 2025.", "Variable — NTA 2025", false, "changed"),
      makeTax("ng_dst",    "Digital services tax (DST)",       "On digital/tech services supplied in or to Nigeria.", "6% — NTA 2025", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("ng_cit",    "Corporate income tax (CIT)",       "Small companies (turnover ≤ ₦100m AND fixed assets < ₦250m) fully exempt. CIT rate reducing gradually.", "27.5% (2025 YOA) → 25% (from 2026) large / 0% small — NTA 2025 S.56", true, "changed"),
      makeTax("ng_devlevy","Development levy",                 "Replaces TET, NITDA, NASENI, and Police Trust Fund levies. Not for small companies.", "4% of assessable profits — NTA 2025", true, "new"),
      makeTax("ng_wht",    "Withholding tax (WHT)",            "Deducted at source on payments. Rates restructured under NTA 2025.", "2.5% contracts / 5% consultancy & dividends / 10% rent, royalties, non-residents — NTA 2025", true, "changed"),
      makeTax("ng_cgt",    "Capital gains tax (CGT)",          "Rate now aligned to CIT. Exemption threshold ₦50m.", "27.5%→25% large / 0% small — NTA 2025", false, "changed"),
      makeTax("ng_mintax", "Minimum tax",                     "Applies where CIT payable is below statutory minimum. Small companies exempt.", "1% of gross turnover — NTA 2025", false, "changed"),
      makeTax("ng_tp",     "Transfer pricing",                 "On intercompany transactions with related parties in other jurisdictions.", "Arm's length — TP Regulations (retained under NTA 2025)", false),
      makeTax("ng_cfc",    "Controlled foreign company (CFC)", "New provision targeting undistributed profits of foreign companies controlled by Nigerian entities.", "Applicable rate on attributed income — NTA 2025", false, "new"),
      makeTax("ng_topup",  "Minimum effective tax rate (top-up)", "For MNE constituent entities and companies with turnover ≥ ₦20bn where effective tax rate falls below 15%.", "Top-up to 15% effective rate — NTA 2025", false, "new"),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("ng_paye",   "PAYE (Pay As You Earn)",           "Personal income tax deducted from employee salaries. Income bands and rates revised.", "Revised graduated rates (up to 25%) — NTA 2025", true, "changed"),
      makeTax("ng_pension","Pension contributions",             "Mandatory employer and employee contributions.", "10% employer + 8% employee — Pension Reform Act 2014", true),
      makeTax("ng_nsitf",  "NSITF",                           "Nigeria Social Insurance Trust Fund — employer only.", "1% of gross salary", false),
      makeTax("ng_itf",    "ITF (Industrial Training Fund)",   "For companies with 5+ staff or ₦50m+ turnover.", "1% of annual payroll", false),
      makeTax("ng_nhf",    "NHF (National Housing Fund)",      "Deducted from qualifying employees.", "2.5% of basic salary", false),
    ]},
  ],
  GB: [
    { title: "Indirect taxes", items: [
      makeTax("gb_vat",    "VAT",                             "On supply of goods and services.", "20% standard / 5% reduced / 0% zero-rated — VAT Act 1994", true),
      makeTax("gb_sdlt",   "Stamp duty land tax (SDLT)",       "On property purchases.", "Variable — Finance Act 2003", false),
      makeTax("gb_excise", "Excise duty",                     "On alcohol, tobacco, fuel.", "Varies — HMRC Excise tariff", false),
      makeTax("gb_ipt",    "Insurance premium tax (IPT)",      "On general insurance premiums.", "12% standard / 20% higher — Finance Act 1994", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("gb_ct",     "Corporation tax",                  "On company profits.", "25% main (profits > £250k) / 19% small profits (< £50k) — Finance Act 2023", true),
      makeTax("gb_wht",    "Withholding tax",                  "On interest and royalties paid to non-residents.", "20% — ITA 2007", false),
      makeTax("gb_dpt",    "Diverted profits tax",             "On profits artificially diverted from the UK.", "31% — Finance Act 2015", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("gb_paye",   "PAYE",                            "Income tax withheld from salaries.", "20%–45% graduated — Income Tax Act 2007", true),
      makeTax("gb_nic",    "National Insurance (NIC)",         "Employer and employee contributions.", "13.8% employer / 8% employee — SSCBA 1992", true),
      makeTax("gb_appLevy","Apprenticeship levy",              "For employers with payroll over £3m.", "0.5% of annual payroll", false),
    ]},
  ],
  US: [
    { title: "Indirect taxes", items: [
      makeTax("us_sales",  "Sales tax",                        "State and local. Rate and applicability varies by state.", "0%–10.25% — varies by state", true),
      makeTax("us_use",    "Use tax",                          "On goods purchased out-of-state but used in-state.", "Mirrors sales tax rate", false),
      makeTax("us_excise", "Excise tax",                      "On fuel, alcohol, tobacco, air travel.", "Varies — IRS", false),
      makeTax("us_tariff", "Import duties / tariffs",          "On goods imported into the US.", "Varies — CBP Harmonized Tariff Schedule", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("us_fed_cit","Federal corporate income tax",     "On corporate profits.", "21% flat — TCJA 2017", true),
      makeTax("us_state_cit","State corporate income tax",     "Additional tax by state. Some states have none.", "0%–11.5% depending on state", true),
      makeTax("us_amt",    "Alternative minimum tax (AMT)",    "For corporations with avg. income over $1bn.", "15% — Inflation Reduction Act 2022", false),
      makeTax("us_wht",    "Withholding tax",                  "On payments to non-resident aliens and foreign corporations.", "30% (reduced by treaty) — IRC S.1441", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("us_fitw",   "Federal income tax withholding",   "Withheld from employee wages.", "10%–37% graduated — IRS Pub 15", true),
      makeTax("us_ss",     "FICA — Social Security",           "Employer and employee contributions.", "6.2% each (up to wage base) — IRC S.3111", true),
      makeTax("us_med",    "FICA — Medicare",                  "Employer and employee contributions.", "1.45% each + 0.9% additional high earners", true),
      makeTax("us_futa",   "FUTA",                            "Federal unemployment tax — employer only.", "6% on first $7,000 per employee", false),
    ]},
  ],
  ZA: [
    { title: "Indirect taxes", items: [
      makeTax("za_vat",    "VAT",                             "On supply of goods and services.", "15% — VAT Act 89 of 1991", true),
      makeTax("za_td",     "Transfer duty",                   "On acquisition of immovable property.", "0%–13% graduated — Transfer Duty Act", false),
      makeTax("za_stt",    "Securities transfer tax",          "On transfer of listed and unlisted securities.", "0.25% — STT Act 2007", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("za_cit",    "Corporate income tax (CIT)",       "On taxable income.", "27% — Income Tax Act 58 of 1962 (amended 2022)", true),
      makeTax("za_dwt",    "Dividends withholding tax",        "On dividends paid to shareholders.", "20%", true),
      makeTax("za_cgt",    "Capital gains tax",                "80% of net gain included in taxable income.", "Effective 21.6% for companies", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("za_paye",   "PAYE",                            "Income tax deducted from salaries.", "18%–45% graduated — Fourth Schedule ITA", true),
      makeTax("za_uif",    "UIF",                             "Unemployment Insurance Fund.", "1% each employer + employee — UIF Act 2001", true),
      makeTax("za_sdl",    "SDL",                             "Skills Development Levy for payroll > R500,000/year.", "1% of monthly payroll — SDL Act 1999", false),
    ]},
  ],
  KE: [
    { title: "Indirect taxes", items: [
      makeTax("ke_vat",    "VAT",                             "On supply of taxable goods and services.", "16% standard / 8% petroleum — VAT Act 2013", true),
      makeTax("ke_excise", "Excise duty",                     "On alcohol, tobacco, fuel, and certain services.", "Varies — Excise Duty Act 2015", false),
      makeTax("ke_dst",    "Digital service tax",             "On digital marketplace services.", "1.5% of gross transaction value — Finance Act 2020", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("ke_cit",    "Corporate income tax (CIT)",       "On taxable profits of resident companies.", "30% — Income Tax Act Cap 470", true),
      makeTax("ke_wht",    "Withholding tax (WHT)",            "On dividends, interest, royalties, and service fees.", "5%–30% depending on payment type", true),
      makeTax("ke_cgt",    "Capital gains tax",                "On transfer of property.", "15% — Finance Act 2023", false),
      makeTax("ke_mintax", "Minimum tax",                     "Where CIT payable is less than minimum tax.", "1% of gross turnover", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("ke_paye",   "PAYE",                            "Deducted from employee salaries.", "10%–35% graduated — ITA Cap 470", true),
      makeTax("ke_nssf",   "NSSF",                           "National Social Security Fund.", "6% employee + 6% employer (capped) — NSSF Act 2013", true),
      makeTax("ke_nhif",   "NHIF / SHIF",                    "National Hospital Insurance Fund.", "2.75% of gross pay — Finance Act 2023", true),
      makeTax("ke_housing","Housing levy",                    "Affordable housing levy.", "1.5% employee + 1.5% employer — Finance Act 2023", false),
    ]},
  ],
  GH: [
    { title: "Indirect taxes", items: [
      makeTax("gh_vat",    "VAT",                             "On supply of taxable goods and services.", "15% — VAT Act 2013 (Act 870)", true),
      makeTax("gh_nhil",   "NHIL",                            "National Health Insurance Levy — collected with VAT.", "2.5%", true),
      makeTax("gh_getf",   "GETFund levy",                   "Ghana Education Trust Fund Levy — collected with VAT.", "2.5%", true),
      makeTax("gh_covid",  "COVID-19 Health Recovery Levy",   "On VAT taxable supply.", "1%", false),
      makeTax("gh_excise", "Excise duty",                     "On alcohol, tobacco, petroleum.", "Varies — Excise Duty Act", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("gh_cit",    "Corporate income tax (CIT)",       "On taxable profits.", "25% — ITA 2015 (Act 896)", true),
      makeTax("gh_wht",    "Withholding tax (WHT)",            "On dividends, interest, rent, and fees.", "8%–20% — ITA 2015", true),
      makeTax("gh_cgt",    "Capital gains tax",                "On realised gains.", "15%", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("gh_paye",   "PAYE",                            "Deducted from employee salaries.", "0%–35% graduated — ITA 2015", true),
      makeTax("gh_ssnit",  "SSNIT",                           "Social Security & National Insurance Trust.", "13% employer + 5.5% employee", true),
      makeTax("gh_t2",     "Tier 2 pension",                  "Mandatory occupational pension.", "5% employer", false),
    ]},
  ],
  AE: [
    { title: "Indirect taxes", items: [
      makeTax("ae_vat",    "VAT",                             "Introduced January 2018.", "5% — Federal Decree-Law No. 8 of 2017", true),
      makeTax("ae_excise", "Excise tax",                      "On tobacco, energy drinks, carbonated drinks.", "50%–100% — Federal Decree-Law No. 7 of 2017", false),
      makeTax("ae_customs","Customs duty",                    "GCC Common External Tariff on imports.", "5% standard — GCC CET", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("ae_ct",     "Corporate tax (CT)",               "Introduced June 2023 on business profits above AED 375,000.", "9% — Federal Decree-Law No. 47 of 2022", true),
      makeTax("ae_tp",     "Transfer pricing",                 "On related-party transactions.", "Arm's length — CT Law 2022", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("ae_gpssa",  "GPSSA (UAE nationals only)",       "Pension for UAE national employees. Expatriates are exempt.", "12.5% employer + 5% employee (Abu Dhabi: 15%+5%)", false),
      makeTax("ae_gratuity","End of service gratuity",         "Mandatory for expatriate employees.", "21 days pay per year (first 5 years) — UAE Labour Law", true),
    ]},
  ],
  IN: [
    { title: "Indirect taxes", items: [
      makeTax("in_gst0",   "GST — Nil rated",                 "On exempt goods and services.", "0%", false),
      makeTax("in_gst5",   "GST — 5% rate",                   "On essential goods and certain services.", "5% — CGST + SGST/IGST", false),
      makeTax("in_gst12",  "GST — 12% rate",                  "On processed goods and standard services.", "12% — CGST + SGST/IGST", false),
      makeTax("in_gst18",  "GST — 18% rate",                  "Standard rate on most goods and services.", "18% — CGST + SGST/IGST", true),
      makeTax("in_gst28",  "GST — 28% rate",                  "On luxury and demerit goods.", "28% — CGST + SGST/IGST", false),
      makeTax("in_customs","Customs duty",                    "On imported goods.", "Varies — Customs Tariff Act 1975", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("in_cit",    "Corporate income tax",             "Domestic companies. New regime rates apply from FY 2020-21.", "22% new regime / 30% old regime — Income Tax Act 1961", true),
      makeTax("in_cit_new","CIT — new manufacturing cos.",     "New manufacturing companies incorporated after Oct 2019.", "15% — Section 115BAB", false),
      makeTax("in_tds",    "Tax deducted at source (TDS)",     "Deducted at source on various payments (salary, rent, interest, professional fees).", "1%–30% depending on payment type — Income Tax Act", true),
      makeTax("in_cgt",    "Capital gains tax",                "On sale of capital assets.", "STCG 15%–30% / LTCG 10%–20% — ITA", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("in_paye",   "TDS on salary",                   "Income tax deducted from salaries.", "Slab rates (0%–30%) — ITA", true),
      makeTax("in_epf",    "Employees' Provident Fund (EPF)",  "Mandatory retirement savings.", "12% each employer + employee — EPF Act 1952", true),
      makeTax("in_esi",    "Employees' State Insurance (ESI)", "For employees earning ≤ ₹21,000/month.", "3.25% employer + 0.75% employee — ESI Act 1948", false),
      makeTax("in_pt",     "Professional tax",                 "State-level tax on employment income. Rate varies by state.", "Up to ₹2,500/year — varies by state", false),
    ]},
  ],
  CA: [
    { title: "Indirect taxes", items: [
      makeTax("ca_gst",    "GST (Goods and Services Tax)",     "Federal goods and services tax.", "5% — Excise Tax Act", true),
      makeTax("ca_hst",    "HST (Harmonised Sales Tax)",       "Combined federal + provincial tax (ON, NB, NS, NL, PEI).", "13%–15% depending on province", true),
      makeTax("ca_pst",    "PST (Provincial Sales Tax)",       "BC, SK, MB, QC (QST). Applied separately from GST.", "6%–9.975% depending on province", false),
      makeTax("ca_customs","Customs & import duties",          "On goods imported into Canada.", "Varies — Canada Border Services Agency", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("ca_fed_cit","Federal corporate income tax",     "On taxable income of Canadian corporations.", "15% general / 9% CCPC small business — ITA", true),
      makeTax("ca_prov_cit","Provincial corporate income tax", "Additional tax levied by each province.", "8%–16% depending on province", true),
      makeTax("ca_wht",    "Withholding tax",                  "On dividends, interest, and royalties paid to non-residents.", "25% (reduced by treaty) — ITA Part XIII", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("ca_paye",   "Payroll income tax (source deductions)", "Federal and provincial income tax deducted from wages.", "15%–33% federal graduated + provincial rates", true),
      makeTax("ca_cpp",    "Canada Pension Plan (CPP)",        "Mandatory employee and employer contributions.", "5.95% each (up to YMPE) — CPP Act", true),
      makeTax("ca_ei",     "Employment Insurance (EI)",        "Mandatory unemployment insurance premiums.", "1.64% employee / 2.30% employer — EI Act", true),
    ]},
  ],
  AU: [
    { title: "Indirect taxes", items: [
      makeTax("au_gst",    "GST (Goods and Services Tax)",     "On supply of most goods, services, and anything else.", "10% — A New Tax System (GST) Act 1999", true),
      makeTax("au_excise", "Excise duty",                      "On fuel, alcohol, and tobacco.", "Varies — Excise Act 1901", false),
      makeTax("au_customs","Customs duty",                    "On imported goods.", "Varies — Customs Tariff Act 1995", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("au_cit",    "Corporate income tax",             "On taxable income of companies.", "30% general / 25% base rate entities (aggregated turnover < $50m) — ITAA 1936/1997", true),
      makeTax("au_cgt",    "Capital gains tax",                "Part of income tax. Discount applies for assets held > 12 months.", "At company's marginal rate (no CGT discount for companies) — ITAA 1997 Part 3-1", false),
      makeTax("au_div",    "Dividend withholding tax",         "On unfranked dividends paid to non-residents.", "30% (reduced by treaty) — ITAA 1936 s.128B", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("au_payg",   "PAYG withholding",                 "Tax withheld from employee wages and salaries.", "0%–47% graduated — ITAA 1997", true),
      makeTax("au_super",  "Superannuation guarantee",         "Mandatory employer retirement contribution.", "11.5% of ordinary time earnings — SGAA 1992", true),
      makeTax("au_payroll","Payroll tax (state-based)",        "State tax on wages above threshold. Rate and threshold vary by state.", "4.75%–6.85% depending on state", false),
    ]},
  ],
  XX: [
    { title: "Indirect taxes", items: [
      makeTax("xx_vat",    "VAT / GST / Sales tax",            "Tax on supply of goods and services. Name and rate varies by country.", "Set rate on Tax & statutory page", true),
      makeTax("xx_excise", "Excise / customs duty",            "On specific goods or imports.", "Varies", false),
      makeTax("xx_stamp",  "Stamp duty",                       "On legal documents and property.", "Varies", false),
    ]},
    { title: "Direct taxes", items: [
      makeTax("xx_cit",    "Corporate income tax (CIT)",       "On company profits.", "Set rate on Tax & statutory page", true),
      makeTax("xx_wht",    "Withholding tax (WHT)",            "Deducted at source on vendor and contractor payments.", "Set rate on Tax & statutory page", true),
      makeTax("xx_cgt",    "Capital gains tax",                "On disposal of capital assets.", "Varies", false),
    ]},
    { title: "Employment & payroll", items: [
      makeTax("xx_payroll","Payroll income tax withholding",   "Income tax deducted from employee salaries.", "Varies", true),
      makeTax("xx_pension","Social security / pension",        "Mandatory employer and employee contributions.", "Varies", true),
    ]},
  ],
};

function getTaxProfileForCountry(countryCode: string): TaxItem[] {
  const profile = TAX_PROFILES[countryCode] ?? TAX_PROFILES["XX"];
  return profile.flatMap(g => g.items);
}

function getTaxGroupsForItems(items: TaxItem[], countryCode: string): TaxGroup[] {
  const baseProfile = TAX_PROFILES[countryCode] ?? TAX_PROFILES["XX"];
  const checkedMap = new Map(items.map(i => [i.id, i.checked]));
  return baseProfile.map(group => ({
    ...group,
    items: group.items.map(item => ({
      ...item,
      checked: checkedMap.has(item.id) ? checkedMap.get(item.id)! : item.checked,
    })),
  }));
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function TabBtn({
  id,
  active,
  onClick,
  label,
}: {
  id: Tab;
  active: boolean;
  onClick: (t: Tab) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ── Page ──────────────────────────────────────────────────────────────────────

function TaxContent() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tax-config tabs (VAT/WHT/PAYE/Other)
  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) || "applicability");

  const handleTabChange = (t: Tab) => {
    setTab(t);
    router.replace(`?tab=${t}`, { scroll: false });
  };
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<TaxConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Applicability state (loaded from /api/setup/org)
  const [orgRaw, setOrgRaw] = useState<OrgApplicabilityLoad | null>(null);
  const [isTaxHaven, setIsTaxHaven] = useState(false);
  const [taxItems, setTaxItems] = useState<TaxItem[]>([]);
  const [collapsedTaxGroups, setCollapsedTaxGroups] = useState<Set<string>>(new Set());
  const [customTaxInput, setCustomTaxInput] = useState("");
  const [customTaxCategory, setCustomTaxCategory] = useState<string>("Indirect taxes");
  const [customTaxNewCategory, setCustomTaxNewCategory] = useState<string>("");
  const [savingApp, setSavingApp] = useState(false);
  const [appSaved, setAppSaved] = useState(false);

  // Load tax config (VAT/WHT/PAYE/Other)
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<TaxConfig>("/api/setup/tax", { token: accessToken })
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  // Load org config for applicability (tax_items + is_tax_haven live in org_configuration)
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<OrgApplicabilityLoad>("/api/setup/org", { token: accessToken })
      .then(data => {
        setOrgRaw(data);
        const orgConf = data.org_configuration;
        if (orgConf?.tax_items && orgConf.tax_items.length > 0) {
          setTaxItems(orgConf.tax_items);
          setIsTaxHaven(orgConf.is_tax_haven ?? false);
        } else if (data.country) {
          setTaxItems(getTaxProfileForCountry(data.country));
        }
      })
      .catch(() => {});
  }, [accessToken]);

  const toggleTaxGroup = (title: string) => {
    setCollapsedTaxGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  // Gating: determine which tax-config tabs are visible based on checked applicability
  const checkedIds = new Set(taxItems.filter(t => t.checked).map(t => t.id));
  const vatVisible  = [...checkedIds].some(id => /vat|gst|sales|nhil|getf/.test(id));
  const whtVisible  = [...checkedIds].some(id => /wht|dwt|tds/.test(id));
  const payeVisible = [...checkedIds].some(id => /paye|payg|fitw/.test(id));
  // Other statutory is always visible — it's a catch-all for levies that don't
  // map cleanly to a single tax type, so hiding it incorrectly would be worse.

  // If the current tab becomes hidden, fall back to applicability
  useEffect(() => {
    if (tab === "vat"  && !vatVisible)  setTab("applicability");
    if (tab === "wht"  && !whtVisible)  setTab("applicability");
    if (tab === "paye" && !payeVisible) setTab("applicability");
  }, [tab, vatVisible, whtVisible, payeVisible]);

  const saveApplicability = async () => {
    if (!accessToken) return;
    setSavingApp(true);
    setError(null);
    try {
      const existingOrgConf = orgRaw?.org_configuration ?? {};
      await apiFetch("/api/setup/org", {
        method: "PATCH",
        token: accessToken,
        body: {
          org_configuration: {
            ...existingOrgConf,
            is_tax_haven: isTaxHaven,
            tax_items: taxItems,
          },
        },
      });
      setAppSaved(true);
      setTimeout(() => setAppSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingApp(false);
    }
  };

  const save = async (patch: Partial<TaxConfig>) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<TaxConfig>("/api/setup/tax", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify(patch),
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const setVat = (key: keyof VatConfig, val: unknown) =>
    setConfig((c) => ({ ...c, vat_config: { ...(c.vat_config ?? {}), [key]: val } }));

  const setWht = (key: keyof WhtConfig, val: unknown) =>
    setConfig((c) => ({ ...c, wht_config: { ...(c.wht_config ?? {}), [key]: val } }));

  const setPaye = (key: keyof PayeConfig, val: unknown) =>
    setConfig((c) => ({ ...c, paye_config: { ...(c.paye_config ?? {}), [key]: val } }));

  const SaveBtn = ({ patch }: { patch: Partial<TaxConfig> }) => (
    <div className="mt-6 flex items-center gap-3">
      <Button
        variant="primary"
        onClick={() => save(patch)}
        disabled={saving}
        loading={saving}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
      {saved && <span className="text-sm text-green-600">Saved</span>}
    </div>
  );

  const countryCode = (orgRaw?.country && TAX_PROFILES[orgRaw.country]) ? orgRaw.country : "XX";

  return (
    <PageContainer maxWidth="3xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <PageHeading title="Tax & statutory" />
      <p className="text-sm text-gray-500 mb-6">
        Select applicable taxes, then configure rates and GL accounts for each.
      </p>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <TabBtn id="applicability" active={tab === "applicability"} onClick={handleTabChange} label="Tax applicability" />
        {vatVisible  && <TabBtn id="vat"   active={tab === "vat"}   onClick={handleTabChange} label="VAT" />}
        {whtVisible  && <TabBtn id="wht"   active={tab === "wht"}   onClick={handleTabChange} label="WHT" />}
        {payeVisible && <TabBtn id="paye"  active={tab === "paye"}  onClick={handleTabChange} label="PAYE" />}
        <TabBtn id="other" active={tab === "other"} onClick={handleTabChange} label="Other statutory" />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Tax applicability tab ── */}
      {tab === "applicability" && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-xs text-gray-500">Select every tax that applies to your organisation. Only selected taxes will appear in the tabs above.</p>

          {/* Zero-tax haven */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-200">
            <input type="checkbox" className="w-3.5 h-3.5 cursor-pointer accent-blue-600"
              checked={isTaxHaven}
              onChange={e => {
                setIsTaxHaven(e.target.checked);
                if (e.target.checked) {
                  const groups = getTaxGroupsForItems(taxItems, countryCode);
                  setCollapsedTaxGroups(new Set(groups.map(g => g.title)));
                } else {
                  setCollapsedTaxGroups(new Set());
                }
              }}
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Zero-tax / tax haven jurisdiction</p>
              <p className="text-xs text-gray-500">e.g. UAE (pre-June 2023), Cayman Islands, BVI, Isle of Man. Corporate income tax not applicable.</p>
            </div>
          </div>

          {isTaxHaven && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
              <i className="ti ti-info-circle text-amber-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
              <p className="text-xs text-amber-700">Zero-tax jurisdiction selected. Tax groups are collapsed below — expand any group to select specific taxes that may still apply (e.g. VAT, customs duty, employment taxes).</p>
            </div>
          )}

          {/* Jurisdiction note */}
          <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-md">
            <i className="ti ti-map-pin text-blue-600 flex-shrink-0 mt-0.5" style={{ fontSize: 13 }} />
            <p className="text-xs text-blue-700">
              Showing taxes for your registered country — pre-populated based on your country setting in Identity. Add or remove as needed.
            </p>
          </div>

          {/* Tax groups — collapsible */}
          {(() => {
            const groups = getTaxGroupsForItems(taxItems, countryCode);
            return groups.map(group => {
              const isCollapsed = collapsedTaxGroups.has(group.title);
              return (
                <div key={group.title} className="border border-gray-200 rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleTaxGroup(group.title)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{group.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {(() => {
                          const jurisdictionChecked = group.items.filter(i => {
                            const saved = taxItems.find(t => t.id === i.id);
                            return saved ? saved.checked : i.checked;
                          }).length;
                          const customChecked = taxItems.filter(t => t.custom && t.category === group.title && t.checked).length;
                          const totalCustom = taxItems.filter(t => t.custom && t.category === group.title).length;
                          const total = group.items.length + totalCustom;
                          const checked = jurisdictionChecked + customChecked;
                          return `${checked} of ${total} selected`;
                        })()}
                      </span>
                      <i className={`ti ti-chevron-${isCollapsed ? "right" : "down"} text-gray-400`} style={{ fontSize: 13 }} />
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-gray-50">
                      {group.items.map(item => {
                        const savedItem = taxItems.find(t => t.id === item.id);
                        const isChecked = savedItem ? savedItem.checked : item.checked;
                        return (
                          <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5">
                            <input type="checkbox" className="w-3.5 h-3.5 cursor-pointer accent-blue-600 mt-0.5 flex-shrink-0"
                              checked={isChecked}
                              onChange={e => {
                                setTaxItems(prev => {
                                  const existing = prev.find(t => t.id === item.id);
                                  if (existing) {
                                    return prev.map(t => t.id === item.id ? { ...t, checked: e.target.checked } : t);
                                  }
                                  return [...prev, { ...item, checked: e.target.checked }];
                                });
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900">
                                {item.name}
                                {item.tag === "new" && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-1.5">New</span>}
                                {item.tag === "changed" && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1.5">Updated</span>}
                              </p>
                              <p className="text-[11px] text-gray-500">{item.desc}</p>
                              {item.rate && <p className="text-[11px] text-blue-600 mt-0.5">{item.rate}</p>}
                            </div>
                          </div>
                        );
                      })}
                      {/* Custom items for this group */}
                      {taxItems
                        .filter(t => t.custom && (t.category === group.title))
                        .map(item => (
                          <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5 bg-blue-50">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 cursor-pointer accent-blue-600 mt-0.5 flex-shrink-0"
                              checked={item.checked}
                              onChange={e => {
                                setTaxItems(prev => prev.map(t =>
                                  t.id === item.id ? { ...t, checked: e.target.checked } : t
                                ));
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-medium text-gray-900">{item.name}</p>
                                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Custom</span>
                              </div>
                              <p className="text-[11px] text-gray-500">{item.desc}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setTaxItems(prev => prev.filter(t => t.id !== item.id))}
                              className="text-red-400 hover:text-red-600 p-0.5 flex-shrink-0"
                              title="Remove"
                            >
                              <i className="ti ti-x" style={{ fontSize: 12 }} />
                            </button>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {/* Custom taxes in categories not in the jurisdiction profile */}
          {(() => {
            const existingGroupTitles = new Set(
              (TAX_PROFILES[countryCode] ?? TAX_PROFILES["XX"]).map(g => g.title)
            );
            const newCategoryItems = taxItems.filter(
              t => t.custom && t.category && !existingGroupTitles.has(t.category)
            );
            if (newCategoryItems.length === 0) return null;

            const byCategory = newCategoryItems.reduce((acc, item) => {
              const cat = item.category ?? "Custom taxes";
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(item);
              return acc;
            }, {} as Record<string, TaxItem[]>);

            return Object.entries(byCategory).map(([category, items]) => {
              const isCollapsed = collapsedTaxGroups.has(`custom_${category}`);
              return (
                <div key={`custom_${category}`} className="border border-blue-200 rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleTaxGroup(`custom_${category}`)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{category}</span>
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Custom</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-500">
                        {items.filter(i => i.checked).length} of {items.length} selected
                      </span>
                      <i className={`ti ti-chevron-${isCollapsed ? "right" : "down"} text-blue-400`} style={{ fontSize: 13 }} />
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-blue-50">
                      {items.map(item => (
                        <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5 bg-blue-50">
                          <input type="checkbox" className="w-3.5 h-3.5 cursor-pointer accent-blue-600 mt-0.5 flex-shrink-0"
                            checked={item.checked}
                            onChange={e => setTaxItems(prev => prev.map(t =>
                              t.id === item.id ? { ...t, checked: e.target.checked } : t
                            ))} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900">{item.name}</p>
                            <p className="text-[11px] text-gray-500">{item.desc}</p>
                          </div>
                          <button type="button"
                            onClick={() => setTaxItems(prev => prev.filter(t => t.id !== item.id))}
                            className="text-red-400 hover:text-red-600 p-0.5 flex-shrink-0" title="Remove">
                            <i className="ti ti-x" style={{ fontSize: 12 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {/* Add a custom tax */}
          <div className="border border-gray-200 rounded-md p-3 bg-gray-50 space-y-2">
            <p className="text-xs font-medium text-gray-600">Add a custom tax</p>
            <input
              type="text"
              value={customTaxInput}
              onChange={e => setCustomTaxInput(e.target.value)}
              placeholder="Tax name (e.g. Tourism levy, Excise on plastics)"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <select
                  value={customTaxCategory}
                  onChange={e => setCustomTaxCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Indirect taxes">Indirect taxes</option>
                  <option value="Direct taxes">Direct taxes</option>
                  <option value="Employment & payroll">Employment &amp; payroll</option>
                  <option value="Sector-specific & other">Sector-specific &amp; other</option>
                  <option value="__new__">+ Create new category</option>
                </select>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (!customTaxInput.trim()) return;
                  const category = customTaxCategory === "__new__"
                    ? (customTaxNewCategory.trim() || "Other")
                    : customTaxCategory;
                  const newItem: TaxItem = {
                    id: `custom_${Date.now()}`,
                    name: customTaxInput.trim(),
                    desc: `Custom tax — ${category}. Configure rate and details on Tax & statutory page.`,
                    rate: "",
                    checked: true,
                    custom: true,
                    category,
                  };
                  setTaxItems(prev => [...prev, newItem]);
                  setCustomTaxInput("");
                  setCustomTaxNewCategory("");
                  setCustomTaxCategory("Indirect taxes");
                }}
              >
                + Add
              </Button>
            </div>
            {customTaxCategory === "__new__" && (
              <input
                type="text"
                value={customTaxNewCategory}
                onChange={e => setCustomTaxNewCategory(e.target.value)}
                placeholder="New category name (e.g. Environmental levies)"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <p className="text-xs text-gray-400 pl-2 border-l-2 border-amber-300">
            Tax information is provided for guidance only. Always verify with your tax adviser.
            Ziva BI updates jurisdiction profiles as laws change, and your admin can add, remove,
            or adjust applicable taxes at any time.
          </p>

          <div className="flex justify-end pt-1">
            <Button variant="primary" onClick={saveApplicability} disabled={savingApp} loading={savingApp}>
              {savingApp ? "Saving…" : appSaved ? "✓ Saved" : "Save tax applicability"}
            </Button>
          </div>
        </div>
      )}

      {/* ── VAT tab ── */}
      {tab === "vat" && vatVisible && (
        <div className="space-y-4 max-w-md">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="vat_reg"
              checked={config.vat_config?.vat_registered ?? false}
              onChange={(e) => setVat("vat_registered", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="vat_reg" className="text-sm font-medium text-gray-700">
              VAT registered
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Standard VAT rate (%)</label>
            <input
              type="number"
              className={inputCls}
              min={0}
              max={100}
              step={0.01}
              value={config.vat_config?.standard_rate ?? ""}
              onChange={(e) => setVat("standard_rate", parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VAT GL account</label>
            <input
              className={inputCls}
              placeholder="GL number"
              value={config.vat_config?.vat_gl ?? ""}
              onChange={(e) => setVat("vat_gl", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Input VAT GL account</label>
            <input
              className={inputCls}
              placeholder="GL number"
              value={config.vat_config?.input_vat_gl ?? ""}
              onChange={(e) => setVat("input_vat_gl", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="reverse_vat"
              checked={config.vat_config?.reverse_vat ?? false}
              onChange={(e) => setVat("reverse_vat", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="reverse_vat" className="text-sm text-gray-700">Reverse VAT (applicable vendors)</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="self_vat"
              checked={config.vat_config?.self_account_vat ?? false}
              onChange={(e) => setVat("self_account_vat", e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="self_vat" className="text-sm text-gray-700">Self-account VAT</label>
          </div>
          <SaveBtn patch={{ vat_config: config.vat_config }} />
        </div>
      )}

      {/* ── WHT tab ── */}
      {tab === "wht" && whtVisible && (
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Non-resident WHT rate (%)</label>
            <input
              type="number"
              className={inputCls}
              min={0}
              max={100}
              step={0.01}
              value={config.wht_config?.non_resident_rate ?? ""}
              onChange={(e) => setWht("non_resident_rate", parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WHT GL account</label>
            <input
              className={inputCls}
              placeholder="GL number"
              value={config.wht_config?.wht_gl ?? ""}
              onChange={(e) => setWht("wht_gl", e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">WHT categories</p>
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => {
                  const updated = [
                    ...(config.wht_config?.categories ?? []),
                    { vendor_category: "", rate: 0, gl_account: "", applies_to: "", effective_from: "" },
                  ];
                  setWht("categories", updated);
                }}
              >
                + Add WHT rule
              </button>
            </div>
            {(config.wht_config?.categories ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">No WHT rules configured.</p>
            ) : (
              <div className="space-y-2">
                {(config.wht_config?.categories ?? []).map((cat, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <input
                      className={inputCls}
                      placeholder="Vendor category"
                      value={cat.vendor_category}
                      onChange={(e) => {
                        const cats = [...(config.wht_config?.categories ?? [])];
                        cats[i] = { ...cats[i], vendor_category: e.target.value };
                        setWht("categories", cats);
                      }}
                    />
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="Rate %"
                      value={cat.rate}
                      onChange={(e) => {
                        const cats = [...(config.wht_config?.categories ?? [])];
                        cats[i] = { ...cats[i], rate: parseFloat(e.target.value) };
                        setWht("categories", cats);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <SaveBtn patch={{ wht_config: config.wht_config }} />
        </div>
      )}

      {/* ── PAYE tab ── */}
      {tab === "paye" && payeVisible && (
        <div className="space-y-4 max-w-md">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee pension rate (%)</label>
              <input
                type="number"
                className={inputCls}
                min={0}
                value={config.paye_config?.employee_pension_rate ?? ""}
                onChange={(e) => setPaye("employee_pension_rate", parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employer pension rate (%)</label>
              <input
                type="number"
                className={inputCls}
                min={0}
                value={config.paye_config?.employer_pension_rate ?? ""}
                onChange={(e) => setPaye("employer_pension_rate", parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee pension GL</label>
              <input
                className={inputCls}
                placeholder="GL number"
                value={config.paye_config?.employee_pension_gl ?? ""}
                onChange={(e) => setPaye("employee_pension_gl", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employer pension GL</label>
              <input
                className={inputCls}
                placeholder="GL number"
                value={config.paye_config?.employer_pension_gl ?? ""}
                onChange={(e) => setPaye("employer_pension_gl", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NHF rate (%)</label>
              <input
                type="number"
                className={inputCls}
                min={0}
                value={config.paye_config?.nhf_rate ?? ""}
                onChange={(e) => setPaye("nhf_rate", parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NSITF rate (%)</label>
              <input
                type="number"
                className={inputCls}
                min={0}
                value={config.paye_config?.nsitf_rate ?? ""}
                onChange={(e) => setPaye("nsitf_rate", parseFloat(e.target.value))}
              />
            </div>
          </div>
          <SaveBtn patch={{ paye_config: config.paye_config }} />
        </div>
      )}

      {/* ── Other statutory tab ── */}
      {tab === "other" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Configure other statutory levies (Education tax, Police levy, NITDA levy, etc.)
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Statutory levies</p>
            <button
              type="button"
              onClick={() => {
                const levies = [
                  ...(config.other_statutory?.levies ?? []),
                  { name: "", rate: 0, base: "", gl_account: "", effective_from: "" },
                ];
                setConfig((c) => ({
                  ...c,
                  other_statutory: { levies },
                }));
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add levy
            </button>
          </div>
          {(config.other_statutory?.levies ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 italic">No levies configured.</p>
          ) : (
            <div className="space-y-2">
              {(config.other_statutory?.levies ?? []).map((levy, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <input
                    className={inputCls}
                    placeholder="Levy name"
                    value={levy.name}
                    onChange={(e) => {
                      const levies = [...(config.other_statutory?.levies ?? [])];
                      levies[i] = { ...levies[i], name: e.target.value };
                      setConfig((c) => ({ ...c, other_statutory: { levies } }));
                    }}
                  />
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="Rate %"
                    value={levy.rate}
                    onChange={(e) => {
                      const levies = [...(config.other_statutory?.levies ?? [])];
                      levies[i] = { ...levies[i], rate: parseFloat(e.target.value) };
                      setConfig((c) => ({ ...c, other_statutory: { levies } }));
                    }}
                  />
                  <input
                    className={inputCls}
                    placeholder="Base"
                    value={levy.base}
                    onChange={(e) => {
                      const levies = [...(config.other_statutory?.levies ?? [])];
                      levies[i] = { ...levies[i], base: e.target.value };
                      setConfig((c) => ({ ...c, other_statutory: { levies } }));
                    }}
                  />
                  <input
                    className={inputCls}
                    placeholder="GL account"
                    value={levy.gl_account}
                    onChange={(e) => {
                      const levies = [...(config.other_statutory?.levies ?? [])];
                      levies[i] = { ...levies[i], gl_account: e.target.value };
                      setConfig((c) => ({ ...c, other_statutory: { levies } }));
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <SaveBtn patch={{ other_statutory: config.other_statutory }} />
        </div>
      )}
    </PageContainer>
  );
}

export default function TaxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <TaxContent />
    </Suspense>
  );
}
