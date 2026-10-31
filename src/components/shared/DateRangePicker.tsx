"use client";

import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  className?: string;
  placeholder?: string;
}

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = "Pick a date range",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const applyPreset = (preset: "today" | "last7" | "last30" | "thisMonth") => {
    const today = new Date();
    let from = today;
    let to = today;

    if (preset === "last7") {
      from = subDays(today, 7);
    } else if (preset === "last30") {
      from = subDays(today, 30);
    } else if (preset === "thisMonth") {
      from = startOfMonth(today);
      to = endOfMonth(today);
    }

    onChange?.({ from, to });
    setOpen(false);
  };

  const displayText = () => {
    if (!value?.from) return placeholder;
    if (!value?.to) return format(value.from, "LLL dd, y");
    return `${format(value.from, "LLL dd, y")} - ${format(value.to, "LLL dd, y")}`;
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "h-9 justify-start text-left font-normal border-rule",
              !value?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="text-xs">{displayText()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex gap-2 mb-3 pb-2 border-b border-rule">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => applyPreset("today")}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => applyPreset("last7")}
            >
              Last 7d
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => applyPreset("last30")}
            >
              Last 30d
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => applyPreset("thisMonth")}
            >
              This month
            </Button>
          </div>
          <Calendar
            selected={value?.from}
            onSelect={(date) => {
              if (!value?.from || (value?.from && value?.to)) {
                onChange?.({ from: date, to: undefined });
              } else {
                if (date < value.from) {
                  onChange?.({ from: date, to: value.from });
                } else {
                  onChange?.({ from: value.from, to: date });
                }
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

