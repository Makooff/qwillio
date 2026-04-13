import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';

interface AddExpenseData {
  description: string;
  amount: number;
  date: Date;
  vendor?: string;
  receiptUrl?: string;
  isRecurring?: boolean;
  notes?: string;
}

interface AddIncomeData {
  description: string;
  amount: number;
  date: Date;
  source?: string;
}

interface ListExpensesOpts {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  page?: number;
  limit?: number;
}

interface ListIncomeOpts {
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

interface ClassificationResult {
  category: string;
  confidence: number;
}

interface InsightsResult {
  insights: string;
}

const EXPENSE_CATEGORIES = [
  'rent', 'utilities', 'payroll', 'supplies', 'marketing',
  'insurance', 'taxes', 'equipment', 'software', 'travel',
  'meals', 'professional_services', 'other',
] as const;

type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export class AgentAccountingService {

  // ═══════════════════════════════════════════
  // EXPENSES
  // ═══════════════════════════════════════════

  async addExpense(clientId: string, data: AddExpenseData) {
    try {
      const expense = await prisma.agentExpense.create({
        data: {
          clientId,
          description: data.description,
          amount: data.amount,
          currency: 'USD',
          date: data.date,
          vendor: data.vendor ?? null,
          receiptUrl: data.receiptUrl ?? null,
          isRecurring: data.isRecurring ?? false,
          notes: data.notes ?? null,
        },
      });

      // Classify asynchronously — do not await
      this.classifyExpense(expense.id).catch((err) => {
        logger.error(`Async expense classification failed for ${expense.id}:`, err);
      });

      logger.info(`Expense added for client ${clientId}: $${data.amount} — ${data.description}`);
      return expense;
    } catch (error) {
      logger.error('Failed to add expense:', error);
      throw error;
    }
  }

  async classifyExpense(expenseId: string): Promise<ClassificationResult | null> {
    try {
      const expense = await prisma.agentExpense.findUnique({ where: { id: expenseId } });
      if (!expense) {
        logger.warn(`Expense ${expenseId} not found for classification`);
        return null;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a business expense classifier. Classify this expense into exactly one category:
rent, utilities, payroll, supplies, marketing, insurance, taxes, equipment, software, travel, meals, professional_services, other.

Expense: "${expense.description}" from vendor "${expense.vendor || 'unknown'}" for $${expense.amount}

Return JSON: {"category": "...", "confidence": 0.0-1.0}`,
            },
            { role: 'user', content: 'Classify this expense.' },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const result: ClassificationResult = JSON.parse(data.choices[0].message.content);

      // Validate category
      const validCategory = EXPENSE_CATEGORIES.includes(result.category as ExpenseCategory)
        ? result.category
        : 'other';

      const confidence = Math.max(0, Math.min(1, result.confidence));

      await prisma.agentExpense.update({
        where: { id: expenseId },
        data: {
          category: validCategory,
          categoryConfidence: confidence,
        },
      });

      logger.info(`Expense ${expenseId} classified as "${validCategory}" (confidence: ${confidence})`);
      return { category: validCategory, confidence };
    } catch (error) {
      logger.error(`Expense classification failed for ${expenseId}:`, error);
      return null;
    }
  }

  async listExpenses(clientId: string, opts: ListExpensesOpts = {}) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { clientId };
    if (opts.category) where.category = opts.category;
    if (opts.startDate || opts.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (opts.startDate) dateFilter.gte = opts.startDate;
      if (opts.endDate) dateFilter.lte = opts.endDate;
      where.date = dateFilter;
    }

    const [expenses, total] = await Promise.all([
      prisma.agentExpense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.agentExpense.count({ where }),
    ]);

    return {
      expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ═══════════════════════════════════════════
  // INCOME
  // ═══════════════════════════════════════════

  async addIncome(clientId: string, data: AddIncomeData) {
    try {
      const income = await prisma.agentIncome.create({
        data: {
          clientId,
          description: data.description,
          amount: data.amount,
          currency: 'USD',
          date: data.date,
          source: data.source ?? null,
        },
      });

      logger.info(`Income added for client ${clientId}: $${data.amount} — ${data.description}`);
      return income;
    } catch (error) {
      logger.error('Failed to add income:', error);
      throw error;
    }
  }

  async listIncome(clientId: string, opts: ListIncomeOpts = {}) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { clientId };
    if (opts.startDate || opts.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (opts.startDate) dateFilter.gte = opts.startDate;
      if (opts.endDate) dateFilter.lte = opts.endDate;
      where.date = dateFilter;
    }

    const [income, total] = await Promise.all([
      prisma.agentIncome.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.agentIncome.count({ where }),
    ]);

    return {
      income,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ═══════════════════════════════════════════
  // FINANCIAL SUMMARY
  // ═══════════════════════════════════════════

  async getFinancialSummary(clientId: string, startDate: Date, endDate: Date) {
    const [expenses, incomeRecords] = await Promise.all([
      prisma.agentExpense.findMany({
        where: { clientId, date: { gte: startDate, lte: endDate } },
        orderBy: { amount: 'desc' },
      }),
      prisma.agentIncome.findMany({
        where: { clientId, date: { gte: startDate, lte: endDate } },
      }),
    ]);

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalIncome = incomeRecords.reduce((sum, i) => sum + Number(i.amount), 0);
    const netProfit = totalIncome - totalExpenses;

    // Group expenses by category
    const expensesByCategory: Record<string, number> = {};
    for (const expense of expenses) {
      const cat = expense.category || 'uncategorized';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(expense.amount);
    }

    // Top 5 expenses
    const topExpenses = expenses.slice(0, 5).map((e) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      category: e.category,
      vendor: e.vendor,
      date: e.date,
    }));

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      expensesByCategory,
      topExpenses,
    };
  }

  async getExpensesByCategory(clientId: string, startDate: Date, endDate: Date) {
    const expenses = await prisma.agentExpense.findMany({
      where: { clientId, date: { gte: startDate, lte: endDate } },
    });

    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const categoryMap: Record<string, { total: number; count: number }> = {};
    for (const expense of expenses) {
      const cat = expense.category || 'uncategorized';
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0 };
      categoryMap[cat].total += Number(expense.amount);
      categoryMap[cat].count += 1;
    }

    const categories = Object.entries(categoryMap)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: totalAmount > 0 ? Math.round((data.total / totalAmount) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return { categories, totalAmount };
  }

  // ═══════════════════════════════════════════
  // MONTHLY REPORT GENERATION
  // ═══════════════════════════════════════════

  async generateMonthlyReport(clientId: string, year: number, month: number) {
    try {
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

      const summary = await this.getFinancialSummary(clientId, periodStart, periodEnd);

      // Fetch client info for context
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { businessName: true, businessType: true },
      });

      const businessName = client?.businessName || 'Unknown Business';
      const businessType = client?.businessType || 'general';

      // Generate AI insights
      const categorySummaryStr = Object.entries(summary.expensesByCategory)
        .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`)
        .join(', ');

      let aiInsights = '';
      try {
        aiInsights = await this.generateInsights({
          businessName,
          businessType,
          month,
          year,
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          netProfit: summary.netProfit,
          categorySummary: categorySummaryStr,
        });
      } catch (err) {
        logger.error(`AI insights generation failed for client ${clientId}:`, err);
        aiInsights = 'Insights unavailable for this period.';
      }

      const report = await prisma.agentFinancialReport.create({
        data: {
          clientId,
          reportType: 'monthly',
          periodStart,
          periodEnd,
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          netProfit: summary.netProfit,
          categorySummary: summary.expensesByCategory,
          aiInsights,
        },
      });

      logger.info(`Monthly report generated for client ${clientId}: ${month}/${year}`);
      return report;
    } catch (error) {
      logger.error(`Monthly report generation failed for client ${clientId}:`, error);
      throw error;
    }
  }

  private async generateInsights(params: {
    businessName: string;
    businessType: string;
    month: number;
    year: number;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    categorySummary: string;
  }): Promise<string> {
    // Use Claude for P&L insights
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Analyze this monthly P&L for a ${params.businessType || 'small business'} (${params.businessName}):
        Revenue: $${params.totalIncome.toFixed(2)}
        Expenses: $${params.totalExpenses.toFixed(2)}
        Net Profit: $${(params.totalIncome - params.totalExpenses).toFixed(2)}
        Top expense categories: ${params.categorySummary}

        Give 3 brief actionable insights in French. Be concise.`
        }],
      });

      const aiInsights = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return aiInsights;
    } catch (err) {
      logger.warn('Claude P&L insights generation failed, falling back to OpenAI:', err);

      // Fallback to OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a financial analyst for a small business. Based on this monthly financial data, provide 2-3 concise actionable insights in French.

Business: ${params.businessName} (${params.businessType})
Period: ${params.month}/${params.year}
Total Income: $${params.totalIncome.toFixed(2)}
Total Expenses: $${params.totalExpenses.toFixed(2)}
Net Profit: $${params.netProfit.toFixed(2)}
Expense breakdown: ${params.categorySummary}

Return JSON: {"insights": "..."}`,
            },
            { role: 'user', content: 'Generate financial insights for this period.' },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const result: InsightsResult = JSON.parse(data.choices[0].message.content);
      return result.insights;
    }
  }

  // ═══════════════════════════════════════════
  // CRON: PROCESS ALL MONTHLY REPORTS
  // ═══════════════════════════════════════════

  async processAllMonthlyReports(): Promise<void> {
    logger.info('Starting monthly report generation for all accounting clients...');

    const subscriptions = await prisma.agentSubscription.findMany({
      where: { accountingAi: true, status: 'active' },
      select: { clientId: true },
    });

    // Previous month
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() is 0-indexed
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    let generated = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await this.generateMonthlyReport(sub.clientId, prevYear, prevMonth);
        generated++;
      } catch (error) {
        logger.error(`Monthly report failed for client ${sub.clientId}:`, error);
        failed++;
      }
    }

    logger.info(`Monthly reports complete: ${generated} generated, ${failed} failed out of ${subscriptions.length} clients`);
  }

  // ═══════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════

  async listReports(clientId: string) {
    return prisma.agentFinancialReport.findMany({
      where: { clientId },
      orderBy: { periodStart: 'desc' },
    });
  }
}

export const agentAccountingService = new AgentAccountingService();
