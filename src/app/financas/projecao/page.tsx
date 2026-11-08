import { FinanceProjection } from "@/components/finance-projection";
import { loadFinanceData } from "@/lib/finance-page-data";
import { toAmount } from "@/lib/subscription-billing";

export default async function FinanceProjecaoPage() {
  const { today, settings, startingCash, charges, bills, overdueIncome, projectReceivable } =
    await loadFinanceData();

  return (
    <FinanceProjection
      today={today}
      startingCash={startingCash}
      reserve={settings ? toAmount(settings.reserve_amount) : 0}
      balanceOn={settings?.balance_on ?? null}
      hasBalance={Boolean(settings)}
      charges={charges}
      bills={bills}
      overdueIncome={overdueIncome}
      projectReceivable={projectReceivable}
    />
  );
}
