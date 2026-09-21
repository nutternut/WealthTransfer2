"use client";

import { TaxRulesList } from "@/components/tax-rules/TaxRulesList";
import { taxRules } from "@/data/wealth-transfer";

export default function AdminTaxRulesPage() {
  return <TaxRulesList initialRules={taxRules} />;
}
