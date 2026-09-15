import { z } from 'zod';

export const HeadlineKpisSchema = z.object({
  all_in_revenue: z.number().default(0),
  all_in_expenditures: z.number().default(0),
  all_in_net: z.number().default(0),
  all_in_margin_pct: z.number().default(0),
  qbo_operating_revenue: z.number().default(0),
  qbo_cogs: z.number().default(0),
  qbo_operating_expenditures: z.number().default(0),
  qbo_operating_net: z.number().default(0),
  non_operating_bridge: z.number().default(0),
  program_ratio_pct: z.number().default(0),
  program_spend: z.number().default(0),
  mg_spend: z.number().default(0),
  fund_spend: z.number().default(0),
  operating_cash: z.number().default(0),
  operating_checking_first_merchants: z.number().default(0),
  undeposited_funds: z.number().default(0),
  petty_cash: z.number().default(0),
  bank_register_cash: z.number().default(0),
  fidelity_reserve: z.number().default(0),
  total_liquidity: z.number().default(0),
  runway_bank_days: z.number().default(0),
  runway_reserve_months: z.number().default(0),
  average_monthly_burn: z.number().default(0),
  baseline_monthly_burn: z.number().default(0)
}).passthrough();

export const RevenueExpenseItemSchema = z.object({
  name: z.string(),
  group: z.string(),
  amount: z.number()
});

export const MonthlyStatementSchema = z.object({
  id: z.string(),
  month: z.string(),
  is_partial: z.boolean().default(false),
  revenue: z.number().default(0),
  cogs: z.number().default(0),
  operating_exp: z.number().default(0),
  other_exp: z.number().default(0),
  total_exp: z.number().default(0),
  net_margin: z.number().default(0),
  margin_pct: z.number().default(0),
  status: z.string().default(''),
  driver: z.string().default(''),
  rev_items: z.array(RevenueExpenseItemSchema).default([]),
  exp_items: z.array(RevenueExpenseItemSchema).default([])
}).passthrough();

export const CheckingBalanceHistorySchema = z.object({
  years: z.record(z.string(), z.array(z.number())),
  meta: z.object({
    period_title: z.string().optional(),
    cutoff_date: z.string().optional(),
    latest_partial_date: z.string().optional(),
    has_partial_cutoff: z.boolean().optional(),
    source: z.string().optional(),
    basis: z.string().optional()
  }).passthrough().optional()
}).passthrough();

export const FinancialPayloadSchema = z.object({
  meta: z.any().optional(),
  headline_kpis: HeadlineKpisSchema.optional(),
  monthly_statements: z.array(MonthlyStatementSchema).optional(),
  checking_balance_history: CheckingBalanceHistorySchema.optional(),
  monthly_drilldown: z.any().optional(),
  bank_statement: z.any().optional(),
  bank_statements: z.any().optional(),
  donors: z.array(z.any()).optional(),
  donor_meta: z.any().optional()
}).passthrough();
