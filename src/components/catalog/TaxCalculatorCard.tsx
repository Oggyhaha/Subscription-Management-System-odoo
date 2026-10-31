"use client";

import * as React from "react";
import { TaxService } from "@/server/services/tax";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyText } from "@/components/shared/MoneyText";
import { Calculator } from "lucide-react";

export function TaxCalculatorCard() {
  const [amount, setAmount] = React.useState("100.00");
  const [rate, setRate] = React.useState("10.00");
  const [isInclusive, setIsInclusive] = React.useState(false);

  const result = React.useMemo(() => {
    try {
      return TaxService.calculateTax(amount || "0", {
        rate: rate || "0",
        isInclusive,
      });
    } catch {
      return null;
    }
  }, [amount, rate, isInclusive]);

  return (
    <Card className="border-rule">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-semibold">Live Tax Simulator</CardTitle>
        </div>
        <CardDescription>
          Verify Decimal precision and rounding policy for exclusive vs inclusive tax configurations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Amount ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tax Rate (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Mode</Label>
            <div className="flex items-center gap-2 pt-1.5">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInclusive}
                  onChange={(e) => setIsInclusive(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-ring"
                />
                <span>Inclusive</span>
              </label>
            </div>
          </div>
        </div>

        {result && (
          <div className="rounded-md bg-paper-3/60 p-3 border border-rule grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Taxable Base</span>
              <MoneyText amount={result.taxableAmount} className="text-sm font-semibold" />
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Calculated Tax</span>
              <MoneyText amount={result.taxAmount} className="text-sm font-semibold text-primary" />
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Gross Total</span>
              <MoneyText amount={result.totalWithTax} className="text-sm font-bold text-foreground" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

