"use client";

/**
 * Module Setup stub page — M8.2 Implementation Portal.
 *
 * Renders a clean placeholder for each module that has not yet been built.
 * All 13 non-expense module setup pages use this single dynamic route.
 *
 * Route: /dashboard/business/setup/modules/[module]
 * Examples: /setup/modules/ap, /setup/modules/payroll, /setup/modules/bank
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

const MODULE_INFO: Record<string, {
  label: string;
  icon: string;
  description: string;
  features: string[];
}> = {
  ap: {
    label: "Accounts Payable",
    icon: "📄",
    description: "Configure accounts payable settings, vendor invoice processing, payment terms, and approval workflows.",
    features: [
      "Vendor master data and onboarding",
      "Invoice capture and 3-way matching",
      "Payment runs and batch processing",
      "Aging reports and due date alerts",
      "WHT application rules",
      "AP approval workflows",
    ],
  },
  ar: {
    label: "Accounts Receivable",
    icon: "📬",
    description: "Configure accounts receivable settings, customer invoicing, credit limits, and collection workflows.",
    features: [
      "Customer master data",
      "Invoice generation and dispatch",
      "Credit limit controls",
      "Receipt allocation and matching",
      "Aging analysis and dunning",
      "Revenue recognition rules",
    ],
  },
  payroll: {
    label: "Payroll & HR",
    icon: "💰",
    description: "Configure payroll processing, salary structures, statutory deductions, and HR administration.",
    features: [
      "Salary structure and grade setup",
      "PAYE, pension, and NHF computation",
      "Monthly payroll run automation",
      "Payslip generation and distribution",
      "Leave and attendance management",
      "HR analytics and headcount reports",
    ],
  },
  inventory: {
    label: "Inventory Management",
    icon: "📦",
    description: "Configure inventory tracking, stock levels, reorder rules, and warehouse integration.",
    features: [
      "Item master and categorisation",
      "Stock level monitoring and alerts",
      "FIFO/LIFO/Average cost methods",
      "Purchase order integration",
      "Stock movement audit trail",
      "Multi-warehouse support",
    ],
  },
  "fixed-assets": {
    label: "Fixed Assets",
    icon: "🏗️",
    description: "Configure fixed asset register, depreciation methods, and asset lifecycle management.",
    features: [
      "Asset register and tagging",
      "Depreciation methods (SL, DB, UoP)",
      "Asset additions and disposals",
      "Revaluation and impairment",
      "Asset transfer between cost centers",
      "IFRS 16 lease accounting",
    ],
  },
  posm: {
    label: "POSM Management",
    icon: "🗺️",
    description: "Configure point-of-sale materials tracking, deployment, and recovery across trade channels.",
    features: [
      "POSM item catalogue",
      "Deployment to outlets",
      "Recovery and write-off workflows",
      "Trade activation campaigns",
      "Outlet and route master",
      "POSM cost allocation to GL",
    ],
  },
  "vendor-portal": {
    label: "Vendor Portal",
    icon: "🤝",
    description: "Configure the self-service portal for vendors to submit invoices, view payment status, and manage their profile.",
    features: [
      "Vendor self-registration and onboarding",
      "Invoice submission and tracking",
      "Payment status visibility",
      "Bank account management",
      "Document uploads and compliance",
      "Dispute resolution workflow",
    ],
  },
  "customer-portal": {
    label: "Customer Portal",
    icon: "👤",
    description: "Configure the self-service portal for customers to view invoices, make payments, and manage their account.",
    features: [
      "Customer self-service dashboard",
      "Invoice viewing and download",
      "Online payment integration",
      "Credit note and dispute management",
      "Statement of account",
      "Collection correspondence",
    ],
  },
  warehouse: {
    label: "Warehouse / 3PL Portal",
    icon: "🏭",
    description: "Configure warehouse operations, 3PL integration, and goods movement tracking.",
    features: [
      "Inbound and outbound shipment management",
      "3PL partner integration",
      "Pick, pack, and dispatch workflows",
      "Returns and reverse logistics",
      "Inventory reconciliation with 3PL",
      "Freight cost allocation",
    ],
  },
  bank: {
    label: "Bank Reconciliation",
    icon: "🏦",
    description: "Configure automated bank reconciliation, statement imports, and matching rules.",
    features: [
      "Bank statement import (MT940, CSV)",
      "Automated transaction matching rules",
      "Unreconciled items dashboard",
      "Multi-bank and multi-currency support",
      "Reconciliation lock by period",
      "Variance analysis reports",
    ],
  },
  budget: {
    label: "Budget Engine",
    icon: "📈",
    description: "Configure budget creation, allocation, version control, and budget vs. actual reporting.",
    features: [
      "Annual and rolling budget creation",
      "Cost center and GL-level allocation",
      "Budget version control and approval",
      "Real-time budget vs. actual tracking",
      "Budget transfer workflows",
      "Variance alerts and escalation",
    ],
  },
  "tax-engine": {
    label: "Tax Engine",
    icon: "🧮",
    description: "Configure automated tax computation, filing schedules, and compliance reporting.",
    features: [
      "Company income tax computation",
      "Deferred tax calculation",
      "Tax return preparation",
      "FIRS and state revenue board filing",
      "Transfer pricing documentation",
      "Tax audit support package",
    ],
  },
  reporting: {
    label: "Reporting & Analytics",
    icon: "📊",
    description: "Configure financial reports, management dashboards, and data exports.",
    features: [
      "Income statement and balance sheet",
      "Cash flow statement (direct/indirect)",
      "Management accounts pack",
      "Consolidated group reporting",
      "Custom report builder",
      "Power BI and Excel export",
    ],
  },
};

export default function ModuleStubPage() {
  const params = useParams();
  const moduleKey = params.module as string;
  const info = MODULE_INFO[moduleKey];

  if (!info) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Module not found.</p>
        <Link href="/dashboard/business/setup" className="text-sm text-blue-600 hover:underline mt-2 block">
          ← Back to setup dashboard
        </Link>
      </div>
    );
  }

  return (
    <PageContainer maxWidth="2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-3xl leading-none">{info.icon}</span>
        <div>
          <PageHeading title={info.label} />
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full mt-1">
            Configuration coming soon
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6 mt-3">{info.description}</p>

      {/* Status banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm font-medium text-blue-800">
          This module is activated and awaiting configuration.
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Full configuration options will be available in an upcoming milestone.
          The module has been activated and will appear in relevant workflows.
        </p>
      </div>

      {/* What will be configurable */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          What will be configurable here:
        </p>
        <ul className="space-y-2">
          {info.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/dashboard/business/setup"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to setup dashboard
        </Link>
      </div>
    </PageContainer>
  );
}
