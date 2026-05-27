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

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

type Tab = "identity" | "structure" | "branding" | "config";
type ConfigSubTab = "fiscal" | "features" | "tax" | "governance";

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

interface TaxGroup {
  title: string;
  items: TaxItem[];
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
  auth_levels?: Array<{ role: string; min_amount: number | "" }>;
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
const PERIOD_FREQS = ["Monthly", "Quarterly", "Annual"];
const FY_FORMATS = ["FY{YYYY}", "{YYYY}/{YYYY+1}", "{Mon YYYY} — {Mon YYYY}"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const NODE_TYPES = ["Legal entity", "Division / Business unit", "Department", "Cost center"];

const PRESET_THEMES: Omit<BrandingTheme, "id">[] = [
  { name: "Corporate Blue",  primary: "#2563EB", secondary: "#64748B", accent: "#F59E0B", sidebar: "#1E293B", font_family: "Inter",          font_size: "default", button_style: "rounded", card_radius: "medium", email_header_bg: "#1E293B", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Forest Green",    primary: "#16A34A", secondary: "#4B7B5E", accent: "#F97316", sidebar: "#14532D", font_family: "Inter",          font_size: "default", button_style: "rounded", card_radius: "medium", email_header_bg: "#14532D", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Midnight Dark",   primary: "#8B5CF6", secondary: "#6D6D8A", accent: "#EC4899", sidebar: "#0F0F0F", font_family: "Inter",          font_size: "default", button_style: "pill",    card_radius: "large",  email_header_bg: "#0F0F0F", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Classic Red",     primary: "#DC2626", secondary: "#78716C", accent: "#FBBF24", sidebar: "#1C1917", font_family: "Inter",          font_size: "default", button_style: "rounded", card_radius: "medium", email_header_bg: "#1C1917", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Ocean Teal",      primary: "#0D9488", secondary: "#4B7B78", accent: "#F59E0B", sidebar: "#134E4A", font_family: "DM Sans",        font_size: "default", button_style: "rounded", card_radius: "large",  email_header_bg: "#134E4A", email_sender_name: "", logo_url: "", favicon_url: "" },
  { name: "Slate Modern",    primary: "#475569", secondary: "#94A3B8", accent: "#06B6D4", sidebar: "#1E293B", font_family: "IBM Plex Sans",  font_size: "default", button_style: "square",  card_radius: "sharp",  email_header_bg: "#1E293B", email_sender_name: "", logo_url: "", favicon_url: "" },
];

// ── Tax jurisdiction profiles ─────────────────────────────────────────────────

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

  const [configTab, setConfigTab] = useState<ConfigSubTab>("fiscal");
  const [collapsedTaxGroups, setCollapsedTaxGroups] = useState<Set<string>>(new Set());

  const toggleTaxGroup = (title: string) => {
    setCollapsedTaxGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

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
    auth_levels: [
      { role: "", min_amount: "" },
      { role: "", min_amount: "" },
    ],
  };

  const [config, setConfig] = useState<OrgConfiguration>(DEFAULT_CONFIG);
  const [customTaxInput, setCustomTaxInput] = useState("");
  const [customTaxCategory, setCustomTaxCategory] = useState<string>("Indirect taxes");
  const [customTaxNewCategory, setCustomTaxNewCategory] = useState<string>("");

  // Load org config
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<OrgConfig>("/api/setup/org", { token: accessToken })
      .then(data => {
        setOrg(data);
        if (data.org_configuration) {
          setConfig(data.org_configuration);
        } else if (data.country) {
          setConfig(prev => ({
            ...prev,
            tax_items: getTaxProfileForCountry(data.country!),
          }));
        }
      })
      .catch(() => {});
  }, [accessToken]);

  // Load org tree when Structure tab is active
  useEffect(() => {
    if (tab !== "structure" || !accessToken) return;
    apiFetch<{ nodes: OrgNode[] }>("/api/setup/org-structure", { token: accessToken })
      .then(d => setNodes(d.nodes))
      .catch(() => {});
  }, [tab, accessToken]);

  // Load fiscal periods when Configuration tab is active
  useEffect(() => {
    if (tab !== "config" || !accessToken) return;
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
        <TabBtn tab="config" active={tab === "config"} onClick={setTab} label="Configuration" />
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
                  <button type="button" onClick={() => setBrandingTab("themes")}
                    className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="button" onClick={async () => {
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
                  }} disabled={saving}
                    className="text-sm px-4 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                    {saving ? "Saving…" : "Save theme"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── PREVIEW sub-tab ── */}
          {brandingTab === "preview" && (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Browser chrome */}
                <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Portal preview</p>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                </div>
                {/* Portal simulation */}
                <div className="flex" style={{ height: 340 }}>
                  {/* Sidebar */}
                  <div className="w-36 flex-shrink-0 py-4"
                    style={{ background: editTheme.sidebar }}>
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
                      <p className="text-xs px-3 mb-1 mt-2" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.05em" }}>FINANCIALS</p>
                      <div className="px-3 py-1.5">
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Dimensions</p>
                      </div>
                      <div className="px-3 py-1.5">
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Chart of accounts</p>
                      </div>
                    </div>
                  </div>
                  {/* Main content */}
                  <div className="flex-1 p-4 overflow-auto bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Organisation</p>
                        <p className="text-xs text-gray-500">Configure your company identity</p>
                      </div>
                      <button
                        type="button"
                        style={{
                          background: editTheme.primary,
                          color: getButtonTextColor(editTheme.primary),
                          borderRadius: editTheme.button_style === "rounded" ? 6 : editTheme.button_style === "pill" ? 999 : 2,
                          border: "none",
                          padding: "6px 14px",
                          fontSize: 12,
                          cursor: "default",
                        }}
                      >Save changes</button>
                    </div>
                    <div className="bg-white border border-gray-200 p-3 mb-3"
                      style={{ borderRadius: editTheme.card_radius === "sharp" ? 2 : editTheme.card_radius === "medium" ? 8 : 16 }}>
                      <p className="text-xs font-medium text-gray-500 mb-2" style={{ letterSpacing: "0.05em" }}>LEGAL & REGISTRATION</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Legal name</p>
                          <div className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800">
                            {org.legal_name || "Acme Corporation"}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">RC number</p>
                          <div className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800">RC1234567</div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 rounded bg-gray-100">
                        <p className="text-xs text-gray-500">Employees</p>
                        <p className="text-base font-medium text-gray-900">24</p>
                      </div>
                      <div className="p-2.5 rounded bg-gray-100">
                        <p className="text-xs text-gray-500">Modules</p>
                        <p className="text-base font-medium text-gray-900">3</p>
                      </div>
                      <div className="p-2.5 rounded" style={{ background: editTheme.accent + "33" }}>
                        <p className="text-xs" style={{ color: editTheme.accent }}>Pending</p>
                        <p className="text-base font-medium text-gray-900">7</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-xs text-blue-700">This is a simulated preview. Full live theming across all pages is planned for a future milestone.</p>
              </div>

              <div className="flex justify-between">
                <button type="button" onClick={() => setBrandingTab("controls")}
                  className="text-sm px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                  Back to edit
                </button>
                <button type="button" onClick={async () => {
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
                }} disabled={saving}
                  className="text-sm px-4 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                  {saving ? "Saving…" : "Save & apply"}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Configuration tab ────────────────────────────────────────────────── */}
      {tab === "config" && (
        <div className="space-y-0">

          {/* Sub-tab bar */}
          <div className="flex gap-0 border-b border-gray-200 mb-5">
            {([
              { key: "fiscal",     label: "Fiscal year" },
              { key: "features",   label: "Financial features" },
              { key: "tax",        label: "Tax applicability" },
              { key: "governance", label: "Governance" },
            ] as { key: ConfigSubTab; label: string }[]).map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setConfigTab(t.key)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  configTab === t.key
                    ? "border-blue-600 text-gray-900 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >{t.label}</button>
            ))}
          </div>

          {/* ── FISCAL YEAR sub-tab ── */}
          {configTab === "fiscal" && (
            <div className="space-y-4 max-w-xl">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Start month">
                  <Select value={org.fiscal_year_start_month ?? ""} onChange={e => setOrg(o => ({ ...o, fiscal_year_start_month: parseInt(e.target.value) || undefined }))}>
                    <option value="">— Select —</option>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </Select>
                </Field>
                <Field label="Start day">
                  <Input type="number" min={1} max={31} value={org.fiscal_year_start_day ?? ""} onChange={e => setOrg(o => ({ ...o, fiscal_year_start_day: parseInt(e.target.value) || undefined }))} placeholder="1" />
                </Field>
                <Field label="Year name format">
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
              <p className="text-xs text-gray-400 italic">Period closing frequency controls when periods are formally closed. It does not restrict report generation.</p>
              <button type="button" onClick={() => save({
                fiscal_year_start_month: org.fiscal_year_start_month,
                fiscal_year_start_day: org.fiscal_year_start_day,
                fiscal_year_name_format: org.fiscal_year_name_format,
                period_closing_frequency: org.period_closing_frequency,
              })} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                {saving ? "Saving…" : saved ? "✓ Saved" : "Save fiscal year settings"}
              </button>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-800 mb-3">Generate fiscal periods</p>
                <div className="flex items-center gap-3">
                  <input type="text" value={genLabel} onChange={e => setGenLabel(e.target.value)} placeholder="e.g. FY2026"
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={generatePeriods} disabled={generating || !org.fiscal_year_start_month}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 rounded-md disabled:opacity-50">
                    <i className="ti ti-refresh" style={{ fontSize: 14 }} />
                    {generating ? "Generating…" : `Generate periods for ${genLabel}`}
                  </button>
                </div>
                {!org.fiscal_year_start_month && <p className="mt-1 text-xs text-amber-600">Set start month and save first.</p>}
              </div>
              {periods.length > 0 && (
                <div className="overflow-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>{["Period name","Opens","Closes","Status"].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}</tr>
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
                              p.status === "closed" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"
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

          {/* ── FINANCIAL FEATURES sub-tab ── */}
          {configTab === "features" && (
            <div className="space-y-0 max-w-2xl">

              {/* Dimensions */}
              <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Analytical dimensions <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded ml-1">Recommended</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">Tag transactions with additional context — cost center, project, brand, or region — to slice and filter reports beyond just the GL account.</p>
                  {config.use_dimensions && (
                    <p className="text-xs text-blue-600 mt-1.5">Dimensions page is now visible in the sidebar. Configure dimension types and values there before uploading your Chart of Accounts.</p>
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
                  <p className="text-xs text-gray-500 mt-0.5">Enable if your organisation transacts in foreign currencies. Unlocks the Currencies & FX setup page.</p>
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
                  {config.use_multi_currency && (
                    <p className="text-xs text-blue-600 mt-1.5">Currencies & FX page is now visible in the sidebar.</p>
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
              <div className="flex items-start justify-between gap-4 py-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Intercompany transactions</p>
                  <p className="text-xs text-gray-500 mt-0.5">Enable if this entity transacts with other entities in the same group. Required for intercompany eliminations in consolidated reports.</p>
                </div>
                <label className="relative w-9 h-5 cursor-pointer flex-shrink-0 mt-0.5">
                  <input type="checkbox" className="sr-only" checked={config.use_intercompany}
                    onChange={e => setConfig(c => ({ ...c, use_intercompany: e.target.checked }))} />
                  <span className={`absolute inset-0 rounded-full transition-colors ${config.use_intercompany ? "bg-blue-600" : "bg-gray-300"}`} />
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.use_intercompany ? "translate-x-4" : ""}`} />
                </label>
              </div>

              {/* Inventory costing */}
              <div className="flex items-start justify-between gap-4 py-4 border-t border-gray-100">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Inventory costing method <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded ml-1">Required for inventory</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">Choose how inventory cost is calculated. This is a one-time irreversible decision (IAS 2) — locked after go-live.</p>
                  {config.use_inventory_costing && (
                    <div className="mt-2">
                      <Field label="Costing method">
                        <Select value={config.inventory_costing_method ?? ""} onChange={e => setConfig(c => ({ ...c, inventory_costing_method: e.target.value }))}>
                          <option>Weighted average cost (AVCO)</option>
                          <option>First in, first out (FIFO)</option>
                          <option>Standard cost</option>
                        </Select>
                      </Field>
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <i className="ti ti-lock" style={{ fontSize: 12 }} /> Cannot be changed after go-live.
                      </p>
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
              <div className="flex items-start justify-between gap-4 py-4 border-t border-gray-100">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Budget control</p>
                  <p className="text-xs text-gray-500 mt-0.5">Control what happens when a transaction exceeds the approved budget for a cost center or GL account.</p>
                  {config.use_budget_control && (
                    <div className="mt-2">
                      <Field label="When budget is exceeded">
                        <Select value={config.budget_exceeded_action ?? ""} onChange={e => setConfig(c => ({ ...c, budget_exceeded_action: e.target.value }))}>
                          <option>Show warning, allow posting</option>
                          <option>Block posting — hard stop</option>
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
                <button type="button" onClick={() => save({ org_configuration: config })} disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                  {saving ? "Saving…" : saved ? "✓ Saved" : "Save features"}
                </button>
              </div>
            </div>
          )}

          {/* ── TAX APPLICABILITY sub-tab ── */}
          {configTab === "tax" && (
            <div className="space-y-4 max-w-2xl">
              <p className="text-xs text-gray-500">Select every tax that applies to your organisation. Only selected taxes will appear in Tax & statutory setup.</p>

              {/* Zero-tax haven */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                <input type="checkbox" className="w-3.5 h-3.5 cursor-pointer accent-blue-600"
                  checked={config.is_tax_haven}
                  onChange={e => {
                    setConfig(c => ({ ...c, is_tax_haven: e.target.checked }));
                    if (e.target.checked) {
                      const countryCode = (org.country && TAX_PROFILES[org.country]) ? org.country : "XX";
                      const groups = getTaxGroupsForItems(config.tax_items, countryCode);
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

              {config.is_tax_haven && (
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
                const countryCode = (org.country && TAX_PROFILES[org.country]) ? org.country : "XX";
                const groups = getTaxGroupsForItems(config.tax_items, countryCode);
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
                            {group.items.filter(i => {
                              const saved = config.tax_items.find(t => t.id === i.id);
                              return saved ? saved.checked : i.checked;
                            }).length} of {group.items.length} selected
                          </span>
                          <i className={`ti ti-chevron-${isCollapsed ? "right" : "down"} text-gray-400`} style={{ fontSize: 13 }} />
                        </div>
                      </button>

                      {!isCollapsed && (
                        <div className="divide-y divide-gray-50">
                          {group.items.map(item => {
                            const savedItem = config.tax_items.find(t => t.id === item.id);
                            const isChecked = savedItem ? savedItem.checked : item.checked;
                            return (
                              <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5">
                                <input type="checkbox" className="w-3.5 h-3.5 cursor-pointer accent-blue-600 mt-0.5 flex-shrink-0"
                                  checked={isChecked}
                                  onChange={e => {
                                    setConfig(c => {
                                      const existing = c.tax_items.find(t => t.id === item.id);
                                      if (existing) {
                                        return { ...c, tax_items: c.tax_items.map(t => t.id === item.id ? { ...t, checked: e.target.checked } : t) };
                                      }
                                      return { ...c, tax_items: [...c.tax_items, { ...item, checked: e.target.checked }] };
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
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              {/* Custom taxes group — renders items added via the form below */}
              {config.tax_items.filter(t => t.custom).length > 0 && (() => {
                const customByCategory = config.tax_items
                  .filter(t => t.custom)
                  .reduce((acc, item) => {
                    const cat = item.category ?? "Custom taxes";
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                  }, {} as Record<string, TaxItem[]>);

                return Object.entries(customByCategory).map(([category, items]) => {
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
                          <span className="text-xs text-blue-500">{items.filter(i => i.checked).length} of {items.length} selected</span>
                          <i className={`ti ti-chevron-${isCollapsed ? "right" : "down"} text-blue-400`} style={{ fontSize: 13 }} />
                        </div>
                      </button>
                      {!isCollapsed && (
                        <div className="divide-y divide-blue-50">
                          {items.map(item => (
                            <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5">
                              <input
                                type="checkbox"
                                className="w-3.5 h-3.5 cursor-pointer accent-blue-600 mt-0.5 flex-shrink-0"
                                checked={item.checked}
                                onChange={e => {
                                  setConfig(c => ({
                                    ...c,
                                    tax_items: c.tax_items.map(t =>
                                      t.id === item.id ? { ...t, checked: e.target.checked } : t
                                    ),
                                  }));
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900">{item.name}</p>
                                <p className="text-[11px] text-gray-500">{item.desc}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setConfig(c => ({ ...c, tax_items: c.tax_items.filter(t => t.id !== item.id) }))}
                                className="text-red-400 hover:text-red-600 p-0.5 flex-shrink-0"
                                title="Remove custom tax"
                              >
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

              {/* Custom tax */}
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
                  <button
                    type="button"
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
                      setConfig(c => ({ ...c, tax_items: [...c.tax_items, newItem] }));
                      setCustomTaxInput("");
                      setCustomTaxNewCategory("");
                      setCustomTaxCategory("Indirect taxes");
                    }}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                  >
                    + Add
                  </button>
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
                <button type="button" onClick={() => save({ org_configuration: config })} disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                  {saving ? "Saving…" : saved ? "✓ Saved" : "Save tax settings"}
                </button>
              </div>
            </div>
          )}

          {/* ── GOVERNANCE sub-tab ── */}
          {configTab === "governance" && (
            <div className="space-y-0 max-w-2xl">

              {/* Audit trail */}
              <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Full audit trail</p>
                  <p className="text-xs text-gray-500 mt-0.5">Log every create, edit, and delete action against a user, timestamp, and IP address. Required for SOX, ISO 27001, and most enterprise compliance frameworks.</p>
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
                  <p className="text-xs text-gray-500 mt-0.5">Require sequential approval by multiple authorisers on payments above defined thresholds. Number of levels configurable up to 5.</p>
                  {config.use_multilevel_auth && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-500 mb-2">Define each authorisation level. Levels are sequential — Level 1 approves first.</p>
                      {(config.auth_levels ?? []).map((level, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-medium flex items-center justify-center flex-shrink-0">{i + 1}</div>
                          <Input placeholder="Role or person (e.g. Finance Manager)" value={level.role}
                            onChange={e => setConfig(c => ({ ...c, auth_levels: c.auth_levels?.map((l, idx) => idx === i ? { ...l, role: e.target.value } : l) }))} />
                          <Input type="number" placeholder="Min amount" style={{ width: 140 }} value={level.min_amount}
                            onChange={e => setConfig(c => ({ ...c, auth_levels: c.auth_levels?.map((l, idx) => idx === i ? { ...l, min_amount: parseInt(e.target.value) || "" } : l) }))} />
                          {(config.auth_levels?.length ?? 0) > 1 && (
                            <button type="button"
                              onClick={() => setConfig(c => ({ ...c, auth_levels: c.auth_levels?.filter((_, idx) => idx !== i) }))}
                              className="text-red-400 hover:text-red-600 p-1">
                              <i className="ti ti-x" style={{ fontSize: 13 }} />
                            </button>
                          )}
                        </div>
                      ))}
                      {(config.auth_levels?.length ?? 0) < 5 && (
                        <button type="button"
                          onClick={() => setConfig(c => ({ ...c, auth_levels: [...(c.auth_levels ?? []), { role: "", min_amount: "" }] }))}
                          className="text-xs text-blue-600 hover:text-blue-700 mt-1">
                          + Add level
                        </button>
                      )}
                      <p className="text-xs text-gray-400 mt-1">Full workflow configuration is done in Approval workflows. This enables the feature globally.</p>
                    </div>
                  )}
                </div>
                <label className="relative w-9 h-5 cursor-pointer flex-shrink-0 mt-0.5">
                  <input type="checkbox" className="sr-only" checked={config.use_multilevel_auth}
                    onChange={e => setConfig(c => ({ ...c, use_multilevel_auth: e.target.checked }))} />
                  <span className={`absolute inset-0 rounded-full transition-colors ${config.use_multilevel_auth ? "bg-blue-600" : "bg-gray-300"}`} />
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${config.use_multilevel_auth ? "translate-x-4" : ""}`} />
                </label>
              </div>

              <div className="pt-4 flex justify-end border-t border-gray-100">
                <button type="button" onClick={() => save({ org_configuration: config })} disabled={saving}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                  {saving ? "Saving…" : saved ? "✓ Saved" : "Save governance settings"}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
